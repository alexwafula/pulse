import * as THREE from "three";
import type { SceneState, Position } from "./types";

// Fixed-size reusable geometry: one clock update never allocates a GPU buffer.
export function createAnnotations(scene: THREE.Scene): (state: SceneState) => void {
  function line(capacity:number, colour:number): THREE.Line {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(capacity*3),3));geometry.setDrawRange(0,0);
    const mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:colour,transparent:true,opacity:.9}));mesh.frustumCulled=false;scene.add(mesh);return mesh;
  }
  const trail=line(64,0xffde83), shot=line(4,0xffde83);
  function update(mesh:THREE.Line, points:Position[]):void {
    const attribute=mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const count=Math.min(points.length,attribute.count);
    for(let i=0;i<count;i++) attribute.setXYZ(i,points[i].x-52.5,.22,34-points[i].y);
    attribute.needsUpdate=true;mesh.geometry.setDrawRange(0,count);mesh.visible=count>1;
  }
  return state=>{update(trail,state.trail ?? []);update(shot,state.shot ? [state.shot.from,...state.shot.posts,state.shot.from] : []);};
}
