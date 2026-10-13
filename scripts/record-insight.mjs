// Export only a capped, already-approved response that also passed the Go gate.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.env.PULSE_CACHED_FOUNDRY,"1","Cap and warm Foundry before exporting; this requests the cached insight.");
const go = process.env.PULSE_URL, agents = process.env.PULSE_AGENT_URL;
assert.ok(go && agents,"Set PULSE_URL and PULSE_AGENT_URL to the capped local services.");
for (const url of [go,agents]) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol,"http:"); assert.equal(parsed.hostname,"127.0.0.1");
  assert.ok(!parsed.username && !parsed.password && !parsed.search && !parsed.hash);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const output = path.join(root,"agents/recordings/corner-casual.en-GB.json");
assert.ok(!fs.existsSync(output),"Recording exists; review changes before replacing it.");
const packsResponse = await fetch(`${go}/api/fact-packs?scenario=corner`);
assert.ok(packsResponse.ok);
const packs = await packsResponse.json();
assert.equal(packs.length,1);
const request = {schemaVersion:"2.0.0",factPack:packs[0],locale:"en-GB",persona:"CASUAL"};
const response = await fetch(`${agents}/insights`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)});
assert.ok(response.ok);
const insight = await response.json();
assert.equal(insight.verification.status,"VERIFIED");
const gateResponse = await fetch(`${go}/api/insights?scenario=corner&persona=CASUAL`);
assert.ok(gateResponse.ok);
assert.equal(gateResponse.headers.get("X-Pulse-Insight-Source"),"python-verified");
const cue = (await gateResponse.json()).cues[0];
assert.equal(cue.text,insight.draft.text);
assert.deepEqual(cue.verification,insight.verification);
assert.deepEqual(cue.eventIds,insight.draft.claims[0].eventIds);
const record = {request,response:insight,provenance:{provider:"Microsoft Foundry",deployment:"pulse-insights",model:"gpt-4.1-mini",modelVersion:"2025-04-14",recordedAt:new Date().toISOString()}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n");
console.log(`Exported reviewed insight to ${output}; no keys included.`);
