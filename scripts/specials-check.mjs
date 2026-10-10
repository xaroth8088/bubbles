import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createPuzzle,makeState,validateState} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4184';let server,browser;
const contexts=[],errors=[],output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});
try{
  if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4184'},windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  async function fixture(special,{motion='system',legacy=false,chainOnly=false,depth=2}={}){
    let puzzle=createPuzzle({mode:'lab',special});
    if(depth===3){
      for(let round=1;round<=100;round++){
        const candidate=createPuzzle({mode:'endless',special,round,difficulty:'tricky'});
        if(candidate.groups.filter(g=>g.parentId).length===3){puzzle={...candidate,mode:'lab'};break;}
      }
      assert.equal(puzzle.groups.filter(g=>g.parentId).length,3,'No runtime three-return route was assembled');
    }
    if(chainOnly)puzzle.groups=puzzle.groups.filter(g=>g.id==='g0'||g.childId);
    const initial=makeState(puzzle);
    if(legacy){const dotted=initial.bubbles.find(b=>b.kind==='cryptic');dotted.kind='hidden';dotted.atoms[0].revealed=2;const plain=initial.bubbles.find(b=>b.kind==='normal');plain.kind='crack';plain.shell=true;initial.puzzle.specials=['hidden','crack','octopus'];initial.pressure=4;}
    initial.bubbles.forEach((b,i)=>b.position={x:.125+(i%4)*.25,y:.12+Math.floor(i/4)*.19});
    assert.ok(validateState(initial));
    const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true});contexts.push(context);
    const save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion,difficulty:'balanced',challenge:false,physics:{gravity:0,pressure:1,damping:1}},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:initial},stats:{groups:0,puzzles:0}};
    await context.addInitScript(value=>{if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(value));},save);
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.bubble[data-id]').first().waitFor();await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');
    await page.waitForTimeout(500);
    await page.evaluate(()=>{window.effects=[];new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&(node.matches('.state-effect,.decoy-pop,.completion,.reborn')))window.effects.push(node.className);}).observe(document.querySelector('#board'),{childList:true});});
    const bubble=id=>page.locator(`.bubble[data-id="${id}"]`),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab);
    const idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
    const tap=async id=>bubble(id).dispatchEvent('click',{detail:0});
    const join=async(a,b)=>{await tap(a);await tap(b);await idle();};
    const clear=async id=>{let s=await read(),members=s.bubbles.filter(b=>b.groupId===id);while(members.length>1){await join(members[0].id,members[1].id);s=await read();members=s.bubbles.filter(b=>b.groupId===id);}};
    return{page,context,initial,bubble,read,idle,tap,join,clear};
  }
  for(const motion of['system','reduced']){
    const f=await fixture('linked',{motion}),pair=f.initial.bubbles.filter(b=>b.link),real=pair.find(b=>!b.decoy),fake=pair.find(b=>b.decoy);assert.ok(real&&fake);
    const cdp=await f.context.newCDPSession(f.page),bounds=await f.page.locator('#board').boundingBox();
    const center=async id=>{const box=await f.bubble(id).boundingBox();return{x:box.x+box.width/2,y:box.y+box.height/2};};
    for(const end of[real,fake]){
      const start=await center(end.id);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
      for(const point of[{x:bounds.x+bounds.width+150,y:start.y},{x:bounds.x-150,y:start.y},{x:start.x,y:bounds.y-150},{x:start.x,y:bounds.y+bounds.height+150}]){
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});await f.page.waitForTimeout(70);
        for(const b of pair){const box=await f.bubble(b.id).boundingBox();assert.ok(box.x>=bounds.x-.5&&box.x+box.width<=bounds.x+bounds.width+.5,'Linked pair escaped a side wall');assert.ok(box.y>=bounds.y-.5&&box.y+box.height<=bounds.y+bounds.height+.5,'Linked pair escaped the top or bottom');}
      }
      // Cancel instead of making an arbitrary drop at the last wall.
      await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await f.page.waitForTimeout(150);
    }
    const mate=f.initial.bubbles.find(b=>b.groupId===real.groupId&&b.id!==real.id);
    await f.join(fake.id,mate.id);assert.ok((await f.read()).bubbles.some(b=>b.id===fake.id));
    await f.tap(real.id);await f.tap(mate.id);
    if(motion==='system'){
      assert.equal(await f.page.locator('.decoy-pop').count(),1);
      await f.page.locator('#tools-button').click();await f.page.locator('#undo-button').click();
      assert.equal(await f.page.locator('.decoy-pop').count(),0,'Undo left an obsolete decoy pop on the board');
      assert.equal(await f.bubble(fake.id).count(),1);assert.ok(validateState(await f.read()));
      await f.join(real.id,mate.id);
    }else await f.idle();
    assert.equal(await f.bubble(fake.id).count(),0);assert.ok(!(await f.read()).bubbles.some(b=>b.link||b.decoy));
    if(motion==='system')assert.ok((await f.page.evaluate(()=>window.effects)).some(c=>c.includes('decoy-pop')),'The linked decoy did not animate its pop');
    assert.equal(await f.page.locator('#toast.visible').count(),0);assert.ok(validateState(await f.read()));
  }
  const locks=await fixture('keylock');
  for(const lock of locks.initial.bubbles.filter(b=>b.lockColor)){
    assert.equal((await locks.bubble(lock.id).innerText()).trim(),'•••');
    assert.ok(!(await locks.bubble(lock.id).getAttribute('aria-label')).includes(lock.atoms[0].word),'A locked word leaked through accessibility text');
    const key=locks.initial.bubbles.find(b=>b.keyColor===lock.lockColor),mate=(await locks.read()).bubbles.find(b=>b.groupId===key.groupId&&b.id!==key.id);
    await locks.join(key.id,mate.id);assert.ok((await locks.bubble(lock.id).innerText()).includes(lock.atoms[0].word));
  }
  assert.ok((await locks.page.evaluate(()=>window.effects)).some(c=>c.includes('unlock')));
  await locks.page.screenshot({path:output+'special-locks.png'});
  for(const special of['sealed','pinlock']){
    const f=await fixture(special),held=f.initial.bubbles.find(b=>special==='sealed'?b.clearsNeeded:b.pinsNeeded),selector=special==='sealed'?'.kelp-wrap':'.pinned-art';
    assert.equal(await f.bubble(held.id).locator(selector).count(),1);assert.equal(await f.bubble(held.id).locator('.lock-hardware').count(),0);
    await f.page.screenshot({path:output+`special-${special}.png`});
    await f.clear('g0');if(special==='pinlock'){assert.equal(await f.bubble(held.id).locator('[data-pin-index]').count(),1);await f.clear('g1');}
    assert.equal(await f.bubble(held.id).locator(selector).count(),0);
    assert.ok((await f.page.evaluate(()=>window.effects)).some(c=>c.includes(special==='sealed'?'untangle':'unpin')));
  }
  const chain=await fixture('nested',{chainOnly:true}),child=chain.initial.puzzle.groups[0],parent=chain.initial.puzzle.groups.find(g=>g.id===child.parentId),grand=chain.initial.puzzle.groups.find(g=>g.id===parent.parentId);
  for(const g of[child,parent]){await chain.clear(g.id);const b=(await chain.read()).bubbles.find(b=>b.id===`${g.id}-theme`);assert.equal(b.atoms[0].word,g.name);assert.equal(b.kind,'normal');assert.equal(await chain.bubble(b.id).getAttribute('data-terms'),'1');assert.ok(validateState(await chain.read()));}
  await chain.clear(grand.id);assert.equal((await chain.read()).status,'won');
  const deep=await fixture('nested',{chainOnly:true,depth:3});
  for(const g of deep.initial.puzzle.groups){
    assert.equal((await deep.read()).bubbles.filter(b=>b.groupId===g.id).reduce((n,b)=>n+b.atoms.length,0),4);
    await deep.clear(g.id);assert.ok(validateState(await deep.read()));
    if(g.parentId){const b=(await deep.read()).bubbles.find(b=>b.id===`${g.id}-theme`);assert.equal(b.atoms[0].word,g.name);assert.equal(b.kind,'normal');assert.equal(await deep.bubble(b.id).getAttribute('data-terms'),'1');}
  }
  assert.equal((await deep.read()).status,'won');
  const bonus=await fixture('picture');await bonus.page.locator('#help-button').click();await bonus.page.locator('#specials-button').click();
  assert.equal(await bonus.page.locator('[data-special]').count(),13);assert.equal(await bonus.page.locator('[data-special="hidden"],[data-special="crack"],[data-special="octopus"]').count(),0);
  await bonus.page.locator('[data-special="bonus"]').click();await bonus.page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');
  let save=await bonus.page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')));assert.equal(save.settings.challenge,false);assert.ok(save.sessions.lab.remaining>0);
  await bonus.tap('bonus');save=await bonus.page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')));assert.equal(save.settings.challenge,false);
  await bonus.page.locator('[data-mode="journey"]').click();save=await bonus.page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')));assert.equal(save.sessions.journey.remaining,null);assert.ok(!save.sessions.journey.bubbles.some(b=>b.kind==='bonus'));
  const legacy=await fixture('cryptic',{legacy:true});assert.deepEqual((await legacy.read()).puzzle.specials,['cryptic']);assert.ok(!(await legacy.read()).bubbles.some(b=>b.shell||b.kind==='hidden'));assert.equal(await legacy.page.locator('#octopus,.octopus-art,.word-cloud,.shell-cracks').count(),0);
  await legacy.page.evaluate(async()=>{await navigator.serviceWorker.ready;});await legacy.context.setOffline(true);await legacy.page.reload();await legacy.page.locator('.bubble').first().waitFor();assert.ok(validateState(await legacy.read()));assert.equal(await legacy.page.locator('.word-cloud,.shell-cracks').count(),0);
  await legacy.page.locator('#help-button').click();await legacy.page.locator('#specials-button').click();await legacy.page.locator('[data-special="nested"]').click();
  await legacy.page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');const offline=await legacy.read();
  assert.ok(validateState(offline));assert.ok(offline.puzzle.groups.filter(g=>g.parentId).length>=2,'A fresh offline demo did not assemble a runtime chain');
  assert.deepEqual(errors,[]);console.log('Special bubble checks passed: linked walls and decoy pops in both motion modes, concealed colored locks, kelp and pin release animations, two- and three-return runtime chains, thirteen demos, bonus-only move budgets, legacy migration, offline replay, and fresh offline chain assembly.');
}finally{for(const c of contexts)await c.close();await browser?.close();server?.kill();}
