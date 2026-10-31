import test from 'node:test';
import assert from 'node:assert/strict';
import changes from './fixtures/semantic-label-renames.json' with {type:'json'};
import {getCatalog} from '../src/catalog.js';
import {createPuzzle,makeState,upgradeDealing,validateState} from '../src/engine.js';

// A curated list, not a whitespace ban: compounds and proper titles often need
// every word. The audit includes both ordinary clues and returning labels.
test('semantic label revisions preserve IDs, aliases and exact parent references',()=>{
  for(const {language,id,old,name} of changes){
    const catalog=getCatalog({language}),theme=catalog.themes.find(t=>t.id===id);
    assert.equal(theme?.name,name,`${language}: ${id}`);
    assert.ok(theme.legacyNames.includes(old),old);
    assert.ok(!catalog.themes.some(t=>t.words.includes(old)),`stale returning clue: ${old}`);
    assert.ok(!Object.hasOwn(catalog.pictures,old),`stale picture: ${old}`);
    assert.ok(!theme.words.includes(name),`self-answer: ${name}`);
  }
});

test('music categories connect by meaning, not a repeated Music prefix',()=>{
  const catalog=getCatalog(),theme=catalog.themes.find(t=>t.id==='theme-308');
  for(const name of ['Styles','Instrumentation','Composition','Jamming','Notation']){
    assert.ok(theme.words.includes(name));
    assert.ok(catalog.themes.some(t=>t.name===name));
  }
  assert.ok(theme.words.every(w=>!/^music/i.test(w)));
  for(const old of ['Music genres','Music session','Musical qualities'])assert.ok(!catalog.themes.some(t=>t.words.includes(old)));
});

test('natural multiword titles and precise compounds remain playable',()=>{
  const en=getCatalog(),de=getCatalog({language:'de'});
  for(const word of ['Let It Be','Pride and Prejudice','The Last of Us','Golden Fleece','Petri dish','Test tube'])assert.ok(en.themes.some(t=>t.words.includes(word)||t.name===word),word);
  for(const word of ['Stolz und Vorurteil','Rotes Meer','Stein der Weisen'])assert.ok(de.themes.some(t=>t.words.includes(word)||t.name===word),word);
});

test('German compound clues require finding the missing shared word',()=>{
  const themes=getCatalog({language:'de',packIds:['language']}).themes;
  for(const stem of ['Hand','Wasser','Spiel','Buch','Schnee']){
    const theme=themes.find(t=>t.name===`${stem} ergänzen`);assert.ok(theme,stem);
    assert.ok(theme.words.every(w=>!w.startsWith(stem)),`${stem}: prefix giveaway`);
  }
});

test('saved clues and category names are not rewritten by vocabulary updates',()=>{
  for(const language of ['en','de']){
    const puzzle=createPuzzle({language,mode:'lab',special:'nested'});
    // A returning name is also a parent clue. Construct a consistent legacy
    // ledger before making the state, rather than renaming only its heading.
    for(const group of puzzle.groups){
      const changed=changes.find(c=>c.language===language&&c.name===group.name);
      if(!changed)continue;
      group.name=changed.old;
      for(const parent of puzzle.groups)parent.words=parent.words.map(word=>word===changed.name?changed.old:word);
    }
    const state=makeState(puzzle);assert.ok(validateState(state),'legacy fixture starts valid');
    const before=structuredClone(state);
    upgradeDealing(state);
    assert.deepEqual(state.puzzle.groups,before.puzzle.groups);
    const ledger=s=>[...s.bubbles,...s.reserve.flat()].filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>[a.id,a.word]));
    assert.deepEqual(ledger(state),ledger(before));assert.ok(validateState(state));
  }
});
