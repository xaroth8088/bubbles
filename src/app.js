import {SPECIALS,INTRO_LEVELS} from './data.js';
import {getCatalog,PACKS,ALL_PACK_IDS,normalizePackIds,normalizeLanguage} from './catalog.js';
import {translate,localizeUI} from './i18n.js';
import {createPuzzle,makeState,merge,tapSpecial,getHint,magnet,moreRoom,bubbleText,specialLabel,isBlocked,blockedReason,validateState,localDate,random,shuffle,upgradeDealing,atomText,arrivalDependency,canUseDriver,linkedPartner,countdownReady} from './engine.js';
import {stepPhysics,simulatePhysics,bubbleDiameter,radialImpulse,resetPhysics,membranePath,membraneContains,translateBoundedGroup,PHYSICS_STEP,PHYSICS_DEFAULTS,normalizePhysics} from './physics.js';
import {specialArt,oceanArt,membraneArt,KEY_PALETTE} from './art.js';
import {createExperience} from './experience.js';
import {fitBubbleTerm} from './text-fit.js';

const $=id=>document.getElementById(id);
const STORAGE_KEY='bubble-grove-v1';
const defaults={language:'en',packIds:[...ALL_PACK_IDS],theme:'grove',sound:false,haptics:true,motion:'system',difficulty:'balanced',challenge:false,physics:{...PHYSICS_DEFAULTS}};
const initial={version:1,settings:{...defaults},activeMode:'journey',level:1,round:1,completed:[],dailyWins:[],sessions:{},stats:{groups:0,puzzles:0}};
let saved=loadSave(),settings=saved.settings,state,history=[],selected=null,hinted=new Set(),positions=new Map(),elements=new Map(),drag=null,frame=0,settleUntil=0,toastTimer=0,winTimer=0,installPrompt=null,audioContext=null,storageWarning=false;
let lastFrame=0,physicsTime=0,quietFrames=0,restorePositions=false,boardSize={width:0,height:0},shuffleNumber=0;
const board=$('board'),sheet=$('sheet');
const t=text=>translate(text,settings.language);
const catalog=()=>getCatalog({language:settings.language,packIds:settings.packIds});
const wordScope=(language,packIds)=>`${normalizeLanguage(language)}|${normalizePackIds(packIds).join(',')}`;
const compatible=p=>wordScope(p.language,p.packIds)===wordScope(settings.language,settings.packIds);
let busy=false,animationEpoch=0,activeActions=0;
const returning=new Map(),completions=new Map(),births=new Map();
board.insertAdjacentHTML('beforebegin',oceanArt());
const experience=createExperience(board,reducedMotion);
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function isSave(data){return data&&data.version===1&&data.settings&&['journey','daily','endless','lab'].includes(data.activeMode)&&Number.isInteger(data.level)&&data.level>0&&Number.isInteger(data.round)&&data.round>0&&Array.isArray(data.completed)&&data.completed.every(n=>Number.isInteger(n)&&n>0&&n<=100000)&&Array.isArray(data.dailyWins)&&data.dailyWins.every(d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}(?:\|[a-z0-9,|\-]+)?$/.test(d))&&data.sessions&&Object.entries(data.sessions).every(([mode,value])=>['journey','daily','endless','lab'].includes(mode)&&value.puzzle?.mode===mode&&validateState(value))&&data.stats&&Number.isFinite(data.stats.groups)&&Number.isFinite(data.stats.puzzles)&&(data.awarded===undefined||Array.isArray(data.awarded)&&data.awarded.every(id=>typeof id==='string'));}
function loadSave(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return structuredClone(initial);const data=JSON.parse(raw);if(!isSave(data))return structuredClone(initial);return {...structuredClone(initial),...data,settings:normalizeSettings(data.settings),stats:{...initial.stats,...data.stats}};}catch{return structuredClone(initial);}}
function normalizeSettings(value={}){return {...defaults,language:normalizeLanguage(value.language),packIds:normalizePackIds(value.packIds),theme:['grove','lavender','sunset'].includes(value.theme)?value.theme:'grove',sound:value.sound===true,haptics:value.haptics!==false,motion:['system','reduced'].includes(value.motion)?value.motion:'system',difficulty:['gentle','balanced','tricky'].includes(value.difficulty)?value.difficulty:'balanced',challenge:value.challenge===true,physics:normalizePhysics(value.physics)};}
function capturePositions(){if(state)for(const b of state.bubbles){const p=positions.get(b.id);if(p?.releaseAt!==undefined)delete b.position;else if(p)b.position={x:p.x/Math.max(1,board.clientWidth),y:p.y/Math.max(1,board.clientHeight)};}}
function persist(){
  if(state){capturePositions();saved.sessions[state.puzzle.mode]=state;saved.activeMode=state.puzzle.mode;}
  saved.settings=settings;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{if(!storageWarning){storageWarning=true;toast('This browser cannot save right now. Export your progress in Settings.');}}
}
function applySettings(){document.documentElement.lang=settings.language;document.title=t('Bubble Grove · a little wordplay');localizeUI(document.body,settings.language);document.documentElement.dataset.theme=settings.theme;document.documentElement.dataset.motion=settings.motion;document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();experience.sync();syncPhysicsControls();if(state){render();wake();}if($('offline-label').dataset.ready)$('offline-label').textContent=t(navigator.onLine?'Ready for a little offline time.':'Offline. All yours.');}
function start(options={},force=false){
  resetAnimations();
  clearTimeout(winTimer);if(drag)cancelDrag();
  if(state)persist();
  const mode=options.mode||saved.activeMode||'journey';
  const previous=saved.sessions[mode];
  if(!force&&previous&&compatible(previous.puzzle)&&validateState(previous)&&(mode!=='daily'||previous.puzzle.date===localDate()))state=structuredClone(previous);
  else state=makeState(createPuzzle({mode,level:saved.level||1,round:saved.round||1,difficulty:settings.difficulty,...options,language:settings.language,packIds:settings.packIds}),{
    challenge:settings.challenge,
    shuffleSeed:mode==='journey'?Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-'):null
  });
  upgradeDealing(state);history=[];selected=null;hinted.clear();resetPhysics();positions.clear();restorePositions=true;lastFrame=0;physicsTime=0;shuffleNumber=0;render();persist();
  if(state.status==='paused')showPause();
}

