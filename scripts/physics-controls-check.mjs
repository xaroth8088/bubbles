// Real touch sliders, live gravity, continued gameplay, and offline saved tuning.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createPuzzle,makeState} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4182';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4182'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})}),errors=[];
const output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const initial=makeState(createPuzzle({mode:'journey',level:1})),save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion:'system',difficulty:'balanced',challenge:false},activeMode:'journey',level:1,round:1,completed:[],dailyWins:[],sessions:{journey:initial},stats:{groups:0,puzzles:0}};
  await context.addInitScript(value=>{if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(value));},save);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.bubble[data-id]').first().waitFor();await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.waitForTimeout(2000);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1'))),center=async locator=>{const b=await locator.boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const ledger=value=>({clues:value.sessions.journey.bubbles.flatMap(b=>b.atoms.map(a=>a.id)).sort(),reserve:value.sessions.journey.reserve,moves:value.sessions.journey.moves,puzzle:value.sessions.journey.puzzle});
  const before=ledger(await read());await page.locator('#tools-button').tap();await page.locator('#physics-button').tap();
  await page.locator('#physics-panel').waitFor();assert.equal(await page.locator('[data-game-hud]:visible').count(),0);assert.equal(await page.locator('dialog[open]').count(),0);
  // Native touch interaction moves gravity to zero; no synthetic setting mutation.
  const gravity=page.locator('#physics-gravity'),range=await gravity.boundingBox();await page.touchscreen.tap(range.x+12,range.y+range.height/2);assert.equal((await read()).settings.physics.gravity,0);
  const source=page.locator(`.bubble[data-id="${initial.bubbles[0].id}"]`),cdp=await context.newCDPSession(page),start=await center(source),board=await page.locator('#board').boundingBox(),lift={x:180,y:board.y+55};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[lift]});await page.waitForTimeout(350);
  assert.ok(await source.evaluate(el=>el.classList.contains('dragging')),'Tuning mode blocked bubble input');
  // Stop the finger before release so throwing velocity cannot mimic gravity.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:lift.x+1,y:lift.y+1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  // A free bubble may retain a little collision/drag momentum at zero gravity.
  const floating=await center(source);await page.waitForTimeout(3000);const drifted=await center(source);assert.ok(drifted.y<floating.y+10,`Zero gravity did not prevent falling: ${JSON.stringify({floating,drifted})}`);
  await gravity.press('End');assert.equal((await read()).settings.physics.gravity,2);await page.waitForTimeout(250);assert.ok((await center(source)).y>floating.y+35,'Gravity required restarting the board');
  await page.locator('#physics-pressure').press('Home');await page.locator('#physics-damping').press('End');
  assert.deepEqual((await read()).settings.physics,{gravity:2,pressure:.25,damping:2});assert.equal(await page.locator('#physics-pressure-value').textContent(),'25%');assert.deepEqual(ledger(await read()),before,'Tuning changed the puzzle or consumed a move');
  await page.locator('#physics-reset').tap();assert.deepEqual((await read()).settings.physics,{gravity:1,pressure:1,damping:1});assert.deepEqual(ledger(await read()),before);
  await page.locator('#physics-done').tap();assert.equal(await page.locator('[data-game-hud]:visible').count(),4);assert.equal(await page.locator('#physics-panel:visible').count(),0);
  await page.locator('#tools-button').tap();await page.locator('#physics-button').tap();
  for(const viewport of[{width:320,height:640},{width:393,height:852},{width:360,height:780}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(150);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,board:document.querySelector('#board').getBoundingClientRect().toJSON(),sliders:[...document.querySelectorAll('.physics-row input')].map(el=>el.getBoundingClientRect().toJSON())}));
    assert.equal(layout.overflow,false);assert.ok(layout.board.height>350&&layout.board.bottom<=viewport.height+1);assert.ok(layout.sliders.every(b=>b.height>=44&&b.right<=viewport.width));
  }
  await page.evaluate(()=>{for(const [key,value]of Object.entries({gravity:50,pressure:75,damping:25})){const el=document.querySelector(`#physics-${key}`);el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));}});
  await page.screenshot({path:output+'physics-controls-s23.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#physics-panel:visible').count(),0);
  await page.reload();await source.waitFor();assert.deepEqual((await read()).settings.physics,{gravity:.5,pressure:.75,damping:.25});assert.deepEqual(ledger(await read()),before);
  await page.locator('#tools-button').tap();await page.locator('#physics-button').tap();assert.equal(await gravity.inputValue(),'50');assert.equal(await page.locator('#physics-pressure').inputValue(),'75');assert.equal(await page.locator('#physics-damping').inputValue(),'25');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await source.waitFor();
  await page.locator('#tools-button').tap();await page.locator('#physics-button').tap();assert.deepEqual((await read()).settings.physics,{gravity:.5,pressure:.75,damping:.25});await page.locator('#physics-reset').tap();assert.deepEqual((await read()).settings.physics,{gravity:1,pressure:1,damping:1});
  // A fresh offline level must remain playable at zero gravity, too.
  await page.locator('#physics-gravity').press('Home');await page.locator('#physics-done').tap();await page.locator('#levels-button').tap();await page.locator('[data-level="2"]').tap();
  await page.waitForFunction(()=>{const board=document.querySelector('#board').getBoundingClientRect(),bubbles=[...document.querySelectorAll('.bubble[data-id]')];return document.querySelector('#board').dataset.arriving==='0'&&bubbles.length>=24&&bubbles.every(el=>el.querySelector('.membrane-fill').getBoundingClientRect().top>=board.top-1);});
  assert.deepEqual(errors,[]);console.log('Physics controls passed: menu/HUD swap, native touch sliders, immediate gravity on live bubbles, continued dragging, pressure/damping controls, reset, unchanged clues/moves, 320–393px layouts, Escape/Done, and offline saved preferences.');
}finally{await browser.close();server?.kill();}
