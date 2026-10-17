import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,ALL_PACK_IDS} from '../src/catalog.js';
import {SPECIALS} from '../src/data.js';
import {createPuzzle,makeState,validateState,upgradeDealing,merge,tapSpecial,isBlocked,clearableGroups} from '../src/engine.js';

const fold=word=>word.trim().toLowerCase();
const indexes=new WeakMap();
function check(puzzle){
  const catalog=getCatalog(puzzle);
  if(!indexes.has(catalog))indexes.set(catalog,new Map(catalog.themes.map(t=>[t.name,new Set(t.words.map(fold))])));
  const index=indexes.get(catalog),pools=puzzle.groups.map(g=>({id:g.id,words:index.get(g.name)}));
  const words=puzzle.groups.flatMap(g=>g.words.map(fold));
  assert.equal(new Set(words).size,words.length,`Duplicate clue: ${puzzle.id}`);
  for(const group of puzzle.groups)for(const word of group.words){
    const matches=pools.filter(pool=>pool.words.has(fold(word))).map(pool=>pool.id);
    assert.deepEqual(matches,[group.id],`${puzzle.id}: ${word} must fit only ${group.name}`);
  }
  const state=makeState(puzzle),bubbles=[...state.bubbles,...state.reserve.flat()];
  assert.ok(validateState(state),puzzle.id);
  assert.ok(bubbles.length<=70,puzzle.id);
  assert.ok(puzzle.groups.length>=(puzzle.mode==='lab'?4:10),`Undersized deck: ${puzzle.id}`);
  for(const b of bubbles.filter(b=>b.decoy))assert.equal(pools.filter(p=>p.words.has(fold(b.atoms[0].word))).length,0);
  for(const b of bubbles.filter(b=>!b.decoy))for(const atom of b.atoms){
    assert.deepEqual(pools.filter(pool=>pool.words.has(fold(atom.word))).map(pool=>pool.id),[b.groupId]);
  }
  return state;
}

test('known English and German cross-theme memberships do not recur in new decks',()=>{
  for(const options of [{mode:'journey',level:1},{mode:'endless',round:23,language:'de',packIds:['base']}]){
    const puzzle=createPuzzle(options);assert.match(puzzle.id,/-v10-/);check(puzzle);
    assert.deepEqual(puzzle,createPuzzle(options));
  }
});

test('every language and pack scope keeps all generated clues exclusive across modes and mechanics',()=>{
  let unusedOverlap=false;
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS]){
    const catalog=getCatalog({language,packIds}),before=JSON.stringify(catalog.themes);
    for(const difficulty of ['gentle','balanced','tricky'])for(let round=1;round<=20;round++){
      const special=[null,'nested','split','picture','linked'][round%5];
      const puzzle=createPuzzle({language,packIds,mode:'endless',difficulty,round,special});check(puzzle);
      const pools=puzzle.groups.map(g=>catalog.themes.find(t=>t.name===g.name).words.map(fold));
      if(!unusedOverlap)unusedOverlap=pools.some((pool,i)=>pools.slice(i+1).some(other=>pool.some(w=>other.includes(w))));
    }
    for(const level of [1,5,18,36])check(createPuzzle({language,packIds,level}));
    for(let day=1;day<=5;day++)check(createPuzzle({language,packIds,mode:'daily',date:`2026-10-${String(day).padStart(2,'0')}`}));
    assert.equal(JSON.stringify(catalog.themes),before,'Deck generation must never prune the shared catalog');
  }
  assert.ok(unusedOverlap,'Themes may share unused catalog clues while all actual deck clues remain exclusive');
});

test('all-pack practice mechanics preserve the membership invariant through saves and completion',()=>{
  for(const language of ['en','de'])for(const {id:special} of SPECIALS){
    let state=check(createPuzzle({language,packIds:ALL_PACK_IDS,mode:'lab',special}));
    if(special==='nested')assert.ok(state.puzzle.groups.some(g=>g.parentId));
    for(let step=0;state.status==='playing'&&step<80;step++){
      state=JSON.parse(JSON.stringify(state));const before=structuredClone(state);upgradeDealing(state);assert.deepEqual(state,before);
      assert.ok(clearableGroups(state).length,`${state.puzzle.id}: no clearable group`);
      const removable=state.bubbles.find(b=>b.shell||b.kind==='bonus');
      if(removable){assert.ok(tapSpecial(state,removable.id).ok);continue;}
      let pair;
      for(const group of state.puzzle.groups){
        const members=state.bubbles.filter(b=>b.groupId===group.id&&!isBlocked(b));
        const fragment=members.find(b=>b.atoms.some(a=>a.part!==undefined));
        const mate=fragment&&members.find(b=>b!==fragment&&b.atoms[0].id===fragment.atoms[0].id);
        if(mate){pair=[fragment,mate];break;}
        const whole=members.filter(b=>b.atoms.every(a=>a.part===undefined));
        if(whole.length>=2){pair=whole.slice(0,2);break;}
      }
      assert.ok(pair,state.puzzle.id);assert.ok(merge(state,pair[0].id,pair[1].id).ok);assert.ok(validateState(state));
    }
    assert.equal(state.status,'won');check(state.puzzle);
  }
});

test('dense standalone packs keep normal deck sizes without sacrificing unique meanings',()=>{
  for(const language of ['en','de'])for(const packIds of [['music'],['sports']])for(let round=1;round<=300;round++){
    const puzzle=createPuzzle({language,packIds,mode:'endless',round,difficulty:language==='en'?'gentle':'tricky'});
    check(puzzle);
  }
});
