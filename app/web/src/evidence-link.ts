import type { Replay } from "./pitch";

export type LinkSelection = {eventId:string} | {cueId:string} | {momentType:string; momentAt:number; teamId:string} | {startMs:number; endMs:number};
export type EvidenceLink = {
  scenario:string; matchId:string; replayKey:string; timeMs:number;
  locale:string; persona:string; view:string; camera:string; control:boolean; broadcast:boolean;
  section:string; returnMs?:number; selection?:LinkSelection;
};
const allowed = {
  locale:["en-GB","sw-KE","hi-IN"], persona:["CASUAL","ANALYST"], view:["svg","three","pixi"],
  camera:["broadcast","tactical","follow"], section:["live","story","insights","recap"],
  moment:["SET_PIECE_SHOT","SUSTAINED_PRESSURE","CONTROL_SWING"],
};
const identifier = (value:string):boolean => /^[A-Za-z0-9_.:-]{1,64}$/.test(value);
const integer = (value:string|null):number => value !== null && /^(0|[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;

export async function replayKey(replay:Replay):Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(replay));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,"0")).join("").slice(0,24);
}

export function evidenceURL(base:string, state:EvidenceLink):string {
  const url = new URL("/",base), query=url.searchParams;
  const values = {share:"1",scenario:state.scenario,match:state.matchId,replayKey:state.replayKey,atMs:String(state.timeMs),
    locale:state.locale,persona:state.persona,view:state.view,camera:state.camera,control:state.control?"1":"0",broadcast:state.broadcast?"1":"0",
    section:state.selection?"live":state.section};
  for (const [key,value] of Object.entries(values)) query.set(key,value);
  const selection=state.selection;
  if (selection) {
    query.set("returnMs",String(state.returnMs ?? state.timeMs));
    if ("eventId" in selection) query.set("event",selection.eventId);
    else if ("cueId" in selection) query.set("cue",selection.cueId);
    else if ("momentType" in selection) {
      query.set("moment",selection.momentType); query.set("momentAt",String(selection.momentAt)); query.set("teamId",selection.teamId);
    } else { query.set("clipStart",String(selection.startMs)); query.set("clipEnd",String(selection.endMs)); }
  }
  return url.href;
}

export function readEvidenceLink(url:URL, replay:Replay, key:string, scenario:string):EvidenceLink|undefined {
  const query=url.searchParams;
  if (!query.has("share")) return undefined;
  const fail = ():never => {throw new Error("Shared evidence unavailable");};
  if ([...new Set(query.keys())].some(name=>query.getAll(name).length>1)) fail();
  if (!/^[a-f0-9]{24}$/.test(key) || query.get("share")!=="1" || query.get("scenario")!==scenario || query.get("match")!==replay.match.id || query.get("replayKey")!==key) fail();
  const timeMs=integer(query.get("atMs"));
  if (!Number.isFinite(timeMs) || timeMs<replay.match.startMs || timeMs>replay.match.endMs) fail();
  const read = (name:keyof typeof allowed):string => {
    const value=query.get(name) ?? (name==="section"?"live":"");
    return allowed[name].includes(value) ? value : fail();
  };
  const bit = (name:string):boolean => {
    const value=query.get(name);
    if (value!=="0" && value!=="1") fail();
    return value==="1";
  };
  const state:EvidenceLink={scenario,matchId:replay.match.id,replayKey:key,timeMs,locale:read("locale"),persona:read("persona"),
    view:read("view"),camera:read("camera"),section:read("section"),control:bit("control"),broadcast:bit("broadcast")};
  const selectors=["event","cue","moment","clipStart"].filter(name=>query.has(name));
  if (selectors.length>1 || (query.has("clipEnd") && !query.has("clipStart")) || ((query.has("momentAt") || query.has("teamId")) && !query.has("moment"))) fail();
  if (query.has("event")) {
    const id=query.get("event")!;
    if (!replay.events.some(event=>event.id===id && event.timeMs<=timeMs)) fail();
    state.selection={eventId:id};
  } else if (query.has("cue")) {
    const id=query.get("cue")!;
    if (!identifier(id)) fail();
    state.selection={cueId:id};
  } else if (query.has("moment")) {
    const momentAt=integer(query.get("momentAt")),teamId=query.get("teamId") ?? "";
    if (!Number.isFinite(momentAt) || momentAt<replay.match.startMs || momentAt>replay.match.endMs || !replay.match.teams.some(team=>team.id===teamId)) fail();
    state.selection={momentType:read("moment"),momentAt,teamId};
  } else if (query.has("clipStart")) {
    const startMs=integer(query.get("clipStart")),endMs=integer(query.get("clipEnd"));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs<replay.match.startMs || endMs>replay.match.endMs || startMs>=endMs || timeMs<startMs || timeMs>endMs) fail();
    state.selection={startMs,endMs};
  }
  if (state.selection && state.section!=="live") fail();
  if (state.broadcast && state.section!=="live") fail();
  if (state.selection) {
    const returnMs=integer(query.get("returnMs"));
    if (!Number.isFinite(returnMs) || returnMs<replay.match.startMs || returnMs>replay.match.endMs) fail();
    state.returnMs=returnMs;
  } else if (query.has("returnMs")) fail();
  return state;
}
