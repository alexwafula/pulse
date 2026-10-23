import type { Replay } from "./pitch";
import type { PlayerMotion, Position } from "./renderers/types";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const angle = (v: number): number => Math.atan2(Math.sin(v), Math.cos(v));
type Sample = Position & { vx: number; vy: number; distance: number; heading: number; turn: number };
type Knot = Position & { time: number; distance: number; gait: number; heading: number; vx: number; vy: number };

/** Monotone Hermite tangents: pass through samples without overshooting either coordinate. */
function tangent(before: number, here: number, after: number, dt0: number, dt1: number): number {
  const a = (here-before)/dt0, b = (after-here)/dt1;
  return a*b <= 0 ? 0 : 2*a*b/(a+b);
}
function curve(a: number, b: number, va: number, vb: number, dt: number, t: number): [number, number] {
  const d = (b-a)/dt;
  if (d === 0) return [a, 0];
  let m = va/d, n = vb/d;
  m = Math.max(0,m); n = Math.max(0,n);
  const length = Math.hypot(m,n);
  if (length > 3) { m *= 3/length; n *= 3/length; }
  va=m*d; vb=n*d;
  const t2=t*t, t3=t2*t;
  return [(2*t3-3*t2+1)*a+(t3-2*t2+t)*dt*va+(-2*t3+3*t2)*b+(t3-t2)*dt*vb,
    ((6*t2-6*t)*a+(3*t2-4*t+1)*dt*va+(-6*t2+6*t)*b+(3*t2-2*t)*dt*vb)/dt];
}