const bubbleSize=b=>bubbleDiameter(b)*Math.min(1,board.clientWidth/358);
function fitTerm(el,size,count,badge){
  const bubble=el.closest('.bubble'),style=getComputedStyle(bubble);
  const contentHeight=bubble.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const gap=count>1?parseFloat(getComputedStyle(el.parentElement).rowGap)||0:0;
  const height=count>1?(Math.min(contentHeight,size*.76)-(count-1)*gap)/count:Math.min(contentHeight,size*(badge?.48:.67));
  fitBubbleTerm(el,{maxFont:count>1?19:18,maxHeight:height});
}
function topInset(){return 0;}
const onField=p=>p&&p.releaseAt===undefined&&!p.entering&&!p.rebirthPending;
const arrivalDependencies=(b,bubbles)=>[arrivalDependency(b,bubbles),...(typeof b.timer==='number'?bubbles.filter(other=>other!==b&&other.groupId===b.groupId):[])].filter(Boolean);
const countdownOnField=b=>countdownReady(state,b)&&state.bubbles.filter(other=>other!==b&&other.groupId===b.groupId).every(other=>onField(positions.get(other.id)));
function placeBubbles(reset=false){
  const w=board.clientWidth,h=board.clientHeight,top=topInset();if(!w||!h)return;
  if(reset)shuffleNumber++;
  const rng=random(`${state.puzzle.shuffleSeed||state.puzzle.seed}-${state.moves}-${state.bubbles.length}-${shuffleNumber}`);
  const waiting=shuffle(state.bubbles,rng),order=[],lanes=shuffle([0,1,2,3,4],rng);
  // Logical deals and visible releases place locks before their keys or screwdrivers.
  while(waiting.length){let i=waiting.findIndex(b=>!arrivalDependencies(b,waiting).length);if(i<0)i=0;order.push(...waiting.splice(i,1));}
  const count=order.filter(b=>(reset||!positions.has(b.id))&&!(restorePositions&&!reset&&b.position)).length;
  const now=performance.now(),reduced=reducedMotion();
  let releaseAt=Math.max(now+35,...(reset?[]:[...positions.values()]).map(p=>p.releaseAt===undefined?0:p.releaseAt+90));
  const resized=boardSize.width&& (boardSize.width!==w||boardSize.height!==h);
  if(resized)for(const p of positions.values()){p.x*=w/boardSize.width;p.y*=h/boardSize.height;}
  boardSize={width:w,height:h};let incoming=0;
  order.forEach(b=>{
    const size=bubbleSize(b),r=size/2;
    if(reset||!positions.has(b.id)){
      const stored=!reset&&restorePositions&&b.position;
      const lane=lanes[incoming++%lanes.length];
      const x=stored?stored.x*w:r+3+lane*(w-2*r-6)/4+(rng()-.5)*14;
      const y=stored?stored.y*h:top-r-8;
      const p={id:b.id,x:Math.max(r+3,Math.min(w-r-3,x)),y,vx:stored?0:(rng()-.5)*30,vy:0,r,entering:y<top+r+2};
      // Waiting bubbles have no physical presence until their individual release.
      if(!stored&&!reduced||typeof b.timer==='number'&&!countdownOnField(b)){p.releaseAt=releaseAt;releaseAt+=(count>8?70:125)+rng()*(count>8?35:65);}
      positions.set(b.id,p);
    }else positions.get(b.id).r=r;
    positions.get(b.id).stiff=!!(b.ice>0||b.lockColor||b.turns>0||b.pinsNeeded>0||b.clearsNeeded>0);
    const el=elements.get(b.id);if(el){el.style.setProperty('--size',`${size}px`);el.dataset.terms=String(b.atoms.some(a=>a.part!==undefined)?.5:Math.max(1,b.atoms.length));
      if(b.kind!=='picture')for(const label of el.querySelectorAll('.bubble-label,.bubble-term'))fitTerm(label,size,b.atoms.length,!!specialLabel(b));}
  });
  restorePositions=false;drawPositions();wake(Math.max(4000,releaseAt-now+1800));
}
function wake(ms=1800){quietFrames=0;settleUntil=performance.now()+ms;if(!frame)frame=requestAnimationFrame(animate);}
function heldBubbles(){const ids=new Set([...returning.keys(),...births.keys()]);for(const[id,p]of completions)if(p.popping)ids.add(id);if(drag){ids.add(drag.id);const b=state.bubbles.find(b=>b.id===drag.id);const other=linkedPartner(b,state.bubbles),p=positions.get(other?.id);if(p&&p.releaseAt===undefined&&!p.entering&&!p.rebirthPending)ids.add(other.id);}return ids;}
function drawBubble(el,p){
  el.hidden=p.rebirthPending||p.releaseAt!==undefined;
  el.style.translate=`${(p.x-p.r).toFixed(2)}px ${(p.y-p.r).toFixed(2)}px`;
  const path=membranePath(p);if(el._membranePath!==path){for(const shape of el.querySelectorAll('.membrane-contour'))shape.setAttribute('d',path);el._membranePath=path;}
  el.dataset.deformation=(p.deformation||0).toFixed(4);
  el.style.setProperty('--light-x',`${(32+p.x/Math.max(1,board.clientWidth)*12).toFixed(1)}%`);
  el.style.setProperty('--light-y',`${(18+p.y/Math.max(1,board.clientHeight)*7).toFixed(1)}%`);
}
// An arrival finishes when its full physical membrane enters the field, not
// when it is merely released from the queue (its visual skin may still shrink).
function drawPositions(){board.dataset.arriving=String([...positions.values()].filter(p=>!onField(p)).length);for(const[bId,p]of positions){const el=elements.get(bId);if(el)drawBubble(el,p);}for(const p of completions.values())drawBubble(p.el,p);drawLinks();}
function animate(now){
  const pendingArrivals=state.bubbles.filter(b=>positions.get(b.id)?.releaseAt!==undefined);
  const arrivals=pendingArrivals.filter(b=>{
    if(typeof b.timer==='number'&&!countdownOnField(b))return false;
    if(reducedMotion())return true;
    return arrivalDependencies(b,state.bubbles).every(other=>onField(positions.get(other.id)));
  }).sort((a,b)=>positions.get(a.id).releaseAt-positions.get(b.id).releaseAt);
  const arrivalNow=performance.now();
  if(arrivals.length&&(reducedMotion()||arrivalNow>=positions.get(arrivals[0].id).releaseAt)){
    // Preserve the cadence after a slow frame or a backgrounded tab, too.
    const releasing=reducedMotion()?arrivals:arrivals.slice(0,1),late=arrivalNow-positions.get(arrivals[0].id).releaseAt;
    for(const b of pendingArrivals)positions.get(b.id).releaseAt+=late;
    for(const b of releasing){const p=positions.get(b.id);delete p.releaseAt;const el=elements.get(b.id);if(el){el.hidden=false;if(b.kind!=='picture')for(const label of el.querySelectorAll('.bubble-label,.bubble-term'))fitTerm(label,p.r*2,b.atoms.length,!!specialLabel(b));experience.arrive(el);}}
  }
  const pending=[...positions.values()].some(p=>p.releaseAt!==undefined);
  for(const[id,until]of births)if(now>=until)births.delete(id);
  frame=0;const bounds={width:board.clientWidth,height:board.clientHeight,top:topInset(),physics:settings.physics,held:heldBubbles(),solidHeld:new Set([...returning].filter(([,t])=>now-t.start>=t.duration).map(([id])=>id))};
  const bodies=[...state.bubbles.map(b=>positions.get(b.id)).filter(p=>p&&!p.rebirthPending&&p.releaseAt===undefined),...completions.values()];
  if(!bodies.length){lastFrame=0;physicsTime=0;drawPositions();if(pending)frame=requestAnimationFrame(animate);return;}
  const reduced=settings.motion==='reduced'||(settings.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  const before=bodies.map(p=>({x:p.x,y:p.y}));
  for(const p of bodies){p.impact=0;p.shapeMotion=0;}
  const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):1/60;lastFrame=now;
  for(const[id,tween]of returning){const p=positions.get(id);if(!p){returning.delete(id);continue;}const t=Math.min(1,(now-tween.start)/tween.duration),ease=1-(1-t)**3;p.x=tween.from.x+(tween.to.x-tween.from.x)*ease;p.y=tween.from.y+(tween.to.y-tween.from.y)*ease;if(now-tween.start>=tween.duration+120){returning.delete(id);p.vx=0;p.vy=0;}}
  if(reduced&&!drag&&!returning.size){if(!births.size||quietFrames===0)simulatePhysics(bodies,bounds,4);}
  else{
    // Keep spring stiffness and contact response consistent across display rates.
    physicsTime=Math.min(.05,physicsTime+dt);
    while(physicsTime>=PHYSICS_STEP){stepPhysics(bodies,bounds,PHYSICS_STEP);physicsTime-=PHYSICS_STEP;}
  }
  const movement=Math.max(...bodies.map((p,i)=>Math.max(p.shapeMotion||0,Math.hypot(p.x-before[i].x,p.y-before[i].y))));
  quietFrames=movement<.2&&!bodies.some(p=>p.entering)?quietFrames+1:0;
  drawPositions();
  if(!reduced){let count=0;for(const p of bodies)if(p.impact>160&&now-(p.lastSplash||0)>350&&count++<3){p.lastSplash=now;experience.emit('hit',p.x,p.y+p.r*.5,p.r);}}
  if(pending||drag||returning.size||births.size||(!reduced&&(completions.size||now<settleUntil||quietFrames<40)))frame=requestAnimationFrame(animate);
  else{for(const p of bodies){p.vx=0;p.vy=0;}lastFrame=0;physicsTime=0;persist();}
}
function drawLinks(){
  let svg=board.querySelector('.link-lines');const linked=state.bubbles.filter(b=>b.link);
  if(!linked.length){svg?.remove();return;}
  if(!svg){svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('link-lines');board.prepend(svg);}
  svg.replaceChildren();const seen=new Set();
  for(const b of linked){if(seen.has(b.link))continue;seen.add(b.link);const other=linked.find(x=>x.link===b.link&&x.id!==b.id),p=positions.get(b.id),q=positions.get(other?.id);if(!p||!q)continue;
    if(p.releaseAt!==undefined||q.releaseAt!==undefined)continue;const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',p.x);line.setAttribute('y1',p.y);line.setAttribute('x2',q.x);line.setAttribute('y2',q.y);svg.append(line);}
}

function render(){
  const p=state.puzzle;
  document.querySelectorAll('[data-mode]').forEach(el=>{const active=el.dataset.mode===(p.mode==='lab'?'journey':p.mode);el.classList.toggle('active',active);el.setAttribute('aria-current',active?'page':'false');});
  $('level-label').textContent=t(p.mode==='journey'?`JOURNEY · LEVEL ${String(p.level).padStart(2,'0')}`:p.mode==='daily'?`DAILY · ${new Date(p.date+'T12:00:00').toLocaleDateString(settings.language,{month:'short',day:'numeric'})}`:p.mode==='lab'?'BUBBLE PLAYGROUND':`FREE PLAY · PUZZLE ${p.round}`);
  $('level-title').textContent=t(p.title);$('level-number').textContent=p.mode==='daily'?'☀':p.mode==='lab'?'✧':String(p.mode==='endless'?p.round:p.level).padStart(2,'0');
  $('levels-button').setAttribute('aria-label',t(p.mode==='lab'?'Explore special bubbles':'Choose a journey level'));
  $('progress-text').textContent=t(state.solved.length?`${state.solved.length} of ${p.groups.length} connections found`:`Find ${p.groups.length} groups of four`);
  $('moves-text').innerHTML=state.remaining===null?`${t('Take your time')} <span>∞</span>`:t(`${Math.max(0,state.remaining)} moves left`);
  $('progress-track').innerHTML=p.groups.map((_,i)=>`<span class="${i<state.solved.length?'done':''}"></span>`).join('');
  $('board-empty').hidden=state.status!=='won'||busy;
  $('undo-button').disabled=!history.length;
  for(const id of ['hint-button','magnet-button','space-button','shuffle-button'])$(id).disabled=state.status==='won';
  const current=new Set(state.bubbles.map(b=>b.id));
  for(const[id,el]of elements)if(!current.has(id)){el.remove();elements.delete(id);positions.delete(id);}
  for(const b of state.bubbles){
    let el=elements.get(b.id),fresh=false;
    if(!el){el=document.createElement('button');el.type='button';el.className='bubble spawn';el.dataset.id=b.id;board.append(el);elements.set(b.id,el);fresh=true;}
    const classes=['bubble'];
    if(fresh)classes.push('spawn');if(b.atoms.length>1)classes.push('merged');if(selected===b.id)classes.push('selected');if(hinted.has(b.id))classes.push('hinted');
    if(drag?.id===b.id)classes.push('dragging');if(drag?.target===b.id)classes.push('target');
    if(b.ice>0)classes.push('frozen');else if(b.lockColor)classes.push('locked');else if(b.pinsNeeded>0)classes.push('pinned');else if(b.clearsNeeded>0)classes.push('tangled');else if(b.kind==='cryptic')classes.push('hidden-word');else if(b.turns>0)classes.push('screw');else if(b.kind==='split')classes.push('split');else if(b.keyColor||b.driverColor||b.pinCarrier)classes.push('key');else if(b.kind==='burst')classes.push('burst');else if(b.kind==='linked')classes.push('linked');else if(b.kind==='picture')classes.push('picture');else if(b.kind==='bonus')classes.push('bonus');
    if(b.driverColor)classes.push('screwdriver');const badge=specialLabel(b);if(badge)classes.push('has-special');el.className=classes.join(' ');
    const pairColor=b.lockColor||b.keyColor||b.screwColor||b.driverColor;
    if(pairColor){el.dataset.pairColor=pairColor;el.style.setProperty('--skin-border',KEY_PALETTE[pairColor].ink);}else{delete el.dataset.pairColor;el.style.removeProperty('--skin-border');}
    const label=b.atoms.length>1&&!b.lockColor?`<span class="bubble-terms">${b.atoms.map(atom=>`<span class="bubble-term">${escape(atomText(atom))}</span>`).join('')}</span>`:`<span class="bubble-label">${escape(bubbleText(b))}</span>`;
    el.dataset.soft='true';el._membranePath=null;el.innerHTML=`<span class="bubble-skin" aria-hidden="true">${membraneArt(b.id)}</span>${specialArt(b)}${label}`;
    const text=b.lockColor?t('Locked word'):b.kind==='picture'?t(`Picture: ${b.atoms[0].word}`):bubbleText(b);
    el.setAttribute('aria-label',`${text}${b.atoms.length>1?`, ${t(`${b.atoms.length} of four`)}`:''}${isBlocked(b)?`, ${t(blockedReason(b))}`:badge?`, ${badge.replace(/amber|azure|coral|violet|green|gold|blue|pink|purple|teal|red/g,color=>t(color))}`:''}`);
    el.setAttribute('aria-pressed',String(selected===b.id));
  }
  placeBubbles();
}

function remember(){capturePositions();history.push(structuredClone(state));if(history.length>40)history.shift();}
function act(callback){
  const before=structuredClone(state.bubbles);remember();const result=callback();if(!result?.ok&&!result?.mismatch){history.pop();return result;}
  selected=null;hinted.clear();render();persist();
  animateStates(before);
  if(result?.mismatch){sound('wrong');haptic(20);}else{sound(result?.cleared?'clear':'merge');haptic(result?.cleared?[12,40,12]:8);}
  if(result?.cleared)celebrateSmall();
  if(state.status==='won')onWin();else if(state.status==='paused')showPause();
  return result;
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function reducedMotion(){return settings.motion==='reduced'||settings.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}
function resetAnimations(){animationEpoch++;activeActions=0;busy=false;board.dataset.busy='false';returning.clear();births.clear();for(const p of positions.values())delete p.rebirthPending;experience.reset();for(const el of elements.values())el.getAnimations().forEach(animation=>animation.cancel());for(const p of completions.values())p.el.remove();completions.clear();board.querySelectorAll('.state-effect,.pop-ripple,.merge-ghost,.decoy-pop').forEach(el=>el.remove());}
function pulse(id,cls='rejected'){const el=elements.get(id);if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),450);}
function animateStates(before){
  for(const old of before){const b=state.bubbles.find(b=>b.id===old.id),p=positions.get(old.id);if(!b||!p)continue;
    const types=[];
    if(old.ice>b.ice)types.push(b.ice>0?'ice-chip':'thaw');
    if(old.turns>(b.turns||0))types.push('unscrew');
    if(old.lockColor&&!b.lockColor)types.push('unlock');
    if((old.pinsNeeded||0)>(b.pinsNeeded||0))types.push('unpin');
    if((old.clearsNeeded||0)>(b.clearsNeeded||0))types.push('untangle');
    for(const type of types){const fx=document.createElement('span');fx.className=`state-effect ${type}`;fx.innerHTML=specialArt(old);fx.style.cssText=`left:${p.x-p.r}px;top:${p.y-p.r}px;width:${p.r*2}px;height:${p.r*2}px`;
      if(['unlock','unpin','untangle'].includes(type)){
        const selector={unlock:'.lock-hardware',unpin:'.pinned-art',untangle:'.kelp-wrap'}[type];fx.querySelectorAll(`svg:not(${selector})`).forEach(el=>el.remove());
        if(type==='unpin'){fx.querySelectorAll('.pin-ribbon').forEach(el=>el.remove());fx.querySelectorAll('[data-pin-index]').forEach(el=>{if(Number(el.dataset.pinIndex)<(b.pinsNeeded||0))el.remove();});}
      }
      if(type==='unscrew'){
        fx.querySelectorAll('svg:not(.screw-ring)').forEach(el=>el.remove());
        if(b.turns>0)fx.querySelectorAll('.screw-ring>circle').forEach(el=>el.remove());
        fx.querySelectorAll('.screw-head').forEach((head,i)=>{if(i<(b.turns||0))head.remove();});
      }
      if(type==='ice-chip'||type==='thaw'){
        fx.querySelectorAll('svg:not(.ice-coat)').forEach(el=>el.remove());
        if(type==='ice-chip'){
          const remaining=elements.get(b.id).querySelectorAll('.ice-facet').length;
          fx.querySelectorAll('.ice-surface,.ice-fracture,.ice-snowflake').forEach(el=>el.remove());
          fx.querySelectorAll('.ice-facet').forEach(el=>{if(Number(el.dataset.facet)<remaining)el.remove();});
        }
      }
      board.append(fx);setTimeout(()=>fx.remove(),650);pulse(b.id,type==='ice-chip'?'ice-cracking':'released');experience.emit(type==='ice-chip'||type==='thaw'?'ice':'unlock',p.x,p.y,p.r);}
    if(old.atoms.some((a,i)=>a.revealed!==undefined&&a.revealed<(b.atoms[i]?.revealed??0))){pulse(b.id,'letter-reveal');experience.emit('letter',p.x,p.y,p.r);}
  }
}
async function animateAction(callback,{a,b,origin}={}){
  const epoch=animationEpoch,before=structuredClone(state.bubbles),point=b&&positions.has(b)?{...positions.get(b)}:null;
  remember();
  if(origin&&history.length){const original=history.at(-1).bubbles.find(x=>x.id===a);if(original)original.position={x:origin.x/board.clientWidth,y:origin.y/board.clientHeight};}
  const result=callback();if(!result?.ok&&!result?.mismatch)history.pop();
  const visualMembers=before.filter(old=>result?.poppedDecoys?.includes(old.id)||(result?.cleared?old.groupId===result.cleared.group.id:!result?.toolOnly&&old.id===a));
  const snapshots=new Map(visualMembers.map(old=>[old.id,{el:!reducedMotion()?elements.get(old.id)?.cloneNode(true):null,p:positions.has(old.id)?{...positions.get(old.id)}:null}]));
  if(result?.ok){returning.delete(a);returning.delete(b);}
  activeActions++;busy=true;board.dataset.busy='true';selected=null;hinted.clear();
  // Commit and render immediately. Only detached visual snapshots wait for animations.
  if(result?.cleared?.returnedId){const id=result.cleared.returnedId,r=bubbleSize(state.bubbles.find(x=>x.id===id))/2;positions.set(id,{id,x:point?.x||board.clientWidth/2,y:point?.y||board.clientHeight/2,r,vx:0,vy:0,rebirthPending:true,entering:false});}
  render();animateStates(before);persist();
  for(const id of result?.poppedDecoys||[]){const {el,p}=snapshots.get(id)||{};if(!p||p.releaseAt!==undefined)continue;
    experience.emit('pop',p.x,p.y,p.r);
    if(el&&!reducedMotion()){el.removeAttribute('data-id');el.className='bubble decoy-pop completion-pop';el.setAttribute('aria-hidden','true');el.tabIndex=-1;el.style.translate=`${p.x-p.r}px ${p.y-p.r}px`;board.append(el);setTimeout(()=>el.remove(),220);}
  }
  if(result?.cleared&&!reducedMotion()){
    const liveBefore=new Set(before.map(b=>b.id)),notBefore=state.bubbles.filter(b=>!liveBefore.has(b.id)&&b.id!==result.cleared.returnedId);
    for(const bubble of notBefore){const p=positions.get(bubble.id);if(p?.releaseAt!==undefined)p.releaseAt+=1000;}
  }
  if(result?.toolOnly){
    for(const id of[a,b].filter(Boolean))pulse(id,'merge-bounce');
    if(origin&&positions.has(a)){const p=positions.get(a);returning.set(a,{from:{x:p.x,y:p.y},to:origin,start:performance.now(),duration:reducedMotion()?1:260});wake();}
    sound('merge');haptic(8);await delay(reducedMotion()?0:260);
  }else if(!result?.ok){
    for(const id of[a,b].filter(Boolean))pulse(id);
    if(point)experience.ripple(point.x,point.y,point.r*.5,'#ffaab1',24);
    if(origin&&positions.has(a)){const p=positions.get(a);returning.set(a,{from:{x:p.x,y:p.y},to:origin,start:performance.now(),duration:reducedMotion()?1:260});wake();}
    sound('wrong');haptic(20);await delay(reducedMotion()?130:400);
  }else{
    sound(result.cleared?'clear':'merge');haptic(result.cleared?[12,40,12]:8);
    const destination=point||(()=>{const members=before.filter(x=>x.groupId===result.cleared?.group.id).map(x=>snapshots.get(x.id)?.p).filter(Boolean);return members.length?{x:members.reduce((n,p)=>n+p.x,0)/members.length,y:members.reduce((n,p)=>n+p.y,0)/members.length}:{x:board.clientWidth/2,y:board.clientHeight/2};})();
    experience.emit('join',destination.x,destination.y,point?.r||37);
    const sources=result.cleared?before.filter(x=>x.groupId===result.cleared.group.id).map(x=>x.id):[a];
    const ghosts=[];
    for(const id of sources){const {el,p}=snapshots.get(id)||{};if(el&&p&&!reducedMotion()){
      el.removeAttribute('data-id');el.classList.remove('selected','dragging','target','rejected');el.classList.add('merge-ghost');el.setAttribute('aria-hidden','true');el.tabIndex=-1;board.append(el);ghosts.push(el);
      el.animate([{translate:`${p.x-p.r}px ${p.y-p.r}px`,opacity:1,scale:1},{translate:`${destination.x-p.r}px ${destination.y-p.r}px`,opacity:0,scale:.35}],{duration:180,easing:'ease-in',fill:'forwards'});
    }}
    if(!result.cleared){pulse(result.bubbleId,'merge-bounce');experience.arrive(elements.get(result.bubbleId));}
    await delay(reducedMotion()?0:180);if(epoch!==animationEpoch)return;
    for(const ghost of ghosts)ghost.remove();
    if(result.cleared){
      const size=bubbleSize(result.cleared.completed),r=size/2,id=`completion-${result.cleared.group.id}`,el=document.createElement('div');
      el.className='bubble completion merge-bounce';el.dataset.terms='4';el.dataset.soft='true';el.style.setProperty('--size',`${size}px`);el.innerHTML=`<span class="bubble-skin" aria-hidden="true">${membraneArt(id)}</span><span class="bubble-label group-name">${escape(result.cleared.group.name)}</span>`;board.append(el);fitTerm(el.querySelector('.group-name'),size,1,false);
      const p={id,x:destination.x,y:destination.y,vx:0,vy:0,r,el,entering:false};completions.set(id,p);wake();
      await delay(1200);if(epoch!==animationEpoch)return;
      p.popping=true;el.classList.remove('merge-bounce');el.classList.add('completion-pop');
      experience.emit('pop',p.x,p.y,r);if(!reducedMotion())radialImpulse([...positions.values()].filter(q=>q.releaseAt===undefined&&!q.rebirthPending),{x:p.x,y:p.y,radius:r+110,strength:65,held:heldBubbles()});
      const ripple=document.createElement('span');ripple.className='pop-ripple';ripple.style.cssText=`left:${p.x-r}px;top:${p.y-r}px;width:${size}px;height:${size}px`;board.append(ripple);setTimeout(()=>ripple.remove(),450);
      const center={x:p.x,y:p.y};await delay(reducedMotion()?0:220);if(epoch!==animationEpoch)return;
      el.remove();completions.delete(id);
      const returned=state.bubbles.find(x=>x.id===result.cleared.returnedId);
      if(returned){const radius=bubbleSize(returned)/2;positions.set(returned.id,{id:returned.id,...center,r:radius,vx:0,vy:0,entering:false});returned.position={x:center.x/board.clientWidth,y:center.y/board.clientHeight};births.set(returned.id,performance.now()+120);drawBubble(elements.get(returned.id),positions.get(returned.id));pulse(returned.id,'reborn');experience.arrive(elements.get(returned.id));}celebrateSmall();
    }
  }
  if(epoch!==animationEpoch)return;activeActions--;busy=activeActions>0;board.dataset.busy=String(busy);persist();wake();
  if(state.status==='won'&&!busy){render();onWin();}else if(state.status==='paused')showPause();
}
function combine(a,b,origin){return animateAction(()=>merge(state,a,b,{visibleIds:new Set(state.bubbles.filter(b=>onField(positions.get(b.id))).map(b=>b.id))}),{a,b,origin});}

