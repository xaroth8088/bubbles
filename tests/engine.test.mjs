import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,SPECIALS,LIBRARY_STATS} from '../src/data.js';
import {assembleThemeChain} from '../src/nesting.js';
import {createPuzzle,makeState,merge,tapSpecial,isBlocked,magnet,moreRoom,getHint,validateState,bubbleText,localDate,clearableGroups,liveLoad,upgradeDealing,random,refill} from '../src/engine.js';

const demo=special=>makeState(createPuzzle({mode:'lab',special}));
// Named vocabulary coverage must not depend on the size of the random pool.
function checkNamedReturn(name,parentName){
  const dictionary=[name,parentName].map(n=>THEMES.find(t=>t.name===n));
  assert.ok(dictionary.every(Boolean),`${name} / ${parentName} must exist`);
  const chain=assembleThemeChain(dictionary,{rng:random(`fixture-${name}`),maxDepth:1});
  assert.deepEqual(chain.map(t=>t.name),[name,parentName]);
  assert.ok(chain.every(t=>t.words.length===4));
  assert.equal(new Set(chain.flatMap(t=>t.words.map(w=>w.toLowerCase()))).size,8);
  assert.equal(chain[1].words[0],name);
  assert.ok(chain[1].words.every(w=>dictionary[1].words.includes(w)));
  const puzzle=createPuzzle({mode:'lab',special:'nested'});
  puzzle.groups=chain.map((t,i)=>({id:`g${i}`,name:t.name,domain:t.domain,words:t.words,...(i?{childId:'g0'}:{parentId:'g1'})}));
  const state=makeState(puzzle);
  popGroup(state,'g0');
  const term=state.bubbles.find(b=>b.id==='g0-theme');
  assert.ok(term,`${name} must return`);
  assert.equal(term.kind,'normal');
  assert.equal(term.atoms.length,1);
  assert.equal(term.groupId,'g1');
  assert.equal(bubbleText(term),name);
  solve(state);
  return name;
}

function members(state,group){return state.bubbles.filter(b=>b.groupId===group);}
function popGroup(state,group){
  for(let tries=0;tries<15;tries++){
    const list=members(state,group);if(!list.length)return;
    const fragmented=list.filter(b=>b.atoms.some(a=>a.part!==undefined));
    if(fragmented.length){const a=fragmented[0],b=fragmented.find(b=>b.id!==a.id&&b.atoms[0].id===a.atoms[0].id);assert.ok(b);assert.ok(merge(state,a.id,b.id).ok);continue;}
    if(list.length<2)return;
    assert.ok(merge(state,list[0].id,list[1].id).ok);
  }
  assert.fail('Group did not clear');
}
function solve(state){
  for(let i=0;i<160&&state.status==='playing';i++){
    assert.ok(validateState(JSON.parse(JSON.stringify(state))),`Invalid save during ${state.puzzle.id}`);
    assert.ok(clearableGroups(state).length,`No live four-way connection in ${state.puzzle.id}`);
    const removable=state.bubbles.find(b=>b.shell||b.kind==='bonus');
    if(removable){assert.ok(tapSpecial(state,removable.id).ok);continue;}
    let pair=null;
    for(const g of state.puzzle.groups){
      const list=members(state,g.id).filter(b=>!isBlocked(b));
      const fragment=list.find(b=>b.atoms.some(a=>a.part!==undefined));
      if(fragment){const partner=list.find(b=>b.id!==fragment.id&&b.atoms[0]?.id===fragment.atoms[0].id);if(partner){pair=[fragment,partner];break;}}
      const whole=list.filter(b=>b.atoms.every(a=>a.part===undefined));
      if(whole.length>=2){pair=whole.slice(0,2);break;}
    }
    assert.ok(pair,`No valid action: ${state.puzzle.id}, solved ${state.solved.length}, ${JSON.stringify(state.bubbles)}`);
    assert.ok(merge(state,pair[0].id,pair[1].id).ok);
  }
  assert.equal(state.status,'won',state.puzzle.id);assert.equal(state.bubbles.length,0);assert.equal(state.reserve.length,0);assert.ok(validateState(state),`Invalid win save ${state.puzzle.id}`);
}

test('dictionary contains substantial, valid original pools',()=>{
  assert.ok(LIBRARY_STATS.themes>=250);assert.ok(LIBRARY_STATS.words>=2000);
  for(const t of THEMES){assert.ok(t.words.length>=4);assert.equal(new Set(t.words.map(w=>w.toLowerCase())).size,t.words.length,t.name);}
});
test('journey clues are deterministic and have four unique words per group',()=>{
  for(let level=1;level<=300;level++){
    const puzzle=createPuzzle({level});assert.deepEqual(puzzle,createPuzzle({level}));
    const words=puzzle.groups.flatMap(g=>g.words.map(w=>w.toLowerCase()));assert.equal(new Set(words).size,words.length,`Level ${level}`);
    assert.ok(puzzle.groups.every(g=>g.words.length===4));
  }
});

