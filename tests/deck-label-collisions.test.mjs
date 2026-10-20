import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,ALL_PACK_IDS} from '../src/catalog.js';
import {SPECIALS} from '../src/data.js';
import {assembleThemeChain,normalizeLabel as fold} from '../src/nesting.js';
import {createPuzzle,selectDeckThemes,makeState,upgradeDealing,validateState,random} from '../src/engine.js';

const theme=(name,words)=>({id:name,name,words,difficulty:1,domain:name});
const draw=themes=>selectDeckThemes({themes,planned:[],count:themes.length,maxDifficulty:3,specials:[],pictures:{},rng:()=>.999999});
function check(puzzle){
  const names=puzzle.groups.map(g=>fold(g.name));
  assert.equal(new Set(names).size,names.length,`${puzzle.id}: duplicate theme labels`);
  for(const owner of puzzle.groups)for(const word of owner.words){
    for(const label of puzzle.groups.filter(g=>fold(g.name)===fold(word))){
      assert.equal(label.parentId,owner.id,`${puzzle.id}: ${word} coincides with ${label.name} without returning to ${owner.name}`);
      assert.equal(owner.childId,label.id,`${puzzle.id}: a coinciding clue must be the immediate child label`);
      assert.equal(word,label.name,'The returned word retains the exact displayed label');
    }
  }
}

test('Earth cannot be both an ordinary clue and an unrelated theme, in either selection order',()=>{
  const earth=theme('Earth',['Mantle','Crust','Core','Continents']);
  const planets=theme('Planets',['Earth','Mars','Venus','Saturn','Neptune']);
  const clueFirst=draw([planets,earth]);
  assert.equal(clueFirst.length,1);assert.ok(clueFirst[0].words.includes('Earth'));
  const labelFirst=draw([earth,planets]);
  assert.equal(labelFirst.length,2);assert.ok(!labelFirst[1].words.includes('Earth'));
  for(const groups of [clueFirst,labelFirst])check({id:'Earth regression',groups});
  check(createPuzzle({mode:'journey',level:87}));
});

test('labels are normalized, reserved against their own clues, and unique across ordinary themes',()=>{
  const own=draw([theme('  Café  Moon ',['Cafe\u0301   moon','A','B','C','D'])]);
  assert.deepEqual(own[0].words,['A','B','C','D']);
  const first=theme('Café Moon',['A','B','C','D']);
  const duplicate=theme(' cafe\u0301   MOON ',['E','F','G','H']);
  assert.equal(draw([first,duplicate]).length,1);
  const other=theme('Other',['  CAFE\u0301 MOON  ','E','F','G','H']);
  assert.equal(draw([other,first]).length,1);
  assert.equal(draw([first,other]).length,2);
  check({id:'normalized labels',groups:draw([first,other])});
});

test('the explicit Earth return remains legal and all chain labels stay reserved',()=>{
  const themes=[theme('Earth',['Mantle','Crust','Core','Continents']),theme('Planets',['Earth','Mars','Venus','Saturn']),theme('Space',['Planets','Orbit','Vacuum','Rocket'])];
  const planned=assembleThemeChain(themes,{rng:random(87),maxDepth:2,minDepth:2});
  assert.deepEqual(planned.map(t=>t.name),['Earth','Planets','Space']);
  const extras=[theme('Unrelated',['Space','A','B','C','D']),theme('Ambiguous',[' earth ','Planets','I','J','K','L']),theme('Mars',['E','F','G','H'])];
  const selected=selectDeckThemes({themes:[...themes,...extras],planned,count:3,maxDifficulty:3,specials:[],pictures:{},rng:()=>.999999});
  assert.deepEqual(selected.map(t=>t.name),['Earth','Unrelated']);
  assert.deepEqual(selected[1].words,['A','B','C','D']);
});

test('all packs, languages, modes and mechanics keep label coincidences limited to actual theme returns',()=>{
  let returns=0,renamed=0;
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS]){
    const catalog=getCatalog({language,packIds});
    const options=[];
    for(const difficulty of ['gentle','balanced','tricky'])for(let round=1;round<=12;round++)options.push({mode:'endless',round,difficulty});
    for(const level of [1,5,14,36,87,120])options.push({mode:'journey',level});
    for(let day=1;day<=5;day++)options.push({mode:'daily',date:`2026-10-0${day}`});
    for(const {id:special} of SPECIALS)options.push({mode:'lab',special});
    for(const option of options){
      const puzzle=createPuzzle({language,packIds,...option});check(puzzle);
      returns+=puzzle.groups.filter(g=>g.parentId).length;
      renamed+=puzzle.groups.filter(g=>catalog.themes.find(t=>t.name===g.name)?.legacyNames?.length).length;
      assert.ok(puzzle.groups.length>=(puzzle.mode==='lab'?4:10),`Undersized deck: ${puzzle.id}`);
    }
  }
  assert.ok(returns>0,'Do not fix coincidences by disabling theme returns');
  assert.ok(renamed>0,'Exercise current renamed labels too');
});

test('saved boards with an old Earth coincidence retain their exact groups and clues',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'picture'});
  puzzle.specials=[];puzzle.title='Word bubbles';
  puzzle.groups=[{id:'g0',name:'Earth',words:['Mantle','Crust','Core','Continents']},{id:'g1',name:'Planets',words:['Earth','Mars','Venus','Saturn']}];
  const state=JSON.parse(JSON.stringify(makeState(puzzle))),before=structuredClone(state);
  assert.ok(validateState(state));upgradeDealing(state);
  assert.deepEqual(state,before);assert.ok(validateState(state));
});
