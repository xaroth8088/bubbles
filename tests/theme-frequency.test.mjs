import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_PACK_IDS,getCatalog} from '../src/catalog.js';
import {SPECIALS,INTRO_LEVELS} from '../src/data.js';
import {createPuzzle,makeState,upgradeDealing,validateState} from '../src/engine.js';

const hasReturn=puzzle=>puzzle.groups.some(group=>group.parentId);
function checkReturns(puzzle,maxDepth){
  const themes=getCatalog(puzzle).themes;
  assert.equal(hasReturn(puzzle),puzzle.specials.includes('nested'),puzzle.id);
  for(const child of puzzle.groups.filter(group=>group.parentId)){
    const parent=puzzle.groups.find(group=>group.id===child.parentId);
    assert.ok(parent&&parent.childId===child.id,puzzle.id);
    assert.ok(parent.words.includes(child.name),puzzle.id);
    assert.ok(themes.find(theme=>theme.name===parent.name).words.includes(child.name),puzzle.id);
  }
  for(const root of puzzle.groups.filter(group=>!group.childId)){
    let group=root,depth=0;
    while(group.parentId){group=puzzle.groups.find(parent=>parent.id===group.parentId);assert.ok(++depth<=maxDepth,puzzle.id);}
  }
  assert.deepEqual(puzzle.packIds,[...getCatalog(puzzle).packIds].sort());
}

test('actual Theme returns appear on 80% of normal boards in every language, standalone pack, and difficulty',()=>{
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS]){
    for(const difficulty of ['gentle','balanced','tricky'])for(const mode of ['journey','endless']){
      let returns=0;
      for(let n=1;n<=10;n++){
        const options={language,packIds,difficulty,mode,level:INTRO_LEVELS+n,round:n};
        const puzzle=createPuzzle(options);checkReturns(puzzle,{gentle:1,balanced:2,tricky:3}[difficulty]);
        assert.deepEqual(puzzle,createPuzzle(options));
        returns+=Number(hasReturn(puzzle));
        assert.ok(puzzle.specials.length<=(difficulty==='tricky'?3:2),'Theme frequency must not add extra ordinary-mode obstacles');
      }
      assert.equal(returns,8,`${language}/${packIds}/${difficulty}/${mode}`);
    }
  }
});

test('daily Theme cadence is deterministic, crosses month boundaries, and reaches 80% for every pack',()=>{
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS]){
    let returns=0;
    for(let n=0;n<10;n++){
      const date=new Date(Date.UTC(2026,9,27+n)).toISOString().slice(0,10);
      const options={language,packIds,mode:'daily',date};
      const puzzle=createPuzzle(options);checkReturns(puzzle,2);returns+=Number(hasReturn(puzzle));
      assert.deepEqual(puzzle,createPuzzle({...options,difficulty:'tricky'}));
      assert.equal(puzzle.specials.filter(id=>id!=='nested').length,1);
    }
    assert.equal(returns,8,`${language}/${packIds}/daily`);
  }
});

test('Theme frequency preserves focused introductions, practice, and explicit mechanic requests',()=>{
  for(const language of ['en','de']){
    for(let level=1;level<=INTRO_LEVELS;level++){
      const puzzle=createPuzzle({language,level});
      const expected=SPECIALS.find(s=>s.level===level)?.id;
      assert.deepEqual(puzzle.specials,expected?[expected]:[]);
      assert.equal(hasReturn(puzzle),expected==='nested');
    }
    for(const {id:special} of SPECIALS)for(const mode of ['lab','endless','daily']){
      const puzzle=createPuzzle({language,mode,special});
      assert.deepEqual(puzzle.specials,[special]);assert.equal(hasReturn(puzzle),special==='nested');
    }
  }
});

test('saved boards retain their existing cadence, old labels, clues, and progress',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'nested'});
  puzzle.groups=[
    {id:'g0',name:'Blood components',domain:'science',words:['Plasma','Platelet','Red cell','White cell'],parentId:'g1'},
    {id:'g1',name:'Anatomy',domain:'science',words:['Blood components','Bone','Muscle','Organ'],childId:'g0'}
  ];
  const state=makeState(puzzle),before=structuredClone(state);
  assert.ok(validateState(state));upgradeDealing(state);
  assert.deepEqual(state,before);assert.ok(validateState(JSON.parse(JSON.stringify(state))));
});