test('fresh journey shuffles change the opening and reserve order while preserving the level',()=>{
  for(const level of[1,3,4,6,10,13,15,18,36]){
    const puzzle=createPuzzle({level}),a=makeState(puzzle,{shuffleSeed:'first-play'}),b=makeState(puzzle,{shuffleSeed:'next-play'});
    assert.deepEqual(a.puzzle.groups,b.puzzle.groups);assert.deepEqual(a.puzzle.specials,b.puzzle.specials);assert.equal(a.puzzle.id,b.puzzle.id);
    assert.notDeepEqual(a.bubbles.map(b=>b.id),b.bubbles.map(b=>b.id),`Same opening at level ${level}`);
    assert.notDeepEqual(a.reserve.flat().map(b=>b.id),b.reserve.flat().map(b=>b.id),`Same reserve at level ${level}`);
    // Real clues are fixed; a reshuffle may choose a different unrelated decoy.
    const ledger=state=>[...state.bubbles,...state.reserve.flat()].filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>a.word)).sort();
    assert.deepEqual(ledger(a),ledger(b));assert.deepEqual(a,makeState(puzzle,{shuffleSeed:'first-play'}));
    const resumed=JSON.parse(JSON.stringify(a));upgradeDealing(resumed);assert.deepEqual(resumed,a);
    assert.ok(validateState(resumed));solve(a);solve(b);
  }
});
test('randomized journey decks stay solvable across mechanics and retain deck limits',()=>{
  for(let level=1;level<=100;level++){
    const state=makeState(createPuzzle({level}),{shuffleSeed:`attempt-${level}`});
    const total=state.bubbles.length+state.reserve.flat().length;
    assert.ok(total>=40&&total<=70);assert.equal(liveLoad(state),24);
    assert.ok(state.bubbles.length>=24&&state.bubbles.length<=28);solve(state);
  }
});
test('all 300 journey levels are solvable without helpers, including mixed dependencies',()=>{
  for(let level=1;level<=300;level++)solve(makeState(createPuzzle({level}),{challenge:true}));
});
test('all special demos can be solved without helpers',()=>{
  for(const s of SPECIALS)solve(demo(s.id));
});
test('daily puzzles are stable across preferences and change with the local date',()=>{
  const a=createPuzzle({mode:'daily',date:'2026-10-07',difficulty:'gentle',level:1});
  const b=createPuzzle({mode:'daily',date:'2026-10-07',difficulty:'tricky',level:999});
  assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.specials,b.specials);assert.equal(a.seed,b.seed);
  assert.notDeepEqual(a.groups,createPuzzle({mode:'daily',date:'2026-10-08'}).groups);
  assert.equal(localDate(new Date(2026,9,7,23,59)),'2026-10-07');
});
test('free-play rounds vary, all difficulty settings produce solvable boards',()=>{
  for(const difficulty of ['gentle','balanced','tricky'])for(let round=1;round<=70;round++)solve(makeState(createPuzzle({mode:'endless',round,difficulty})));
  assert.notDeepEqual(createPuzzle({mode:'endless',round:1}).groups,createPuzzle({mode:'endless',round:2}).groups);
});
test('merging four words pops once and saves the exact theme',()=>{
  const state=makeState(createPuzzle());const group=state.puzzle.groups[0];popGroup(state,group.id);
  assert.equal(state.solved.length,1);assert.deepEqual(state.solved[0].words,group.words);assert.equal(state.moves,3);
});
test('wrong pairs spend a challenge move without destroying words',()=>{
  const state=makeState(createPuzzle(),{challenge:true}),count=state.bubbles.length,before=state.remaining;
  const a=state.bubbles[0],b=state.bubbles.find(b=>b.groupId!==a.groupId);
  const result=merge(state,a.id,b.id);assert.ok(result.mismatch);assert.equal(state.bubbles.length,count);assert.equal(state.mistakes,1);assert.equal(state.remaining,before-1);
});
test('ice thaws on four successful merges, including partial joins, with no extra step on a clear',()=>{
  const state=demo('frozen'),ice=state.bubbles.find(b=>b.ice),other=state.bubbles.find(b=>b.id!==ice.id);
  assert.equal(ice.ice,4);assert.equal(ice.iceTotal,4);
  assert.ok(merge(state,ice.id,other.id).blocked);assert.equal(state.moves,0);assert.equal(ice.ice,4);
  const list=members(state,'g0');
  assert.ok(merge(state,list[0].id,list[1].id).ok);assert.equal(ice.ice,3);assert.equal(state.solved.length,0);
  assert.ok(merge(state,list[1].id,list[2].id).ok);assert.equal(ice.ice,2);assert.ok(isBlocked(ice));
  assert.ok(merge(state,list[2].id,list[3].id).cleared);assert.equal(ice.ice,1);assert.ok(isBlocked(ice));
  const next=members(state,'g1');assert.ok(merge(state,next[0].id,next[1].id).ok);
  assert.equal(ice.ice,0);assert.ok(!isBlocked(ice));assert.equal(ice.kind,'normal');assert.ok(validateState(state));
});
test('split joins thaw live and waiting ice; wrong guesses and hardware taps do not',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'split'});puzzle.specials=['split','frozen','screw','crack'];
  const state=makeState(puzzle),ice=state.bubbles.find(b=>b.ice),waiting=state.reserve.flat()[0];
  waiting.ice=waiting.iceTotal=4;waiting.kind='frozen';
  const parts=state.bubbles.filter(b=>b.kind==='split');
  assert.ok(merge(state,parts[0].id,parts[1].id).assembled);assert.equal(ice.ice,3);assert.equal(waiting.ice,3);
  const wrong=state.bubbles.find(b=>b.groupId!==parts[1].groupId&&!b.driverColor&&!isBlocked(b));
  assert.ok(merge(state,parts[1].id,wrong.id).mismatch);assert.equal(ice.ice,3);assert.equal(waiting.ice,3);
  for(const b of state.bubbles.filter(b=>b.shell))assert.ok(tapSpecial(state,b.id).ok);
  assert.equal(ice.ice,3);assert.equal(waiting.ice,3);assert.ok(validateState(state));
});
test('existing frozen saves migrate once and retain thaw progress across reloads',()=>{
  const state=demo('frozen'),ice=state.bubbles.find(b=>b.ice),list=members(state,'g0');
  ice.ice=1;delete ice.iceTotal;upgradeDealing(state);assert.equal(ice.ice,4);assert.equal(ice.iceTotal,4);
  merge(state,list[0].id,list[1].id);assert.equal(ice.ice,3);
  const restored=JSON.parse(JSON.stringify(state));upgradeDealing(restored);
  assert.equal(restored.bubbles.find(b=>b.id===ice.id).ice,3);assert.ok(validateState(restored));
  const bad=structuredClone(restored);bad.bubbles.find(b=>b.id===ice.id).iceTotal=2;assert.ok(!validateState(bad));
});
test('a key unlocks only its own colored lock on a successful partial merge',()=>{
  const state=demo('keylock'),key=state.bubbles.find(b=>b.keyColor==='amber'),lock=state.bubbles.find(b=>b.lockColor==='amber');
  const partner=members(state,key.groupId).find(b=>b.id!==key.id),wrong=state.bubbles.find(b=>b.groupId!==key.groupId&&!isBlocked(b));
  assert.ok(merge(state,key.id,wrong.id).mismatch);assert.equal(lock.lockColor,'amber');
  const result=merge(state,key.id,partner.id);assert.ok(result.ok);assert.equal(state.solved.length,0);assert.equal(lock.lockColor,undefined);
  assert.equal(state.bubbles.find(b=>b.id===partner.id).keyColor,undefined,'The consumed key stayed on the merged bubble');
  assert.deepEqual(state.keys,['amber']);assert.ok(validateState(state));
});

