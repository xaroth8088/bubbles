// Optional browser QA: install Playwright, or set PLAYWRIGHT_PATH to an existing package.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {clearableGroups} from '../src/engine.js';
const packagePath=process.env.PLAYWRIGHT_PATH;
const {chromium}=await import(packagePath?pathToFileURL(packagePath).href:'playwright');
let server;
const base=process.env.TEST_URL||'http://127.0.0.1:4174';
if(!process.env.TEST_URL){
  server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4174',HOST:'127.0.0.1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`Test server exited: ${code}`)));});
}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const output=fileURLToPath(new URL('../test-results/',import.meta.url));
await mkdir(output,{recursive:true});
const errors=[],network=[];
const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:3,isMobile:true,hasTouch:true});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>network.push(request.url()));
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions[JSON.parse(localStorage.getItem('bubble-grove-v1')).activeMode]);
const bubble=id=>page.locator(`.bubble[data-id="${id}"]`);
const center=async id=>{const box=await bubble(id).boundingBox();assert.ok(box,id);return{x:box.x+box.width/2,y:box.y+box.height/2};};
async function tap(id){await page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');const p=await center(id);await page.touchscreen.tap(p.x,p.y);await page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');}
const settle=async()=>{await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.waitForTimeout(1800);};
async function useTool(id){await page.locator('#tools-button').click();await page.locator(id).click();}
async function layout(){
  const result=await page.evaluate(()=>{const app=document.querySelector('.app'),board=document.querySelector('.board'),bubbles=[...document.querySelectorAll('.bubble')],tools=document.querySelector('.tools').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,app:app.getBoundingClientRect().toJSON(),board:board.getBoundingClientRect().toJSON(),tools:tools.toJSON(),bubbles:bubbles.map(b=>({...b.getBoundingClientRect().toJSON(),terms:b.dataset.terms,surface:b.querySelector('.membrane-fill').getBoundingClientRect().toJSON()}))};});
  assert.ok(result.scrollWidth<=result.width,`Horizontal overflow ${JSON.stringify(result)}`);
  if(result.height>=780)assert.ok(result.tools.bottom<=result.height,`Thumb controls out of viewport ${JSON.stringify(result)}`);
  if(result.width>=360)assert.ok(result.board.width/74<5&&result.board.width/74>4.5,'Board should be just shy of five single bubbles wide');
  if(result.width===360)assert.ok(Math.abs(result.board.width-result.width)<=2,'The S23 playfield should use the full phone width, including its border');
  assert.ok(result.board.height>=result.height-205,'The playfield should occupy the former footer space');
  assert.ok(result.board.bottom>=result.height-16,'The playfield should extend to the bottom safe area');
  for(const b of result.bubbles){assert.equal(Math.round(b.width),Math.round({'.5':54,'0.5':54,1:74,2:108,3:134,4:158}[b.terms]*Math.min(1,result.board.width/358)),'Fixed nominal bubble size changed');assert.ok(b.surface.left>=result.board.left-1&&b.surface.right<=result.board.right+1,'Membrane off horizontal board');assert.ok(b.surface.top>=result.board.top-1&&b.surface.bottom<=result.board.bottom+1,`Membrane off vertical board ${JSON.stringify({bubble:b,board:result.board,viewport:[result.width,result.height]})}`);}
  return result;
}

