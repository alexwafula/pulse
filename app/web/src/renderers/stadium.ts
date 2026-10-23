import * as THREE from "three";
import { createAnnotations } from "./annotations";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCharacterFactory, poseCharacter } from "./characters";
import { kitColours, type CameraMode, type ControlField, type PitchRenderer, type RenderPlayer, type SceneState } from "./types";

export function createStadium(host: HTMLElement, players: RenderPlayer[]): PitchRenderer {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x142c21);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute("role","img");
  renderer.domElement.setAttribute("aria-label","Football stadium with articulated players and a textured ball");
  Object.assign(renderer.domElement.dataset, { presentation: "stadium", teamColours: kitColours(players) });
  const perspective = new THREE.PerspectiveCamera(34,1,.5,600);
  const plan = new THREE.OrthographicCamera(-59,59,39,-39,.5,600);
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspective;
  const controls = new OrbitControls<THREE.PerspectiveCamera | THREE.OrthographicCamera>(camera,renderer.domElement);
  controls.enableDamping = true; controls.enablePan = false;
  controls.minDistance = 18; controls.maxDistance = 190;
  controls.minPolarAngle = .15; controls.maxPolarAngle = Math.PI/2.15;
  scene.add(new THREE.HemisphereLight(0xe8f2ff,0x294e34,1.45));
  const sun = new THREE.DirectionalLight(0xfff4df,2.3); sun.position.set(-35,90,55); sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048); sun.shadow.bias = -.0005;
  Object.assign(sun.shadow.camera,{ left:-80,right:80,top:65,bottom:-65,near:10,far:180 });
  sun.shadow.camera.updateProjectionMatrix(); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc6e7ff,.5); fill.position.set(50,35,-60); scene.add(fill);
  const textures: THREE.Texture[] = [];
  const material = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color,roughness:.9 });
  function box(w: number,h: number,d: number,mat: THREE.Material,x: number,y: number,z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); mesh.position.set(x,y,z); mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  box(260,.1,220,material(0x153522),0,-.12,0);

  // The supplied stadium's painted turf, tiers and instanced crowd, made seeded.
  const turfCanvas = document.createElement("canvas"); turfCanvas.width = 2048; turfCanvas.height = 1326;
  const ctx = turfCanvas.getContext("2d")!;
  for (let i=0;i<14;i++) { ctx.fillStyle = i%2 ? "#37a565" : "#32965b"; ctx.fillRect(i*2048/14,0,2048/14+1,1326); }
  for (let i=0;i<18000;i++) {
    const x = (i*7919)%2048, y = (i*3571)%1326;
    ctx.fillStyle = i%2 ? "rgba(0,0,0,.045)" : "rgba(255,255,255,.035)"; ctx.fillRect(x,y,2,3);
  }
  const turfTexture = new THREE.CanvasTexture(turfCanvas); turfTexture.colorSpace = THREE.SRGBColorSpace;
  turfTexture.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy()); textures.push(turfTexture);
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(113,76),new THREE.MeshStandardMaterial({ map:turfTexture,roughness:1 }));
  turf.rotation.x = -Math.PI/2; turf.receiveShadow = true; scene.add(turf);
  const standMat = material(0x33453d), railMat = material(0x82958a);
  const seats: [number,number,number][] = [];
  for (const axis of ["x","z"]) for (const side of [-1,1]) for (let tier=0;tier<7;tier++) {
    const length = axis === "x" ? 146 : 96;
    const offset = (axis === "x" ? 42 : 61)+tier*2.2;
    const height = 1.5*(tier+1);
    box(axis === "x" ? length : 2.2,height,axis === "x" ? 2.2 : length,standMat,axis === "x" ? 0 : side*offset,height/2,axis === "x" ? side*offset : 0);
    box(axis === "x" ? length : .15,.15,axis === "x" ? .15 : length,railMat,axis === "x" ? 0 : side*(offset-1),height+.1,axis === "x" ? side*(offset-1) : 0);
    for (let column=0;column<Math.floor(length/1.35);column++) if ((column+tier)%7 !== 0) {
      const along = -length/2+1+column*1.35;
      seats.push(axis === "x" ? [along,height+.5,side*offset] : [side*offset,height+.5,along]);
    }
  }
  const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(.75,1,.6),new THREE.MeshLambertMaterial(),seats.length);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const palette = [0xe9614f,0x269ab7,0xe7eee8,0x33483e,0xc9a27e,0x809d91];
  seats.forEach(([x,y,z],i) => {
    dummy.position.set(x,y,z); dummy.scale.set(1,.8+(i%5)*.08,1); dummy.updateMatrix(); crowd.setMatrixAt(i,dummy.matrix);
    color.setHex(palette[(i*7+Math.floor(i/9))%palette.length]); crowd.setColorAt(i,color);
  }); scene.add(crowd);
  for (const x of [-78,78]) for (const z of [-62,62]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.45,.65,40,8),material(0x50665a)); pole.position.set(x,20,z); scene.add(pole);
    box(8,3,1,new THREE.MeshBasicMaterial({ color:0xfff4d9 }),x,40,z).lookAt(0,0,0);
  }
  const lineMat = new THREE.LineBasicMaterial({ color:0xf1f7eb });
  function line(points: [number,number][]): void {
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x,y]) => new THREE.Vector3(x-52.5,.06,34-y))),lineMat));
  }
  function rect(x: number,y: number,w: number,h: number): void { line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]); }
  rect(0,0,105,68); line([[52.5,0],[52.5,68]]);
  rect(0,13.84,16.5,40.32); rect(88.5,13.84,16.5,40.32);
  rect(0,24.84,5.5,18.32); rect(99.5,24.84,5.5,18.32);
  line(Array.from({ length:65 },(_,i) => [52.5+9.15*Math.cos(i/64*Math.PI*2),34+9.15*Math.sin(i/64*Math.PI*2)]));
  for (const side of [-1,1]) {
    const goalX = side*52.5;
    const postMat = material(0xffffff);
    for (const z of [-3.66,3.66]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.44,10),postMat); post.position.set(goalX,1.22,z); scene.add(post);
    }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,7.32,10),postMat); bar.rotation.x = Math.PI/2; bar.position.set(goalX,2.44,0); scene.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2.6,2.44,7.32,5,6,14),new THREE.MeshBasicMaterial({ color:0xffffff,wireframe:true,transparent:true,opacity:.3 }));
    net.position.set(goalX+side*1.3,1.22,0); scene.add(net);
    const penaltyX = side < 0 ? 11 : 94;
    const angle = Math.acos(5.5/9.15);
    line(Array.from({ length:25 },(_,i) => {
      const a = (side < 0 ? -angle : Math.PI-angle)+i/24*angle*2;
      return [penaltyX+9.15*Math.cos(a),34+9.15*Math.sin(a)];
    }));
  }
  const createCharacter = createCharacterFactory(textures);
  const sideColour = (home: boolean): string => players.find(player => player.home === home)?.colour || (home ? "#f47761" : "#48bed3");
  const controlColours = [sideColour(true), sideColour(false)];
  const contactMaterial=new THREE.MeshBasicMaterial({color:0x102818,transparent:true,opacity:.22,depthWrite:false});
  const contactGeometry=new THREE.CircleGeometry(.36,16);
  const contacts=new Map(players.map(player=>{const shadow=new THREE.Mesh(contactGeometry,contactMaterial); shadow.rotation.x=-Math.PI/2; shadow.position.y=.015; scene.add(shadow); return [player.id,shadow];}));
  const characters = new Map(players.map(player => { const character = createCharacter(player); scene.add(character.root); return [player.id,character]; }));
  const ballCanvas = document.createElement("canvas"); ballCanvas.width = 256; ballCanvas.height = 128;
  const bc = ballCanvas.getContext("2d")!; bc.fillStyle = "#f5f5ef"; bc.fillRect(0,0,256,128);
  bc.fillStyle = "#17251e";
  for (const [x,y] of [[32,28],[95,76],[160,28],[223,78],[63,118],[193,118],[127,5]]) {
    bc.beginPath(); for (let i=0;i<5;i++) { const a=i*Math.PI*2/5; const px=x+14*Math.cos(a), py=y+14*Math.sin(a); if (i===0) bc.moveTo(px,py); else bc.lineTo(px,py); } bc.closePath(); bc.fill();
  }
  const ballTexture = new THREE.CanvasTexture(ballCanvas); ballTexture.colorSpace = THREE.SRGBColorSpace; textures.push(ballTexture);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.11,24,18),new THREE.MeshStandardMaterial({ map:ballTexture,roughness:.55 })); ball.castShadow = true; scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.21,24),new THREE.MeshBasicMaterial({ color:0x09180f,transparent:true,opacity:.3,depthWrite:false }));
  ballShadow.rotation.x = -Math.PI/2; ballShadow.position.y = .025; scene.add(ballShadow);
  // A restrained ground locator keeps a regulation-sized ball readable at broadcast distance.
  const ballLocator = new THREE.Mesh(new THREE.RingGeometry(.28,.36,24),new THREE.MeshBasicMaterial({ color:0xfff3b0,transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide }));
  ballLocator.rotation.x=-Math.PI/2; scene.add(ballLocator);
  const selectedRing = new THREE.Mesh(new THREE.RingGeometry(.9,1.08,36),new THREE.MeshBasicMaterial({ color:0xffe9a1,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide }));
  selectedRing.rotation.x = -Math.PI/2; selectedRing.position.y = .07; selectedRing.visible = false; scene.add(selectedRing);
  const tag = document.createElement("div"); tag.className = "stadium-player-tag"; tag.hidden = true; tag.setAttribute("aria-hidden","true"); host.append(tag);
  const field = new THREE.Group(); scene.add(field);
  const cells: THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[] = [];
  let lastControl: ControlField | undefined;
  const pathGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const path = new THREE.Line(pathGeometry,new THREE.LineDashedMaterial({ color:0xffefb1,dashSize:1.2,gapSize:.7,transparent:true,opacity:.8 })); scene.add(path);
  const updateAnnotations = createAnnotations(scene);
  let mode: CameraMode = "broadcast", state: SceneState | undefined, followCamera = true;
  controls.addEventListener("start",() => { followCamera = false; controls.enableDamping=true; });

  function frameCamera(): void {
    if (!followCamera) return;
    camera=mode==="tactical"?plan:perspective;
    controls.object=camera;
    controls.minPolarAngle=mode==="tactical"?.001:.15;
    const focus=state?.cameraFocus;
    const x=(focus?.x??52.5)-52.5, z=34-(focus?.y??34);
    if (mode === "tactical") {
      // Near-plan view: complete team shape, with almost no perspective foreshortening.
      camera.position.set(0,130,.01); controls.target.set(0,0,0);
      const halfHeight=Math.max(39,59/Math.max(.4,perspective.aspect));
      plan.top=halfHeight; plan.bottom=-halfHeight; plan.left=-halfHeight*perspective.aspect; plan.right=halfHeight*perspective.aspect;
    } else if (mode === "follow") {
      camera.position.set(x-3,15,z+23); controls.target.set(x,0,z-2); perspective.fov=50;
    } else {
      const spread=focus?.spread??27;
      const targetX=Math.max(-37,Math.min(37,x*.86));
      const targetZ=Math.max(-19,Math.min(19,z*.65));
      camera.position.set(targetX*.96,25+spread*.24,targetZ+43);
      controls.target.set(targetX,0,targetZ); perspective.fov=47;
    }
    if(mode!=="tactical" && perspective.aspect<1.3) perspective.fov+=10;
    // Automatic cameras must land on exactly the same pose after pause/rewind.
    controls.enableDamping=false;
    camera.updateProjectionMatrix(); controls.update();
  }
  function restoreAutomatic(): void {
    // Consume manual damping before setting the exact replay-derived camera pose.
    controls.enableDamping=false; controls.update();
    followCamera=true; plan.zoom=1; perspective.zoom=1; frameCamera();
  }
  function resize(): void {
    const width = Math.max(1,host.clientWidth), height = Math.max(1,host.clientHeight);
    renderer.setSize(width,height); perspective.aspect = width/height; frameCamera(); camera.updateProjectionMatrix();
  }
  function positionTag(): void {
    const actor = state?.selectedPlayer ? characters.get(state.selectedPlayer) : undefined;
    const player = players.find(item => item.id === state?.selectedPlayer);
    selectedRing.visible = !!actor; tag.hidden = !actor;
    if (!actor || !player) return;
    selectedRing.position.set(actor.root.position.x,.07,actor.root.position.z);
    const position = actor.root.position.clone(); position.y = 2.5; position.project(camera);
    if (position.z < -1 || position.z > 1 || Math.abs(position.x) > 1 || Math.abs(position.y) > 1) { tag.hidden = true; return; }
    const width = host.clientWidth, height = host.clientHeight;
    const x = Math.max(64,Math.min(width-64,(position.x+1)/2*width));
    let y = Math.max(88,Math.min(height-55,(1-position.y)/2*height));
    if (x < 205 && y < 108) y = 108;
    tag.style.left = `${x}px`; tag.style.top = `${y}px`; tag.textContent = `${player.number} ${player.name}`; tag.dataset.playerId = player.id;
  }
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  return {
    update(next) {
      state = next;
      updateAnnotations(next);
      for (const [id,point] of next.players) {
        const character = characters.get(id); if (!character) continue;
        character.root.position.set(point.x-52.5,0,34-point.y);
        contacts.get(id)?.position.set(point.x-52.5,.015,34-point.y);
        poseCharacter(character,next.timeMs ?? 0,next.velocities?.get(id) ?? { x:0,y:0 },{ x:next.ball.x-point.x,y:next.ball.y-point.y },next.motion?.get(id));
      }
      ball.position.set(next.ball.x-52.5,.11+(next.ball.z ?? 0),34-next.ball.y);
      ball.rotation.set((34-next.ball.y)/.11,0,-(next.ball.x-52.5)/.11);
      ballLocator.position.set(ball.position.x,.03,ball.position.z);
      ballLocator.visible=(next.ball.z??0)<.5;
      ballShadow.material.opacity=.3/(1+(next.ball.z??0)*.4);
      ballShadow.position.set(ball.position.x,.025,ball.position.z);
      ballShadow.scale.setScalar(1+(next.ball.z ?? 0)*.1);
      if (next.control !== lastControl) {
        field.visible = !!next.control;
        if (next.control) {
          const grid = next.control;
          if (cells.length !== grid.values.length) {
            for (const cell of cells) { cell.geometry.dispose(); cell.material.dispose(); } field.clear(); cells.length = 0;
            for (let row=0;row<grid.rows;row++) for (let col=0;col<grid.cols;col++) {
              const cell = new THREE.Mesh(new THREE.PlaneGeometry(105/grid.cols,68/grid.rows),new THREE.MeshBasicMaterial({ transparent:true,depthWrite:false }));
              cell.rotation.x = -Math.PI/2; cell.position.set((col+.5)*105/grid.cols-52.5,.03,34-(row+.5)*68/grid.rows); field.add(cell); cells.push(cell);
            }
          }
          cells.forEach((cell,index) => { const value = grid.values[index]; cell.material.color.set((value >= .5) === grid.homeTeamGrid ? controlColours[0] : controlColours[1]); cell.material.opacity = Math.abs(value-.5)*.55; });
        }
        lastControl = next.control;
      }
      path.visible = !!next.path;
      if (next.path) {
        const vertices = pathGeometry.attributes.position as THREE.BufferAttribute;
        vertices.setXYZ(0,next.path.from.x-52.5,.16,34-next.path.from.y); vertices.setXYZ(1,next.path.to.x-52.5,.16,34-next.path.to.y);
        vertices.needsUpdate = true; pathGeometry.computeBoundingSphere(); path.computeLineDistances();
      }
      frameCamera(); positionTag();
      renderer.domElement.dataset.cameraMode=mode;
      renderer.domElement.dataset.ballScreen=JSON.stringify(ball.position.clone().project(camera).toArray());
      renderer.domElement.dataset.cameraPose=JSON.stringify([...camera.position.toArray(),...controls.target.toArray(),mode==="tactical"?plan.top:perspective.fov]);
    },
    draw() { const moving = controls.update(); positionTag(); renderer.render(scene,camera); return moving; },
    resetCamera() { restoreAutomatic(); },
    setCamera(value) { mode = value; restoreAutomatic(); },
    destroy() {
      observer.disconnect(); controls.dispose(); tag.remove();
      const geometry = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometry.add(object.geometry);
          for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
        }
      });
      geometry.forEach(item => item.dispose()); materials.forEach(item => item.dispose()); textures.forEach(item => item.dispose());
      crowd.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