test('key levels can contain multiple pairs with distinct colors',()=>{
  const state=demo('keylock'),keys=state.bubbles.filter(b=>b.keyColor),locks=state.bubbles.filter(b=>b.lockColor);
  assert.ok(keys.length>=2);assert.equal(new Set(keys.map(b=>b.keyColor)).size,keys.length);
  assert.deepEqual(keys.map(b=>b.keyColor).sort(),locks.map(b=>b.lockColor).sort());
  const key=keys[0],color=key.keyColor,partner=members(state,key.groupId).find(b=>b.id!==key.id);
  assert.ok(merge(state,key.id,partner.id).ok);assert.ok(locks.filter(b=>b.lockColor!==color).some(b=>b.lockColor),'A key opened another color');solve(state);
});

test('the dealer puts a corresponding lock on the board before its key',()=>{
  for(let seed=0;seed<80;seed++){
    const puzzle=createPuzzle({level:6}),state=makeState(puzzle,{shuffleSeed:`lock-order-${seed}`});
    for(const key of state.bubbles.filter(b=>b.keyColor)){
      const lockIndex=state.bubbles.findIndex(b=>b.lockColor===key.keyColor);
      assert.ok(lockIndex>=0&&lockIndex<state.bubbles.indexOf(key),`Key ${key.keyColor} preceded its lock in shuffle ${seed}`);
    }
    solve(state);
  }
  const state=demo('keylock'),all=[...state.bubbles,...state.reserve.flat()];state.bubbles=[];state.reserve=state.puzzle.groups.map(g=>all.filter(b=>b.groupId===g.id));state.capacity=8;
  refill(state,{initial:true});for(const key of state.bubbles.filter(b=>b.keyColor))assert.ok(state.bubbles.some(b=>b.lockColor===key.keyColor));
  assert.ok(clearableGroups(state).length,'Key prerequisites consumed the guaranteed playable group');
});

test('fragment assembly triggers its key and old carried keys migrate without losing clues',()=>{
  const split=demo('split'),parts=split.bubbles.filter(b=>b.kind==='split'),lock=split.bubbles.find(b=>b.groupId==='g3');
  parts[0].keyColor='violet';lock.lockColor='violet';lock.kind='keylock';assert.ok(merge(split,parts[0].id,parts[1].id).assembled);
  assert.equal(lock.lockColor,undefined);assert.deepEqual(split.keys,['violet']);assert.equal(split.solved.length,0);assert.ok(validateState(split));
  const old=demo('keylock'),key=old.bubbles.find(b=>b.keyColor==='amber'),target=old.bubbles.find(b=>b.groupId===key.groupId&&b.id!==key.id),oldLock=old.bubbles.find(b=>b.lockColor==='amber');
  merge(old,key.id,target.id);target.keyColor='amber';oldLock.lockColor='amber';oldLock.kind='keylock';old.keys=[];
  const ledger=s=>[...s.bubbles,...s.reserve.flat()].flatMap(b=>b.atoms.map(a=>a.id)).sort(),words=ledger(old),moves=old.moves;
  upgradeDealing(old);assert.equal(oldLock.lockColor,undefined);assert.equal(target.keyColor,undefined);assert.deepEqual(old.keys,['amber']);assert.deepEqual(ledger(old),words);assert.equal(old.moves,moves);assert.ok(validateState(old));
  const waiting=demo('keylock'),waitingLock=waiting.bubbles.find(b=>b.lockColor==='amber');waiting.bubbles=waiting.bubbles.filter(b=>b!==waitingLock);waiting.reserve.push([waitingLock]);
  const waitingWords=ledger(waiting);upgradeDealing(waiting);assert.ok(waiting.bubbles.includes(waitingLock));assert.deepEqual(waitingLock.position,{x:.5,y:.25});assert.deepEqual(ledger(waiting),waitingWords);assert.ok(validateState(waiting));
});
test('pinned bubbles collect both pins from completed groups',()=>{
  const state=demo('pinlock'),lock=state.bubbles.find(b=>b.pinsNeeded);popGroup(state,'g0');assert.equal(lock.pinsNeeded,1);popGroup(state,'g1');assert.equal(lock.pinsNeeded,0);assert.equal(state.pins,2);
});
test('removed shells and old hidden clouds migrate without losing clues or moves',()=>{
  assert.ok(!SPECIALS.some(s=>['hidden','crack'].includes(s.id)));
  const state=demo('cryptic'),b=state.bubbles.find(b=>b.kind==='cryptic'),c=state.bubbles.find(b=>b.kind==='normal');
  b.kind='hidden';b.atoms[0].revealed=2;c.kind='crack';c.shell=true;state.puzzle.specials=['hidden','cryptic','crack'];
  const words=state.bubbles.flatMap(b=>b.atoms.map(a=>a.word)),moves=state.moves;
  assert.ok(validateState(state));upgradeDealing(state);
  assert.deepEqual(state.puzzle.specials,['cryptic']);assert.equal(b.kind,'cryptic');assert.equal(b.atoms[0].revealed,2);assert.equal(c.kind,'normal');assert.equal(c.shell,undefined);
  assert.deepEqual(state.bubbles.flatMap(b=>b.atoms.map(a=>a.word)),words);assert.equal(state.moves,moves);assert.ok(validateState(state));solve(state);
});