function pointerPoint(event){const rect=board.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
board.addEventListener('pointerdown',event=>{
  if(event.button!==0||drag||state.status!=='playing')return;
  const point=pointerPoint(event),hit=event.target.closest('.bubble')?.dataset.id;
  const candidates=[...state.bubbles].sort((a,b)=>(b.id===hit)-(a.id===hit));
  const b=candidates.find(b=>{const p=positions.get(b.id);return p&&!p.rebirthPending&&p.releaseAt===undefined&&membraneContains(p,point);});if(!b)return;
  const el=elements.get(b.id),pos=positions.get(b.id);
  births.delete(b.id);returning.delete(b.id);
  experience.press(el);experience.ripple(pos.x,pos.y,pos.r*.65,'#b7f7e5',18);
  drag={id:b.id,pointer:event.pointerId,start:point,last:point,lastTime:event.timeStamp,velocity:{x:0,y:0},moved:false,offset:{x:pos.x-point.x,y:pos.y-point.y},origin:{x:pos.x,y:pos.y},target:null,blocked:isBlocked(b)||b.kind==='bonus'};
  board.setPointerCapture(event.pointerId);event.preventDefault();wake();
});
board.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;const point=pointerPoint(event);
  if(Math.hypot(point.x-drag.start.x,point.y-drag.start.y)>7)drag.moved=true;
  if(!drag.moved||drag.blocked)return;
  const pos=positions.get(drag.id);if(!pos)return;
  const group=[pos],bubble=state.bubbles.find(b=>b.id===drag.id);
  if(bubble?.link){const partner=linkedPartner(bubble,state.bubbles),pp=positions.get(partner?.id);if(pp&&pp.releaseAt===undefined&&!pp.entering&&!pp.rebirthPending)group.push(pp);}
  const delta=translateBoundedGroup(group,{x:point.x+drag.offset.x-pos.x,y:point.y+drag.offset.y-pos.y},{width:board.clientWidth,height:board.clientHeight,top:topInset()}),dx=delta.x,dy=delta.y;
  const elapsed=Math.max(.008,(event.timeStamp-drag.lastTime)/1000);drag.velocity={x:Math.max(-400,Math.min(400,dx/elapsed)),y:Math.max(-400,Math.min(400,dy/elapsed))};drag.lastTime=event.timeStamp;
  elements.get(drag.id)?.classList.add('dragging');
  let nearest=null,distance=Infinity;
  for(const b of state.bubbles){if(b.id===drag.id||b.kind==='bonus'&&!canUseDriver(bubble))continue;const q=positions.get(b.id);if(!q||q.rebirthPending||q.releaseAt!==undefined)continue;const d=Math.hypot(pos.x-q.x,pos.y-q.y);if(d<Math.max(q.r+12,pos.r+6)&&d<distance){nearest=b.id;distance=d;}}
  for(const[id,el]of elements)el.classList.toggle('target',id===nearest);
  drag.target=nearest;drag.last=point;wake();event.preventDefault();
  experience.trail({x:pos.x,y:pos.y},nearest?positions.get(nearest):null);
});
board.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.pointer)return;const action=drag;cancelDrag();
  if(action.moved&&!action.blocked){if(action.target)combine(action.id,action.target,action.origin);else{const p=positions.get(action.id);if(p){p.vx=action.velocity.x*.3;p.vy=action.velocity.y*.3;}wake();persist();}}
  else if(!action.moved){onBubbleTap(action.id);}
  else{pulse(action.id);}
});
board.addEventListener('pointercancel',()=>{if(drag){const p=positions.get(drag.id);if(p){p.x=drag.origin.x;p.y=drag.origin.y;}}cancelDrag();wake();});
board.addEventListener('lostpointercapture',()=>{if(drag){cancelDrag();wake();}});
function cancelDrag(){const pointer=drag?.pointer;drag=null;experience.release();for(const el of elements.values())el.classList.remove('target','dragging');if(pointer!==undefined&&board.hasPointerCapture(pointer))board.releasePointerCapture(pointer);}
function onBubbleTap(id){
  if(positions.get(id)?.rebirthPending||positions.get(id)?.releaseAt!==undefined)return;
  const b=state.bubbles.find(x=>x.id===id);if(!b)return;
  if(selected&&selected!==id&&(canUseDriver(b)||canUseDriver(state.bubbles.find(x=>x.id===selected)))){combine(selected,id);return;}
  if(b.kind==='bonus'){act(()=>tapSpecial(state,id));return;}
  if(isBlocked(b)){pulse(id);return;}
  if(selected&&selected!==id){combine(selected,id);return;}
  selected=selected===id?null:id;render();
}
board.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){const el=event.target.closest('.bubble');if(el){event.preventDefault();onBubbleTap(el.dataset.id);}}if(event.key==='Escape'){selected=null;render();}});
board.addEventListener('click',event=>{if(event.detail===0){const el=event.target.closest('.bubble');if(el)onBubbleTap(el.dataset.id);}});

