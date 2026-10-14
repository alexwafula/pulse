import assert from "node:assert/strict";
import test from "node:test";
import { checkCue, probe } from "./cloud-soak.mjs";

const pack={facts:[{id:"fact-1",eventIds:["corner","shot"]}],windowStartMs:1000,windowEndMs:2000};
const feed=()=>({schemaVersion:"2.0.0",cues:[{locale:"sw-KE",factIds:["fact-1"],eventIds:["corner","shot"],replayStartMs:1000,replayEndMs:2000,verification:{status:"FALLBACK_TEMPLATE",claimsChecked:0,claimsPassed:0}}]});
test("soak accepts only complete template provenance",()=>{
  checkCue(feed(),pack,"sw-KE");
  for(const mutate of [cue=>cue.eventIds.pop(),cue=>cue.factIds.push("invented"),cue=>cue.replayEndMs++,cue=>cue.verification.status="VERIFIED",cue=>cue.locale="en-GB",cue=>cue.verification.claimsChecked=1]){
    const invalid=feed();mutate(invalid.cues[0]);assert.throws(()=>checkCue(invalid,pack,"sw-KE"));
  }
});
test("probe records only status, mode and bounded latency",async()=>{
  const result=await probe("https://example.invalid","/healthz",async()=>new Response("ok",{status:200,headers:{"X-Pulse-Insight-Source":"python-template"}}));
  assert.equal(result.body,"ok");assert.equal(result.source,"python-template");assert.ok(result.latencyMs>=0);
  await assert.rejects(probe("https://example.invalid","/healthz",async()=>new Response("failure",{status:503})));
});
