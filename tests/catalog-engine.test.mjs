import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,PACKS} from '../src/catalog.js';
import {createPuzzle,makeState,magnet,clearableGroups,validateState,bubbleText} from '../src/engine.js';
const all=s=>[...s.bubbles,...s.reserve.flat()];
function solve(s){
  for(let step=0;s.status==='playing'&&step<40;step++){
    assert.ok(clearableGroups(s).length,`No clearable group: ${s.puzzle.id}`);
    assert.ok(magnet(s).ok);assert.ok(validateState(s));
  }
  assert.equal(s.status,'won',s.puzzle.id);
}
test('each language and standalone pack produces self-contained, solvable decks',()=>{
  for(const language of ['en','de'])for(const {id} of PACKS)for(const difficulty of ['gentle','tricky']){
    const options={language,packIds:[id],difficulty,mode:'endless',round:23},catalog=getCatalog(options);
    for(const special of ['split','linked','picture']){
      const puzzle=createPuzzle({...options,special}),state=makeState(puzzle);
      assert.ok(puzzle.groups.length>=10,`${language}/${id}/${difficulty} is too small`);
      for(const group of puzzle.groups){const theme=catalog.themes.find(t=>t.name===group.name);assert.ok(theme);assert.ok(group.words.every(w=>theme.words.includes(w)));}
      assert.ok(all(state).length<=70);assert.ok(validateState(state));
      if(special==='split')assert.equal(state.bubbles.filter(b=>b.kind==='split').length,state.puzzle.splitCount*2);
      for(const b of all(state).filter(b=>b.kind==='picture'))assert.equal(bubbleText(b),catalog.pictures[b.atoms[0].word]);
      for(const fake of all(state).filter(b=>b.decoy))assert.ok(catalog.themes.some(t=>t.words.includes(fake.atoms[0].word)));
      solve(state);
    }
  }
});
test('daily identity is stable for a reordered selection and scoped to language and packs',()=>{
  const options={mode:'daily',date:'2026-10-10',packIds:['base','nature'],language:'en'};
  const a=createPuzzle(options),b=createPuzzle({...options,packIds:['nature','base'],difficulty:'tricky'});
  assert.deepEqual(a,b);assert.notEqual(a.id,createPuzzle({...options,language:'de'}).id);assert.notEqual(a.id,createPuzzle({...options,packIds:['nature']}).id);
});
