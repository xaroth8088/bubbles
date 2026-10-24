import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_PACK_IDS,getCatalog} from '../src/catalog.js';
import {INTRO_LEVELS,SPECIALS} from '../src/data.js';
import {createPuzzle,makeState,bubbleText,validateState,upgradeDealing,clearableGroups,merge,PICTURE_MAJORITY_INTERVAL} from '../src/engine.js';

const all=state=>[...state.bubbles,...state.reserve.flat()];
const isPicture=b=>b.kind==='picture';
function checkMajority(state){
  assert.equal(state.puzzle.pictureMajority,true,state.puzzle.id);
  assert.ok(state.bubbles.filter(isPicture).length>state.bubbles.length/2,`Opening majority: ${state.puzzle.id}`);
  assert.ok(all(state).filter(isPicture).length>all(state).length/2,`Whole-deck majority: ${state.puzzle.id}`);
  const glyphs=all(state).filter(isPicture).map(b=>b.picture);
  assert.equal(new Set(glyphs).size,glyphs.length,'One image cannot disguise two different clues');
  const catalog=getCatalog(state.puzzle),names=new Set(catalog.themes.map(t=>t.name));
  assert.ok(state.puzzle.groups.every(g=>names.has(g.name)),'Only selected packs may supply a theme');
  for(const b of all(state).filter(isPicture)){
    assert.equal(b.atoms.length,1);assert.equal(b.atoms[0].part,undefined);
    assert.equal(b.picture,catalog.pictures[b.atoms[0].word]);assert.equal(bubbleText(b),b.picture);
  }
  assert.ok(validateState(state));assert.ok(clearableGroups(state).length);
}

test('one in eight ordinary boards is picture-led when the selected vocabulary supports it',()=>{
  assert.equal(PICTURE_MAJORITY_INTERVAL,8);
  for(const language of ['en','de'])for(const difficulty of ['gentle','balanced','tricky'])for(const mode of ['journey','endless','daily']){
    let count=0;
    for(let n=1;n<=40;n++){
      const date=new Date(Date.UTC(2026,9,n)).toISOString().slice(0,10);
      const options={language,difficulty,mode,level:INTRO_LEVELS+n,round:n,date};
      const puzzle=createPuzzle(options);
      if(!puzzle.pictureMajority)continue;
      count++;checkMajority(makeState(puzzle));
      assert.deepEqual(puzzle,createPuzzle(options));
      for(let restart=0;restart<4;restart++)checkMajority(makeState(puzzle,{shuffleSeed:`majority-${restart}`}));
    }
    assert.equal(count,5,`${language}/${difficulty}/${mode}`);
  }
});

test('all standalone packs and languages preserve real majorities or gracefully keep ordinary decks',()=>{
  let majority=0,fallback=0;
  for(const language of ['en','de'])for(const packIds of ALL_PACK_IDS.map(id=>[id]))for(const difficulty of ['gentle','balanced','tricky'])for(const round of [1,9,17,25]){
    const puzzle=createPuzzle({language,packIds,difficulty,mode:'endless',round});
    const state=makeState(puzzle,{shuffleSeed:`scope-${round}`});
    assert.ok(validateState(state));assert.deepEqual(puzzle.packIds,packIds);
    assert.ok(all(state).length<=70);assert.ok(puzzle.groups.length>=10);
    if(puzzle.pictureMajority){majority++;checkMajority(state);}
    else{fallback++;assert.ok(all(state).filter(isPicture).length<=1);}
  }
  assert.ok(majority>50);assert.ok(fallback>50);
  for(const language of ['en','de']){
    const state=makeState(createPuzzle({language,packIds:['history'],level:15}));
    assert.ok(!state.puzzle.pictureMajority,'Low-coverage packs must not borrow other genres or invent pictures');
  }
});

test('tutorials, explicit special requests and picture practice retain their focused mechanics',()=>{
  for(const language of ['en','de']){
    for(let level=1;level<=INTRO_LEVELS;level++)assert.ok(!createPuzzle({language,level}).pictureMajority);
    for(const {id:special} of SPECIALS)for(const mode of ['journey','endless','daily','lab']){
      const puzzle=createPuzzle({language,special,mode,level:15,round:1});
      assert.ok(!puzzle.pictureMajority);assert.deepEqual(puzzle.specials,[special]);
      if(special==='picture')assert.equal(all(makeState(puzzle)).filter(isPicture).length,1);
    }
  }
});

test('majority decks preserve exact saved pictures, reveal merged words, and can be completed',()=>{
  for(const language of ['en','de'])for(const difficulty of ['gentle','balanced','tricky']){
    let state=makeState(createPuzzle({language,difficulty,level:15}),{shuffleSeed:'save-majority'});
    checkMajority(state);
    for(let step=0;state.status==='playing'&&step<100;step++){
      const saved=JSON.parse(JSON.stringify(state));upgradeDealing(saved);assert.deepEqual(saved,state);state=saved;
      const group=clearableGroups(state)[0];assert.ok(group);
      const pair=state.bubbles.filter(b=>b.groupId===group.id).slice(0,2);
      const words=pair.flatMap(b=>b.atoms.map(a=>a.word));
      assert.ok(merge(state,pair[0].id,pair[1].id).ok);assert.ok(validateState(state));
      const joined=state.bubbles.find(b=>b.id===pair[1].id);
      if(joined){assert.notEqual(joined.kind,'picture');for(const word of words)assert.ok(bubbleText(joined).includes(word));}
    }
    assert.equal(state.status,'won');
  }
  const overridden=createPuzzle({level:15});overridden.specials=['nested'];
  const focused=makeState(overridden);assert.equal(focused.puzzle.pictureMajority,false);assert.equal(all(focused).filter(isPicture).length,0);
  const legacy=makeState(createPuzzle({mode:'lab',special:'picture'}));
  delete legacy.puzzle.pictureMajority;
  const saved=structuredClone(legacy);upgradeDealing(saved);assert.deepEqual(saved,legacy);
  assert.ok(validateState(saved));saved.puzzle.pictureMajority='yes';assert.equal(validateState(saved),false);
});
