import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,ALL_PACK_IDS} from '../src/catalog.js';
import {assembleThemeChain} from '../src/nesting.js';
import {createPuzzle,makeState,merge,upgradeDealing,validateState} from '../src/engine.js';
import renames from './fixtures/answer-label-renames.json' with {type:'json'};
import revisions from './fixtures/answer-clue-revisions.json' with {type:'json'};
import exceptions from './fixtures/answer-clue-exceptions.json' with {type:'json'};

const fold=value=>value.normalize('NFKD').toLocaleLowerCase().replaceAll('ß','ss').replace(/[^\p{L}\p{N}]/gu,'');
// Audit known inflections, not arbitrary stems: Riding/Bridle and
// Whales/Narwhal must not be rejected by indiscriminate substring stemming.
const inflections={
  en:{Teeth:['Tooth'],Painting:['Paint'],Knitting:['Knit'],Quilting:['Quilt'],Camping:['Camp'],Jamming:['Jam'],Flying:['Fly'],Bedding:['Bed'],Lighting:['Light'],Banking:['Bank'],Clothing:['Clothes'],Dishwashing:['Dishwash'],Sailing:['Sail'],Fishing:['Fish'],Swimming:['Swim'],Surfing:['Surf'],Skiing:['Ski'],Rowing:['Row'],Skating:['Skate']},
  de:{Töpfern:['Töpfer'],Messen:['Mess'],Magnete:['Magnet'],Verstecken:['Versteck'],Fangen:['Fang'],Woche:['Woch'],Lesen:['Lese'],Ende:['End'],Blumen:['Blume'],Fische:['Fisch'],Pilze:['Pilz'],Backen:['Back'],Kartoffeln:['Kartoffel'],Soßen:['Soße'],Wäsche:['Wasch'],Schuhe:['Schuh'],Ostern:['Oster'],Segeln:['Segel'],Beeren:['Beere'],Nüsse:['Nuss'],Meere:['Meer']}
};
function answerForms(name,language){
  const plain=name.replace(/ compounds$| ergänzen$/u,''),forms=[fold(plain),...(inflections[language][plain]||[]).map(fold)];
  if(language==='en'){
    const singular=plain.endsWith('ies')?plain.slice(0,-3)+'y':/(?:ches|shes|xes|sses)$/.test(plain)?plain.slice(0,-2):/s$/.test(plain)&&!/(?:ss|us)$/.test(plain)?plain.slice(0,-1):plain;
    forms.push(fold(singular));
  }
  return [...new Set(forms)];
}
const reveals=(name,word,language)=>answerForms(name,language).some(answer=>fold(word).includes(answer));
function checkClue(theme,word,language){
  if(!reveals(theme.name,word,language))return;
  assert.ok(exceptions.some(e=>e.language===language&&e.id===theme.id&&e.clues.includes(word)),`${language}/${theme.id}: ${theme.name} is revealed by ${word}`);
}

test('the answer audit catches case, spacing, compounds and reviewed inflections',()=>{
  for(const [name,word,language] of [['Sun','sunlight','en'],['Sun','SUN-LIGHT','en'],['Corn','popcorn','en'],['Corn','Pop corn','en'],['Drums','Drumstick','en'],['Swimming','Swimsuit','en'],['Käse','BERGKÄSE','de'],['Schnee','Schnee\u00a0ball','de'],['Fische','Goldfisch','de']])assert.ok(reveals(name,word,language),`${name}/${word}`);
  for(const [name,word,language] of [['Sun','Dawn','en'],['Corn','Kernel','en'],['Hand','Schuh','de'],['Riding','Bridle','en'],['Whales','Narwhal','en']])assert.ok(!reveals(name,word,language),`${name}/${word}`);
});

test('every bilingual clue pool avoids unreviewed answer giveaways',()=>{
  let groups=0;
  for(const language of ['en','de'])for(const theme of getCatalog({language}).themes){
    for(const word of theme.words)checkClue(theme,word,language);
    groups++;
  }
  assert.equal(groups,1717);
  // Exceptions name individual clues and must stay relevant, never whole packs.
  for(const {language,id,clues,reason} of exceptions){
    const theme=getCatalog({language}).themes.find(t=>t.id===id);
    assert.ok(theme&&reason&&clues.length);
    for(const word of clues){assert.ok(theme.words.includes(word),`${id}: stale exception ${word}`);assert.ok(reveals(theme.name,word,language),`${id}: unnecessary exception ${word}`);}
  }
});

test('reviewed giveaway replacements remain present, unique and free of answer leaks',()=>{
  assert.equal(revisions.length,152);
  for(const {language,id,old,replacement} of revisions){
    const theme=getCatalog({language}).themes.find(t=>t.id===id);
    assert.ok(!theme.words.includes(old),`${id}: ${old} returned`);
    assert.ok(theme.words.includes(replacement),`${id}: missing ${replacement}`);
    assert.equal(theme.words.filter(w=>w===replacement).length,1);
    checkClue(theme,replacement,language);
  }
});

