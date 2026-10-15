import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

// Native-language requests are deterministic in both template and Foundry modes.
// This measures replay/template availability, not live model latency or SSE.
export async function probe(base, route, fetcher = fetch) {
  const start = performance.now();
  const response = await fetcher(new URL(route, base), { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
  const body = route === "/healthz" ? (await response.text()).trim() : await response.json();
  return { body, source: response.headers.get("X-Pulse-Insight-Source"), latencyMs: Math.round(performance.now()-start) };
}

export function checkCue(feed, pack, locale) {
  assert.equal(feed.schemaVersion,"2.0.0");
  assert.equal(feed.cues.length,1);
  const cue=feed.cues[0];
  assert.equal(cue.locale,locale);
  assert.equal(cue.verification.status,"FALLBACK_TEMPLATE");
  assert.equal(cue.verification.claimsChecked,0);
  assert.equal(cue.verification.claimsPassed,0);
  assert.deepEqual(cue.eventIds,pack.facts[0].eventIds);
  assert.deepEqual(cue.factIds,[pack.facts[0].id]);
  assert.equal(cue.replayStartMs,pack.windowStartMs);
  assert.equal(cue.replayEndMs,pack.windowEndMs);
}

export async function soak(base, seconds=900, intervalSeconds=30) {
  assert.ok(Number.isInteger(seconds)&&seconds>=1&&seconds<=3600,"Use a duration of 1 to 3600 seconds");
  assert.ok(Number.isInteger(intervalSeconds)&&intervalSeconds>=1&&intervalSeconds<=60);
  const url=new URL(base);
  assert.ok(url.protocol==="https:"||(url.protocol==="http:"&&["127.0.0.1","localhost"].includes(url.hostname)));
  assert.ok(!url.username&&!url.password&&!url.search&&!url.hash);
  const report={base:url.origin,scope:"Replay and deterministic Go-to-Python templates; no live model calls or SSE",requestedSeconds:seconds,startedAt:new Date().toISOString(),warmup:[],rounds:[],failures:[]};
  const fixtureIds=["corner","central","exchange","late-siege","calm-midfield"];
  for (const id of fixtureIds) {
    const sample=await probe(url,`/api/replay?scenario=${id}`);
    assert.equal(sample.body.schemaVersion,"2.0.0");
    assert.ok(sample.body.tracking.length>0&&sample.body.events.length>0);
  }
  const packs=(await probe(url,"/api/fact-packs?scenario=corner")).body;
  assert.equal(packs.length,1);
  const pack=packs[0];
  // Give a scaled-to-zero agent time to become reachable; record every fallback.
  for (let attempt=0;attempt<5;attempt++) {
    const sample=await probe(url,"/api/insights?scenario=corner&persona=CASUAL&locale=sw-KE");
    checkCue(sample.body,pack,"sw-KE");
    report.warmup.push({source:sample.source,latencyMs:sample.latencyMs});
    if(sample.source==="python-template")break;
    if(attempt===4)throw new Error("Python template did not become ready; Go fallback is not a healthy service boundary");
    await sleep(3000);
  }
  const start=performance.now();
  do {
    const round={at:new Date().toISOString(),elapsedSeconds:Math.round((performance.now()-start)/1000),samples:[]};
    try {
      const health=await probe(url,"/healthz");assert.equal(health.body,"ok");
      round.samples.push({path:"/healthz",latencyMs:health.latencyMs});
      const metrics=await probe(url,"/api/metrics?scenario=late-siege");
      assert.equal(metrics.body.trackingMetrics,"supported");assert.ok(metrics.body.ticks.length>0);
      round.samples.push({path:"/api/metrics",latencyMs:metrics.latencyMs});
      for (const locale of ["sw-KE","hi-IN"]) {
        const sample=await probe(url,`/api/insights?scenario=corner&persona=ANALYST&locale=${locale}`);
        assert.equal(sample.source,"python-template",`${locale}: backend unavailable; received ${sample.source}`);
        checkCue(sample.body,pack,locale);
        round.samples.push({path:`/api/insights:${locale}`,latencyMs:sample.latencyMs,source:sample.source});
      }
      console.log(`PASS round ${report.rounds.length+1}, ${round.elapsedSeconds}s: replay metrics and both Python locale templates`);
    }catch(error){
      const failure={at:round.at,message:error instanceof Error?error.message:String(error)};
      report.failures.push(failure);console.error("FAIL",JSON.stringify(failure));
    }
    report.rounds.push(round);
    const remaining=seconds*1000-(performance.now()-start);
    if(remaining<=0)break;
    await sleep(Math.min(intervalSeconds*1000,remaining));
  }while(true);
  report.elapsedSeconds=Number(((performance.now()-start)/1000).toFixed(2));
  report.completedAt=new Date().toISOString();
  const latencies=report.rounds.flatMap(round=>round.samples.map(sample=>sample.latencyMs)).sort((a,b)=>a-b);
  report.latencyMs={samples:latencies.length,p50:latencies[Math.floor(latencies.length*.5)]??null,p95:latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*.95)-1)]??null,max:latencies.at(-1)??null};
  report.passed=report.failures.length===0&&report.elapsedSeconds>=seconds;
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const report=await soak(process.env.PULSE_URL??"http://127.0.0.1:8080",Number(process.env.PULSE_SOAK_SECONDS??900),Number(process.env.PULSE_SOAK_INTERVAL_SECONDS??30));
  const output=process.env.PULSE_SOAK_REPORT??path.join(os.tmpdir(),`pulse-cloud-soak-${Date.now()}.json`);
  writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({passed:report.passed,elapsedSeconds:report.elapsedSeconds,rounds:report.rounds.length,failures:report.failures.length,latencyMs:report.latencyMs,report:output}));
  if(!report.passed)process.exitCode=1;
}
