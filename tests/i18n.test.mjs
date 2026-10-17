import test from 'node:test';
import assert from 'node:assert/strict';
import {translate,GERMAN} from '../src/i18n.js';
import {SPECIALS} from '../src/data.js';

test('German interface covers every special name, description and tip',()=>{
  for(const special of SPECIALS)for(const property of ['name','description','tip']){
    assert.ok(GERMAN[special[property]],`${special.id}.${property} has no translation`);
    assert.notEqual(translate(special[property],'de'),special[property]);
  }
});
test('UI templates interpolate values without translating clues',()=>{
  assert.equal(translate('Find 14 groups of four','de'),'Finde 14 Vierergruppen');
  assert.equal(translate('3 of 10 connections found','de'),'3 von 10 Gruppen gefunden');
  assert.equal(translate('Look for Schmetterlinge.','de'),'Gesuchte Kategorie: Schmetterlinge.');
  assert.equal(translate('Picture: Gift','de'),'Bild: Gift');
  assert.equal(translate('A little connection','de'),'Eine kleine Verbindung');
  assert.equal(translate('Find 14 groups of four','en'),'Find 14 groups of four');
});
test('message placeholders remain aligned between languages',()=>{
  for(const [source,translated] of Object.entries(GERMAN))assert.deepEqual([...source.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),[...translated.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),source);
});


test('new pack domains and the frequent Theme explanation are localized',()=>{
  for(const [source,target] of Object.entries({history:'Geschichte',books:'Bücher',mythology:'Mythen & Sagen',comics:'Comics & Manga'}))assert.equal(translate(source,'de'),target);
  const help='A few new words fall in after a group clears. On most later boards, a solved category returns as a word. Its new connection may use another meaning.';
  assert.ok(GERMAN[help]);assert.notEqual(translate(help,'de'),help);
});
