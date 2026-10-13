import * as THREE from "three";
import type { RenderPlayer } from "./types";

export type Character = {
  root: THREE.Group;
  body: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  hips: THREE.Group[];
  knees: THREE.Group[];
  shoulders: THREE.Group[];
  elbows: THREE.Group[];
  phase: number;
};

export function avatarSeed(id: string): number {
  let value = 0;
  for (const character of id) value = (value * 31 + character.charCodeAt(0)) >>> 0;
  return value;
}

// Adapted from the supplied Matchlens character construction. Avatars are
// visual styling, not biographical attributes or another football simulator.
export function createCharacterFactory(textures: THREE.Texture[]): (player: RenderPlayer) => Character {
  const lathe = (points: [number, number][], segments = 16): THREE.LatheGeometry =>
    new THREE.LatheGeometry(points.map(([radius, height]) => new THREE.Vector2(radius, height)), segments);
  const torsoProfile: [number, number][] = [[0,1.02],[.15,1.03],[.158,1.12],[.172,1.24],[.198,1.36],[.214,1.46],[.205,1.53],[.15,1.59],[.075,1.625],[0,1.63]];
  const geometry = {
    torso: lathe(torsoProfile, 20),
    shorts: lathe([[0,1.07],[.162,1.07],[.178,1],[.19,.9],[0,.9]], 18),
    thigh: lathe([[0,.02],[.084,0],[.09,-.1],[.083,-.26],[.064,-.42],[0,-.46]], 12),
    shin: lathe([[0,.02],[.058,0],[.068,-.11],[.061,-.25],[.044,-.39],[0,-.42]], 12),
    sleeve: lathe([[0,.03],[.078,.02],[.074,-.12],[.066,-.2],[0,-.2]], 12),
    forearm: lathe([[0,.01],[.048,0],[.046,-.11],[.035,-.24],[0,-.25]], 10),
    shortLeg: new THREE.CylinderGeometry(.1,.108,.2,12),
    sockBand: new THREE.CylinderGeometry(.06,.06,.035,12),
    upperArm: new THREE.CylinderGeometry(.05,.047,.13,10),
    boot: new THREE.SphereGeometry(.06,12,8),
    sole: new THREE.BoxGeometry(.1,.018,.27),
    hand: new THREE.SphereGeometry(.045,10,8),
    neck: new THREE.CylinderGeometry(.052,.062,.12,10),
    head: new THREE.SphereGeometry(.118,20,16),
    jaw: new THREE.SphereGeometry(.092,16,12),
    ear: new THREE.SphereGeometry(.024,8,6),
    nose: new THREE.ConeGeometry(.017,.05,6),
    eye: new THREE.SphereGeometry(.012,8,6),
    hair: new THREE.SphereGeometry(.126,18,10,0,Math.PI*2,0,Math.PI*.52),
    curls: new THREE.SphereGeometry(.155,16,12),
    bun: new THREE.SphereGeometry(.048,10,8),
    collar: new THREE.TorusGeometry(.07,.013,6,18),
  };
  const material = (color: THREE.ColorRepresentation, roughness = .75): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const eyes = material(0x191714);
  const sole = material(0xd7ddd8);

  function shirtTexture(player: RenderPlayer): THREE.CanvasTexture {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = player.home ? "#d9485f" : "#3a7fd5"; ctx.fillRect(0,0,512,256);
    ctx.fillStyle = player.home ? "#fff" : "#bce8f1";
    if (player.home) { ctx.fillRect(115,0,20,256); ctx.fillRect(377,0,20,256); }
    else ctx.fillRect(0,83,512,25);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 22px Arial"; ctx.fillText(player.name.toUpperCase(),256,56,200);
    ctx.font = "bold 72px Arial"; ctx.fillText(String(player.number),256,130);
    ctx.font = "bold 28px Arial"; ctx.fillText(String(player.number),482,78);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture); return texture;
  }

  return player => {
    const seed = avatarSeed(player.id);
    const skins = [0x6b4129,0x8a5634,0xb07a4f,0xd39d72,0xe9c09a,0xf1cfae];
    const hairs = [0x120d0a,0x2a1b12,0x3f2a1b,0x6a4628];
    const kit = material(player.home ? 0xd9485f : 0x3a7fd5);
    const shorts = material(player.home ? 0xf3f4f2 : 0x142f3c);
    const socks = material(player.home ? 0xd9485f : 0x142f3c);
    const skin = material(skins[seed % skins.length], .62);
    const hair = material(hairs[(seed >>> 3) % hairs.length]);
    const boots = material([0x141615,0xf1ede4,0xe75e36,0xe6bf30][(seed >>> 5) % 4], .4);
    const trim = material(0xf4f5ef);
    const shirt = new THREE.MeshStandardMaterial({ map: shirtTexture(player), roughness: .72 });
    const root = new THREE.Group(), body = new THREE.Group(), chest = new THREE.Group();
    root.name = `player:${player.id}`; root.scale.setScalar(1.9); root.add(body); body.add(chest);
    const hips: THREE.Group[] = [], knees: THREE.Group[] = [], shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [];
    function mesh(shape: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, position: [number,number,number] = [0,0,0], scale: [number,number,number] = [1,1,1]): THREE.Mesh {
      const part = new THREE.Mesh(shape,mat); part.position.set(...position); part.scale.set(...scale); part.castShadow = true; parent.add(part); return part;
    }
    mesh(geometry.shorts,shorts,body,[0,0,0],[1,1,.74]);
    for (const side of [-1,1]) {
      const hip = new THREE.Group(); hip.position.set(side*.095,.94,0); body.add(hip);
      mesh(geometry.shortLeg,shorts,hip,[0,-.07,0]); mesh(geometry.thigh,skin,hip,[0,-.02,0]);
      const knee = new THREE.Group(); knee.position.y = -.46; hip.add(knee);
      mesh(geometry.shin,socks,knee); mesh(geometry.sockBand,trim,knee,[0,-.03,0]);
      mesh(geometry.boot,boots,knee,[0,-.43,.045],[1.05,.72,2.3]); mesh(geometry.sole,sole,knee,[0,-.475,.045]);
      hips.push(hip); knees.push(knee);
      const shoulder = new THREE.Group(); shoulder.position.set(side*.235,1.5,0); chest.add(shoulder);
      mesh(geometry.sleeve,kit,shoulder); mesh(geometry.upperArm,skin,shoulder,[0,-.24,0]);
      const elbow = new THREE.Group(); elbow.position.y = -.3; shoulder.add(elbow);
      mesh(geometry.forearm,skin,elbow); mesh(geometry.hand,skin,elbow,[0,-.28,.01],[.8,1.2,.6]);
      shoulders.push(shoulder); elbows.push(elbow);
    }
    mesh(geometry.torso,shirt,chest,[0,0,0],[1,1,.7]);
    mesh(geometry.collar,trim,chest,[0,1.6,0],[1,1,.85]).rotation.x = Math.PI/2;
    mesh(geometry.neck,skin,chest,[0,1.66,0]);
    const head = new THREE.Group(); head.position.y = 1.79; chest.add(head);
    mesh(geometry.head,skin,head,[0,0,0],[.92,1.08,1]); mesh(geometry.jaw,skin,head,[0,-.055,.022],[.9,.8,.92]);
    mesh(geometry.ear,skin,head,[-.108,0,0]); mesh(geometry.ear,skin,head,[.108,0,0]);
    mesh(geometry.nose,skin,head,[0,-.012,.118]).rotation.x = Math.PI/2;
    mesh(geometry.eye,eyes,head,[-.038,.02,.104]); mesh(geometry.eye,eyes,head,[.038,.02,.104]);
    if (seed % 3 === 0) mesh(geometry.curls,hair,head,[0,.05,-.01],[1,.86,1]);
    else mesh(geometry.hair,hair,head,[0,.012,-.004],[.96,1.06,1.06]);
    if (seed % 4 === 0) mesh(geometry.bun,hair,head,[0,.09,-.1]);
    return { root, body, chest, head, hips, knees, shoulders, elbows, phase: seed % 100 / 10 };
  };
}