test('screw rings require two to five matching tools, and unrelated words also activate screwdrivers',()=>{
  const counts=new Set();
  for(let seed=0;seed<60;seed++){
    const state=makeState(createPuzzle({mode:'lab',special:'screw'}),{shuffleSeed:`screw-${seed}`});
    const lock=[...state.bubbles,...state.reserve.flat()].find(b=>b.turns),tools=[...state.bubbles,...state.reserve.flat()].filter(b=>b.driverColor===lock.screwColor);
    counts.add(lock.turns);assert.equal(lock.turns,lock.screwTotal);assert.equal(tools.length,lock.turns);
    assert.equal(new Set(tools.map(b=>b.groupId)).size,Math.min(3,lock.turns),'Tools should span the unlocked themes');
    for(const tool of tools)assert.ok([...state.bubbles,...state.reserve.flat()].some(b=>b.groupId===tool.groupId&&b.id!==tool.id&&!b.driverColor&&!isBlocked(b)),'Each tool needs an ordinary partner');
    assert.ok(!clearableGroups(state).some(g=>g.id===lock.groupId));
    if(state.bubbles.includes(lock)){const before=lock.turns,moves=state.moves;assert.ok(!tapSpecial(state,lock.id).ok);assert.equal(lock.turns,before);assert.equal(state.moves,moves);}
    for(const tool of state.bubbles.filter(b=>b.driverColor)){
      const at=state.bubbles.indexOf(tool),lockAt=state.bubbles.findIndex(b=>b.screwColor===tool.driverColor&&b.turns>0);assert.ok(lockAt>=0&&lockAt<at,'A screwdriver arrived before its screw lock');
    }
    const tool=state.bubbles.find(b=>b.driverColor),wrong=state.bubbles.find(b=>b.groupId!==tool.groupId&&!isBlocked(b));
    const before=lock.turns,removed=1+Number(!!wrong.driverColor),atoms=structuredClone([tool.atoms,wrong.atoms]),moves=state.moves,mistakes=state.mistakes;
    const result=merge(state,tool.id,wrong.id);assert.ok(result.ok);assert.ok(result.toolOnly);assert.equal(lock.turns,before-removed);
    assert.equal(result.usedDrivers.length,removed);assert.equal(tool.driverColor,undefined);assert.equal(wrong.driverColor,undefined);
    assert.deepEqual([tool.atoms,wrong.atoms],atoms);assert.ok(state.bubbles.includes(tool)&&state.bubbles.includes(wrong));
    assert.equal(state.moves,moves+1);assert.equal(state.mistakes,mistakes);assert.ok(validateState(state));
    solve(state);
  }
  assert.deepEqual([...counts].sort(),[2,3,4,5]);
});

test('a screwdriver removes one screw when joining an ordinary single, pair, or triple in either direction',()=>{
  for(const size of[1,2,3])for(const toolFirst of[false,true]){
    const state=makeState(createPuzzle({mode:'lab',special:'screw'}),{shuffleSeed:'screw-5'}),all=[...state.bubbles,...state.reserve.flat()],lock=all.find(b=>b.turns);
    const tool=state.bubbles.find(b=>b.driverColor&&members(state,b.groupId).length===4);
    // Keep exactly one tool in this theme without changing the number of tools in the deck.
    for(const b of members(state,tool.groupId).filter(b=>b!==tool&&b.driverColor)){
      const replacement=all.find(p=>p.groupId!==tool.groupId&&p.groupId!==lock.groupId&&!p.driverColor&&!isBlocked(p));
      replacement.driverColor=b.driverColor;delete b.driverColor;
    }
    const plain=members(state,tool.groupId).filter(b=>b!==tool);let partner=plain[0];
    for(let i=1;i<size;i++){
      const result=merge(state,plain[i].id,partner.id);assert.ok(result.ok);assert.deepEqual(result.usedDrivers,[]);
      partner=state.bubbles.find(b=>b.id===partner.id);
    }
    const before=lock.turns,result=merge(state,...(toolFirst?[tool.id,partner.id]:[partner.id,tool.id]));
    assert.ok(result.ok);assert.deepEqual(result.usedDrivers,['violet']);assert.equal(lock.turns,before-1);
    assert.equal(Boolean(result.cleared),size===3);assert.ok(![...state.bubbles,...state.reserve.flat()].find(b=>b.id===tool.id)?.driverColor);
    assert.ok(validateState(state));solve(state);
  }
});

test('screwdrivers activate against unrelated words and blocked bubbles in either direction without losing clues',()=>{
  for(const kind of['normal','frozen','keylock','sealed','pinlock','screw'])for(const toolFirst of[false,true]){
    const state=makeState(createPuzzle({mode:'lab',special:'screw'}),{shuffleSeed:'screw-5'}),lock=state.bubbles.find(b=>b.turns),tool=state.bubbles.find(b=>b.driverColor);
    const partner=kind==='screw'?lock:state.bubbles.find(b=>b.groupId!==tool.groupId&&!b.driverColor&&!isBlocked(b));
    if(kind==='frozen'){partner.kind=kind;partner.ice=partner.iceTotal=4;}
    if(kind==='keylock'){partner.kind=kind;partner.lockColor='amber';}
    if(kind==='sealed'){partner.kind=kind;partner.clearsNeeded=1;}
    if(kind==='pinlock'){partner.kind=kind;partner.pinsNeeded=2;}
    const ledger=state.bubbles.flatMap(b=>b.atoms).concat(state.reserve.flat().flatMap(b=>b.atoms)),before=structuredClone(ledger),turns=lock.turns;
    const result=merge(state,...(toolFirst?[tool.id,partner.id]:[partner.id,tool.id]));
    assert.ok(result.ok&&result.toolOnly,kind);assert.deepEqual(result.usedDrivers,['violet']);assert.equal(lock.turns,turns-1);
    assert.deepEqual(state.bubbles.flatMap(b=>b.atoms).concat(state.reserve.flat().flatMap(b=>b.atoms)),before);assert.equal(state.mistakes,0);
    assert.ok(state.bubbles.includes(tool)&&state.bubbles.includes(partner));assert.ok(validateState(state));
    assert.ok(!merge(state,tool.id,partner.id).ok);assert.equal(lock.turns,turns-1,'A used tool must not remove another screw');
    if(kind==='frozen')assert.equal(partner.ice,4);
    if(kind==='keylock')assert.equal(partner.lockColor,'amber');
  }
});

test('screwdriver contacts with fragments, decoys, keys, and move bonuses use only the tool',()=>{
  for(const special of['split','linked','keylock','bonus']){
    const puzzle=createPuzzle({mode:'lab',special:'screw'});puzzle.specials=['screw',special];
    // Exercise the contact semantics without depending on a particular deal.
    let state,lock,partner,tool;
    for(let attempt=0;attempt<80&&!tool;attempt++){
      state=makeState(puzzle,{shuffleSeed:`contact-${attempt}`});lock=state.bubbles.find(b=>b.turns);
      partner=state.bubbles.find(b=>special==='split'?b.kind==='split'&&b.atoms[0].part===1:special==='linked'?b.decoy:special==='keylock'?b.keyColor:b.kind==='bonus');
      tool=partner&&state.bubbles.find(b=>b.driverColor&&b.groupId!==partner.groupId);
    }
    assert.ok(tool&&partner&&lock,`A test deal must expose the ${special} contact`);
    const before=structuredClone(partner),turns=lock.turns,remaining=state.remaining;
    const result=merge(state,tool.id,partner.id);assert.ok(result.ok&&result.toolOnly,special);assert.equal(lock.turns,turns-1);
    assert.deepEqual(partner,before);assert.equal(state.bonusCollected,0);assert.deepEqual(state.keys,[]);assert.equal(state.mistakes,0);
    if(remaining!==null)assert.equal(state.remaining,remaining-1);assert.ok(validateState(state));solve(state);
  }
});

