// Real-browser regression for picture-heavy boards, saved pictures, and replay.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createPuzzle,makeState,validateState} from '../src/engine.js';
import {ALL_PACK_IDS,getCatalog} from '../src/catalog.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4184';
let server,browser;
try{
  if(!process.env.TEST_URL){
    server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4184',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
  }
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  let page;const errors=[];
  const withoutPositions=state=>JSON.parse(JSON.stringify(state),(key,value)=>key==='position'?undefined:value);
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.journey);
  const settle=async()=>{await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0'&&document.querySelector('#board').dataset.busy!=='true');await page.waitForTimeout(300);};
  const verify=async()=>{
    await settle();const state=await read();assert.ok(validateState(state));assert.equal(state.puzzle.pictureMajority,true);
    const pictures=state.bubbles.filter(b=>b.kind==='picture');assert.ok(pictures.length>state.bubbles.length/2);
    assert.equal(await page.locator('.bubble.picture').count(),pictures.length);
    const catalog=getCatalog(state.puzzle);
    for(const b of pictures){
      const element=page.locator(`.bubble[data-id="${b.id}"]`);
      assert.equal(await element.locator('.bubble-label').textContent(),catalog.pictures[b.atoms[0].word]);
      assert.ok((await element.getAttribute('aria-label')).includes(b.atoms[0].word),'Accessible picture must retain its real clue');
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));return state;
  };
  await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
  for(const language of ['en','de'])for(const packIds of [ALL_PACK_IDS,['base'],['food']]){
    const state=makeState(createPuzzle({language,packIds,level:15}),{shuffleSeed:`browser-${language}-${packIds[0]}`});
    const context=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});
    // Seed a fresh browser context before the app starts. Writing into a live
    // page would be overwritten by the game's legitimate pagehide save.
    await context.addInitScript(({state,language,packIds})=>{
      if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify({
        version:1,settings:{language,packIds,motion:'reduced',difficulty:'balanced'},level:15,round:1,activeMode:'journey',
        completed:[],dailyWins:[],stats:{groups:0,puzzles:0},sessions:{journey:state}
      }));
    },{state,language,packIds});
    page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.locator('.bubble').first().waitFor();let current=await verify();
    await page.reload();await page.locator('.bubble').first().waitFor();assert.deepEqual(withoutPositions(await verify()),withoutPositions(current),'Reload changed the saved emoji deck');
    await page.locator('#settings-button').click();await page.locator('#restart-button').click();await page.locator('#confirm-restart').click();
    const restarted=await verify();assert.deepEqual(restarted.puzzle.groups,current.puzzle.groups);assert.notEqual(restarted.puzzle.shuffleSeed,current.puzzle.shuffleSeed);
    await page.screenshot({path:fileURLToPath(new URL(`../test-results/picture-majority-${language}-${packIds.length===1?packIds[0]:'all'}.png`,import.meta.url))});
    current=await read();const picture=current.bubbles.find(b=>b.kind==='picture'&&current.bubbles.some(other=>other.id!==b.id&&other.groupId===b.groupId));
    const mate=current.bubbles.find(b=>b.id!==picture.id&&b.groupId===picture.groupId);
    for(const b of [picture,mate]){await page.locator(`.bubble[data-id="${b.id}"]`).click({force:true});await settle();}
    const merged=await read();assert.equal(merged.moves,current.moves+1);assert.ok(validateState(merged));
    const joined=merged.bubbles.find(b=>b.atoms.length===2&&b.groupId===picture.groupId);assert.ok(joined);assert.notEqual(joined.kind,'picture');
    assert.deepEqual(await page.locator(`.bubble[data-id="${joined.id}"] .bubble-term`).allTextContents(),joined.atoms.map(a=>a.word));
    await page.reload();await page.locator('.bubble').first().waitFor();await settle();assert.deepEqual(withoutPositions(await read()),withoutPositions(merged),'Merged picture did not persist');
    await context.close();
  }
  assert.deepEqual(errors,[]);console.log('Picture-majority browser checks passed: English/German, all/Everyday/Food packs, rendering, accessibility, reload, replay, and merge revelation.');
}finally{await browser?.close();server?.kill();}
