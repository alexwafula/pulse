import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {chromium} from "playwright-core";
const base=process.env.PULSE_URL??"http://127.0.0.1:8180";
const output=path.join(os.tmpdir(),"pulse-motion-review");await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
const errors=[];
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===1440?1000:844}});
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/?scenario=end-to-end&view=three",{waitUntil:"networkidle"});
  const canvas=page.locator("#canvas-host canvas");
  await canvas.waitFor();
  if(await page.locator("#play-button").getAttribute("aria-label")==="Pause") await page.locator("#play-button").click();
  const seek=async value=>{await page.locator("#seek").evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event("input",{bubbles:true}));},value);await page.waitForTimeout(90);};
  const camera=async mode=>{await page.locator("#camera-mode").selectOption(mode,{force:true});await page.waitForTimeout(100);};
  const poses=[];
  for(const mode of ["broadcast","tactical","follow"]){
   await camera(mode);
   for(const value of Array.from({length:51},(_,i)=>i*20)){
    await seek(value);
    const point=JSON.parse(await canvas.getAttribute("data-ball-screen"));
    assert.ok(Math.abs(point[0])<.94&&Math.abs(point[1])<.94&&Math.abs(point[2])<1,mode+" keeps ball in frame at "+value+": "+point);
   }
   await seek(460);
   const pose=await canvas.getAttribute("data-camera-pose");poses.push(pose);
   await seek(80);await seek(460);
   assert.equal(await canvas.getAttribute("data-camera-pose"),pose,"camera independent of seek history");
   const image=await canvas.screenshot();
   await page.waitForTimeout(200);
   assert.deepEqual(await canvas.screenshot(),image,"paused pitch does not animate");
   const bounds=await canvas.boundingBox();
   await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);
   await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.6,{steps:8});await page.mouse.up();
   await page.mouse.wheel(0,-200);await page.waitForTimeout(100);
   await page.locator("#camera-reset").click();await page.waitForTimeout(200);
   assert.equal(await canvas.getAttribute("data-camera-pose"),pose,"manual orbit/zoom reset restores replay camera");
   await page.locator(".pitch-shell").screenshot({path:path.join(output,mode+"-"+width+".png")});
  }
  assert.equal(new Set(poses).size,3,"camera presets have distinct composition");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log("PASS: all camera modes, ball framing across full replay, pause/rewind, desktop/mobile. "+output);
}finally{await browser.close();}
