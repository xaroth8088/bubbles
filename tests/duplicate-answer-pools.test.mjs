import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,groupThemeCandidates,resolveGroupTheme} from '../src/catalog.js';
import {createPuzzle,makeState,upgradeDealing,validateState,decoyPool,merge,isBlocked} from '../src/engine.js';
import {assembleThemeChain,normalizeLabel} from '../src/nesting.js';
const themes=[
  {id:'dental',name:'Teeth',legacyNames:['Dental teeth'],words:['Molar','Enamel','Incisor','Canine','Root']},
  {id:'toothed',name:'Teeth',legacyNames:['With teeth'],words:['Comb','Saw','Gear','Zipper','Rake']},
];

test('same-label pools resolve by stable source ID, exact old clues or unique aliases',()=>{
  for(const theme of themes){
    const group={sourceThemeId:theme.id,name:'Teeth',words:['Old clue','Other old clue','Third old clue','Fourth old clue']};
    assert.equal(resolveGroupTheme(group,themes),theme);
    assert.equal(resolveGroupTheme({name:'Teeth',words:theme.words.slice(0,4)},themes),theme);
    assert.equal(resolveGroupTheme({name:theme.legacyNames[0],words:group.words},themes),theme);
  }
  const old={name:'Teeth',words:['Comb','Saw','Replaced clue','Another replaced clue']};
  assert.equal(resolveGroupTheme(old,themes),undefined);
  assert.deepEqual(groupThemeCandidates(old,themes),themes,'Do not guess from partial overlap after dictionary edits');
});

test('returning chains cannot repeat one answer across separate source pools',()=>{
  const options=[...themes.map(t=>({...t,difficulty:1,domain:t.id})),{id:'parent',name:'Tools',words:['Teeth','Hammer','Drill','Plane','File'],difficulty:1,domain:'tools'}];
  for(let i=0;i<30;i++){
    const chain=assembleThemeChain(options,{rng:()=>i/30,maxDepth:4});
    assert.ok(chain.length>=2);
    assert.equal(new Set(chain.map(t=>normalizeLabel(t.name))).size,chain.length);
    for(const theme of chain)assert.ok(theme.words.every(w=>options.find(t=>t.id===theme.id).words.includes(w)));
  }
});

test('decoys exclude only the selected Teeth pool, or both pools for ambiguous legacy clues',()=>{
  const catalog=getCatalog(),source=catalog.themes.find(t=>t.id==='theme-266'),sibling=catalog.themes.find(t=>t.id==='theme-404');
  assert.equal(source.name,'Teeth');assert.equal(sibling.name,'Teeth');
  const group={id:'g0',sourceThemeId:source.id,name:'Teeth',words:source.words.slice(0,4)};
  const pool=decoyPool({groups:[group]});
  for(const word of source.words)assert.ok(!pool.includes(word),word);
  const independent=sibling.words.filter(w=>!source.words.some(v=>normalizeLabel(v)===normalizeLabel(w))&&normalizeLabel(w)!=='teeth');
  assert.ok(independent.length);
  for(const word of independent)assert.ok(pool.includes(word),`Do not merge dental clue ${word} into the tooth-tool pool`);
  const legacy={...group,sourceThemeId:undefined,words:[source.words[0],sibling.words[0],'Retired clue','Another retired clue']};
  assert.equal(resolveGroupTheme(legacy,catalog.themes),undefined);
  const conservative=decoyPool({groups:[legacy]});
  for(const word of [...source.words,...sibling.words,...legacy.words])assert.ok(!conservative.includes(word),word);
});

test('new saves retain IDs; legacy saves preserve clues and partial progress without requiring an ID',()=>{
  for(const legacy of [false,true]){
    const state=makeState(createPuzzle({mode:'lab',special:'linked'}));
    for(const group of state.puzzle.groups){
      assert.equal(resolveGroupTheme(group,getCatalog(state.puzzle).themes)?.id,group.sourceThemeId);
      if(legacy)delete group.sourceThemeId;
    }
    const group=state.puzzle.groups.find(g=>state.bubbles.filter(b=>b.groupId===g.id&&!isBlocked(b)).length>=2);
    const pair=state.bubbles.filter(b=>b.groupId===group.id&&!isBlocked(b)).slice(0,2);
    assert.ok(merge(state,pair[0].id,pair[1].id).ok);
    const restored=JSON.parse(JSON.stringify(state)),before=structuredClone(restored);
    upgradeDealing(restored);
    assert.deepEqual(restored,before);
    assert.ok(validateState(restored));
  }
});

test('saved source IDs reject unknown and wrong-label identities but preserve historical clues',()=>{
  const state=makeState(createPuzzle({mode:'lab',special:'picture'}));
  const changed=structuredClone(state);changed.puzzle.groups[0].sourceThemeId='missing-source';
  assert.equal(validateState(changed),false);
  assert.deepEqual(groupThemeCandidates(changed.puzzle.groups[0],getCatalog().themes),[],'Unknown IDs must not silently resolve by name');
  changed.puzzle.groups[0].sourceThemeId=state.puzzle.groups[1].sourceThemeId;
  assert.equal(validateState(changed),false);
  const catalog=getCatalog(),duplicates=catalog.themes.filter(t=>t.name==='Teeth');
  assert.equal(duplicates.length,2);
  const puzzle=createPuzzle({mode:'lab',special:'picture'});
  puzzle.specials=[];puzzle.groups=[{id:'g0',sourceThemeId:duplicates[0].id,name:'Teeth',words:duplicates[0].words.slice(0,4)}];
  const duplicateState=makeState(puzzle);assert.ok(validateState(duplicateState));
  // Simulate a later vocabulary revision moving these old words to another
  // same-named pool. Stored IDs, words and progress must remain authoritative.
  duplicateState.puzzle.groups[0].sourceThemeId=duplicates[1].id;
  assert.ok(validateState(duplicateState));
  assert.equal(resolveGroupTheme(duplicateState.puzzle.groups[0],catalog.themes).id,duplicates[1].id);
});