test('short answers preserve stable IDs, aliases, distinct categories and returning references',()=>{
  for(const {language,id,old,name} of renames){
    const catalog=getCatalog({language}),theme=catalog.themes.find(t=>t.id===id);
    assert.equal(theme.name,name);assert.ok(theme.legacyNames.includes(old));
    assert.ok(!catalog.themes.some(t=>t.words.includes(old)),`stale returning label ${old}`);
    assert.ok(!Object.hasOwn(catalog.pictures,old));
  }
  const en=getCatalog(),de=getCatalog({language:'de'});
  for(const stem of ['Rain','House','Cake','Book','Sun','Light','Work','Keys','Teeth']){
    const matching=en.themes.filter(t=>t.name===stem);
    assert.equal(matching.length,2,`${stem}: keep both distinct pools under the simple answer`);
    assert.equal(new Set(matching.map(t=>t.id)).size,2);
  }
  for(const stem of ['Wasser','Buch','Schnee']){
    assert.equal(de.themes.filter(t=>t.name===stem).length,2);
  }
  assert.ok(en.themes.every(t=>! / compounds$|^With (keys|teeth)$/u.test(t.name)));
  assert.ok(de.themes.every(t=>! / ergänzen$/u.test(t.name)));
  const recreation=en.themes.find(t=>t.name==='Recreation'),rooms=de.themes.find(t=>t.name==='Räume');
  for(const name of ['Board games','Card games','Video games'])assert.ok(recreation.words.includes(name)&&en.themes.some(t=>t.name===name));
  for(const name of ['Schlafzimmer','Wohnzimmer'])assert.ok(rooms.words.includes(name)&&de.themes.some(t=>t.name===name));
});

test('generated ordinary and returning groups use audited clues in every language and pack',()=>{
  let returns=0;
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS])for(const difficulty of ['gentle','balanced','tricky'])for(const round of [1,2,9,17]){
    const catalog=getCatalog({language,packIds}),puzzle=createPuzzle({language,packIds,difficulty,mode:'endless',round});
    for(const group of puzzle.groups){
      const theme=catalog.themes.find(t=>t.id===group.sourceThemeId);assert.ok(theme);
      for(const word of group.words)checkClue(theme,word,language);
      if(group.parentId)returns++;
    }
    assert.ok(validateState(makeState(puzzle)));
  }
  assert.ok(returns>0,'Do not prevent giveaways by disabling returning groups');
});

test('saved old answers and revealing clues retain exact words, partial merges and progress',()=>{
  for(const language of ['en','de']){
    const catalog=getCatalog({language}),ids=new Set([...revisions,...renames].filter(c=>c.language===language).map(c=>c.id));
    for(const id of ids){
      const theme=catalog.themes.find(t=>t.id===id),rename=renames.find(c=>c.language===language&&c.id===id);
      const oldClues=revisions.filter(c=>c.language===language&&c.id===id).map(c=>c.old);
      const puzzle=createPuzzle({language,mode:'lab',special:'picture'});puzzle.specials=[];puzzle.title='Word bubbles';
      puzzle.groups=[{id:'g0',name:rename?.old||theme.name,words:[...new Set([...oldClues,...theme.words])].slice(0,4)}];
      const original=makeState(puzzle);assert.ok(merge(original,original.bubbles[0].id,original.bubbles[1].id).ok);
      const state=JSON.parse(JSON.stringify(original)),before=structuredClone(state);
      assert.ok(validateState(state));upgradeDealing(state);assert.deepEqual(state,before);assert.ok(validateState(state));
    }
  }
});

test('legacy renamed chains resume solved children and return their original parent labels',()=>{
  for(const [language,names,oldName] of [['en',['Board games','Recreation','Apps'],'Games'],['de',['Schlafzimmer','Räume','Zuhause'],'Zimmer']]){
    const themes=getCatalog({language}).themes.filter(t=>names.includes(t.name));
    const chain=assembleThemeChain(themes,{rng:()=>.5,maxDepth:2,minDepth:2});
    assert.deepEqual(chain.map(t=>t.name),names);
    const puzzle=createPuzzle({language,mode:'lab',special:'nested'});puzzle.specials=['nested'];
    // Older saves have no sourceThemeId. Rename both the displayed middle
    // category and its future returned clue, preserving one consistent ledger.
    puzzle.groups=chain.map((theme,i)=>({id:`g${i}`,name:i===1?oldName:theme.name,domain:theme.domain,
      words:theme.words.map(word=>word===names[1]?oldName:word),
      ...(i<2?{parentId:`g${i+1}`}:{ }),...(i>0?{childId:`g${i-1}`}:{ })}));
    const complete=(state,id)=>{
      for(let joins=0;joins<3;joins++){
        const members=state.bubbles.filter(b=>b.groupId===id);
        if(members.length<2)break;
        assert.ok(merge(state,members[0].id,members[1].id).ok);
      }
      assert.ok(state.solved.some(g=>g.id===id));
    };
    const original=makeState(puzzle);complete(original,'g0');
    const returned=original.bubbles.find(b=>b.id==='g0-theme'),partner=original.bubbles.find(b=>b.groupId==='g1'&&b!==returned);
    assert.ok(returned&&partner);assert.ok(merge(original,returned.id,partner.id).ok);
    const state=JSON.parse(JSON.stringify(original)),before=structuredClone(state);
    assert.ok(validateState(state));upgradeDealing(state);assert.deepEqual(state,before);
    complete(state,'g1');
    assert.equal(state.bubbles.find(b=>b.id==='g1-theme').atoms[0].word,oldName);
    complete(state,'g2');assert.equal(state.status,'won');assert.ok(validateState(state));
  }
});