$('hint-button').addEventListener('click',()=>{const hint=getHint(state);if(!hint)return;hinted=new Set(hint.ids);render();persist();toast(`Look for ${hint.group.name}.`);});
$('magnet-button').addEventListener('click',()=>animateAction(()=>magnet(state)));
$('space-button').addEventListener('click',()=>{remember();moreRoom(state);render();persist();wake();});
$('undo-button').addEventListener('click',()=>{if(!history.length)return;clearTimeout(winTimer);resetAnimations();resetPhysics();state=history.pop();selected=null;hinted.clear();positions.clear();restorePositions=true;render();persist();});
$('shuffle-button').addEventListener('click',()=>{resetAnimations();selected=null;placeBubbles(true);wake();persist();});
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>{if(state.puzzle.mode===el.dataset.mode)return;start({mode:el.dataset.mode});}));
$('help-button').addEventListener('click',showHelp);$('settings-button').addEventListener('click',showSettings);$('levels-button').addEventListener('click',()=>state.puzzle.mode==='lab'?showSpecials():showLevels());$('library-button').addEventListener('click',showLibrary);$('close-sheet').addEventListener('click',()=>sheet.close());
function closeActions(){$('actions-menu').hidden=true;$('tools-button').setAttribute('aria-expanded','false');}
function syncPhysicsControls(){
  for(const key of Object.keys(PHYSICS_DEFAULTS)){
    const input=$(`physics-${key}`),percent=Math.round(settings.physics[key]*100);
    input.value=percent;$(`physics-${key}-value`).value=`${percent}%`;input.setAttribute('aria-valuetext',t(`${percent} percent of the default`));
  }
}
function showPhysicsControls(open){
  closeActions();if(drag)cancelDrag();
  document.querySelectorAll('[data-game-hud]').forEach(el=>el.hidden=open);$('physics-panel').hidden=!open;
  syncPhysicsControls();wake(4000);(open?$('physics-gravity'):$('tools-button')).focus({preventScroll:true});
}
$('physics-button').addEventListener('click',()=>showPhysicsControls(true));
$('physics-done').addEventListener('click',()=>showPhysicsControls(false));
$('physics-reset').addEventListener('click',()=>{settings.physics={...PHYSICS_DEFAULTS};syncPhysicsControls();persist();wake(4000);});
for(const key of Object.keys(PHYSICS_DEFAULTS))$(`physics-${key}`).addEventListener('input',event=>{
  settings.physics=normalizePhysics({...settings.physics,[key]:Number(event.target.value)/100});syncPhysicsControls();persist();wake(4000);
});
$('tools-button').addEventListener('click',()=>{const open=$('actions-menu').hidden;$('actions-menu').hidden=!open;$('tools-button').setAttribute('aria-expanded',String(open));if(open)experience.panel($('actions-menu'));});
$('actions-menu').addEventListener('click',event=>{if(event.target.closest('button'))closeActions();});
$('board-next').addEventListener('click',nextPuzzle);
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#actions-menu,#tools-button'))closeActions();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!$('physics-panel').hidden)showPhysicsControls(false);else closeActions();}});
sheet.addEventListener('click',event=>{const r=sheet.getBoundingClientRect();if(event.target===sheet&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))sheet.close();});

