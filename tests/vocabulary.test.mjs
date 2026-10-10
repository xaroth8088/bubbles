import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,PICTURES} from '../src/data.js';
const theme=name=>{const item=THEMES.find(t=>t.name===name);assert.ok(item,name);return item;};
test('type clues omit giveaway family words while preserving useful ambiguity',()=>{
  for(const word of ['Electric','Mountain','Road','Folding'])assert.ok(theme('Bicycles').words.includes(word));
  assert.ok(theme('Bicycles').words.every(w=>!/(?:bike|bicycle)/i.test(w)));
  assert.ok(theme('Whales').words.includes('Blue'));
  assert.ok(theme('Whales').words.every(w=>!w.toLowerCase().includes('whale')));
  assert.ok(theme('Soup').words.includes('Tomato'));
  assert.ok(!theme('Soup').words.includes('Tomato soup'));
});
test('short instrument names still form exact nested theme connections',()=>{
  const families=theme('Instrument families');
  for(const name of ['Strings','Woodwinds','Brass','Percussion']){
    assert.ok(families.words.includes(name));assert.ok(theme(name).words.length>=4);
  }
  assert.ok(theme('Strings').words.includes('Bass'));
  assert.ok(theme('Musical topics').words.includes('Instrument families'));
});
test('picture keys use one emoji grapheme and exact playable clue spellings',()=>{
  const words=new Set(THEMES.flatMap(t=>t.words));
  const segmenter=new Intl.Segmenter('en',{granularity:'grapheme'});
  for(const [word,emoji] of Object.entries(PICTURES)){
    assert.equal(word,word.trim());assert.ok(words.has(word),word);
    assert.equal([...segmenter.segment(emoji)].length,1,word);
  }
  assert.ok(Object.keys(PICTURES).length>=700);
});
test('catalogue rows have canonical unique identifiers and clean clue text',()=>{
  assert.equal(new Set(THEMES.map(t=>t.id)).size,THEMES.length);
  assert.equal(new Set(THEMES.map(t=>t.name.toLowerCase())).size,THEMES.length);
  for(const t of THEMES){
    assert.ok([1,2,3].includes(t.difficulty));
    for(const word of t.words)assert.ok(word&&word===word.trim()&&!/[|,\n]/.test(word),`${t.name}: ${word}`);
  }
});
