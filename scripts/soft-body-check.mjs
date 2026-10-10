// Full-board soft-membrane rendering, touch, and a throttled frame-budget check.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4180';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4180'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
const errors=[],external=[];
try{
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(base))external.push(request.url());});
  await page.goto(base);await page.locator('.bubble[data-soft]').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.waitForTimeout(2400);
  const bubbles=page.locator('.bubble[data-soft]');assert.ok(await bubbles.count()>=24);
  const shapes=await bubbles.evaluateAll(els=>els.map(el=>({d:el.querySelector('.membrane-fill').getAttribute('d'),deformation:Number(el.dataset.deformation),transform:getComputedStyle(el.querySelector('.bubble-skin')).transform,labelTransform:getComputedStyle(el.querySelector('.bubble-label')).transform})));
  assert.ok(shapes.filter(s=>s.deformation>.04).length>=8,'The full pile did not deform through membrane contacts');
  assert.ok(shapes.every(s=>(s.d.match(/C/g)||[]).length>=16),'The membrane is not a smooth closed particle contour');
  assert.ok(shapes.every(s=>s.transform==='none'&&s.labelTransform==='none'),'Cosmetic transforms still replace the simulated shape');
  await page.screenshot({path:output+'soft-body-s23.png'});
  const source=bubbles.first(),id=await source.getAttribute('data-id'),box=await source.boundingBox(),board=await page.locator('#board').boundingBox();
  const cdp=await context.newCDPSession(page),start={x:box.x+box.width/2,y:box.y+box.height/2},lift={x:180,y:board.y+100};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[lift]});
  await page.waitForTimeout(400);
  const held=await source.boundingBox();assert.ok(Math.hypot(held.x+held.width/2-lift.x,held.y+held.height/2-lift.y)<3,'The physical body does not follow the touch');
  // Keep physics awake under a held finger. This is browser emulation, not S23 hardware.
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const timing=await page.evaluate(()=>new Promise(resolve=>{
    const intervals=[];let first,last;function sample(now){first??=now;if(last!==undefined)intervals.push(now-last);last=now;if(now-first<5000)requestAnimationFrame(sample);else{intervals.sort((a,b)=>a-b);resolve({frames:intervals.length,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],meanFps:intervals.length/((now-first)/1000)});}}requestAnimationFrame(sample);
  }));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  assert.ok(timing.medianMs<=34&&timing.p95Ms<=70,`A full-board soft-body simulation exceeded its throttled frame budget: ${JSON.stringify(timing)}`);
  const initialPath=await source.locator('.membrane-fill').getAttribute('d');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(1500);const fallen=await page.locator(`.bubble[data-id="${id}"]`).boundingBox();
  assert.ok(fallen.y>held.y+40,'The lifted membrane did not fall back into the pile');
  assert.notEqual(await source.locator('.membrane-fill').getAttribute('d'),initialPath,'Contact did not change the actual membrane contour');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();await source.waitFor();await page.waitForTimeout(1500);
  assert.equal(await bubbles.count(),24,'Offline reload lost the soft-body board');
  assert.ok(await bubbles.evaluateAll(els=>els.some(el=>Number(el.dataset.deformation)>.04)),'Offline physics did not initialize');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(output+'soft-body-performance.json',JSON.stringify({viewport:[360,780],cpuSlowdown:4,bubbles:24,...timing},null,2));
  console.log(`Soft-body browser checks passed: a full pile, smooth physical contours, steady labels, touch holding, falling/contact deformation, and offline WebAssembly. At 4× CPU slowdown: ${timing.meanFps.toFixed(1)} fps, median ${timing.medianMs.toFixed(1)} ms, p95 ${timing.p95Ms.toFixed(1)} ms (browser emulation).`);
}finally{await browser.close();server?.kill();}
