// Saved-session browser regressions for screwdriver, split, and countdown rules.
// Run against the production bundle; no engine functions are invoked in the page.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createPuzzle,makeState,validateState,clearableGroups,isBlocked} from '../src/engine.js';

const STORAGE='bubble-grove-v1',base=process.env.TEST_URL||'http://127.0.0.1:4186';
const output=fileURLToPath(new URL('../test-results/',import.meta.url));
const rows=[
  ['Trees','Maple','Oak tree','Silver birch','Scots pine'],
  ['Flowers','Rose','Water lily','Sweet pea','Bird of paradise'],
  ['Planets','Earth','Red planet','Gas giant','Ice giant'],
  ['Weather','Thunder','Rain shower','Ice storm','Summer breeze'],
  ['Water','River','Coral reef','Sea lion','Ocean floor'],
  ['Music','Piano','French horn','Bass drum','Grand organ'],
  ['Space','Starlight','Solar\twind','Deep\u00a0space','Black hole'],
  ['Stories',"Will-o'-the-wisp",'Fairy tale','Once upon a time','Happy ending'],
];
const all=state=>[...state.bubbles,...state.reserve.flat()];
const timerIn=state=>all(state).find(b=>typeof b.timer==='number');
const partsIn=state=>all(state).filter(b=>b.atoms.some(a=>a.part!==undefined));
function puzzle(groups=3,specials=[]){
  return {...createPuzzle({mode:'lab',special:'picture'}),id:`special-rules-${specials.join('-')||'plain'}`,seed:'special-rules-browser',specials,
    splitCount:specials.includes('split')?8:0,groups:rows.slice(0,groups).map(([name,...words],i)=>({id:`g${i}`,name,domain:'browser fixtures',words}))};
}
function plain(groups=3){
  const state=makeState(puzzle(groups));
  state.bubbles=all(state);state.reserve=[];state.capacity=Math.max(12,state.bubbles.length);
  return state;
}
function putInReserve(state,...bubbles){
  const ids=new Set(bubbles.map(b=>b.id));state.bubbles=state.bubbles.filter(b=>!ids.has(b.id));
  state.reserve.push(bubbles);
}
function partial(state,a,b){
  b.atoms.push(...a.atoms);state.bubbles=state.bubbles.filter(item=>item.id!==a.id);return b;
}
function fragments(state,b){
  const atom=b.atoms[0],cut=Math.floor(atom.word.length/2);
  const pair=[0,1].map(part=>({...b,id:`${b.id}-${part}`,kind:'split',atoms:[{...atom,part,label:(part?atom.word.slice(cut):atom.word.slice(0,cut)).toLowerCase()}]}));
  state.bubbles.splice(state.bubbles.indexOf(b),1,...pair);
  state.puzzle.specials.push('split');delete state.puzzle.splitCount; // A valid legacy save with an in-progress pair.
  return pair;
}
function screwdriverFixture(){
  const state=plain(),driver=state.bubbles.find(b=>b.id==='g0w0'),lock=state.bubbles.find(b=>b.id==='g2w0');
  state.puzzle.specials=['screw','frozen'];
  Object.assign(lock,{kind:'screw',screwColor:'violet',turns:2,screwTotal:2});
  driver.driverColor='violet';state.bubbles.find(b=>b.id==='g1w2').driverColor='violet';
  Object.assign(state.bubbles.find(b=>b.id==='g1w1'),{kind:'frozen',ice:4,iceTotal:4});
  return state;
}
function splitFixture(){return makeState(puzzle(8,['split']));}
function frozenTimerFixture(){
  const state=plain(),members=state.bubbles.filter(b=>b.groupId==='g2');
  state.puzzle.specials=['burst','frozen'];
  Object.assign(members[0],{kind:'burst',timer:9});partial(state,members[1],members[2]);
  Object.assign(members[3],{kind:'frozen',ice:4,iceTotal:4});putInReserve(state,members[0]);
  return state;
}
function splitTimerFixture(){
  const state=plain(),members=state.bubbles.filter(b=>b.groupId==='g2');
  state.puzzle.specials=['burst'];Object.assign(members[0],{kind:'burst',timer:9});
  partial(state,members[1],members[2]);
  // Use a contiguous word to build a valid half-word fixture.
  const atom=members[3].atoms[0];state.puzzle.groups[2].words[3]='Neptune';atom.word='Neptune';
  const pair=fragments(state,members[3]);putInReserve(state,members[0],pair[1]);
  return state;
}
function nestedTimerFixture(){
  const p=puzzle();p.specials=['nested'];
  p.groups[0].parentId='g2';p.groups[2].childId='g0';p.groups[2].words=['Trees','Garden','Orchard','Grove'];
  const state=makeState(p);state.bubbles=all(state);state.reserve=[];state.capacity=12;
  state.puzzle.specials.push('burst');const timer=state.bubbles.find(b=>b.groupId==='g2');
  Object.assign(timer,{kind:'burst',timer:9});putInReserve(state,timer);return state;
}
function arrivingTimerFixture(){
  const state=plain();state.puzzle.specials=['burst'];Object.assign(state.bubbles[0],{kind:'burst',timer:9});return state;
}
export const fixtures={screwdriver:screwdriverFixture,split:splitFixture,frozenTimer:frozenTimerFixture,splitTimer:splitTimerFixture,nestedTimer:nestedTimerFixture,arrivingTimer:arrivingTimerFixture};
for(const [name,build]of Object.entries(fixtures))assert.ok(validateState(build()),`${name} saved-session fixture is invalid`);
if(process.argv.includes('--fixtures-only')){
  console.log('All special-rule saved-session fixtures validate.');
}else{
  const {chromium}=await import(process.env.PLAYWRIGHT_PATH?pathToFileURL(process.env.PLAYWRIGHT_PATH).href:'playwright');
  let server,browser,activePage;const contexts=[],errors=[];
  await mkdir(output,{recursive:true});
  try{
    if(!process.env.TEST_URL){
      server=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{env:{...process.env,PORT:'4186',HOST:'127.0.0.1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{
        let stderr='';server.stderr.on('data',chunk=>stderr+=chunk);server.stdout.once('data',resolve);server.once('error',reject);
        server.once('exit',code=>reject(Error(`Browser-test server exited ${code}: ${stderr}`)));
      });
    }
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
    async function open(initial,motion,{arrive=false}={}){
      initial=structuredClone(initial);
      if(!arrive)initial.bubbles.forEach((b,i)=>b.position={x:.14+(i%4)*.24,y:.16+Math.floor(i/4)*.25});
      const context=await browser.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});contexts.push(context);
      const save={version:1,settings:{theme:'grove',sound:false,haptics:false,motion,difficulty:'balanced',challenge:false,physics:{gravity:arrive?1:0,pressure:1,damping:1}},activeMode:'lab',level:1,round:1,completed:[],dailyWins:[],sessions:{lab:initial},stats:{groups:0,puzzles:0}};
      await context.addInitScript(({save,key})=>{
        if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(save));
        window.countdownArrivalViolations=[];window.countdownAppearances=[];
        const seen=new Set();
        const observe=()=>{
          const board=document.querySelector('#board');if(!board)return;
          new MutationObserver(()=>{
            const state=JSON.parse(localStorage.getItem(key))?.sessions?.lab;if(!state)return;
            const field=board.getBoundingClientRect();
            const onField=b=>{
              const el=board.querySelector(`.bubble[data-id="${b.id}"]`),box=el?.querySelector('.membrane-fill')?.getBoundingClientRect();
              return !!box&&!el.hidden&&box.top>=field.top-1&&box.left>=field.left-1&&box.right<=field.right+1&&box.bottom<=field.bottom+1;
            };
            for(const timer of state.bubbles.filter(b=>typeof b.timer==='number')){
              const el=board.querySelector(`.bubble[data-id="${timer.id}"]`);if(!el||el.hidden||seen.has(timer.id))continue;
              seen.add(timer.id);
              const others=state.bubbles.filter(b=>b.id!==timer.id&&b.groupId===timer.groupId&&!b.decoy),atoms=[...timer.atoms,...others.flatMap(b=>b.atoms)],ids=[...new Set(atoms.map(a=>a.id))];
              const complete=ids.length===4&&ids.every(id=>{const parts=atoms.filter(a=>a.id===id);return parts.some(a=>a.part===undefined)||parts.some(a=>a.part===0)&&parts.some(a=>a.part===1);});
              const waiting=others.filter(b=>!onField(b)||b.ice>0||b.lockColor||b.turns>0||b.clearsNeeded>0||b.pinsNeeded>0).map(b=>b.id);
              const event={timer:timer.id,complete,waiting};window.countdownAppearances.push(event);
              if(!complete||waiting.length)window.countdownArrivalViolations.push(event);
            }
          }).observe(board,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','d']});
        };
        if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
      },{save,key:STORAGE});
      const page=await context.newPage();activePage=page;page.on('pageerror',error=>errors.push(error.message));
      page.setDefaultTimeout(15000);await page.goto(base);await page.locator('.bubble[data-id]').first().waitFor();
      const bubble=id=>page.locator(`.bubble[data-id="${id}"]`);
      const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).sessions.lab,STORAGE);
      const idle=async()=>{
        await page.waitForFunction(()=>document.querySelector('#board').dataset.busy!=='true'&&document.querySelector('#board').dataset.arriving==='0');
        // The app's arrival count includes queued, physically entering, and
        // hidden returning bubbles. Also check the actual rendered membrane.
        await page.waitForFunction(()=>{
          const board=document.querySelector('#board'),top=board.getBoundingClientRect().top;
          return [...board.querySelectorAll('.bubble[data-id]:not([hidden]) .membrane-fill')].every(el=>el.getBoundingClientRect().top>=top-1);
        });
      };
      const center=async id=>{await bubble(id).waitFor({state:'visible'});const box=await bubble(id).boundingBox();assert.ok(box);return{x:box.x+box.width/2,y:box.y+box.height/2};};
      // These two helpers use genuine touch events, not synthetic click handlers.
      const tap=async id=>{await bubble(id).evaluate(el=>el.style.zIndex='100');const p=await center(id);await page.touchscreen.tap(p.x,p.y);await bubble(id).evaluate(el=>el.style.removeProperty('z-index')).catch(()=>{});};
      const tapJoin=async(a,b)=>{await tap(a);await tap(b);};
      const keyJoin=async(a,b)=>{await bubble(a).press('Enter');await bubble(b).press('Enter');};
      const cdp=await context.newCDPSession(page);
      const dragJoin=async(a,b)=>{
        await bubble(a).evaluate(el=>el.style.zIndex='100');const from=await center(a);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
        const to=await center(b);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});
        assert.ok(await bubble(a).evaluate(el=>el.classList.contains('dragging')),'Real touch did not start dragging');
        assert.ok(await bubble(b).evaluate(el=>el.classList.contains('target')),'Real touch missed the intended drop target');
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await bubble(a).evaluate(el=>el.style.removeProperty('z-index')).catch(()=>{});
      };
      const undo=async()=>{await page.locator('#tools-button').click();await page.locator('#undo-button').click();if(await page.locator('#actions-menu').isVisible())await page.locator('#tools-button').click();await idle();};
      const clear=async groupId=>{
        for(let i=0;i<12;i++){
          const state=await read();if(state.solved.some(g=>g.id===groupId))return;
          const members=state.bubbles.filter(b=>b.groupId===groupId&&!isBlocked(b));
          const part=members.find(b=>b.atoms.some(a=>a.part!==undefined));
          const pair=part?[part,members.find(b=>b.id!==part.id&&b.atoms[0].id===part.atoms[0].id&&b.atoms[0].part!==part.atoms[0].part)]:members.slice(0,2);
          assert.ok(pair[0]&&pair[1],`Cannot complete fixture group ${groupId}`);await keyJoin(pair[0].id,pair[1].id);await idle();
        }
        assert.fail(`Group ${groupId} did not clear`);
      };
      const reload=async()=>{await page.reload();await page.locator('.bubble[data-id]').first().waitFor();await idle();};
      const arrivals=async()=>assert.deepEqual(await page.evaluate(()=>window.countdownArrivalViolations),[],'A countdown appeared before all playable constituents were visibly on the field');
      await idle();assert.equal((await read()).puzzle.id,initial.puzzle.id,'The app rejected the saved-session fixture');
      return{page,context,read,bubble,idle,tapJoin,keyJoin,dragJoin,undo,clear,reload,arrivals};
    }

    for(const motion of['system','reduced']){
      const f=await open(screwdriverFixture(),motion),driver='g0w0',wrong='g1w0',lock='g2w0';
      const retained=async(moves,mistakes)=>{
        const state=await f.read();assert.equal(state.moves,moves);assert.equal(state.mistakes,mistakes);
        assert.equal(state.bubbles.find(b=>b.id===driver).driverColor,'violet');assert.equal(state.bubbles.find(b=>b.id===lock).turns,2);
        assert.equal(await f.bubble(driver).locator('.screwdriver-art').count(),1);assert.equal(await f.bubble(lock).locator('.screw-head').count(),2);assert.ok(validateState(state));
      };
      await f.tapJoin(driver,wrong);await retained(1,1);
      await f.tapJoin(driver,wrong);await retained(2,2); // Repeated input during the rejection animation.
      await f.undo();await retained(1,1);await f.reload();await retained(1,1);
      await f.dragJoin(driver,wrong);await retained(2,2);await f.idle();
      await f.tapJoin(driver,'g1w1');await f.idle();await retained(2,2); // An unrelated frozen target is blocked.
      await f.page.keyboard.press('Escape');await f.tapJoin(driver,'g0w1');await f.idle();
      let state=await f.read();assert.equal(state.bubbles.find(b=>b.id===lock).turns,1);assert.equal(state.bubbles.find(b=>b.id==='g0w1').driverColor,undefined);
      assert.equal(state.bubbles.find(b=>b.id==='g0w1').atoms.length,2);assert.equal(state.moves,3);assert.equal(state.mistakes,2);
      await f.undo();await retained(2,2);
      await f.dragJoin(driver,lock);await f.idle();state=await f.read();assert.equal(state.bubbles.find(b=>b.id===lock).turns,1);
      assert.equal(state.bubbles.find(b=>b.id===driver).driverColor,undefined);assert.equal(state.bubbles.find(b=>b.id===driver).atoms.length,1);
      await f.tapJoin(driver,lock);await f.idle();assert.equal((await f.read()).bubbles.find(b=>b.id===lock).turns,1,'Repeated ring contact consumed a screwdriver twice');
      await f.reload();assert.equal((await f.read()).bubbles.find(b=>b.id===lock).turns,1);assert.ok(validateState(await f.read()));
      await f.context.close();

      const initial=splitFixture(),reserved=initial.reserve.flat().filter(b=>b.kind==='split').map(b=>b.id);
      assert.ok(reserved.length,'Split clues were still front-loaded onto the opening board');assert.ok(initial.bubbles.some(b=>b.kind==='split'));
      assert.equal(partsIn(initial).length,initial.puzzle.splitCount*2);
      for(const b of partsIn(initial))assert.ok(!/\s/u.test(b.atoms[0].word),`A phrase was split: ${b.atoms[0].word}`);
      const split=await open(initial,motion),savedReserve=(await split.read()).reserve.flat().map(b=>b.id);
      for(const id of reserved)assert.equal(await split.bubble(id).count(),0,'A reserve split clue was rendered');
      await split.reload();assert.deepEqual((await split.read()).reserve.flat().map(b=>b.id),savedReserve,'Reload promoted reserve fragments');
      let dealt;
      for(let cleared=0;cleared<initial.puzzle.groups.length;cleared++){
        const current=await split.read();dealt=current.bubbles.find(b=>reserved.includes(b.id));if(dealt)break;
        const group=clearableGroups(current)[0];assert.ok(group,'Split reserve blocked all playable connections');await split.clear(group.id);
      }
      assert.ok(dealt,'No originally reserved split fragment joined a later refill');
      assert.equal(await split.bubble(dealt.id).locator('.bubble-label').textContent(),dealt.atoms[0].label.toLowerCase());
      const afterRefill=await split.read();assert.ok(validateState(afterRefill));await split.reload();
      assert.deepEqual((await split.read()).solved,afterRefill.solved);assert.ok((await split.read()).bubbles.some(b=>b.id===dealt.id));await split.context.close();

      const frozen=await open(frozenTimerFixture(),motion),timer=timerIn(await frozen.read());
      assert.equal(await frozen.bubble(timer.id).count(),0);
      for(const [i,pair]of[['g0w0','g0w1'],['g0w2','g0w3'],['g1w0','g1w1']].entries()){
        await frozen.keyJoin(...pair);await frozen.idle();const current=await frozen.read();
        assert.equal(timerIn(current).timer,9,'An ineligible reserve countdown ticked');assert.ok(current.reserve.flat().some(b=>b.id===timer.id));
        assert.equal(current.bubbles.find(b=>b.id==='g2w3').ice,3-i);assert.equal(await frozen.bubble(timer.id).count(),0);
      }
      await frozen.reload();assert.equal(timerIn(await frozen.read()).timer,9);
      await frozen.keyJoin('g1w2','g1w3');await frozen.idle();
      assert.ok((await frozen.read()).bubbles.some(b=>b.id===timer.id),'Thawing the last blocker did not release a ready countdown');
      assert.equal(timerIn(await frozen.read()).timer,9,'The release move spent a countdown tick');await frozen.arrivals();
      const beforeTick=await frozen.read();
      await frozen.keyJoin('g0w1','g1w1');await frozen.idle();const afterTick=await frozen.read();
      assert.equal(afterTick.moves,beforeTick.moves+1,'The countdown test did not make its intended move');
      assert.equal(afterTick.mistakes,beforeTick.mistakes+1,'The countdown test did not make its intended mismatch');
      assert.equal(timerIn(afterTick).timer,8,'A visible eligible countdown did not tick');
      await frozen.reload();assert.equal(timerIn(await frozen.read()).timer,8);assert.ok(validateState(await frozen.read()));await frozen.context.close();

      const fragments=await open(splitTimerFixture(),motion),splitTimer=timerIn(await fragments.read());
      assert.equal(await fragments.bubble(splitTimer.id).count(),0);await fragments.keyJoin('g0w0','g0w1');await fragments.idle();
      assert.equal(timerIn(await fragments.read()).timer,9);assert.ok((await fragments.read()).reserve.flat().some(b=>b.id===splitTimer.id),'One split half was treated as the complete word');
      await fragments.reload();await fragments.clear('g0');await fragments.idle();
      assert.ok((await fragments.read()).bubbles.some(b=>b.id===splitTimer.id),'A complete group containing a partial merge and two fragments did not release its countdown');
      assert.equal(timerIn(await fragments.read()).timer,9);await fragments.arrivals();assert.ok(validateState(await fragments.read()));await fragments.context.close();

      const nested=await open(nestedTimerFixture(),motion),nestedTimer=timerIn(await nested.read());
      assert.equal(await nested.bubble(nestedTimer.id).count(),0);
      await nested.keyJoin('g0w0','g0w1');await nested.keyJoin('g0w1','g0w2');await nested.keyJoin('g0w2','g0w3');
      assert.equal(await nested.bubble(nestedTimer.id).isVisible(),false,'Countdown appeared while its returned category was still hidden');
      const unrelated=(await nested.read()).bubbles.find(b=>b.groupId==='g2'&&b.id!==nestedTimer.id&&b.id!=='g0-theme');
      await nested.keyJoin('g1w0',unrelated.id);
      assert.equal(timerIn(await nested.read()).timer,9,'A countdown ticked while waiting for a category rebirth');
      await nested.idle();assert.equal(await nested.bubble(nestedTimer.id).isVisible(),true);await nested.arrivals();
      assert.ok((await nested.page.evaluate(()=>window.countdownAppearances)).some(event=>event.timer===nestedTimer.id));
      await nested.reload();assert.equal(timerIn(await nested.read()).timer,9);assert.ok(validateState(await nested.read()));await nested.context.close();

      const incoming=await open(arrivingTimerFixture(),motion,{arrive:true});await incoming.arrivals();
      assert.ok((await incoming.page.evaluate(()=>window.countdownAppearances)).length,'The initial countdown never appeared');await incoming.context.close();
      console.log(`Special-rule browser checks passed in ${motion} motion.`);
    }
    assert.deepEqual(errors,[]);console.log('Special-rule browser checks passed: real repeated tap/drag mismatch and blocked-target screwdriver retention, legal merge and direct-ring consumption, undo/reload, mixed split reserve/refills, unsplit phrases, frozen/partial/split/nested countdown eligibility, reserve and hidden-arrival tick protection, and visible constituent arrival order in both motion modes.');
  }catch(error){
    if(activePage&&!activePage.isClosed()){
      await activePage.screenshot({path:output+'special-rules-failure.png'}).catch(()=>{});
      const diagnostic=await activePage.evaluate(key=>({save:JSON.parse(localStorage.getItem(key)),board:document.querySelector('#board')?.dataset,arrivals:window.countdownAppearances,violations:window.countdownArrivalViolations,bubbles:[...document.querySelectorAll('.bubble[data-id]')].map(el=>({id:el.dataset.id,hidden:el.hidden,classes:el.className,rect:el.getBoundingClientRect().toJSON(),arrival:getComputedStyle(el).getPropertyValue('--arrival')}))}),STORAGE).catch(()=>null);
      await writeFile(output+'special-rules-failure.json',JSON.stringify({error:String(error),diagnostic},null,2));
    }
    throw error;
  }finally{
    for(const context of contexts)await context.close().catch(()=>{});await browser?.close();server?.kill();
  }
}