test('unrelated screwdriver colors each remove one screw from their own ring',()=>{
  const state=makeState(createPuzzle()),groups=clearableGroups(state).slice(0,2),locks=state.bubbles.filter(b=>!groups.some(g=>g.id===b.groupId)).slice(0,2),colors=['violet','coral'];
  const tools=groups.map(g=>members(state,g.id)[0]);
  locks.forEach((lock,i)=>{lock.kind='screw';lock.turns=lock.screwTotal=2;lock.screwColor=colors[i];members(state,groups[i].id).slice(0,2).forEach(b=>b.driverColor=colors[i]);});
  const result=merge(state,tools[0].id,tools[1].id);assert.ok(result.ok&&result.toolOnly);assert.deepEqual(result.usedDrivers,colors);assert.deepEqual(locks.map(b=>b.turns),[1,1]);
  assert.ok(tools.every(b=>state.bubbles.includes(b)&&!b.driverColor));assert.ok(validateState(state));solve(state);
});

test('two screwdrivers in one partial merge remove two screws and fragment joins consume one',()=>{
  const state=makeState(createPuzzle({mode:'lab',special:'screw'}),{shuffleSeed:'screw-5'}),lock=state.bubbles.find(b=>b.turns),tools=state.bubbles.filter(b=>b.driverColor);
  const a=tools[0],b=members(state,a.groupId).find(b=>b!==a&&!b.driverColor),donor=[...state.bubbles,...state.reserve.flat()].find(b=>b!==a&&b.driverColor);
  b.driverColor=donor.driverColor;delete donor.driverColor;assert.ok(validateState(state));
  const before=lock.turns,result=merge(state,a.id,b.id);assert.ok(result.ok);assert.equal(result.usedDrivers.length,2);assert.equal(lock.turns,before-2);assert.equal(b.driverColor,undefined);assert.equal(state.solved.length,0);assert.ok(validateState(state));solve(state);
  const puzzle=createPuzzle({mode:'lab',special:'split'});puzzle.specials=['split','screw'];const split=makeState(puzzle),first=split.bubbles.find(b=>b.kind==='split'&&b.driverColor),parts=split.bubbles.filter(b=>b.kind==='split'&&b.atoms[0].id===first.atoms[0].id),screw=split.bubbles.find(b=>b.turns),remaining=screw.turns;
  assert.equal(parts.filter(b=>b.driverColor).length,1);assert.ok(merge(split,parts[0].id,parts[1].id).assembled);assert.equal(screw.turns,remaining-1);assert.ok(parts.every(b=>!b.driverColor));solve(split);
});

test('colored screwdriver pairs coexist with keys and never unlock another ring',()=>{
  const state=makeState(createPuzzle()),groups=clearableGroups(state).slice(0,2),locks=state.bubbles.filter(b=>!groups.some(g=>g.id===b.groupId)).slice(0,2);
  const colors=['violet','coral'];
  locks.forEach((lock,i)=>{lock.kind='screw';lock.turns=lock.screwTotal=2;lock.screwColor=colors[i];members(state,groups[i].id).slice(0,2).forEach(b=>b.driverColor=colors[i]);});
  const keyLock=state.bubbles.find(b=>b!==locks[0]&&b!==locks[1]&&!groups.some(g=>g.id===b.groupId));keyLock.lockColor='amber';keyLock.kind='keylock';
  const first=members(state,groups[0].id);first[2].keyColor='amber';merge(state,first[2].id,first[3].id);assert.equal(keyLock.lockColor,undefined);assert.deepEqual(locks.map(b=>b.turns),[2,2]);
  merge(state,first[0].id,first[1].id);assert.equal(locks[0].turns,0);assert.equal(locks[0].screwColor,undefined);assert.equal(locks[1].turns,2);assert.ok(isBlocked(locks[1]));assert.ok(validateState(state));solve(state);
});

test('legacy screw saves gain tools once without changing their word ledger, moves, or progress',()=>{
  for(const turns of[1,2]){
    const state=demo('screw'),all=[...state.bubbles,...state.reserve.flat()],lock=all.find(b=>b.turns);
    all.forEach(b=>{delete b.driverColor;delete b.screwColor;delete b.screwTotal;});lock.turns=turns;state.moves=3;
    const ledger=s=>[...s.bubbles,...s.reserve.flat()].flatMap(b=>b.atoms.map(a=>a.word)).sort(),before=ledger(state);
    assert.ok(validateState(state));upgradeDealing(state);assert.equal(state.moves,3);assert.deepEqual(ledger(state),before);assert.equal(lock.turns,turns);
    assert.equal([...state.bubbles,...state.reserve.flat()].filter(b=>b.driverColor).length,turns);assert.ok(validateState(state));
    const migrated=structuredClone(state);upgradeDealing(state);assert.deepEqual(state,migrated);solve(state);
  }
  const late=demo('screw'),all=[...late.bubbles,...late.reserve.flat()],lock=all.find(b=>b.turns),group=late.puzzle.groups.find(g=>g.id===lock.groupId);
  late.puzzle.groups=[group];late.bubbles=all.filter(b=>b.groupId===group.id);late.reserve=[];late.solved=[];
  late.bubbles.forEach(b=>{delete b.driverColor;delete b.screwColor;delete b.screwTotal;});lock.turns=2;
  upgradeDealing(late);assert.equal(lock.turns,0);assert.ok(validateState(late));solve(late);
});

test('screwdriver dealing remains playable alongside colored keys, ice and split words',()=>{
  for(let seed=0;seed<80;seed++){
    const puzzle=createPuzzle({mode:'endless',round:seed+1,difficulty:'tricky'});puzzle.specials=['screw','keylock','frozen','split'];
    const state=makeState(puzzle,{shuffleSeed:`tools-mixed-${seed}`});assert.equal(liveLoad(state),24);solve(state);
  }
});