function openSheet(title,html){$('sheet-title').textContent=t(title);$('sheet-body').innerHTML=html;localizeUI($('sheet-body'),settings.language);if(!sheet.open)sheet.showModal();$('sheet-body').scrollTop=0;sheet.scrollTop=0;experience.panel(sheet);}
function showHelp(){openSheet('A little wordplay',`<p class="sheet-intro">Some words just belong together. Find their connection and bring four into one bubble.</p><div class="help-steps"><div class="help-step"><span>1</span><div><strong>Find a common thread</strong><p>Oak, Maple, Birch, and Pine are all forest trees. Each word fits just one theme in a deck. Bass can be a fish in one deck and an instrument in another.</p></div></div><div class="help-step"><span>2</span><div><strong>Drag one onto another</strong><p>Words fall and settle at the bottom. Hold one and drop it onto its partner, or tap each in turn. Combined bubbles keep every word visible; the category appears only when four join.</p></div></div><div class="help-step"><span>3</span><div><strong>Let the board open up</strong><p>A few new words fall in after a group clears. Sometimes the category returns as a word. Its new connection may use another meaning.</p></div></div></div><p class="sheet-intro">Hint reveals a theme. Magnet completes a group. More room deals extra bubbles and adds moves in Challenge mode. Shuffle is free. Undo brings back your last action.</p><button class="primary-button" id="help-play">Let's connect</button><button class="secondary-button" id="specials-button">Meet the special bubbles</button>`);$('help-play').onclick=()=>sheet.close();$('specials-button').onclick=showSpecials;}
function showSpecials(){openSheet('Little twists',`<p class="sheet-intro">Meet all ${SPECIALS.length} special mechanics. Tap one to try a small practice puzzle. Your journey stays saved.</p><div class="special-grid">${SPECIALS.map(s=>`<button class="special-card" data-special="${s.id}"><span>${s.icon}</span><strong>${s.name}</strong><small>${s.description}</small><em>Try it · Journey ${s.level} ↗</em></button>`).join('')}</div>`);document.querySelectorAll('[data-special]').forEach(el=>el.onclick=()=>{sheet.close();start({mode:'lab',special:el.dataset.special},true);});}
function showLevels(){const pageStart=Math.max(1,Math.floor(((state.puzzle.level||saved.level)-1)/30)*30+1);renderLevels(pageStart);}
function renderLevels(startAt){openSheet('Your little journey',`<p class="sheet-intro">Every level is open. The first ${INTRO_LEVELS} introduce the special bubbles; later boards mix them together.</p><div class="level-grid">${Array.from({length:30},(_,i)=>{const n=startAt+i;return `<button data-level="${n}" class="${saved.completed.includes(n)?'finished ':''}${state.puzzle.mode==='journey'&&state.puzzle.level===n?'current':''}">${n}<small>${saved.completed.includes(n)?'✓':n<=INTRO_LEVELS?'learn':'explore'}</small></button>`;}).join('')}</div><div class="sheet-tabs" style="margin-top:18px"><button id="level-prev" ${startAt===1?'disabled':''}>← Previous</button><button id="level-next">Next 30 →</button></div>`);document.querySelectorAll('[data-level]').forEach(el=>el.onclick=()=>{saved.level=Number(el.dataset.level);sheet.close();start({mode:'journey',level:saved.level},true);});$('level-prev').onclick=()=>renderLevels(Math.max(1,startAt-30));$('level-next').onclick=()=>renderLevels(startAt+30);}

