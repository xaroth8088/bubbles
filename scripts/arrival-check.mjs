// Observe real releases into the production board, including save/restore mid-stream.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {clearableGroups} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4178';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4178'},windowsHide:true});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const errors=[];
try{
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  await context.addInitScript(()=>{
    window.releases=[];
    new MutationObserver(records=>{for(const r of records)if(r.oldValue!==null&&r.target.matches('.bubble[data-id]')&&!r.target.hidden&&!window.releases.some(x=>x.id===r.target.dataset.id)){
      const box=r.target.getBoundingClientRect();window.releases.push({id:r.target.dataset.id,time:performance.now(),x:box.x+box.width/2});
    }}).observe(document,{subtree:true,attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const arrivals=()=>page.waitForFunction(()=>document.querySelector('#board')?.dataset.arriving==='0');
  const idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
  const read=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('bubble-grove-v1'));return s.sessions[s.activeMode];});
  const releases=()=>page.evaluate(()=>window.releases);
  const reset=()=>page.evaluate(()=>{window.releases=[];});
  const tap=async id=>{await idle();const box=await page.locator(`.bubble[data-id="${id}"]`).boundingBox();assert.ok(box);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);};
  const cadence=records=>{assert.ok(records.length>1);for(let i=1;i<records.length;i++)assert.ok(records[i].time-records[i-1].time>=55,`Bubbles arrived together: ${JSON.stringify(records)}`);};
  await page.goto(base);await page.locator('.bubble').first().waitFor({state:'attached'});
  await page.waitForFunction(()=>document.querySelectorAll('.bubble[hidden]').length>5);
  const waiting=await page.locator('.bubble[hidden]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.id,el.style.translate])));
  await page.waitForTimeout(120);
  const pending=await page.locator('.bubble[hidden]').evaluateAll(els=>els.map(el=>({id:el.dataset.id,translate:el.style.translate})));
  assert.ok(pending.length>5);for(const b of pending)assert.equal(b.translate,waiting[b.id],'An unreleased bubble moved or collided off-screen');
  await page.evaluate(()=>{const end=performance.now()+300;while(performance.now()<end){};});
  await arrivals();const first=await releases();assert.equal(first.length,24);cadence(first);
  assert.ok(first.at(-1).time-first[0].time>1400,'The opening was still a batch');
  assert.ok(Math.max(...first.map(x=>x.x))-Math.min(...first.map(x=>x.x))>200,'The stream did not vary its drop positions');
  await page.waitForTimeout(1600);
  let state=await read(),group=clearableGroups(state)[0];await reset();
  while(state.bubbles.some(b=>b.groupId===group.id)){
    const members=state.bubbles.filter(b=>b.groupId===group.id);await tap(members[0].id);await tap(members[1].id);await idle();state=await read();
  }
  await arrivals();const refill=await releases();assert.ok(refill.length>=2&&refill.length<=4);cadence(refill);
  // A partially delivered opening resumes without dropping the arrived words again.
  await page.locator('#settings-button').click();await page.locator('#restart-button').click();await reset();await page.locator('#confirm-restart').click();
  await page.locator('#tools-button').click();await reset();await page.locator('#shuffle-button').click();
  await page.waitForFunction(()=>window.releases.length>0,{},{timeout:500});
  await page.waitForFunction(()=>window.releases.length>=5);
  const arrived=await page.locator('.bubble:not([hidden])').evaluateAll(els=>els.map(el=>el.dataset.id));
  await page.reload();await page.locator('.bubble').first().waitFor({state:'attached'});
  for(const id of arrived)assert.equal(await page.locator(`.bubble[data-id="${id}"]`).evaluate(el=>el.hidden),false,'Resume requeued a bubble already on the board');
  await arrivals();const resumed=await releases();assert.ok(resumed.length>1);assert.ok(resumed.every(b=>!arrived.includes(b.id)));cadence(resumed);
  // Turning on reduced motion during a stream immediately settles the remainder.
  await page.locator('#settings-button').click();await page.locator('#restart-button').click();await page.locator('#confirm-restart').click();
  await page.waitForFunction(()=>Number(document.querySelector('#board').dataset.arriving)>5);
  await page.locator('#settings-button').click();await page.locator('#setting-motion').check();await page.locator('#close-sheet').click();await arrivals();
  assert.equal(await page.locator('.bubble[hidden]').count(),0);
  const bounds=await page.locator('#board').boundingBox();
  for(const box of await page.locator('.membrane-fill').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().toJSON())))assert.ok(box.y>=bounds.y-1&&box.y+box.height<=bounds.y+bounds.height+1,'Reduced motion left a membrane above the board');
  await page.reload();await arrivals();assert.equal((await releases()).length,0,'A saved, settled board was sprinkled again');
  assert.deepEqual(errors,[]);
  console.log('Arrival checks passed: individual opening and refill drops, varied positions, no waiting-body collisions or batches after a slow frame, prompt mid-stream shuffle, mid-stream save/restore, immediate reduced motion, and settled-board resume.');
}finally{await browser.close();server?.kill();}