test('legacy boards whose only complete group had screws receive a playable connection',()=>{
  const state=makeState(createPuzzle({mode:'endless',special:'screw',difficulty:'tricky'})),all=[...state.bubbles,...state.reserve.flat()],lock=all.find(b=>b.turns);
  for(const b of all){delete b.driverColor;delete b.screwColor;delete b.screwTotal;}lock.turns=2;
  const live=all.filter(b=>b.groupId===lock.groupId),others=state.puzzle.groups.filter(g=>g.id!==lock.groupId);
  for(const g of others)live.push(all.find(b=>b.groupId===g.id));
  for(const g of others){if(live.length>=24)break;live.push(all.find(b=>b.groupId===g.id&&!live.includes(b)));}
  state.bubbles=live;state.reserve=state.puzzle.groups.map(g=>all.filter(b=>b.groupId===g.id&&!live.includes(b))).filter(c=>c.length);state.capacity=24;
  assert.equal(clearableGroups(state).length,0);const seen=live.map(b=>b.id),ledger=all.flatMap(b=>b.atoms.map(a=>a.word)).sort();
  upgradeDealing(state);assert.ok(clearableGroups(state).length);assert.ok(seen.every(id=>state.bubbles.some(b=>b.id===id)));assert.equal(state.moves,0);
  assert.deepEqual([...state.bubbles,...state.reserve.flat()].flatMap(b=>b.atoms.map(a=>a.word)).sort(),ledger);assert.ok(validateState(state));solve(state);
});

test('concise themes return as ordinary terms in expanded fixed-solution connections',()=>{
  assert.equal(THEMES.find(t=>t.id==='theme-178').name,'Ship');
  assert.ok(THEMES.some(t=>t.name==='Ship'&&t.words.includes('Mast')));assert.ok(!THEMES.some(t=>t.name==='Parts of a ship'));
  const returned=new Set();
  for(let round=1;round<=300;round++){
    const puzzle=createPuzzle({mode:'endless',round,special:'nested'}),child=puzzle.groups.find(g=>g.parentId),parent=puzzle.groups.find(g=>g.childId);
    assert.equal(parent.words[0],child.name);assert.equal(new Set(puzzle.groups.flatMap(g=>g.words.map(w=>w.toLowerCase()))).size,puzzle.groups.length*4);
    returned.add(child.name);
    if(child.name==='Ship'){
      const state=makeState(puzzle);popGroup(state,child.id);const bubble=state.bubbles.find(b=>b.id===`${child.id}-theme`);
      assert.equal(bubble.atoms[0].word,'Ship');assert.equal(bubble.kind,'normal');assert.equal(bubble.groupId,parent.id);assert.ok(parent.words.every(w=>THEMES.find(t=>t.name===parent.name).words.includes(w)));solve(state);
    }
  }
  for(const [name,parent]of[['Ship','Vehicles'],['Car','Vehicles'],['Book','Reading material'],['Guitar','Strings'],['Airport','Buildings'],['Coffee','Hot drinks']])returned.add(checkNamedReturn(name,parent));
  for(const name of['Ship','Car','Book','Guitar','Airport','Coffee'])assert.ok(returned.has(name),`${name} never returned`);
});
test('split fragments cannot be sorted until reunited in either direction',()=>{
  for(const reverse of[false,true]){const state=demo('split'),parts=state.bubbles.filter(b=>b.kind==='split');if(reverse)parts.reverse();const plain=state.bubbles.find(b=>b.groupId===parts[0].groupId&&b.kind!=='split');
    assert.ok(merge(state,parts[0].id,plain.id).mismatch);assert.ok(merge(state,parts[0].id,parts[1].id).assembled);const united=state.bubbles.find(b=>b.id===parts[1].id);assert.equal(united.atoms.length,1);assert.equal(united.atoms[0].part,undefined);}
});
test('every successful merge reveals one letter; a hidden word reveals fully when joined',()=>{
  const state=demo('cryptic'),b=state.bubbles.find(b=>b.kind==='cryptic'),list=members(state,'g0');
  assert.equal(b.atoms[0].revealed,1);assert.ok(!isBlocked(b));assert.equal([...bubbleText(b)].filter(c=>/[a-z]/i.test(c)).length,1);
  assert.ok(merge(state,list[0].id,list[1].id).ok);assert.equal(b.atoms[0].revealed,2);assert.equal([...bubbleText(b)].filter(c=>/[a-z]/i.test(c)).length,2);
  const wrong=members(state,'g1')[0];assert.ok(merge(state,b.id,wrong.id).mismatch);assert.equal(b.atoms[0].revealed,2);
  const other=members(state,b.groupId).find(x=>x.id!==b.id);const result=merge(state,b.id,other.id);assert.ok(result.ok);
  const combined=state.bubbles.find(x=>x.id===result.bubbleId);assert.ok(bubbleText(combined).includes(b.atoms[0].word));assert.ok(validateState(state));
});
test('half-word merges reveal letters in live and waiting bubbles without clearing a group',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'split'});puzzle.specials=['split','hidden','cryptic'];const state=makeState(puzzle);
  const parts=state.bubbles.filter(b=>b.kind==='split'),masked=state.bubbles.filter(b=>b.atoms[0]?.revealed!==undefined);
  const waiting=state.reserve.flat()[0];waiting.atoms[0].revealed=0;const before=masked.map(b=>b.atoms[0].revealed);
  const result=merge(state,parts[0].id,parts[1].id);assert.ok(result.assembled);assert.equal(state.solved.length,0);
  masked.forEach((b,i)=>assert.equal(b.atoms[0].revealed,before[i]+1));assert.equal(waiting.atoms[0].revealed,1);
  assert.ok(validateState(JSON.parse(JSON.stringify(state))));
});
test('nested theme pops become the fourth word of their parent group',()=>{
  const state=demo('nested'),child=state.puzzle.groups[0],parent=state.puzzle.groups.find(g=>g.childId);assert.ok(parent);popGroup(state,child.id);const b=state.bubbles.find(b=>b.id===`${child.id}-theme`);assert.equal(b.atoms[0].word,child.name);assert.equal(b.groupId,parent.id);assert.equal(b.kind,'normal');assert.equal(b.atoms.length,1);solve(state);
});
test('links break after a merge; backward and picture words keep their meaning',()=>{
  const state=demo('linked'),b=state.bubbles.find(b=>b.link),partner=state.bubbles.find(x=>x.link===b.link&&x.id!==b.id),other=state.bubbles.find(x=>x.groupId===b.groupId&&x.id!==b.id);
  const result=merge(state,b.id,other.id);assert.ok(result.ok);assert.deepEqual(result.poppedDecoys,[partner.id]);assert.ok(!state.bubbles.some(b=>b.id===partner.id));
  const backward=demo('backward').bubbles.find(b=>b.kind==='backward');assert.equal(bubbleText(backward),[...backward.atoms[0].word].reverse().join(''));
  assert.ok(demo('picture').bubbles.some(b=>b.kind==='picture'));
});
test('burst expiration pauses play and more room restores it without a purchase',()=>{
  const state=demo('burst'),burst=state.bubbles.find(b=>b.timer),a=state.bubbles.find(b=>b.groupId==='g1'),b=state.bubbles.find(b=>b.groupId==='g2');
  for(let i=0;i<9;i++)merge(state,a.id,b.id);assert.equal(state.status,'paused');assert.equal(burst.timer,0);moreRoom(state);assert.equal(state.status,'playing');assert.equal(burst.timer,9);
});
test('legacy octopus boards retain their clues while the retired mechanic is removed',()=>{const state=demo('picture');state.puzzle.specials.push('octopus');state.pressure=4;const words=state.bubbles.flatMap(b=>b.atoms.map(a=>a.word));assert.ok(validateState(state));upgradeDealing(state);assert.ok(!state.puzzle.specials.includes('octopus'));assert.equal(state.pressure,0);assert.deepEqual(state.bubbles.flatMap(b=>b.atoms.map(a=>a.word)),words);solve(state);});
test('magnet preserves key/pin dependencies and completes a real group',()=>{
  const state=demo('keylock'),result=magnet(state);assert.ok(result.ok);assert.equal(state.solved.length,1);assert.equal(state.assists,1);solve(state);
  const pins=demo('pinlock');assert.ok(magnet(pins).ok);assert.ok(magnet(pins).ok);assert.equal(pins.pins,2);solve(pins);
});
test('bonus moves and move exhaustion can always be recovered',()=>{
  const state=makeState(createPuzzle({mode:'lab',special:'bonus'}),{challenge:true}),before=state.remaining;
  assert.ok(tapSpecial(state,'bonus').ok);assert.equal(state.remaining,before+5);
  state.remaining=1;const a=state.bubbles[0],b=state.bubbles.find(b=>b.groupId!==a.groupId);merge(state,a.id,b.id);assert.equal(state.status,'paused');moreRoom(state);assert.equal(state.status,'playing');assert.equal(state.remaining,5);
});
test('saved states survive JSON roundtrips; malformed saves are rejected',()=>{
  const state=demo('split');assert.ok(validateState(JSON.parse(JSON.stringify(state))));assert.ok(!validateState({}));
  const duplicate=structuredClone(state);duplicate.bubbles.push(duplicate.bubbles[0]);assert.ok(!validateState(duplicate));
  const bad=structuredClone(state);bad.bubbles[0].atoms[0].word=null;assert.ok(!validateState(bad));
  const foreign=structuredClone(state);foreign.bubbles[0].atoms[0].word='Not in this puzzle';assert.ok(!validateState(foreign));
  const lost=structuredClone(state);lost.bubbles.shift();assert.ok(!validateState(lost));
  const malformed=structuredClone(state);delete malformed.puzzle.specials;assert.ok(!validateState(malformed));
});
test('hints expose an available connection without spending a move',()=>{const state=demo('frozen'),hint=getHint(state);assert.ok(hint.ids.length>=1);assert.ok(hint.ids.every(id=>!isBlocked(state.bubbles.find(b=>b.id===id))));assert.equal(state.moves,0);});

