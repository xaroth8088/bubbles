// Regression checks for uninterrupted touch input and visible colored key dependencies.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createPuzzle,makeState,validateState} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4181';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4181'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})}),errors=[];
const output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
async function fixture(special){
  const initial=makeState(createPuzzle({mode:'lab',special})),save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion:'system',difficulty:'balanced',challenge:false},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:initial},stats:{groups:0,puzzles:0}};
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.addInitScript(value=>{
    if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(value));
    window.keyArrivalViolations=[];const observed=new Set();
    const observe=()=>{const target=document.querySelector('#board');if(!target)return;new MutationObserver(()=>{
      for(const el of document.querySelectorAll('.bubble[data-id]:not([hidden])')){
        const key=el.querySelector('.key-art');if(!key||observed.has(el.dataset.id))continue;observed.add(el.dataset.id);
        const color=key.dataset.pairColor,lock=[...document.querySelectorAll('.bubble[data-id]:not([hidden])')].find(el=>el.querySelector(`.lock-hardware[data-pair-color="${color}"]`));
        const board=document.querySelector('#board').getBoundingClientRect(),box=lock?.querySelector('.membrane-fill').getBoundingClientRect();
        if(!box||box.top<board.top-1)window.keyArrivalViolations.push({color,lockVisible:!!box,top:box?.top,boardTop:board.top});
      }
    }).observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
  },save);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.bubble[data-id]').first().waitFor();await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.waitForTimeout(1600);
  await page.evaluate(()=>document.querySelector('#board').addEventListener('pointerdown',event=>{
    const el=event.target.closest('.bubble[data-id]');if(!el)return;const box=el.getBoundingClientRect();
    window.touchGrabOffset={x:box.x+box.width/2-event.clientX,y:box.y+box.height/2-event.clientY};
  }));
  const cdp=await context.newCDPSession(page),bubble=id=>page.locator(`.bubble[data-id="${id}"]`),center=async id=>{const b=await bubble(id).boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab);
  const tap=async id=>{const p=await center(id);await page.touchscreen.tap(p.x,p.y);};
  const join=async(a,b)=>{await tap(a);await tap(b);};
  // A moving bubble can travel between sampling its center and touchStart.
  // The game preserves that actual grab offset rather than snapping to a finger.
  const drag=async(a,b)=>{const p=await center(a),q=typeof b==='string'?await center(b):b;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});const offset=await page.evaluate(()=>window.touchGrabOffset);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[q]});return{x:q.x+offset.x,y:q.y+offset.y};};
  const release=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
  return{page,initial,bubble,center,read,tap,join,drag,release,idle};
}
try{
  const f=await fixture('nested'),g0=f.initial.bubbles.filter(b=>b.groupId==='g0'),g1=f.initial.bubbles.filter(b=>b.groupId==='g1'),board=await f.page.locator('#board').boundingBox();
  await f.drag(g0[0].id,g0[1].id);await f.release();assert.equal((await f.read()).moves,1);assert.equal(await f.page.locator('#board').getAttribute('data-busy'),'true');
  const lift=await f.drag(g1[0].id,{x:180,y:board.y+100});
  assert.ok(await f.bubble(g1[0].id).evaluate(el=>el.classList.contains('dragging')),'The next drag was blocked by the previous merge animation');
  await f.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const held=await f.center(g1[0].id);assert.ok(Math.hypot(held.x-lift.x,held.y-lift.y)<8,JSON.stringify({held,lift}));await f.release();
  // Reuse a freshly merged target before its prior visual snapshot has finished.
  await f.join(g0[1].id,g0[2].id);await f.join(g0[2].id,g0[3].id);assert.equal((await f.read()).moves,3);assert.equal((await f.read()).solved.length,1);
  await f.page.locator('.completion').waitFor();const reveal=await f.page.locator('.completion').boundingBox();await f.drag(g1[1].id,{x:reveal.x+reveal.width/2,y:reveal.y+reveal.height/2});
  assert.ok(await f.bubble(g1[1].id).evaluate(el=>el.classList.contains('dragging')),'The completed-group reveal blocked a new drag');assert.equal(await f.page.locator('.bubble[data-id][hidden].target').count(),0,'A not-yet-reborn category became an invisible drop target');await f.release();await f.idle();
  assert.equal(await f.page.locator('.reborn[data-terms="1"]').count(),1,'Overlapping input lost the category rebirth');
  await f.page.screenshot({path:output+'uninterrupted-input.png'});
  // A failed drop's return can also be interrupted by picking the bubble up again.
  const state=await f.read(),a=state.bubbles.find(b=>b.groupId==='g1'),b=state.bubbles.find(b=>b.groupId==='g2');
  await f.drag(a.id,b.id);await f.release();assert.equal((await f.read()).mistakes,1);
  // Sample the fast-moving return after its initial sweep, while it is still active.
  await f.page.waitForTimeout(200);assert.equal(await f.page.locator('#board').getAttribute('data-busy'),'true');
  // The returning bubble can overlap a neighbour in the pile. Expose the intended
  // touch target so this checks an interrupted return, rather than grabbing that neighbour.
  await f.bubble(a.id).evaluate(el=>el.style.zIndex='100');
  const retry=await f.drag(a.id,{x:140,y:board.y+150});await f.bubble(a.id).evaluate(el=>el.style.removeProperty('z-index'));
  assert.ok(await f.bubble(a.id).evaluate(el=>el.classList.contains('dragging')));await f.page.waitForTimeout(100);
  const retryCenter=await f.center(a.id);assert.ok(Math.hypot(retryCenter.x-retry.x,retryCenter.y-retry.y)<8,'The old return tween fought the new touch');await f.release();await f.idle();
  const rapid=await fixture('nested');
  // Keyboard input also stays live, making two overlapping four-word reveals.
  for(const group of['g0','g1']){const list=rapid.initial.bubbles.filter(b=>b.groupId===group);for(const id of[list[0].id,list[1].id,list[1].id,list[2].id,list[2].id,list[3].id])await rapid.bubble(id).press('Enter');}
  assert.equal((await rapid.read()).solved.length,2);assert.ok(validateState(await rapid.read()));
  await rapid.page.waitForFunction(()=>document.querySelectorAll('.completion').length===2);
  await rapid.page.locator('#tools-button').click();await rapid.page.locator('#undo-button').click();assert.equal((await rapid.read()).solved.length,1);
  await rapid.page.waitForTimeout(1100);assert.equal(await rapid.page.locator('.completion,.merge-ghost').count(),0,'A stale animation returned after undo');assert.ok(validateState(await rapid.read()));
  const keys=await fixture('keylock');assert.deepEqual(await keys.page.evaluate(()=>window.keyArrivalViolations),[],'A key appeared before its matching lock entered the playfield');
  const colors=keys.initial.bubbles.filter(b=>b.keyColor).map(b=>b.keyColor);assert.ok(colors.length>=2);
  const strokes=[];
  for(const color of colors){
    const key=keys.initial.bubbles.find(b=>b.keyColor===color),lock=keys.initial.bubbles.find(b=>b.lockColor===color),partner=keys.initial.bubbles.find(b=>b.groupId===key.groupId&&b.id!==key.id);
    const keyStroke=await keys.bubble(key.id).locator('.key-art g circle').getAttribute('stroke'),lockStroke=await keys.bubble(lock.id).locator('.lock-hardware rect').getAttribute('stroke');assert.equal(keyStroke,lockStroke);strokes.push(keyStroke);
    await keys.join(key.id,partner.id);assert.equal((await keys.read()).solved.length,0,'Key use required a group completion');assert.equal(await keys.bubble(lock.id).locator('.lock-hardware').count(),0,'The lock did not immediately unlock on a partial merge');assert.equal(await keys.bubble(partner.id).locator('.key-art').count(),0,'The key was not consumed');
    const used=(await keys.read()).keys;for(const other of colors.filter(c=>c!==color&&!used.includes(c)))assert.equal(await keys.page.locator(`.bubble[data-id] .lock-hardware[data-pair-color="${other}"]`).count(),1);
  }
  assert.equal(new Set(strokes).size,colors.length,'Simultaneous pairs share a visual color');await keys.page.screenshot({path:output+'colored-key-unlock.png'});
  await keys.page.reload();await keys.page.locator('.bubble[data-id]').first().waitFor();assert.deepEqual((await keys.read()).keys.sort(),colors.sort());assert.equal(await keys.page.locator('.bubble[data-id] .lock-hardware').count(),0);
  assert.deepEqual(errors,[]);console.log('Input/key checks passed: immediate next drag, newly merged target reuse, dragging during a group reveal, interruptible failed returns, overlapping four-word completions, undo cancellation, category rebirth, locks visibly arriving before keys, distinct matching colors, immediate partial-merge unlocks, consumed keys, color isolation, and save/restore.');
}finally{await browser.close();server?.kill();}