export function poseCharacter(character: Character, timeMs: number, velocity: { x: number; y: number }, toBall: { x: number; y: number }): void {
  const speed = Math.hypot(velocity.x,velocity.y);
  const amount = Math.min(1,speed/6.5);
  const phase = amount > 0 ? timeMs/1000*8 + character.phase : character.phase;
  const heading = speed > .15 ? Math.atan2(velocity.x,-velocity.y) : Math.atan2(toBall.x,-toBall.y);
  character.root.rotation.y = heading;
  character.hips.forEach((hip,index) => {
    const wave = Math.sin(phase+index*Math.PI);
    hip.rotation.x = -wave*.7*amount - (1-amount)*.06;
    character.knees[index].rotation.x = Math.max(0,-Math.cos(phase+index*Math.PI))*1.3*amount + .16;
    character.shoulders[index].rotation.x = wave*.65*amount;
    character.shoulders[index].rotation.z = (index ? -1 : 1)*.12;
    character.elbows[index].rotation.x = -(.25+.95*amount);
  });
  character.body.rotation.x = .1*amount;
  character.body.position.y = Math.abs(Math.cos(phase))*.045*amount;
  character.chest.rotation.y = -Math.sin(phase)*.12*amount;
  const ballHeading = Math.atan2(toBall.x,-toBall.y) - heading;
  character.head.rotation.y = Math.max(-.8,Math.min(.8,Math.atan2(Math.sin(ballHeading),Math.cos(ballHeading))));
}