try{
  await page.goto(base);await page.locator('.bubble').first().waitFor();await settle();
  await layout();await page.screenshot({path:path.join(output,'galaxy-s23.png')});
  const labels=await page.locator('.bubble-label').evaluateAll(nodes=>nodes.map(el=>({font:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height,bubbleHeight:el.parentElement.getBoundingClientRect().height})));
  assert.ok(labels.every(label=>label.font>0&&label.font<=18&&label.height<=label.bubbleHeight*.7),'A shuffled clue did not fit its bubble');
  let state=await read();assert.equal(state.bubbles.length,24);assert.ok(state.reserve.flat().length>=16);assert.ok(state.bubbles.length+state.reserve.flat().length<=70);
  const journeyShuffle=state.puzzle.shuffleSeed;assert.ok(journeyShuffle,'Journey started without a fresh shuffle');
  const cdp=await context.newCDPSession(page);
  // A held bubble follows the finger; releasing it in open space lets gravity take over.
  await page.locator('#help-button').click();await page.locator('#specials-button').click();await page.locator('[data-special="nested"]').click();await settle();state=await read();
  const falling=state.bubbles[0],start=await center(falling.id),board=await page.locator('.board').boundingBox();
  const singleSize=(await bubble(falling.id).boundingBox()).width;
  const release={x:start.x,y:board.y+singleSize/2+4};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[release]});
  assert.ok(Math.abs((await center(falling.id)).y-release.y)<3,'Held bubble slipped away from finger');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(500);assert.ok((await center(falling.id)).y>release.y+30,`Gravity did not drop released bubble: ${JSON.stringify({release,after:await center(falling.id)})}`);
  assert.equal((await read()).moves,0);await settle();
  await page.locator('[data-mode="journey"]').click();await settle();state=await read();
  // Genuine touch pointer drag of one word onto another word.
  const group=state.bubbles[0].groupId,pair=state.bubbles.filter(b=>b.groupId===group).slice(0,2);
  const a=await center(pair[0].id),b=await center(pair[1].id);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x,y:a.y}]});
  for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12}]});}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
  state=await read();assert.equal(state.bubbles.length,23,'Touch drag did not merge');assert.equal(state.moves,1);
  const joined=state.bubbles.find(b=>b.atoms.length===2);
  assert.equal(await page.locator('.bubble-count').count(),0,'Progress labels should be absent');
  assert.deepEqual(await bubble(joined.id).locator('.bubble-term').allTextContents(),joined.atoms.map(a=>a.word));
  assert.ok(!(await bubble(joined.id).innerText()).includes(state.puzzle.groups.find(g=>g.id===group).name),'Pair revealed the category');
  await settle();assert.ok((await bubble(joined.id).boundingBox()).width>singleSize*1.35,'Pair did not grow');
  const waitingOrder=state.reserve.flat().map(b=>b.id);
  await page.reload();await page.locator('.bubble').first().waitFor();await settle();assert.equal((await read()).bubbles.length,23,'Resume lost the merge');
  assert.equal((await read()).puzzle.shuffleSeed,journeyShuffle,'Resume changed the shuffle');assert.deepEqual((await read()).reserve.flat().map(b=>b.id),waitingOrder,'Resume reshuffled the waiting deck');
  // Tap-to-combine fallback, undo, then finish a group.
  state=await read();let list=state.bubbles.filter(b=>b.groupId===group);await tap(list[0].id);await tap(list[1].id);assert.equal((await read()).moves,2);
  await useTool('#undo-button');assert.equal((await read()).moves,1,'Undo failed');
  state=await read();list=state.bubbles.filter(b=>b.groupId===group);await tap(list[0].id);await tap(list[1].id);await settle();
  state=await read();const triple=state.bubbles.find(b=>b.atoms.length===3);assert.ok(triple);
  assert.deepEqual(await bubble(triple.id).locator('.bubble-term').allTextContents(),triple.atoms.map(a=>a.word));
  assert.ok((await bubble(triple.id).boundingBox()).width>singleSize*1.65,'Triple did not grow');
  await page.screenshot({path:path.join(output,'three-term-bubble.png')});
  const waiting=state.reserve.flat().length,before=new Set(state.bubbles.map(b=>b.id));
  await page.evaluate(existing=>{
    window.reserveEntries={};window.reserveQueued={};const live=new Set(existing);
    new MutationObserver(()=>{
      for(const el of document.querySelectorAll('.bubble[data-id]'))if(!live.has(el.dataset.id)){if(el.hidden)window.reserveQueued[el.dataset.id]=true;else if(window.reserveEntries[el.dataset.id]===undefined)window.reserveEntries[el.dataset.id]=el.getBoundingClientRect().top;}
    }).observe(document.querySelector('#board'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  },[...before]);
  list=state.bubbles.filter(b=>b.groupId===group);await tap(list[0].id);await tap(list[1].id);state=await read();assert.equal(state.solved.length,1);
  const incoming=state.bubbles.filter(b=>!before.has(b.id));assert.ok(incoming.length>0&&incoming.length<=4);assert.ok(state.reserve.flat().length<waiting);
  assert.ok(await page.evaluate(ids=>ids.every(id=>window.reserveQueued[id]),incoming.map(b=>b.id)),'The refill was not queued for sprinkling');
  await bubble(incoming[0].id).waitFor({state:'visible'});
  assert.ok(await page.evaluate(id=>window.reserveEntries[id],incoming[0].id)<board.y,'Incoming words did not start above board');await settle();await layout();
  // Settings, library, special gallery, and practice puzzle.
  await page.locator('#settings-button').click();await page.selectOption('#setting-theme','lavender');await page.locator('#close-sheet').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'lavender');
  await page.locator('#settings-button').click();const downloading=page.waitForEvent('download');await page.locator('#export-button').click();const download=await downloading;const backup=path.join(output,'progress-backup.json');await download.saveAs(backup);
  const replayDeck=await read();
  await page.locator('#restart-button').click();await page.locator('#confirm-restart').click();const restarted=await read();assert.equal(restarted.solved.length,0,'Restart did not restore initial board');
  assert.notEqual(restarted.puzzle.shuffleSeed,replayDeck.puzzle.shuffleSeed,'Restart reused the Journey shuffle');assert.deepEqual(restarted.puzzle.groups,replayDeck.puzzle.groups,'Restart changed the level clues');
  assert.notDeepEqual(restarted.reserve.flat().map(b=>b.id),replayDeck.reserve.flat().map(b=>b.id),'Restart repeated the waiting deck order');
  await page.locator('#settings-button').click();await page.locator('#import-file').setInputFiles(backup);await page.locator('#restore-confirm').click();assert.equal((await read()).solved.length,1,'Backup did not restore progress');
  await useTool('#library-button');await page.locator('#library-search').fill('palindromes');assert.equal(await page.locator('.library-item').count(),1);await page.locator('#close-sheet').click();
  const shuffleWords=(await read()).bubbles.flatMap(b=>b.atoms.map(a=>a.id)).sort();
  await useTool('#shuffle-button');await settle();const firstShuffle=await page.locator('.bubble').evaluateAll(nodes=>nodes.map(el=>`${el.dataset.id}:${el.style.translate}`).sort());
  await useTool('#shuffle-button');await settle();const secondShuffle=await page.locator('.bubble').evaluateAll(nodes=>nodes.map(el=>`${el.dataset.id}:${el.style.translate}`).sort());
  assert.notDeepEqual(firstShuffle,secondShuffle,'Repeated shuffles reused the same arrangement');assert.deepEqual((await read()).bubbles.flatMap(b=>b.atoms.map(a=>a.id)).sort(),shuffleWords,'Shuffle changed the live word deck');
  await page.locator('#help-button').click();await page.locator('#specials-button').click();assert.equal(await page.locator('[data-special]').count(),13);await page.locator('[data-special="split"]').click();
  await settle();state=await read();const parts=state.bubbles.filter(b=>b.kind==='split');assert.equal(parts.length,2);await tap(parts[0].id);await tap(parts[1].id);assert.equal((await read()).bubbles.filter(b=>b.kind==='split').length,0);
  await page.locator('[data-mode="journey"]').click();assert.equal((await read()).solved.length,1,'Practice overwrote journey');
  // Install manifest and real service-worker offline reload.
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const manifest=await page.evaluate(async()=>await(await fetch('./manifest.webmanifest')).json());assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,3);
  const sizes=await page.evaluate(async()=>{const manifest=await(await fetch('./manifest.webmanifest')).json();return await Promise.all(manifest.icons.map(async icon=>{const image=new Image();image.src=icon.src;await image.decode();return[image.naturalWidth,image.naturalHeight];}));});assert.deepEqual(sizes,[[192,192],[512,512],[512,512]]);
  await context.setOffline(true);await page.reload();await page.locator('.bubble').first().waitFor();assert.equal((await read()).solved.length,1);
  assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller),'Offline reload lost its worker');
  assert.equal(await page.evaluate(async()=>(await fetch('./src/physics.js')).status),200,'Physics missing from offline cache');
  let unreachable=false;try{await page.evaluate(async()=>{await fetch('./network-probe',{cache:'no-store'});});}catch{unreachable=true;}
  assert.ok(unreachable,'Offline test still has a network connection');
  await page.locator('[data-mode="daily"]').click();assert.equal((await read()).puzzle.mode,'daily');await useTool('#hint-button');assert.ok(await page.locator('.hinted').count()>0);
  await useTool('#magnet-button');await page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');assert.equal((await read()).solved.length,1);
  await context.setOffline(false);
  // Portrait sizes, browser-chrome-constrained height, and desktop.
  for(const size of[{width:360,height:680},{width:393,height:852},{width:320,height:640}]){await page.setViewportSize(size);await settle();await page.screenshot({path:path.join(output,`portrait-${size.width}-${size.height}.png`),fullPage:true});await layout();}
  await page.setViewportSize({width:360,height:780});await page.locator('[data-mode="journey"]').click();await page.locator('#levels-button').click();await page.locator('[data-level="1"]').click();
  const chosen=await read();assert.notEqual(chosen.puzzle.shuffleSeed,journeyShuffle,'Replaying a level reused its shuffle');
  await page.locator('#levels-button').click();await page.locator('[data-level="1"]').click();const replayed=await read();
  assert.notEqual(replayed.puzzle.shuffleSeed,chosen.puzzle.shuffleSeed,'Choosing the same level twice reused the shuffle');
  assert.notDeepEqual(replayed.bubbles.map(b=>b.id),chosen.bubbles.map(b=>b.id),'Replaying repeated the opening deal');
  await page.locator('#settings-button').click();await page.selectOption('#setting-theme','grove');await page.locator('#close-sheet').click();await settle();await page.screenshot({path:path.join(output,'galaxy-s23.png')});
  // Win dialog and next-level progression work through actual touch input.
  for(let i=0;i<85;i++){state=await read();if(state.status==='won')break;const group=clearableGroups(state)[0],list=state.bubbles.filter(b=>b.groupId===group.id);assert.ok(list.length>=2);await tap(list[0].id);await tap(list[1].id);if((await read()).solved.length>state.solved.length)await settle();else await page.waitForTimeout(300);}
  assert.equal((await read()).status,'won');await page.locator('#next-button').waitFor();await page.locator('#next-button').click();assert.equal((await read()).puzzle.level,2);assert.notEqual((await read()).puzzle.shuffleSeed,replayed.puzzle.shuffleSeed,'Next level reused the shuffle');
  const desktop=await browser.newPage({viewport:{width:1280,height:1000}});desktop.on('pageerror',error=>errors.push(error.message));await desktop.goto(base);await desktop.waitForTimeout(1800);await desktop.screenshot({path:path.join(output,'desktop.png')});
  assert.deepEqual(errors,[],'Browser errors');assert.ok(network.every(url=>url.startsWith(base)),'Unexpected external requests');
  console.log('Browser checks passed: fresh Journey deals on start/restart/replay, preserved shuffle on resume, gravity, touch drag, growing word clusters, hidden categories, reserve arrivals, tap merges, undo, special practice, library, portrait sizes, manifest icons, and offline reload.');
  console.log(`Screenshots: ${output}`);
}finally{await browser.close();server?.kill();}
