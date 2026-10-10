// Optional real-browser regressions for the bilingual, selectable catalog UI.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {ALL_PACK_IDS,getCatalog} from '../src/catalog.js';
const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4176';
let server,browser;
try{
  if(!process.env.TEST_URL){server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4176',HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error(`Server exited ${code}`)));});}
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
  const context=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bubble-grove-v1')));
  const active=async()=>{const save=await read();return save.sessions[save.activeMode];};
  const settings=()=>page.locator('#settings-button').click();
  const choose=async(language,packs)=>{
    await settings();await page.selectOption('#setting-language',language);
    for(const id of ALL_PACK_IDS)await page.locator(`[name="word-pack"][value="${id}"]`).setChecked(packs.includes(id));
    await page.locator('#apply-word-settings').click();await page.locator('#sheet').waitFor({state:'hidden'});
  };
  const assertCatalog=async(language,packIds)=>{
    const state=await active(),available=new Set(getCatalog({language,packIds}).themes.map(theme=>theme.name));
    assert.equal(state.puzzle.language,language);assert.deepEqual([...state.puzzle.packIds].sort(),[...packIds].sort());
    for(const group of state.puzzle.groups)assert.ok(available.has(group.name),`Foreign theme ${group.name} in ${language}/${packIds}`);
    assert.equal(await page.locator('html').getAttribute('lang'),language);
    return state;
  };
  const textFits=async()=>{
    await page.waitForFunction(()=>document.querySelector('#board').dataset.arriving==='0');await page.evaluate(()=>document.fonts.ready);
    const metrics=await page.locator('.bubble:not([hidden]) .bubble-label,.bubble:not([hidden]) .bubble-term').evaluateAll(nodes=>nodes.filter(el=>!el.closest('.picture')).map(el=>{const r=el.getBoundingClientRect(),b=el.closest('.bubble').getBoundingClientRect();return{text:el.textContent,font:parseFloat(getComputedStyle(el).fontSize),width:r.width,height:r.height,bubble:b.toJSON(),rect:r.toJSON(),scroll:el.scrollWidth};}));
    assert.ok(metrics.length);for(const item of metrics){assert.ok(item.font>=10&&item.font<=19,JSON.stringify(item));assert.ok(item.scroll<=item.width+2,`Text overflow ${JSON.stringify(item)}`);assert.ok(item.rect.top>=item.bubble.top-1&&item.rect.bottom<=item.bubble.bottom+1,`Vertical text overflow ${JSON.stringify(item)}`);}
    assert.ok(metrics.some(item=>item.font>=16),'All bubble text is still small');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal page overflow');
  };
  await page.goto(base);await page.locator('.bubble').first().waitFor();
  const original=await active();
  await settings();assert.equal(await page.locator('[name="word-pack"]').count(),ALL_PACK_IDS.length);
  for(const id of ALL_PACK_IDS)await page.locator(`[name="word-pack"][value="${id}"]`).uncheck();
  await page.locator('#apply-word-settings').click();assert.equal(await page.locator('#pack-validation').textContent(),'Keep at least one word pack enabled.');assert.equal((await active()).puzzle.id,original.puzzle.id,'Invalid selection changed the puzzle');
  await page.locator('#close-sheet').click();
  await choose('de',['science']);let state=await assertCatalog('de',['science']);assert.notEqual(state.puzzle.id,original.puzzle.id);
  assert.equal(await page.locator('[data-mode="journey"]').textContent(),'Reise');assert.match(await page.locator('#progress-text').textContent(),/Vierergruppen/);
  assert.equal(Object.keys((await read()).sessions).length,1,'Settings retained incompatible sessions');
  await settings();assert.equal(await page.locator('#sheet-title').textContent(),'Mach es dir gemütlich');assert.equal(await page.locator('[value="base"][name="word-pack"]').isChecked(),false);
  await page.locator('[value="science"][name="word-pack"]').uncheck();await page.locator('#apply-word-settings').click();assert.equal(await page.locator('#pack-validation').textContent(),'Lass mindestens ein Wortpaket eingeschaltet.');await page.locator('#close-sheet').click();
  await page.reload();await page.locator('.bubble').first().waitFor();assert.equal((await assertCatalog('de',['science'])).puzzle.id,state.puzzle.id,'Reload lost selected-language session');
  await settings();await page.locator('#setting-motion').check();await page.locator('#close-sheet').click();
  for(const size of [{width:320,height:640},{width:360,height:780},{width:393,height:852},{width:1280,height:1000}]){await page.setViewportSize(size);await page.waitForTimeout(100);await textFits();}
  // Each selectable pack can generate a board with the base pack switched off.
  for(const language of ['en','de'])for(const packId of ALL_PACK_IDS){await choose(language,[packId]);await assertCatalog(language,[packId]);}
  await page.setViewportSize({width:360,height:780});await choose('de',['science']);await textFits();
  // Keyboard tap-to-join verifies larger per-term typography on real merged DOM.
  state=await active();const pair=state.bubbles.filter(b=>b.groupId===state.bubbles[0].groupId).slice(0,2);
  for(const b of pair){await page.locator(`.bubble[data-id="${b.id}"]`).focus();await page.keyboard.press('Enter');}
  assert.ok((await active()).bubbles.some(b=>b.atoms.length===2),'Keyboard join failed');await textFits();
  await page.locator('#help-button').click();assert.equal(await page.locator('#sheet-title').textContent(),'Ein kleines Wortspiel');await page.locator('#specials-button').click();assert.match(await page.locator('[data-special="frozen"]').textContent(),/Verbindungen tauen das Eis/);await page.locator('#close-sheet').click();
  await page.locator('#tools-button').click();await page.locator('#library-button').click();assert.equal(await page.locator('#sheet-title').textContent(),'Die Wortbibliothek');await page.locator('#library-search').fill('NOT_A_REAL_CLUE');assert.match(await page.locator('#library-results').textContent(),/Nichts gefunden/);await page.locator('#close-sheet').click();
  // Both locales and every pack remain usable after the service worker caches them.
  await page.evaluate(async()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('.bubble').first().waitFor();await assertCatalog('de',['science']);await choose('en',['movies']);await assertCatalog('en',['movies']);await context.setOffline(false);
  await choose('de',['science']);await textFits();
  const output=fileURLToPath(new URL('../test-results/',import.meta.url));await mkdir(output,{recursive:true});await page.screenshot({path:output+'german-science-s23.png'});await settings();await page.screenshot({path:output+'german-pack-settings.png'});
  assert.deepEqual(errors,[]);console.log('Catalog browser checks passed: bilingual UI, standalone packs, optional base, empty-selection validation, scoped fresh sessions, reload, offline language switching, merged text, and responsive large typography.');
}finally{await browser?.close();server?.kill();}