/** Presentation cache only. No changes to replay data, events or football metrics. */
export function createReplayMotion(replay: Replay) {
  const tracks = new Map<string,Knot[]>();
  for (const player of replay.match.players) {
    let distance=0, heading=0, gait=0;
    const points = replay.tracking.map(frame => ({ ...frame.players.find(p => p.playerId===player.id)!, time:frame.timeMs }));
    const knots = points.map((p,i): Knot => {
      const prev=points[Math.max(0,i-1)], next=points[Math.min(points.length-1,i+1)];
      const dt0=Math.max(.001,(p.time-prev.time)/1000), dt1=Math.max(.001,(next.time-p.time)/1000);
      const vx = i===0 ? (next.x-p.x)/dt1 : i===points.length-1 ? 0 : tangent(prev.x,p.x,next.x,dt0,dt1);
      const vy = i===0 ? (next.y-p.y)/dt1 : i===points.length-1 ? 0 : tangent(prev.y,p.y,next.y,dt0,dt1);
      const speed=Math.hypot(vx,vy);
      // Face the ball when waiting; turn towards movement when running. Limit turns in source time.
      const ball=replay.tracking[i].ball;
      const desired=speed>.45 ? Math.atan2(vx,-vy) : Math.atan2(ball.x-p.x,p.y-ball.y);
      if (i===0) heading=desired;
      else {
        const travelled=Math.hypot(p.x-prev.x,p.y-prev.y);
        distance+=travelled;
        gait+=travelled/(.95+travelled/dt0*.32);
        heading+=clamp(angle(desired-heading),-3.2*dt0,3.2*dt0);
      }
      return { ...p, distance, gait, heading, vx, vy };
    });
    tracks.set(player.id,knots);
  }
  function sample(id: string, index: number, time: number): Sample {
    const knots=tracks.get(id)!;
    const a=knots[index], b=knots[Math.min(index+1,knots.length-1)];
    const dt=Math.max(.001,(b.time-a.time)/1000), t=clamp((time-a.time)/(dt*1000),0,1);
    const [x,vx]=curve(a.x,b.x,a.vx,b.vx,dt,t), [y,vy]=curve(a.y,b.y,a.vy,b.vy,dt,t);
    return { x,y,vx,vy,distance:a.distance+(b.distance-a.distance)*t,
      heading:a.heading+(b.heading-a.heading)*t,turn:(b.heading-a.heading)/dt };
  }
  // Causal low-pass camera composition is baked once, so seeking is independent of playback history.
  const cameras=replay.tracking.map(frame=>({x:frame.ball.x,y:frame.ball.y,spread:24}));
  for (let i=1;i<cameras.length;i++) {
    const frame=replay.tracking[i], prev=cameras[i-1], dt=(frame.timeMs-replay.tracking[i-1].timeMs)/1000;
    const nearby=frame.players.filter(p=>Math.hypot(p.x-frame.ball.x,p.y-frame.ball.y)<24);
    const mx=nearby.reduce((sum,p)=>sum+p.x,0)/Math.max(1,nearby.length);
    const my=nearby.reduce((sum,p)=>sum+p.y,0)/Math.max(1,nearby.length);
    const x=frame.ball.x*.82+(nearby.length?mx:frame.ball.x)*.18;
    const y=frame.ball.y*.82+(nearby.length?my:frame.ball.y)*.18;
    const alpha=1-Math.exp(-dt/.7);
    cameras[i]={x:prev.x+(x-prev.x)*alpha,y:prev.y+(y-prev.y)*alpha,
      spread:prev.spread+(clamp(nearby.length*1.1+17,23,35)-prev.spread)*alpha};
  }
  function camera(index: number,time: number) {
    const a=cameras[index], b=cameras[Math.min(index+1,cameras.length-1)];
    const start=replay.tracking[index].timeMs, end=replay.tracking[Math.min(index+1,cameras.length-1)].timeMs;
    const t=clamp((time-start)/Math.max(1,end-start),0,1);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,spread:a.spread+(b.spread-a.spread)*t};
  }
  const arrivals = replay.events.filter(e=>e.recipientId && e.outcome==="COMPLETE" && e.type!=="CARRY").flatMap(e=>{
    const next=replay.events.find(n=>n.timeMs>e.timeMs)?.timeMs??replay.match.endMs;
    const candidates=replay.tracking.filter(f=>f.timeMs>e.timeMs && f.timeMs<=Math.min(next,e.timeMs+6000));
    const frame=candidates.sort((a,b)=>Math.hypot(a.ball.x-e.to.x,a.ball.y-e.to.y)-Math.hypot(b.ball.x-e.to.x,b.ball.y-e.to.y))[0];
    const recipient=frame?.players.find(p=>p.playerId===e.recipientId);
    return frame && recipient && Math.hypot(frame.ball.x-recipient.x,frame.ball.y-recipient.y)<1.8 && frame.ball.z<.5 ? [{id:e.recipientId!,time:frame.timeMs}] : [];
  });
  function pose(id: string, index: number,time: number): PlayerMotion {
    const p=sample(id,index,time);
    let action: PlayerMotion["action"];
    // A kick is cosmetic articulation of a recorded event, never an inferred result.
    for (const e of replay.events) {
      if(e.actorId!==id || e.type==="CARRY") continue;
      const elapsed=(time-e.timeMs)/1000;
      if(elapsed>=-.28 && elapsed<=.52) action={kind:"kick",phase:(elapsed+.28)/.8,
        strength:e.type==="SHOT"||e.type==="CLEARANCE"?1:.65,
        heading:Math.atan2(e.to.x-e.from.x,e.from.y-e.to.y)};
    }
    if(!action) for(const arrival of arrivals) {
      const dt=time-arrival.time;
      if(arrival.id===id && dt>=-120 && dt<=380) action={kind:"receive",phase:(dt+120)/500,strength:.35,heading:p.heading};
    }
    const knots=tracks.get(id)!; const a=knots[index],b=knots[Math.min(index+1,knots.length-1)];
    const t=clamp((time-a.time)/Math.max(1,b.time-a.time),0,1);
    return {distance:p.distance,gait:a.gait+(b.gait-a.gait)*t,heading:p.heading,turn:p.turn,action};
  }
  return { sample, camera, pose };
}
