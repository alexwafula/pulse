import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {build} from "esbuild";
const compiled=await build({entryPoints:["app/web/src/replay-motion.ts"],bundle:true,platform:"node",format:"cjs",write:false});
const module={exports:{}};
vm.runInNewContext(compiled.outputFiles[0].text,{module,exports:module.exports});
const {createReplayMotion}=module.exports;
for(const name of ["end-to-end","late-siege","calm-midfield","first-sequence"]) {
 const replay=JSON.parse(fs.readFileSync(name==="first-sequence"?"data/samples/first-sequence.json":"data/scenarios/"+name+".json","utf8"));
 const original=JSON.stringify(replay),motion=createReplayMotion(replay);
 for(let i=0;i<replay.tracking.length;i++) {
  const f=replay.tracking[i],n=replay.tracking[Math.min(i+1,replay.tracking.length-1)];
  for(const p of f.players) {
   const at=motion.sample(p.playerId,i,f.timeMs);
   assert.ok(Math.abs(at.x-p.x)<1e-9&&Math.abs(at.y-p.y)<1e-9,"exact recorded keyframe");
   const q=n.players.find(q=>q.playerId===p.playerId);
   for(const fraction of [.1,.5,.9]) {
    const time=f.timeMs+(n.timeMs-f.timeMs)*fraction,s=motion.sample(p.playerId,i,time);
    assert.ok(s.x>=Math.min(p.x,q.x)-1e-8&&s.x<=Math.max(p.x,q.x)+1e-8,"bounded X");
    assert.ok(s.y>=Math.min(p.y,q.y)-1e-8&&s.y<=Math.max(p.y,q.y)+1e-8,"bounded Y");
    assert.ok(Number.isFinite(s.vx+s.vy+s.heading+s.distance));
    assert.ok(Math.abs(s.turn)<=3.200001,"turn rate limited in replay time");
   }
   if(i>0) {
    const left=motion.sample(p.playerId,i-1,f.timeMs),right=motion.sample(p.playerId,i,f.timeMs);
    assert.ok(Math.hypot(left.vx-right.vx,left.vy-right.vy)<1e-7,"continuous keyframe velocity");
   }
  }
 }
 const index=Math.floor(replay.tracking.length*.4),time=replay.tracking[index].timeMs+70;
 const before=JSON.stringify([motion.camera(index,time),motion.pose(replay.match.players[0].id,index,time)]);
 motion.camera(0,replay.match.startMs);motion.pose(replay.match.players[0].id,0,replay.match.startMs);
 assert.equal(JSON.stringify([motion.camera(index,time),motion.pose(replay.match.players[0].id,index,time)]),before,"seek order independent");
 for(const event of replay.events.filter(e=>e.type!=="CARRY")) {
  let i=replay.tracking.findIndex(f=>f.timeMs>event.timeMs)-1;if(i<0)i=replay.tracking.length-1;
  assert.equal(motion.pose(event.actorId,i,event.timeMs).action?.kind,"kick","kick grounded in recorded event");
 }
 assert.equal(JSON.stringify(replay),original,"source replay immutable");
 console.log("PASS motion:",name);
}