test('typical decks have 40–70 bubbles total and 24–28 live',()=>{
  for(const difficulty of['gentle','balanced','tricky'])for(let level=1;level<=100;level++){const state=makeState(createPuzzle({level,difficulty})),total=state.bubbles.length+state.reserve.flat().length;assert.equal(liveLoad(state),24);assert.ok(state.bubbles.length>=24&&state.bubbles.length<=28);assert.ok(total>=40&&total<=70);assert.ok(state.reserve.length);assert.ok(clearableGroups(state).length);}
});
test('four-merges feed at most four new bubbles and never deal on an intermediate merge',()=>{
  const state=makeState(createPuzzle()),initial=state.reserve.flat().length,group=members(state,'g0');
  merge(state,group[0].id,group[1].id);assert.equal(state.reserve.flat().length,initial);
  const before=new Set(state.bubbles.map(b=>b.id));popGroup(state,'g0');
  const incoming=state.bubbles.filter(b=>!before.has(b.id));assert.ok(incoming.length>0&&incoming.length<=4);assert.ok(liveLoad(state)<=24);assert.ok(clearableGroups(state).length);
});
test('incoming fours mix themes whenever the reserve offers several themes',()=>{
  let mixed=0;
  for(let level=1;level<=100;level++){
    const puzzle=createPuzzle({level});puzzle.specials=puzzle.specials.filter(s=>s!=='burst');const state=makeState(puzzle);
    for(let step=0;step<24&&state.status==='playing';step++){
      const g=clearableGroups(state)[0],ready=members(state,g.id);for(const b of ready)while(b.shell)tapSpecial(state,b.id);
      const before=new Set(state.bubbles.map(b=>b.id)),waitingGroups=new Set(state.reserve.flat().map(b=>b.groupId));popGroup(state,g.id);
      const incoming=state.bubbles.filter(b=>!before.has(b.id)&&!b.id.endsWith('-theme'));
      if(incoming.length===4&&waitingGroups.size>1){assert.ok(new Set(incoming.map(b=>b.groupId)).size>1,`${puzzle.id} dealt a ready-made group`);mixed++;}
    }
  }
  assert.ok(mixed>100);
});
test('oversized old decks shed unseen groups without changing live clues or solved progress',()=>{
  const puzzle=createPuzzle({mode:'endless',difficulty:'tricky'}),used=new Set(puzzle.groups.flatMap(g=>g.words));
  for(const theme of THEMES){if(puzzle.groups.length>=20)break;const words=theme.words.filter(w=>!used.has(w)).slice(0,4);if(words.length!==4)continue;puzzle.groups.push({id:`extra${puzzle.groups.length}`,name:theme.name,domain:theme.domain,words});words.forEach(w=>used.add(w));}
  const state=makeState(puzzle);state.dealVersion=3;popGroup(state,'g0');
  const live=structuredClone(state.bubbles),solved=structuredClone(state.solved),moves=state.moves;
  upgradeDealing(state);assert.ok(state.puzzle.groups.length<=17);assert.deepEqual(state.bubbles,live);assert.deepEqual(state.solved,solved);assert.equal(state.moves,moves);assert.ok(validateState(state));solve(state);
});
test('arbitrary partial merges and clear orders always leave a completable live group',()=>{
  for(let round=1;round<=300;round++){
    const puzzle=createPuzzle({mode:'endless',round,difficulty:'tricky'});puzzle.specials=puzzle.specials.filter(s=>s!=='burst');
    const state=makeState(puzzle),rng=random(`order-${round}`);
    for(let step=0;step<70&&state.status==='playing';step++){
      assert.ok(clearableGroups(state).length,`Stranded at ${puzzle.id} step ${step}`);assert.ok(liveLoad(state)<=state.capacity+.001);
      const prepare=state.bubbles.find(b=>b.shell);if(prepare){tapSpecial(state,prepare.id);continue;}
      const pairs=[];
      for(const g of puzzle.groups){const list=members(state,g.id).filter(b=>!isBlocked(b));for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
        const a=list[i],b=list[j],af=a.atoms[0]?.part,bf=b.atoms[0]?.part;
        if((af===undefined&&bf===undefined)||(af!==undefined&&bf!==undefined&&a.atoms[0].id===b.atoms[0].id))pairs.push([a,b]);
      }}
      assert.ok(pairs.length);const pair=pairs[Math.floor(rng()*pairs.length)];assert.ok(merge(state,pair[0].id,pair[1].id).ok);
      assert.ok(validateState(state));
    }
    assert.equal(state.status,'won',puzzle.id);
  }
});
test('ordinary completions disappear; only selected categories return as ordinary words',()=>{
  const plain=makeState(createPuzzle());popGroup(plain,'g0');assert.ok(!plain.bubbles.some(b=>b.atoms.some(a=>a.word==='Trees')));
  const names=new Set();for(let level=18;level<=120;level++){const p=createPuzzle({level});if(p.specials.includes('nested'))names.add(p.groups.find(g=>g.parentId).name);}assert.ok(names.size>2,'Category transfers should vary');
});
test('previous saves migrate without losing words, partial merges, moves, or progress',()=>{
  const state=makeState(createPuzzle()),list=members(state,'g0');merge(state,list[0].id,list[1].id);
  state.bubbles.push(...state.reserve.flat());state.reserve=[];delete state.dealVersion;state.capacity=32;
  const atoms=state.bubbles.flatMap(b=>b.atoms.map(a=>a.id)).sort(),moves=state.moves;
  upgradeDealing(state);assert.equal(state.moves,moves);assert.equal(state.dealVersion,4);assert.ok(state.bubbles.some(b=>b.atoms.length===2));
  assert.deepEqual([...state.bubbles,...state.reserve.flat()].flatMap(b=>b.atoms.map(a=>a.id)).sort(),atoms);assert.ok(state.reserve.length);assert.ok(validateState(state));solve(state);
});

