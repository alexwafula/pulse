import type { Replay } from "./pitch";
import type { SceneState, Position } from "./renderers/types";

import { t, locale } from "./i18n";

type Event = Replay["events"][number];
type Counts = {passes:number;shots:number;received:number};
export type MatchDetails = {shots:{eventId:string;distanceM:number;angleDegrees:number;posts:[Position,Position]}[];windows:{timeMs:number;teams:Record<string,Counts>;players:Record<string,Counts>}[]};
const ns = "http://www.w3.org/2000/svg";
const write = (node: Element, value: string): void => { if (node.textContent !== value) node.textContent = value; };
const time = (ms: number): string => `${String(Math.floor(ms/60000)).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;

export function createMatchLab(replay: Replay, details: MatchDetails, repaint: () => void, inspect: (id:string) => void): { update(clock:number,state:SceneState,inspectedId?:string):void } | undefined {
  const root = document.querySelector<HTMLElement>("#match-lab");
  if (!root) return;
  const get = <T extends Element>(selector:string): T => root.querySelector<T>(selector)!;
  const toggle = get<HTMLInputElement>("#spotlight-toggle"), player = get<HTMLSelectElement>("#spotlight-player"), shotToggle = get<HTMLInputElement>("#shot-toggle");
  const detail = get<HTMLElement>("#spotlight-detail"), lens = get<HTMLElement>("#shot-lens");
  const list = get<HTMLElement>("#spotlight-events"), stats = get<HTMLElement>("#window-stats");
  const shotBadge=document.createElement("div");shotBadge.id="shot-distance-overlay";shotBadge.className="shot-mini";shotBadge.hidden=true;shotBadge.setAttribute("aria-live","polite");document.querySelector(".pitch-shell")!.append(shotBadge);
  const svg = document.querySelector<SVGSVGElement>("#pitch")!;
  const layer = document.createElementNS(ns,"g"); layer.id = "match-annotations"; layer.setAttribute("aria-hidden","true");
  svg.insertBefore(layer,document.querySelector("#player-layer"));
  const trace = document.createElementNS(ns,"polyline"), ring = document.createElementNS(ns,"circle"), wedge = document.createElementNS(ns,"polygon");
  trace.setAttribute("class","spotlight-trace"); ring.setAttribute("class","spotlight-ring"); ring.setAttribute("r","22"); wedge.setAttribute("class","shot-wedge");
  layer.append(wedge,trace,ring);
  const project = (p: Position):string => `${32+p.x/replay.match.pitch.lengthM*986},${20+(replay.match.pitch.widthM-p.y)/replay.match.pitch.widthM*640}`;
  let activeShot:Event|undefined, textKey="", shotKey="";
  for (const input of [toggle,player,shotToggle]) input.addEventListener("change",()=>{textKey="";shotKey="";repaint();});
  get<HTMLButtonElement>("#shot-inspect").addEventListener("click",()=>{if(activeShot) inspect(activeShot.id);});
  list.addEventListener("click",event=>{const button=(event.target as Element).closest<HTMLButtonElement>("[data-spotlight-event]");if(button?.dataset.spotlightEvent) inspect(button.dataset.spotlightEvent);});
  return { update(clock,state,inspectedId) {
    const past = replay.events.filter(e=>e.timeMs<=clock);
    const latest = past[past.length-1];
    activeShot = shotToggle.checked && latest?.type==="SHOT" && (clock-latest.timeMs<=6000 || latest.id===inspectedId) ? latest : undefined;
    lens.hidden = !activeShot;shotBadge.hidden=!activeShot;
    const team = activeShot && replay.match.teams.find(item=>item.id===activeShot!.teamId);
    const geometry = activeShot ? details.shots.find(shot=>shot.eventId===activeShot!.id) : undefined;
    state.shot = activeShot && geometry ? { from:activeShot.from, posts:geometry.posts } : undefined;
    wedge.style.display = state.shot ? "" : "none";
    if (state.shot) wedge.setAttribute("points",[state.shot.from,...state.shot.posts].map(project).join(" "));
    if (toggle.checked) {
      state.selectedPlayer = player.value;
      const points = replay.tracking.filter(frame=>frame.timeMs>=Math.max(replay.match.startMs,clock-8000)&&frame.timeMs<=clock).map(frame=>frame.players.find(item=>item.playerId===player.value)).filter((point):point is NonNullable<typeof point>=>Boolean(point));
      const now = state.players.get(player.value);
      state.trail = now ? [...points,now] : points;
      if (now) { const [x,y]=project(now).split(",");ring.setAttribute("cx",x);ring.setAttribute("cy",y); }
      ring.style.display = now ? "" : "none";
      trace.setAttribute("points",state.trail.map(project).join(" ")); trace.style.display="";
    } else { state.trail=undefined;ring.style.display="none";trace.style.display="none"; }
    detail.hidden = !toggle.checked;
    const key = `${Math.floor(clock/250)}:${toggle.checked}:${player.value}:${locale()}`;
    if (key!==textKey) {
      textKey=key;
      const windowStart=Math.max(replay.match.startMs,clock-20000);
      const snapshot=[...details.windows].reverse().find(item=>item.timeMs<=clock)!;
      const heading=document.createElement("span"); heading.className="window-label"; heading.textContent=t("lab.window",{start:time(windowStart),end:time(clock)});
      const rows = replay.match.teams.map(team=>{
        const counts=snapshot.teams[team.id], node=document.createElement("span");node.className="window-team";
        const name=document.createElement("strong"),value=document.createElement("span"); name.textContent=team.name;
        value.textContent=t("lab.teamStats",{passes:counts.passes,shots:counts.shots}); node.append(name,value);return node;
      });stats.replaceChildren(heading,...rows);
      if (toggle.checked) {
        const selected=replay.match.players.find(p=>p.id===player.value)!;
        write(get("#spotlight-name"),`#${selected.number} ${selected.name}`);
        write(get("#spotlight-stats"),t("lab.playerStats",{passes:snapshot.players[selected.id].passes,received:snapshot.players[selected.id].received,shots:snapshot.players[selected.id].shots}));
        list.replaceChildren(...past.filter(e=>e.actorId===selected.id||e.recipientId===selected.id).slice(-3).map(e=>{const b=document.createElement("button");b.type="button";b.dataset.spotlightEvent=e.id;b.textContent=`${time(e.timeMs)} · ${t(e.type.toLowerCase())}`;return b;}));
      }
    }
    const nextShotKey=`${activeShot?.id ?? ""}:${locale()}`;
    if(nextShotKey!==shotKey) {
      shotKey=nextShotKey;
      if(activeShot&&geometry) {
        const actor=replay.match.players.find(p=>p.id===activeShot!.actorId)!;
        write(shotBadge,t("lab.shotOverlay",{distance:geometry.distanceM.toFixed(1),angle:geometry.angleDegrees.toFixed(1)}));
        write(get("#shot-lens-heading"),`${actor.name} · ${time(activeShot.timeMs)}`);
        write(get("#shot-distance"),`${geometry.distanceM.toFixed(1)} m`);write(get("#shot-angle"),`${geometry.angleDegrees.toFixed(1)}°`);
        write(get("#shot-context"),`${team!.name} · ${t(activeShot.outcome.toLowerCase())}`);
        const diagram=get<SVGSVGElement>("#shot-diagram");
        const pitch=document.createElementNS(ns,"rect");Object.entries({x:"0",y:"0",width:"105",height:"68",rx:"2",fill:"#174e3b",stroke:"#b4d6c7","stroke-width":".4"}).forEach(([k,v])=>pitch.setAttribute(k,v));
        const halfway=document.createElementNS(ns,"path");halfway.setAttribute("d","M52.5 0v68 M88.5 13.84h16.5 M88.5 13.84v40.32h16.5 M16.5 13.84H0 M16.5 13.84v40.32H0");halfway.setAttribute("fill","none");halfway.setAttribute("stroke","#c7ded3");halfway.setAttribute("stroke-width",".4");
        const cone=document.createElementNS(ns,"polygon");cone.setAttribute("points",[activeShot.from,...geometry.posts].map(p=>`${p.x},${68-p.y}`).join(" "));cone.setAttribute("class","shot-wedge");
        const path=document.createElementNS(ns,"line");Object.entries({x1:String(activeShot.from.x),y1:String(68-activeShot.from.y),x2:String(activeShot.to.x),y2:String(68-activeShot.to.y),stroke:"#fff","stroke-width":".8","stroke-dasharray":"2 1"}).forEach(([k,v])=>path.setAttribute(k,v));
        const dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",String(activeShot.from.x));dot.setAttribute("cy",String(68-activeShot.from.y));dot.setAttribute("r","1.6");dot.setAttribute("fill","#f8d36b");diagram.replaceChildren(pitch,halfway,cone,path,dot);
        diagram.dataset.eventId=activeShot.id;
      }
    }
  }};
}
