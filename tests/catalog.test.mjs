import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assembleThemeChain} from '../src/nesting.js';
import {ALL_PACK_IDS,PACKS,getCatalog,normalizePackIds,normalizeLanguage} from '../src/catalog.js';

test('pack selection is stable, explicit, and never empty',()=>{
  assert.deepEqual(normalizePackIds(),ALL_PACK_IDS);
  assert.deepEqual(normalizePackIds([]),['base']);
  assert.deepEqual(normalizePackIds(['movies','invalid','movies','science']),['science','movies']);
  assert.equal(normalizeLanguage('de'),'de');assert.equal(normalizeLanguage('unknown'),'en');
  assert.equal(new Set(PACKS.map(p=>p.id)).size,16);
});

test('every language and standalone genre supplies a complete immutable dictionary',()=>{
  for(const language of ['en','de'])for(const packId of ALL_PACK_IDS){
    const catalog=getCatalog({language,packIds:[packId]});
    assert.ok(catalog.themes.length>=25,`${language}/${packId}`);
    assert.equal(catalog.language,language);assert.deepEqual(catalog.packIds,[packId]);
    assert.equal(new Set(catalog.themes.map(t=>t.id)).size,catalog.themes.length);
    assert.equal(new Set(catalog.themes.map(t=>t.name.toLocaleLowerCase(language))).size,catalog.themes.length);
    assert.ok(Object.keys(catalog.pictures).length>=4,`${language}/${packId} needs picture clues`);
    const words=new Set(catalog.themes.flatMap(t=>t.words));
    for(const theme of catalog.themes){
      assert.equal(theme.packId,packId);assert.ok([1,2,3].includes(theme.difficulty));
      assert.ok(theme.words.length>=4);assert.ok(Object.isFrozen(theme.words));
      assert.equal(new Set(theme.words.map(w=>w.toLocaleLowerCase(language))).size,theme.words.length,theme.name);
      for(const word of theme.words)assert.ok(typeof word==='string'&&word.trim()===word&&word.length>0);
    }
    for(const word of Object.keys(catalog.pictures))assert.ok(words.has(word),word);
    assert.ok(Object.isFrozen(catalog));
  }
});

test('each language has globally unique names and IDs',()=>{
  for(const language of ['en','de']){
    const themes=getCatalog({language}).themes;
    assert.equal(new Set(themes.map(t=>t.id)).size,themes.length);
    assert.equal(new Set(themes.map(t=>t.name.toLocaleLowerCase(language))).size,themes.length);
  }
});

test('the original English packs preserve all 995 stable IDs and all emoji mappings',()=>{
  const catalog=getCatalog({packIds:ALL_PACK_IDS.filter(id=>!['history','books','mythology','comics'].includes(id))});
  assert.equal(catalog.themes.length,995);
  for(let i=1;i<=995;i++)assert.ok(catalog.themes.some(t=>t.id===`theme-${String(i).padStart(3,'0')}`));
  assert.equal(Object.keys(catalog.pictures).length,706);
  assert.equal(catalog.stats.entries,10093);
  const names=new Set(catalog.themes.map(t=>t.name));
  assert.ok(catalog.themes.reduce((count,t)=>count+t.words.filter(w=>names.has(w)).length,0)>=1367);
  assert.ok(catalog.themes.find(t=>t.name==='The Beatles').words.includes('Hello, Goodbye'));
});

test('JSON stores punctuation as complete clues without delimiter parsing',()=>{
  const json=JSON.stringify({words:['Hello, Goodbye','Rock | paper','What?','"Quoted"','L’amour','Line\nbreak']});
  assert.deepEqual(JSON.parse(json).words,['Hello, Goodbye','Rock | paper','What?','"Quoted"','L’amour','Line\nbreak']);
  const pack=JSON.parse(readFileSync(new URL('../src/packs/en/music.json',import.meta.url),'utf8'));
  assert.ok(pack.themes.find(t=>t.name==='The Beatles').words.includes('Hello, Goodbye'));
});

test('shortened names retain exact nested memberships',()=>{
  const themes=getCatalog().themes;
  for(const child of ['Matter','Capacity','Glow','House compounds'])assert.ok(themes.some(t=>t.name===child),child);
  assert.ok(themes.find(t=>t.name==='Instrumentation').words.includes('Strings'));
  assert.ok(themes.every(t=>!/^Things that can be |^Words (before|after) /.test(t.name)));
});

test('every standalone genre supports a returning category demo',()=>{
  for(const language of ['en','de'])for(const packId of ALL_PACK_IDS){
    const themes=getCatalog({language,packIds:[packId]}).themes;
    const chain=assembleThemeChain(themes,{rng:()=>.5,maxDepth:2,minDepth:2});
    assert.ok(chain.length>=2,`${language}/${packId} needs a category chain`);
    // The only two-return video-game route is Kirby → Super Smash Bros. →
    // Nintendo, whose last two themes both accept Kirby. Use one valid return.
    if(language==='en'&&packId!=='video-games')assert.ok(chain.length>=3,`${packId} preserves its two-return demo`);
    for(const owner of chain)for(const word of owner.words){
      const matches=chain.filter(chosen=>themes.find(t=>t.id===chosen.id).words.some(w=>w.toLowerCase()===word.toLowerCase()));
      assert.deepEqual(matches.map(t=>t.id),[owner.id]);
    }
  }
});


test('four new localized packs expand the catalog without changing saved selections',()=>{
  const names={history:['History','Geschichte'],books:['Books','Bücher'],mythology:['Myth & folklore','Mythen & Sagen'],comics:['Comics & manga','Comics & Manga']};
  const original=ALL_PACK_IDS.filter(id=>!Object.hasOwn(names,id));
  assert.equal(original.length,12);assert.deepEqual(normalizePackIds(original),original);
  for(const [id,[en,de]] of Object.entries(names)){
    const pack=PACKS.find(pack=>pack.id===id);assert.deepEqual(pack.name,{en,de});
    for(const language of ['en','de']){
      const catalog=getCatalog({language,packIds:[id]});
      assert.ok(catalog.themes.length>=35,`${language}/${id} needs a varied standalone pool`);
      assert.ok(catalog.themes.every(t=>t.id.startsWith(`${language}-${id}-`)),`${language}/${id}: stable namespaced IDs`);
      assert.ok(catalog.themes.every(t=>!t.words.includes(t.name)),`${language}/${id}: avoid giving away the category itself`);
    }
  }
});
