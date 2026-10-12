// Phone-browser checks for screwdriver words, ordinary partners, and animated screw rings.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createPuzzle,makeState,validateState,isBlocked,toolLock} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4183';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4183'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})}),errors=[];
const output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
async function fixture({count=5,reducedMotion='no-preference',mixed=false,legacy=false}={}){
  const puzzle=createPuzzle({mode:'lab',special:'screw'});if(mixed)puzzle.specials=['screw','keylock'];
  let initial;
  for(let seed=0;seed<100;seed++){
    initial=makeState(puzzle,{shuffleSeed:`browser-screw-${seed}`});if(initial.bubbles.find(b=>b.turns)?.turns===count&&initial.bubbles.filter(b=>b.driverColor).length===count)break;
  }
  const lock=initial.bubbles.find(b=>b.turns);assert.equal(lock.turns,count);
  if(legacy){for(const b of [...initial.bubbles,...initial.reserve.flat()]){delete b.driverColor;delete b.screwColor;delete b.screwTotal;}}
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion});
  const save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion:'system',difficulty:'balanced',challenge:false},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:initial},stats:{groups:0,puzzles:0}};
  await context.addInitScript(value=>{
    if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(value));
    window.driverArrivalViolations=[];const observed=new Set();
    const observe=()=>{const board=document.querySelector('#board');if(!board)return;new MutationObserver(()=>{
      for(const el of board.querySelectorAll('.bubble[data-id]:not([hidden])')){
        const tool=el.querySelector('.screwdriver-art');if(!tool||observed.has(el.dataset.id))continue;observed.add(el.dataset.id);
        const color=tool.dataset.pairColor,lock=[...board.querySelectorAll('.bubble[data-id]:not([hidden])')].find(el=>el.querySelector(`.screw-ring[data-pair-color="${color}"]`));
        const field=board.getBoundingClientRect(),box=lock?.querySelector('.membrane-fill').getBoundingClientRect();
        if(!box||box.top<field.top-1)window.driverArrivalViolations.push({color,visible:!!box,top:box?.top,fieldTop:field.top});
      }
    }).observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});};
    document.addEventListener('DOMContentLoaded',observe);
  },save);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.bubble').first().waitFor();await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.waitForTimeout(1000);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab),bubble=id=>page.locator(`.bubble[data-id="${id}"]`);
  // Enter uses exactly the bubble's tap handler, with no coordinate drift while membranes move.
  const tap=id=>bubble(id).press('Enter'),idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
  const join=async(a,b)=>{await tap(a);await tap(b);};
  return{page,read,bubble,tap,join,idle,lock,initial};
}
try{
  const f=await fixture(),lock=f.lock;let state=await f.read();
  assert.deepEqual(await f.page.evaluate(()=>window.driverArrivalViolations),[]);assert.equal(await f.bubble(lock.id).locator('.screw-head').count(),5);
  const tools=state.bubbles.filter(b=>b.driverColor);assert.equal(tools.length,5);
  const color=await f.bubble(lock.id).locator('.screw-ring').getAttribute('data-pair-color');
  for(const tool of tools){assert.equal(await f.bubble(tool.id).locator('.screwdriver-art').getAttribute('data-pair-color'),color);assert.equal(await f.bubble(tool.id).locator('.screwdriver-art rect').getAttribute('stroke'),await f.bubble(lock.id).locator('.screw-ring>circle').first().getAttribute('stroke'));}
  const centers=await f.bubble(lock.id).locator('.screw-head').evaluateAll(els=>els.map(el=>el.getAttribute('transform')));assert.equal(new Set(centers).size,5);
  await f.page.screenshot({path:output+'screwdrivers-s23.png'});
  await f.tap(lock.id);assert.equal((await f.read()).moves,0);assert.equal((await f.read()).bubbles.find(b=>b.id===lock.id).turns,5);
  const a=tools[0],wrong=state.bubbles.find(b=>b.groupId!==a.groupId&&!b.driverColor&&!isBlocked(b)),atoms=structuredClone([a.atoms,wrong.atoms]);
  await f.join(a.id,wrong.id);
  state=await f.read();assert.equal(state.bubbles.find(b=>b.id===lock.id).turns,5);assert.equal(state.bubbles.find(b=>b.id===a.id).driverColor,lock.screwColor);
  assert.deepEqual([state.bubbles.find(x=>x.id===a.id).atoms,state.bubbles.find(x=>x.id===wrong.id).atoms],atoms);assert.equal(state.mistakes,1);assert.equal(state.moves,1);
  assert.equal(await f.page.locator('.state-effect.unscrew').count(),0,'A failed word merge removed a screw');await f.idle();
  await f.page.locator('#tools-button').click();await f.page.locator('#undo-button').click();await f.page.locator('#tools-button').click();
  const b=(await f.read()).bubbles.find(b=>b.id!==a.id&&b.groupId===a.groupId&&!b.driverColor&&!isBlocked(b));assert.ok(b);
  await f.join(a.id,b.id);
  assert.equal((await f.read()).bubbles.find(b=>b.id===lock.id).turns,4);assert.equal(await f.bubble(lock.id).locator('.screw-head').count(),4);
  assert.equal(await f.page.locator('.state-effect.unscrew').last().locator('.screw-head').count(),1);assert.equal(await f.bubble(b.id).locator('.screwdriver-art').count(),0);
  state=await f.read();assert.equal(state.bubbles.find(x=>x.id===b.id).atoms.length,2);assert.equal(state.mistakes,0);assert.equal(state.moves,1);
  // The next touch can start while the removed screw and the merge are animating.
  const other=(await f.read()).bubbles.find(item=>item.id!==lock.id&&item.id!==b.id&&!item.driverColor&&!isBlocked(item)),box=await f.bubble(other.id).boundingBox();
  const cdp=await f.page.context().newCDPSession(f.page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:250}]});
  assert.ok(await f.bubble(other.id).evaluate(el=>el.classList.contains('dragging')));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await f.idle();
  await f.page.locator('#tools-button').click();await f.page.locator('#undo-button').click();
  assert.equal((await f.read()).bubbles.find(b=>b.id===lock.id).turns,5);assert.equal(await f.bubble(a.id).locator('.screwdriver-art').count(),1);
  assert.equal(await f.page.locator('.state-effect,.merge-ghost').count(),0);await f.page.locator('#tools-button').click();
  await f.join(a.id,b.id);await f.idle();
  await f.page.reload();await f.bubble(lock.id).waitFor();assert.equal((await f.read()).bubbles.find(b=>b.id===lock.id).turns,4);
  assert.equal((await f.read()).bubbles.filter(b=>b.driverColor).length+(await f.read()).reserve.flat().filter(b=>b.driverColor).length,4);
  while((await f.read()).bubbles.find(b=>b.id===lock.id).turns){
    state=await f.read();const tool=state.bubbles.find(b=>b.driverColor),partner=state.bubbles.find(b=>b.id!==tool.id&&b.groupId===tool.groupId&&!isBlocked(b));assert.ok(partner);
    await f.join(tool.id,partner.id);await f.idle();
  }
  assert.equal(await f.bubble(lock.id).locator('.screw-ring').count(),0);assert.ok(validateState(await f.read()));assert.equal(await f.page.locator('#toast.visible').count(),0);
  // A real touch drag can use a screwdriver directly on its blocked ring.
  const direct=await fixture({count:2}),directState=await direct.read(),directDriver=directState.bubbles.find(b=>b.driverColor),from=await direct.bubble(directDriver.id).boundingBox(),to=await direct.bubble(direct.lock.id).boundingBox();
  const directTouch=await direct.page.context().newCDPSession(direct.page);
  await directTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from.x+from.width/2,y:from.y+from.height/2}]});
  await directTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:to.x+to.width/2,y:to.y+to.height/2}]});
  assert.ok(await direct.bubble(direct.lock.id).evaluate(el=>el.classList.contains('target')));await directTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal((await direct.read()).bubbles.find(b=>b.id===direct.lock.id).turns,1);assert.equal((await direct.read()).mistakes,0);
  assert.equal(await direct.bubble(directDriver.id).count(),1);assert.equal(await direct.bubble(directDriver.id).locator('.screwdriver-art').count(),0);await direct.idle();
  const lastDriver=(await direct.read()).bubbles.find(b=>b.driverColor);await direct.join(lastDriver.id,direct.lock.id);
  assert.equal((await direct.read()).bubbles.find(b=>b.id===direct.lock.id).turns,0);assert.equal(await direct.bubble(direct.lock.id).locator('.screw-ring').count(),0);assert.ok(validateState(await direct.read()));
  const mixed=await fixture({count:2,mixed:true});state=await mixed.read();const key=state.bubbles.find(b=>b.keyColor),keyLock=toolLock(key,state.bubbles),partner=state.bubbles.find(b=>b.groupId===key.groupId&&b.id!==key.id&&!isBlocked(b)&&!b.driverColor);
  await mixed.join(key.id,partner.id);assert.equal((await mixed.read()).bubbles.find(b=>b.id===keyLock.id).lockColor,undefined);assert.equal((await mixed.read()).bubbles.find(b=>b.id===mixed.lock.id).turns,2);
  assert.notEqual(key.keyColor,mixed.lock.screwColor);assert.deepEqual(await mixed.page.evaluate(()=>window.driverArrivalViolations),[]);
  const reduced=await fixture({count:2,reducedMotion:'reduce'}),driver=(await reduced.read()).bubbles.find(b=>b.driverColor),mate=(await reduced.read()).bubbles.find(b=>b.groupId===driver.groupId&&b.id!==driver.id&&!isBlocked(b));
  await reduced.join(driver.id,mate.id);assert.equal((await reduced.read()).bubbles.find(b=>b.id===reduced.lock.id).turns,2-1-Number(!!mate.driverColor));assert.ok(validateState(await reduced.read()));
  const legacy=await fixture({count:2,legacy:true});assert.equal((await legacy.read()).moves,0);assert.equal((await legacy.read()).bubbles.filter(b=>b.driverColor).length+(await legacy.read()).reserve.flat().filter(b=>b.driverColor).length,2);assert.ok(validateState(await legacy.read()));
  await f.page.context().setOffline(true);await f.page.reload();await f.bubble(lock.id).waitFor();assert.equal((await f.read()).bubbles.find(b=>b.id===lock.id).turns,0);assert.equal(await f.bubble(lock.id).locator('.screw-ring').count(),0);
  assert.deepEqual(errors,[]);console.log('Screw checks passed: failed word merges retain tools and record a mistake, legal matching partners consume tools, native touch onto a blocked ring, one-time tool consumption, screw animations, immediate next touch, undo, reload/offline state, color/key isolation, legacy saves, and reduced motion.');
}finally{await browser.close();server?.kill();}
