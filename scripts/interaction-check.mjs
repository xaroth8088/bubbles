// Focused browser checks for merge choreography and illustrated special states.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createPuzzle,makeState} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4176';let server;
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4176'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const errors=[],contexts=[],output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
async function fixture(special,{reducedMotion='no-preference',specials}={}){
  const puzzle=createPuzzle({mode:'lab',special});if(specials)puzzle.specials=specials;
  const initial=makeState(puzzle),context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion});contexts.push(context);
  const save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion:'system',difficulty:'balanced',challenge:false},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:initial},stats:{groups:0,puzzles:0}};
  await context.addInitScript(value=>{if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(value));},save);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.locator('.bubble').first().waitFor();await page.waitForTimeout(2800);
  const bubble=id=>page.locator(`.bubble[data-id="${id}"]`),center=async locator=>{const box=await locator.boundingBox();assert.ok(box);return{x:box.x+box.width/2,y:box.y+box.height/2};};
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab);
  const idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
  const tap=async id=>{await idle();const p=await center(bubble(id));await page.touchscreen.tap(p.x,p.y);};
  const join=async(a,b)=>{await tap(a);await tap(b);await idle();};
  return{page,context,initial,bubble,center,read,idle,tap,join};
}
try{
  const f=await fixture('nested'),{page,context,initial,bubble,center,read,idle,tap,join}=f;
  const members=initial.bubbles.filter(b=>b.groupId==='g0'),wrong=initial.bubbles.find(b=>b.groupId==='g1');
  const shape=await page.locator('.bubble').evaluateAll(bubbles=>bubbles.map(el=>Number(el.dataset.deformation)));
  assert.ok(shape.some(deformation=>deformation>.04),'The simulated membranes did not deform under weight');
  assert.equal(await page.locator('.bubble-skin').first().evaluate(el=>getComputedStyle(el).transform),'none','The old visual squash still overrides the physical membrane');
  assert.equal(await page.locator('.bubble-label').first().evaluate(el=>getComputedStyle(el).transform),'none','Words were deformed with the skin');
  assert.equal(await page.locator('#instruction,#solved-area').count(),0,'Footer information was not removed');
  const source=members[0],cdp=await context.newCDPSession(page),liftStart=await center(bubble(source.id)),bounds=await page.locator('#board').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[liftStart]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:liftStart.x,y:bounds.y+100}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  let peak=0;for(let i=0;i<65;i++){await page.waitForTimeout(20);peak=Math.max(peak,await bubble(source.id).evaluate(el=>Number(el.dataset.deformation)));}
  assert.ok(peak>.045,'A falling bubble did not wobble on impact');await page.waitForTimeout(1800);
  const origin=await center(bubble(source.id)),destination=await center(bubble(wrong.id));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});
  for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:origin.x+(destination.x-origin.x)*i/10,y:origin.y+(destination.y-origin.y)*i/10}]});
  await page.waitForTimeout(350);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await bubble(source.id).evaluate(el=>el.classList.contains('rejected')),'Missing failed-merge animation');
  await page.waitForTimeout(290);const returned=await center(bubble(source.id));assert.ok(Math.hypot(returned.x-origin.x,returned.y-origin.y)<7,'Failed merge did not return to its original center');
  await idle();assert.equal((await read()).mistakes,1);assert.equal(await page.locator('#toast.visible').count(),0,'Merge failure showed a toast');
  await tap(members[0].id);await tap(members[1].id);await page.waitForTimeout(50);
  assert.ok(await page.locator('.merge-ghost').first().evaluate(el=>el.getAnimations().length>0),'Source did not animate into target');await idle();
  const pair=(await read()).bubbles.find(b=>b.atoms.length===2);assert.equal(await bubble(pair.id).locator('.bubble-term').count(),2);
  const pale=await bubble(members[2].id).evaluate(el=>getComputedStyle(el).getPropertyValue('--bubble-fill'));
  const deep=await bubble(pair.id).evaluate(el=>getComputedStyle(el).getPropertyValue('--bubble-fill'));assert.notEqual(pale,deep);
  await join(pair.id,members[2].id);const triple=(await read()).bubbles.find(b=>b.atoms.length===3);
  assert.equal(await bubble(triple.id).locator('.bubble-term').count(),3);assert.equal(await page.locator('.bubble-count').count(),0);
  // Capture short-lived animation states as they occur, even during a screenshot.
  await page.evaluate(()=>{
    window.rebirthPositions={};
    new MutationObserver(()=>{
      for(const [key,selector]of[['pop','.completion-pop'],['born','.reborn']]){
        const el=document.querySelector(selector);if(!el||window.rebirthPositions[key])continue;
        const box=el.getBoundingClientRect();window.rebirthPositions[key]={x:box.x+box.width/2,y:box.y+box.height/2};
      }
    }).observe(document.querySelector('#board'),{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  });
  await tap(triple.id);await tap(members[3].id);await page.locator('.completion').waitFor();
  assert.equal(await page.locator('.completion').innerText(),initial.puzzle.groups[0].name);assert.equal(await page.locator('.completion').evaluate(el=>parseFloat(getComputedStyle(el).width)),158);
  await page.waitForTimeout(300);
  await page.screenshot({path:output+'completed-group.png'});
  await page.waitForFunction(()=>window.rebirthPositions.pop&&window.rebirthPositions.born);
  const {pop:popCenter,born:newCenter}=await page.evaluate(()=>window.rebirthPositions);
  if(Math.hypot(popCenter.x-newCenter.x,popCenter.y-newCenter.y)>=4){console.log(await page.locator('.reborn').evaluate(el=>({html:el.outerHTML,position:JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab.bubbles.find(b=>b.id===el.dataset.id)?.position,time:performance.now()})));await page.screenshot({path:output+'rebirth-diagnostic.png'});}
  assert.ok(Math.hypot(popCenter.x-newCenter.x,popCenter.y-newCenter.y)<4,`Category moved during rebirth: ${JSON.stringify({popCenter,newCenter})}`);
  assert.equal(await page.locator('.reborn').getAttribute('data-terms'),'1');await idle();assert.equal(await page.locator('#toast.visible').count(),0,'Success showed a toast');
  const layers=await page.evaluate(()=>({ocean:Number(getComputedStyle(document.querySelector('.ocean')).zIndex),board:Number(getComputedStyle(document.querySelector('.board')).zIndex),pointer:getComputedStyle(document.querySelector('.ocean')).pointerEvents,plants:document.querySelectorAll('.kelp').length,fish:document.querySelectorAll('.fish').length}));
  assert.ok(layers.ocean<layers.board);assert.equal(layers.pointer,'none');assert.equal(layers.plants,4);assert.equal(layers.fish,3);
  const frozen=await fixture('frozen'),ice=frozen.initial.bubbles.find(b=>b.ice);
  const coat=()=>frozen.bubble(ice.id).locator('.ice-coat'),checkIce=async remaining=>{
    assert.equal((await frozen.read()).bubbles.find(b=>b.id===ice.id).ice,remaining);
    assert.equal(await coat().getAttribute('data-thaw-stage'),String(4-remaining));
    assert.equal(await coat().locator('.ice-facet').count(),remaining);
    assert.equal(await coat().locator('.ice-fracture').count(),(4-remaining)*2);
    assert.ok((await frozen.bubble(ice.id).getAttribute('aria-label')).includes(`${remaining} successful merge`));
  };
  await checkIce(4);await frozen.bubble(ice.id).screenshot({path:output+'ice-4.png'});
  const group=frozen.initial.bubbles.filter(b=>b.groupId==='g0');
  await frozen.join(group[0].id,group[1].id);await checkIce(3);assert.equal((await frozen.read()).solved.length,0);
  const chip=frozen.page.locator('.state-effect.ice-chip').last();
  assert.equal(await chip.locator('.ice-facet').count(),1);assert.equal(await chip.locator('.ice-surface').count(),0);
  assert.ok(await frozen.bubble(ice.id).evaluate(el=>el.classList.contains('ice-cracking')));
  await frozen.bubble(ice.id).screenshot({path:output+'ice-3.png'});
  await frozen.join(group[1].id,group[2].id);await checkIce(2);
  await frozen.page.reload();await frozen.bubble(ice.id).waitFor();await frozen.page.waitForTimeout(1000);await checkIce(2);
  await frozen.bubble(ice.id).screenshot({path:output+'ice-2.png'});
  await frozen.join(group[2].id,group[3].id);await checkIce(1);assert.equal((await frozen.read()).solved.length,1);
  await frozen.bubble(ice.id).screenshot({path:output+'ice-1.png'});
  const next=(await frozen.read()).bubbles.filter(b=>b.groupId==='g1');await frozen.join(next[0].id,next[1].id);
  assert.equal(await frozen.bubble(ice.id).locator('.ice-coat').count(),0);assert.ok(await frozen.page.locator('.state-effect.thaw').count()>0,'Ice vanished without a melting animation');assert.equal(await frozen.page.locator('#toast.visible').count(),0);
  await frozen.bubble(ice.id).screenshot({path:output+'ice-0.png'});
  const screws=await fixture('screw'),screw=screws.initial.bubbles.find(b=>b.turns);assert.equal(await screws.bubble(screw.id).locator('.screw-head').count(),screw.turns);
  await screws.tap(screw.id);assert.equal((await screws.read()).moves,0);assert.equal(await screws.bubble(screw.id).locator('.screw-head').count(),screw.turns);
  let remaining=screw.turns;
  while(remaining){
    await screws.page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await screws.page.waitForTimeout(600);
    const state=await screws.read(),tool=state.bubbles.find(b=>b.driverColor),partner=state.bubbles.find(b=>b.id!==tool.id&&b.groupId===tool.groupId);
    const removed=1+Number(!!partner.driverColor);await screws.tap(tool.id);await screws.tap(partner.id);remaining-=removed;
    assert.equal(await screws.bubble(screw.id).locator('.screw-head').count(),remaining);assert.ok(await screws.page.locator('.state-effect.unscrew').count()>0);await screws.idle();
  }
  assert.equal(await screws.bubble(screw.id).locator('.screw-ring').count(),0);assert.equal(await screws.page.locator('#toast.visible').count(),0);await screws.page.screenshot({path:output+'special-bubbles.png'});
  const hidden=await fixture('split',{specials:['split','cryptic','frozen']}),parts=hidden.initial.bubbles.filter(b=>b.kind==='split'),masked=hidden.initial.bubbles.filter(b=>b.atoms[0]?.revealed!==undefined),fragmentIce=hidden.initial.bubbles.find(b=>b.ice);
  await hidden.join(parts[0].id,parts[1].id);let state=await hidden.read();for(const b of masked)assert.equal(state.bubbles.find(x=>x.id===b.id).atoms[0].revealed,b.atoms[0].revealed+1);
  assert.equal(state.bubbles.find(b=>b.id===fragmentIce.id).ice,3);assert.equal(await hidden.bubble(fragmentIce.id).locator('.ice-facet').count(),3);
  const cloud=state.bubbles.find(b=>b.kind==='cryptic'),partner=state.bubbles.find(b=>b.groupId===cloud.groupId&&b.id!==cloud.id);await hidden.join(cloud.id,partner.id);
  assert.ok((await hidden.bubble(partner.id).innerText()).includes(cloud.atoms[0].word),'Joined hidden word was not fully revealed');
  const reduced=await fixture('screw',{reducedMotion:'reduce'});assert.equal(await reduced.page.locator('.kelp').first().evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await reduced.page.locator('.fish').first().evaluate(el=>getComputedStyle(el).display),'none');
  const stillIce=await fixture('frozen',{reducedMotion:'reduce'}),still=stillIce.initial.bubbles.find(b=>b.ice),stillGroup=stillIce.initial.bubbles.filter(b=>b.groupId==='g0');
  await stillIce.join(stillGroup[0].id,stillGroup[1].id);assert.equal(await stillIce.bubble(still.id).locator('.ice-facet').count(),3);
  assert.equal(await stillIce.bubble(still.id).locator('.ice-coat').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);console.log('Interaction checks passed: weight deformation, impact wobble, steady labels, expanded playfield, animated failure and return, four-bubble reveal/pop, same-center category rebirth, progressive merge-based thawing, thaw progress after reload, split-word thawing, screw removal, letter reveals, scenery layering, and reduced motion.');
}finally{await browser.close();server?.kill();}
