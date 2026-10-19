import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import test from "node:test";
import {build} from "esbuild";
globalThis.crypto ??= webcrypto;
const compiled=await build({entryPoints:["app/web/src/evidence-link.ts"],bundle:true,platform:"node",format:"esm",write:false});
const {evidenceURL,readEvidenceLink,replayKey}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const replay=JSON.parse(readFileSync("data/scenarios/late-siege.json","utf8")),key=await replayKey(replay);
const state={scenario:"late-siege",matchId:replay.match.id,replayKey:key,timeMs:replay.events.at(-1).timeMs,locale:"sw-KE",persona:"ANALYST",view:"pixi",camera:"tactical",control:true,broadcast:true,section:"live"};
test("evidence links round-trip every source selection and exact audience/view/clock",()=>{
  for(const selection of [undefined,{eventId:replay.events.at(-1).id},{cueId:"cue-pack-open-example"},{momentType:"SUSTAINED_PRESSURE",momentAt:replay.match.startMs+20000,teamId:"vale"},{startMs:replay.events.at(-1).timeMs-500,endMs:replay.events.at(-1).timeMs+500}]) {
    const sample={...state,...selection?{selection,returnMs:replay.match.endMs}:{}};
    const url=new URL(evidenceURL("https://pulse.example/?secret=not-to-share#old",sample));
    assert.equal(url.pathname,"/");assert.equal(url.searchParams.has("secret"),false);assert.equal(url.hash,"");
    const restored=readEvidenceLink(url,replay,key,"late-siege");
    assert.deepEqual(restored,sample);
  }
});
test("invalid, stale, contradictory or ambiguous links never silently select another action",()=>{
  const valid=new URL(evidenceURL("https://pulse.example",{...state,selection:{eventId:replay.events.at(-1).id},returnMs:replay.match.endMs}));
  for(const [name,value] of [["share","2"],["atMs","NaN"],["atMs","1.5"],["atMs",String(replay.match.endMs+1)],["atMs",String(replay.match.startMs)],["match","other"],["replayKey","changed"],["event","unknown"],["locale","fr-FR"],["persona","LOYALIST"],["view","invalid"],["camera","invalid"],["control","yes"],["returnMs","-1"],["cue","another-cue"],["section","story"]]) {
    const url=new URL(valid);url.searchParams.set(name,value);assert.throws(()=>readEvidenceLink(url,replay,key,"late-siege"),/Shared evidence unavailable/,`${name}=${value}`);
  }
  const duplicate=new URL(valid);duplicate.searchParams.append("atMs",String(state.timeMs));assert.throws(()=>readEvidenceLink(duplicate,replay,key,"late-siege"));
  const canonical=new URL(valid);canonical.searchParams.delete("section");assert.equal(readEvidenceLink(canonical,replay,key,"late-siege").section,"live","Live navigation omits its default section in the address bar");
  assert.equal(readEvidenceLink(new URL("https://pulse.example/"),replay,key,"late-siege"),undefined);
});
test("fingerprint detects changed recordings, not only reused match and event IDs",async()=>{
  const changed=structuredClone(replay);changed.tracking[0].ball.x+=.1;
  assert.notEqual(await replayKey(changed),key);assert.equal(await replayKey(replay),key);
});