function toggleRow(id,title,subtitle,checked){return `<label class="field-row"><span><strong>${title}</strong><small>${subtitle}</small></span><span class="switch"><input id="${id}" type="checkbox" ${checked?'checked':''}><span></span></span></label>`;}
function showSettings(){const LIBRARY_STATS=catalog().stats;openSheet('Make yourself at home',`
  <label class="field-row"><span><strong>Language</strong><small>One language for words and interface</small></span><select id="setting-language"><option value="en">English</option><option value="de">Deutsch</option></select></label>
  <fieldset class="word-pack-settings"><legend>Word packs</legend><p class="sheet-intro">Choose at least one pack. Every pack works on its own; the base pack is optional.</p><div class="word-pack-grid">${PACKS.map(pack=>`<label class="word-pack-option"><input type="checkbox" name="word-pack" value="${pack.id}" ${settings.packIds.includes(pack.id)?'checked':''}><span data-vocabulary>${escape(pack.name[settings.language])}</span></label>`).join('')}</div></fieldset>
  <p class="install-note">Changing language or packs starts fresh puzzles in all modes. Completed levels and totals stay saved.</p><p class="install-note">Daily puzzles depend on the selected language and packs.</p><p class="pack-validation" id="pack-validation" role="status" aria-live="polite"></p><button class="primary-button" id="apply-word-settings">Apply word settings</button><div class="sheet-divider"></div>
  <label class="field-row"><span><strong>Palette</strong><small>A different kind of quiet</small></span><select id="setting-theme"><option value="grove">Grove</option><option value="lavender">Lavender</option><option value="sunset">Golden hour</option></select></label>
  <label class="field-row"><span><strong>Word difficulty</strong><small>Applies to the next new puzzle</small></span><select id="setting-difficulty"><option value="gentle">Gentle</option><option value="balanced">Balanced</option><option value="tricky">Curious</option></select></label>
  ${toggleRow('setting-challenge','Challenge mode','A move budget for new puzzles',settings.challenge)}
  ${toggleRow('setting-sound','Little sounds','Soft pops, made right here',settings.sound)}
  ${toggleRow('setting-haptics','Touch feedback','A gentle tap on supported phones',settings.haptics)}
  ${toggleRow('setting-motion','Less motion','Keep things still',settings.motion==='reduced')}
  <div class="sheet-divider"></div><button class="secondary-button" id="install-button">${matchMedia('(display-mode: standalone)').matches?'Already at home ✓':'Install Bubble Grove'}</button>
  <p class="install-note" id="install-note">${installMessage()}</p>
  <div class="sheet-divider"></div><p class="sheet-intro">${LIBRARY_STATS.themes} original themes · ${LIBRARY_STATS.words.toLocaleString(settings.language)} distinct words. No ads, purchases, analytics, or accounts. Progress lives on this device.</p>
  <button class="secondary-button" id="export-button">Export progress</button><button class="secondary-button" id="import-button">Restore progress</button><input class="save-file" type="file" accept="application/json,.json" id="import-file"><button class="inline-link" id="restart-button">Restart this puzzle</button>`);
  $('setting-language').value=settings.language;
  $('apply-word-settings').onclick=()=>{
    const packIds=[...document.querySelectorAll('[name="word-pack"]:checked')].map(el=>el.value);
    if(!packIds.length){$('pack-validation').textContent=t('Keep at least one word pack enabled.');return;}
    const language=$('setting-language').value;
    if(wordScope(language,packIds)===wordScope(settings.language,settings.packIds)){sheet.close();return;}
    const mode=state.puzzle.mode;persist();resetAnimations();if(drag)cancelDrag();state=null;saved.sessions={};settings.language=language;settings.packIds=normalizePackIds(packIds);
    applySettings();sheet.close();start({mode:mode==='lab'?'journey':mode},true);toast('Word settings saved. Fresh puzzles are ready.');
  };
  $('setting-theme').value=settings.theme;$('setting-difficulty').value=settings.difficulty;
  for(const key of['theme','difficulty'])$(`setting-${key}`).onchange=event=>{settings[key]=event.target.value;applySettings();persist();};
  for(const key of['challenge','sound','haptics'])$(`setting-${key}`).onchange=event=>{settings[key]=event.target.checked;persist();if(key==='sound'&&settings.sound)sound('merge');};
  $('setting-motion').onchange=event=>{settings.motion=event.target.checked?'reduced':'system';applySettings();persist();};
  $('install-button').onclick=install;$('export-button').onclick=exportSave;$('import-button').onclick=()=>$('import-file').click();$('import-file').onchange=importSave;
  $('restart-button').onclick=()=>{openSheet('A fresh start?',`<p class="sheet-intro">Restart this puzzle from its opening board. Your other puzzles and completed levels stay saved.</p><button class="primary-button" id="confirm-restart">Restart puzzle</button><button class="secondary-button" id="cancel-restart">Keep playing</button>`);$('confirm-restart').onclick=()=>{const options={...state.puzzle,special:state.puzzle.mode==='lab'?state.puzzle.specials[0]:null};sheet.close();start(options,true);};$('cancel-restart').onclick=()=>sheet.close();};
}
function showLibrary(){const {themes:THEMES,stats:LIBRARY_STATS}=catalog();openSheet('The word library',`<p class="sheet-intro">Short clues can have several meanings. Four words form each theme, and ${LIBRARY_STATS.pictures} emoji can stand in for words.</p><div class="pack-stats"><div><strong>${LIBRARY_STATS.themes}</strong><small>themes</small></div><div><strong>${LIBRARY_STATS.words.toLocaleString(settings.language)}</strong><small>distinct words</small></div><div><strong>${LIBRARY_STATS.domains}</strong><small>worlds to explore</small></div></div><input type="search" class="library-search" id="library-search" placeholder="Find a theme or word…" aria-label="Search themes and words"><div id="library-results"></div>`);const draw=q=>{const query=q.trim().toLowerCase(),themes=THEMES.filter(t=>`${t.name} ${t.domain} ${t.words.join(' ')}`.toLowerCase().includes(query));$('library-results').innerHTML=themes.length?themes.map(t=>`<div class="library-item"><strong>${escape(t.name)}</strong><small>${escape(translate(t.domain,settings.language))}</small><p>${t.words.map(escape).join(' · ')}</p></div>`).join(''):`<p class="sheet-intro">${t('No connection found. Try another word.')}</p>`;};draw('');$('library-search').oninput=event=>draw(event.target.value);}

