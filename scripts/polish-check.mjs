import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createPuzzle,makeState,clearableGroups} from '../src/engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
let server;const base=process.env.TEST_URL||'http://127.0.0.1:4177';
if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4177'},windowsHide:true});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});}
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const errors=[],external=[],output=fileURLToPath(new URL('../test-results/',import.meta.url));
await mkdir(output,{recursive:true});
function save(special){const puzzle=createPuzzle({mode:'lab',special});return {version:1,settings:{theme:'grove',sound:false,haptics:false,motion:'system',difficulty:'balanced',challenge:false},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:makeState(puzzle)},stats:{groups:0,puzzles:0}};}
async function fixture(special,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion});
  await context.addInitScript(data=>{if(!localStorage.getItem('bubble-grove-v1'))localStorage.setItem('bubble-grove-v1',JSON.stringify(data));},save(special));
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(!req.url().startsWith(base))external.push(req.url());});
  await page.goto(base);await page.locator('.bubble').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(3000);
  assert.ok((await page.locator('.header').boundingBox()).y>=0,'The header was scrolled out of the play viewport');
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')).sessions.lab);
  const bubble=id=>page.locator(`.bubble[data-id="${id}"]`),center=async id=>{const b=await bubble(id).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
  const idle=()=>page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true');
  const tap=async id=>{await idle();const p=await center(id);await page.touchscreen.tap(p.x,p.y);};
  const join=async(a,b)=>{await tap(a);await tap(b);await idle();};
  return{page,context,read,bubble,center,idle,tap,join};
}
const color=value=>value.startsWith('#')?[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)):value.match(/[\d.]+/g).slice(0,3).map(Number);
const luminance=value=>color(value).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{a=luminance(a);b=luminance(b);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
try{
  const f=await fixture('nested'),{page,context,read,bubble,center,idle,tap,join}=f;
  assert.ok(await page.evaluate(()=>document.fonts.check('800 14px Nunito')),'Local font did not load');
  const bg=await page.locator('.ocean').evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(bg.includes('.webp'),'Original reef artwork is missing');
  assert.equal(await page.locator('.water-canvas').getAttribute('data-motion'),'moving');
  const canvasImage=()=>page.locator('.water-canvas').evaluate(el=>{const a=el.getContext('2d').getImageData(0,0,el.width,el.height).data;let sum=0;for(let i=3;i<a.length;i+=32)sum+=a[i];return sum;});
  const a=await canvasImage();await page.waitForTimeout(220);assert.notEqual(await canvasImage(),a,'The water scene is not animating');
  assert.equal(await page.locator('.particle-canvas').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  let state=await read(),group=clearableGroups(state)[0],members=state.bubbles.filter(b=>b.groupId===group.id);
  const single=await bubble(members[0].id).evaluate(el=>({fill:getComputedStyle(el).getPropertyValue('--bubble-fill').trim(),ink:getComputedStyle(el).color}));assert.ok(contrast(single.fill,single.ink)>=4.5,'Single bubble text lacks contrast');
  const cdp=await context.newCDPSession(page),start=await center(members[0].id),end=await center(members[1].id);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12}]});
  await page.waitForTimeout(90);assert.ok(Number(await page.locator('.water-canvas').getAttribute('data-trails'))>0,'Dragging did not make a water trail');
  await page.screenshot({path:output+'polish-drag.png'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await idle();
  assert.ok(Number(await page.locator('.particle-canvas').getAttribute('data-join-count'))>0,'A merge did not emit particles');
  let pair=(await read()).bubbles.find(b=>b.atoms.length===2);await join(pair.id,members[2].id);
  const triple=(await read()).bubbles.find(b=>b.atoms.length===3);
  for(const theme of['grove','lavender','sunset']){
    await page.locator('#settings-button').click();await page.selectOption('#setting-theme',theme);await page.locator('#close-sheet').click();
    const text=await bubble(triple.id).evaluate(el=>({fill:getComputedStyle(el).getPropertyValue('--bubble-fill').trim(),ink:getComputedStyle(el).color}));assert.ok(contrast(text.fill,text.ink)>=4.5,`Triple text lacks contrast in ${theme}`);
    await page.screenshot({path:output+`polish-${theme}.png`});
  }
  await page.locator('#settings-button').click();await page.selectOption('#setting-theme','grove');await page.locator('#close-sheet').click();
  await tap(triple.id);await tap(members[3].id);await page.locator('.completion').waitFor();await page.screenshot({path:output+'polish-completion.png'});await idle();
  assert.ok(Number(await page.locator('.particle-canvas').getAttribute('data-pop-count'))>0,'Completed group did not produce a pop burst');
  await page.locator('#settings-button').click();await page.locator('#setting-motion').check();await page.locator('#close-sheet').click();
  assert.equal(await page.locator('.water-canvas').getAttribute('data-motion'),'still');assert.equal(await page.locator('.particle-canvas').evaluate(el=>getComputedStyle(el).display),'none');
  const still=await canvasImage();await page.waitForTimeout(160);assert.equal(await canvasImage(),still,'Reduced motion left the water animation running');
  const emissions=await page.locator('.particle-canvas').getAttribute('data-emissions');state=await read();group=clearableGroups(state)[0];members=state.bubbles.filter(b=>b.groupId===group.id);await join(members[0].id,members[1].id);assert.equal(await page.locator('.particle-canvas').getAttribute('data-emissions'),emissions,'Reduced motion emitted particles');
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const urls=await page.evaluate(()=>[...document.querySelectorAll('link[rel=stylesheet],script[src],link[rel=manifest]')].map(el=>el.href||el.src));
  const cache=await page.evaluate(async()=>{const keys=await caches.keys();return(await caches.open(keys.find(key=>key.startsWith('bubble-grove-v11-')))).keys().then(requests=>requests.map(r=>r.url));});
  assert.ok(urls.every(url=>cache.includes(url)),'A bundled entry was not precached');assert.ok(cache.some(url=>url.endsWith('.woff2'))&&cache.some(url=>url.endsWith('.webp')));
  await context.setOffline(true);await page.reload();await bubble(members[1].id).waitFor();await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.fonts.check('800 14px Nunito')));assert.equal(await page.locator('.water-canvas').getAttribute('data-motion'),'still');
  await context.setOffline(false);
  const ice=await fixture('frozen','reduce');assert.equal(await ice.page.locator('.water-canvas').getAttribute('data-motion'),'still');await ice.page.screenshot({path:output+'polish-ice.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Polish checks passed: original reef, moving currents, drag trails, actual merge/pop particles, local font, all theme contrasts, reduced-motion stillness, and bundled offline artwork/fonts/libraries.');
}finally{await browser.close();server?.kill();}
