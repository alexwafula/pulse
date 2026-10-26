import assert from "node:assert/strict";
import vm from "node:vm";
import { build } from "esbuild";
import * as THREE from "three";

const compiled = await build({ entryPoints:["app/web/src/renderers/characters.ts"],bundle:true,platform:"node",format:"cjs",write:false,external:["three"] });
const module = { exports:{} };
vm.runInNewContext(compiled.outputFiles[0].text,{ module,exports:module.exports,require:specifier => { assert.equal(specifier,"three"); return THREE; } });
const { poseCharacter, avatarSeed } = module.exports;
const character = { root:new THREE.Group(),body:new THREE.Group(),chest:new THREE.Group(),head:new THREE.Group(),hips:[new THREE.Group(),new THREE.Group()],knees:[new THREE.Group(),new THREE.Group()],shoulders:[new THREE.Group(),new THREE.Group()],elbows:[new THREE.Group(),new THREE.Group()],phase:2.4 };
const joints = [character.root,character.body,character.chest,character.head,...character.hips,...character.knees,...character.shoulders,...character.elbows];
const snapshot = () => joints.map(joint => [...joint.rotation.toArray(),...joint.position.toArray()]);
character.root.position.set(12,0,-5);
poseCharacter(character,1234000,{x:4,y:0},{x:8,y:2});
const first = snapshot();
assert.equal(character.root.rotation.y,Math.PI/2,"positive X motion must face along world X");
poseCharacter(character,1234500,{x:4,y:0},{x:8,y:2});
assert.notDeepEqual(snapshot(),first,"recorded motion must animate the limbs");
poseCharacter(character,1234000,{x:4,y:0},{x:8,y:2});
assert.deepEqual(snapshot(),first,"pose must reproduce exactly when rewinding");
poseCharacter(character,1234000,{x:4,y:0},{x:8,y:2});
assert.deepEqual(snapshot(),first,"pose must freeze at a paused match clock");
poseCharacter(character,1234000,{x:0,y:4},{x:0,y:8});
assert.equal(Math.abs(character.root.rotation.y),Math.PI,"bottom-left pitch Y must face world minus Z");
poseCharacter(character,1234000,{x:0,y:0},{x:0,y:8});
const idle = snapshot();
poseCharacter(character,1234500,{x:0,y:0},{x:0,y:8});
assert.deepEqual(snapshot(),idle,"stationary tracking must not fabricate a running gait");
assert.deepEqual(character.root.position.toArray(),[12,0,-5],"poses may never move a player's recorded root position");
assert.equal(avatarSeed("vale-4"),avatarSeed("vale-4"));
assert.notEqual(avatarSeed("vale-4"),avatarSeed("bastion-4"));
console.log("Character pose checks passed: source-clock gait, pause/rewind determinism, coordinate heading and no fabricated movement.");

// A paused source distance must freeze gait even if an unrelated wall clock advances.
const pose={distance:14,gait:3.2,heading:.8,turn:.3};
poseCharacter(character,1000,{x:4,y:0},{x:8,y:2},pose);
const distancePose=snapshot();
poseCharacter(character,9000,{x:4,y:0},{x:8,y:2},pose);
assert.deepEqual(snapshot(),distancePose,"gait is distance-driven, not wall-clock driven");
poseCharacter(character,1000,{x:4,y:0},{x:8,y:2},{...pose,action:{kind:"kick",phase:.6,strength:1,heading:.8}});
assert.notDeepEqual(snapshot(),distancePose,"recorded kick articulates a different pose");
poseCharacter(character,1000,{x:4,y:0},{x:8,y:2},{...pose,action:{kind:"receive",phase:.6,strength:.35,heading:.8}});
assert.notDeepEqual(snapshot(),distancePose,"recorded first touch articulates a different pose");
// Check FK heel height during stance at a range of source speeds.
for(const speed of [0,1,3,6.5]) {
 const amount=speed/6.5,stance=.6-.24*amount;
 const gait=stance*.4-character.phase/(2*Math.PI);
 poseCharacter(character,0,{x:0,y:-speed},{x:0,y:-10},{distance:0,gait,heading:0,turn:0});
 const h=character.hips[0].rotation.x,k=character.knees[0].rotation.x;
 const heelY=.94+character.body.position.y-.46*Math.cos(h)-.43*Math.cos(h+k)-.045;
 assert.ok(heelY>=-.002&&heelY<.035,"stance foot remains on turf: "+heelY);
}
console.log("PASS: distance gait, grounded stance and event articulation.");