function onWin(){
  const p=state.puzzle,key=p.id;
  // Replaying and undoing a solved puzzle never awards progress twice.
  if(!saved.awarded)saved.awarded=[];
  if(!saved.awarded.includes(key)){saved.awarded.push(key);if(saved.awarded.length>2000)saved.awarded.shift();saved.stats.groups+=p.groups.length;saved.stats.puzzles++;}
  if(p.mode==='journey'&&!saved.completed.includes(p.level))saved.completed.push(p.level);
  const dailyKey=`${p.date}|${wordScope(p.language,p.packIds)}`;
  if(p.mode==='daily'&&!saved.dailyWins.includes(dailyKey))saved.dailyWins.push(dailyKey);
  persist();confetti();
  winTimer=setTimeout(()=>{if(state.status==='won')showWin();},500);
}
function showWin(){const p=state.puzzle;openSheet('Everything connects',`<div class="win-art">✦</div><h3 class="win-title">A lovely little discovery.</h3><p class="sheet-intro" style="text-align:center">${p.mode==='daily'?'Your daily moment of wordplay is complete.':p.mode==='lab'?'One more little twist, understood.':'Take that good feeling with you.'}</p><div class="win-stats"><div><strong>${p.groups.length}</strong><small>connections</small></div><div><strong>${state.moves}</strong><small>moves</small></div><div><strong>${state.mistakes===0?'✧':state.mistakes}</strong><small>${state.mistakes===0?'perfect flow':'second thoughts'}</small></div></div><div class="win-groups">${state.solved.map(g=>`<div class="win-group"><strong>${escape(g.name)}</strong><span>${g.words.map(escape).join(' · ')}</span></div>`).join('')}</div><button class="primary-button" id="next-button">${p.mode==='daily'?'Keep playing in Free play':p.mode==='lab'?'Meet another special bubble':'Another little connection →'}</button><button class="secondary-button" id="win-close">Enjoy the moment</button>`);$('next-button').onclick=nextPuzzle;$('win-close').onclick=()=>sheet.close();}
function nextPuzzle(){sheet.close();const p=state.puzzle;if(p.mode==='journey'){saved.level=p.level+1;start({mode:'journey',level:saved.level},true);}else if(p.mode==='lab')showSpecials();else{saved.round=(saved.round||1)+1;start({mode:'endless',round:saved.round},true);}}
function showPause(){openSheet('A little breathing room',`<p class="sheet-intro">${state.bubbles.some(b=>b.timer<=0)?'That spark ran out of moves.':'You reached the move budget.'} Take five more moves, reset any sparks, and keep connecting. Always free.</p><button class="primary-button" id="continue-button">More room · keep playing</button><button class="secondary-button" id="pause-undo" ${history.length?'':'disabled'}>Undo the last move</button>`);$('continue-button').onclick=()=>{sheet.close();remember();moreRoom(state);render();persist();};$('pause-undo').onclick=()=>{sheet.close();$('undo-button').click();};}

