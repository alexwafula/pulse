import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PitchRenderer, RenderPlayer, SceneState } from "./types";

export function createThree(host: HTMLElement, players: RenderPlayer[]): PitchRenderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14241f);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional football pitch");
  renderer.domElement.setAttribute("role", "img");
  const camera = new THREE.OrthographicCamera(-70, 70, 50, -50, .1, 500);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minPolarAngle = .15;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.minZoom = .75;
  controls.maxZoom = 2.5;
  const ambient = new THREE.HemisphereLight(0xf3f9f5, 0x183e24, 2.1);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff5e5, 2.5);
  sun.position.set(-30, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 50, bottom: -50, far: 150 });
  sun.shadow.bias = -.0005;
  scene.add(sun);

  function box(width: number, height: number, depth: number, color: number, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  box(126, .5, 88, 0x1b4735, 0, -.4, 0);
  for (let i = 0; i < 10; i++) box(10.5, .12, 68, i % 2 ? 0x327652 : 0x2b6948, -47.25 + i * 10.5, -.06, 0);
  const markings = new THREE.Group();
  scene.add(markings);
  const white = new THREE.LineBasicMaterial({ color: 0xe7efe2 });
  function line(points: [number, number][]): void {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x - 52.5, .04, 34 - y)));
    markings.add(new THREE.Line(geometry, white));
  }
  function rect(x: number, y: number, w: number, h: number): void {
    line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
  }
  rect(0,0,105,68); line([[52.5,0],[52.5,68]]);
  rect(0,13.84,16.5,40.32); rect(88.5,13.84,16.5,40.32);
  rect(0,24.84,5.5,18.32); rect(99.5,24.84,5.5,18.32);
  line(Array.from({ length: 65 }, (_, i) => [52.5 + 9.15 * Math.cos(i / 64 * Math.PI * 2), 34 + 9.15 * Math.sin(i / 64 * Math.PI * 2)]));
  for (const side of [-1, 1]) {
    const x = side * 52.5;
    for (const z of [-3.66,3.66]) box(.18, 2.44, .18, 0xe9f1ed, x, 1.22, z);
    box(.18, .18, 7.5, 0xe9f1ed, x, 2.44, 0);
    box(2, .08, 7.5, 0xa1baa3, x + side, .03, 0);
    for (let z = -3.66; z <= 3.66; z += .6) {
      box(.04, 2.4, .04, 0x7b9985, x + side * 2, 1.2, z);
    }
  }
  const playerObjects = new Map<string, THREE.Group>();
  const textures: THREE.Texture[] = [];
  for (const player of players) {
    const group = new THREE.Group();
    const kit = new THREE.MeshStandardMaterial({ color: player.home ? 0xf47761 : 0x48bed3, roughness: .65 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.52, .8, 4, 8), kit);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 8), new THREE.MeshStandardMaterial({ color: 0xefc49f }));
    head.position.y = 2.05;
    head.castShadow = true;
    group.add(head);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.45, 32), new THREE.MeshBasicMaterial({ color: player.home ? 0xf47761 : 0x48bed3, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = .07;
    group.add(ring);
    const canvas = document.createElement("canvas");
    canvas.width = 96; canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = player.home ? "#f47761" : "#48bed3";
    ctx.beginPath(); ctx.arc(48,48,41,0,Math.PI*2); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.fillStyle = "#17231f"; ctx.font = "bold 44px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(player.number), 48, 50);
    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    label.position.y = 4.5; label.scale.set(4.5,4.5,1);
    group.add(label);
    scene.add(group); playerObjects.set(player.id, group);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.48, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff6de, roughness: .5 }));
  ball.castShadow = true; scene.add(ball);
  const pathGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const path = new THREE.Line(pathGeometry, new THREE.LineDashedMaterial({ color: 0xe3f39a, dashSize: 1.4, gapSize: .75 }));
  scene.add(path);
  const reset = (): void => {
    camera.position.set(35, 85, 95); camera.zoom = 1;
    controls.target.set(0,0,0); controls.update();
  };
  const resize = (): void => {
    const width = host.clientWidth, height = host.clientHeight;
    renderer.setSize(width, height);
    const aspect = width / Math.max(height, 1);
    const extent = Math.max(38, 64 / aspect);
    camera.left = -extent * aspect; camera.right = extent * aspect;
    camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host); reset(); resize();
  return {
    update(state: SceneState) {
      for (const [id, point] of state.players) playerObjects.get(id)?.position.set(point.x - 52.5, 0, 34 - point.y);
      ball.position.set(state.ball.x - 52.5, .48 + (state.ball.z ?? 0), 34 - state.ball.y);
      path.visible = !!state.path;
      if (state.path) {
        const { from, to } = state.path;
        const positions = pathGeometry.attributes.position as THREE.BufferAttribute;
        positions.setXYZ(0, from.x - 52.5, .15, 34 - from.y);
        positions.setXYZ(1, to.x - 52.5, .15, 34 - to.y);
        positions.needsUpdate = true; pathGeometry.computeBoundingSphere(); path.computeLineDistances();
      }
    },
    draw() { controls.update(); renderer.render(scene, camera); },
    resetCamera() { reset(); },
    destroy() {
      observer.disconnect(); controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
          if ("geometry" in object) object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