test('shared words remain in multiple dictionary pools, while each deck stays unique',()=>{
  const bassPools=THEMES.filter(t=>t.words.includes('Bass')).map(t=>t.name);
  assert.ok(bassPools.includes('Strings'));assert.ok(bassPools.includes('Freshwater fish'));assert.ok(bassPools.includes('Voice'));
  for(const word of['Mouse','Bat','Bank','Orange'])assert.ok(THEMES.filter(t=>t.words.includes(word)).length>=2,word);
});

test('ordinary overlapping clues have fixed answers without a special board template',()=>{
  for(const name of ['Strings','Freshwater fish']){
    const other=name==='Strings'?'Freshwater fish':'Strings';
    const chosen=[name,other].map(n=>THEMES.find(t=>t.name===n));
    const puzzle=createPuzzle({mode:'lab',special:'picture'});puzzle.specials=[];
    puzzle.groups=chosen.map((t,i)=>({id:`g${i}`,name:t.name,domain:t.domain,words:i===0?['Bass',...t.words.filter(w=>w!=='Bass').slice(0,3)]:t.words.filter(w=>w!=='Bass').slice(0,4)}));
    const state=makeState(puzzle),bass=state.bubbles.find(b=>b.atoms[0].word==='Bass');
    const wrong=state.bubbles.find(b=>b.groupId!==bass.groupId),right=state.bubbles.find(b=>b.groupId===bass.groupId&&b!==bass);
    assert.ok(merge(state,bass.id,wrong.id).mismatch);assert.ok(merge(state,bass.id,right.id).ok);solve(state);
  }
});

test('a category term can change meaning and behaves exactly like an ordinary word',()=>{
  const meanings=new Set();
  for(let level=18;level<=500;level++){
    const puzzle=createPuzzle({level}),child=puzzle.groups.find(g=>g.parentId&&['Bass','Rock','Pitch','Jam','Cricket','Keys','Bows'].includes(g.name));
    if(!child)continue;
    puzzle.specials=['nested'];const state=makeState(puzzle);popGroup(state,child.id);
    const term=state.bubbles.find(b=>b.atoms[0]?.word===child.name);
    assert.equal(term.kind,'normal');assert.equal(term.atoms.length,1);assert.equal(term.groupId,child.parentId);assert.equal(bubbleText(term),child.name);
    meanings.add(child.name);solve(state);
  }
  for(const [name,parent]of[['Bass','Freshwater fish'],['Rock','Music genres'],['Pitch','Soccer'],['Jam','Music session'],['Cricket','Ball sports'],['Keys','Moving house']])meanings.add(checkNamedReturn(name,parent));
  assert.ok(meanings.size>=5,'Several category transfers should change meanings');assert.ok(meanings.has('Bass'));
});