function toast(message,duration=3000){clearTimeout(toastTimer);$('toast').textContent=t(message);$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function haptic(pattern){if(settings.haptics)navigator.vibrate?.(pattern);}
function sound(type){if(!settings.sound)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const now=audioContext.currentTime;for(const[i,freq]of(type==='clear'?[523,659,784]:type==='wrong'?[185]:[440,660]).entries()){const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type='sine';osc.frequency.setValueAtTime(freq,now+i*.06);gain.gain.setValueAtTime(0,now+i*.06);gain.gain.linearRampToValueAtTime(.045,now+i*.06+.01);gain.gain.exponentialRampToValueAtTime(.001,now+i*.06+.16);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now+i*.06);osc.stop(now+i*.06+.18);}}catch{/* Audio is an optional enhancement. */}}
function celebrateSmall(){experience.progress($('progress-track'));}
function confetti(){experience.emit('win',board.clientWidth/2,board.clientHeight*.5,80);}

function exportSave(){persist();const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`bubble-grove-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your progress, ready to keep.');}
async function importSave(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>2_000_000)throw Error('That file is too large.');const data=JSON.parse(await file.text());if(!isSave(data))throw Error('This is not a valid Bubble Grove progress file.');openSheet('Restore your progress?',`<p class="sheet-intro">This backup contains ${data.completed.length} completed journey levels. Restoring replaces the progress on this device.</p><button class="primary-button" id="restore-confirm">Restore backup</button><button class="secondary-button" id="restore-cancel">Keep current progress</button>`);$('restore-confirm').onclick=()=>{state=null;saved={...structuredClone(initial),...data};settings=normalizeSettings(data.settings);applySettings();sheet.close();start();toast('Welcome back. Your progress is restored.');};$('restore-cancel').onclick=()=>sheet.close();}catch(error){toast(['That file is too large.','This is not a valid Bubble Grove progress file.'].includes(error.message)?error.message:'That backup could not be read.');}}
function installMessage(){if(matchMedia('(display-mode: standalone)').matches)return 'Bubble Grove is installed. Open it from your home screen, even offline.';if(!window.isSecureContext)return 'To install on your phone, open the game from an HTTPS address. Then use Chrome’s menu → Add to Home screen → Install. The local computer preview is also supported.';return 'On your Galaxy: open this page in Chrome, then tap Install above or use the ⋮ menu → Add to Home screen → Install. After the first visit, the whole game works offline.';}
async function install(){if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else{toast(matchMedia('(display-mode: standalone)').matches?'Already installed. A little grove on your home screen.':'In Chrome: ⋮ menu → Add to Home screen → Install.',5000);}}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('A little grove on your home screen.');});
async function setupOffline(){if(!navigator.onLine)$('offline-label').textContent=t('Offline. All yours.');if(!('serviceWorker'in navigator)||!window.isSecureContext)return;try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;$('offline-label').dataset.ready='true';$('offline-label').textContent=t(navigator.onLine?'Ready for a little offline time.':'Offline. All yours.');}catch{if(navigator.onLine)toast('Offline saving is unavailable here. The game still plays online.');}}
window.addEventListener('online',()=>$('offline-label').textContent=t('Ready for a little offline time.'));window.addEventListener('offline',()=>$('offline-label').textContent=t('Offline. All yours.'));
window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();cancelAnimationFrame(frame);frame=0;}else{wake();if(state.puzzle.mode==='daily'&&state.puzzle.date!==localDate()){start({mode:'daily'},true);toast('A new day, a fresh connection.');}}});
new ResizeObserver(()=>{if(state){placeBubbles();wake();}}).observe(board);
applySettings();start();setupOffline();
document.fonts.ready.then(()=>{if(state&&!busy)render();});
