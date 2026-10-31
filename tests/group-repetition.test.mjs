import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog,ALL_PACK_IDS} from '../src/catalog.js';
import {createPuzzle,makeState,upgradeDealing,validateState} from '../src/engine.js';
import revisions from './fixtures/distinct-group-clues.json' with {type:'json'};
import equivalents from './fixtures/equivalent-clues.json' with {type:'json'};

// Compare complete clues, not arbitrary stems: Farm/Farmer and compounds are
// different concepts. Review the few linguistic exceptions explicitly.
const fold=word=>word.normalize('NFKC').trim().toLocaleLowerCase().replace(/[’']/g,"'").replace(/[\s-]+/g,' ');
const irregular={
  en:{men:'man',women:'woman',children:'child',people:'person',mice:'mouse',geese:'goose',teeth:'tooth',feet:'foot',oxen:'ox',indices:'index',matrices:'matrix',analyses:'analysis',crises:'crisis',criteria:'criterion',phenomena:'phenomenon'},
  de:{bücher:'buch',männer:'mann',frauen:'frau',kinder:'kind',mäuse:'maus',gänse:'gans',zähne:'zahn',füße:'fuß',häuser:'haus',wörter:'wort',worte:'wort',städte:'stadt',blätter:'blatt',bäume:'baum'}
};
function repeated(a,b,language){
  const x=fold(a),y=fold(b);
  if(x===y)return true;
  if(equivalents[language].some(pair=>pair.map(fold).includes(x)&&pair.map(fold).includes(y)))return true;
  const variants=x=>{
    const words=x.split(' '),last=words.pop();
    const forms=language==='en'?[last+'s',last+'es',...(/[^aeiou]y$/.test(last)?[last.slice(0,-1)+'ies']:[]),...(/(?:f|fe)$/.test(last)?[last.replace(/(?:f|fe)$/,'ves')]:[])]:['s','e','en','n','er'].map(s=>last+s);
    if(language==='de'){
      const umlaut=last.replaceAll('a','ä').replaceAll('o','ö').replaceAll('u','ü');
      forms.push(umlaut,umlaut+'e',umlaut+'er');
    }
    return forms.map(w=>[...words,w].join(' '));
  };
  // Cousin and Cousine distinguish male and female relatives, not number.
  if(language==='de'&&[x,y].sort().join('/')==='cousin/cousine')return false;
  return variants(x).includes(y)||variants(y).includes(x)||irregular[language][x]===y||irregular[language][y]===x;
}
function checkWords(words,language,context){
  for(let i=0;i<words.length;i++)for(let j=i+1;j<words.length;j++)assert.ok(!repeated(words[i],words[j],language),`${context}: ${words[i]} / ${words[j]}`);
}

test('the repetition audit recognizes regular, irregular and whole-phrase variants without stemming distinct clues',()=>{
  for(const [a,b] of [['Book','Books'],['  BOOK  ','books'],['City','Cities'],['Wolf','Wolves'],['Child','Children'],['Mouse','Mice'],['Comic book','Comic books']])assert.ok(repeated(a,b,'en'),`${a}/${b}`);
  for(const [a,b] of [['Buch','Bücher'],['Haus','Häuser'],['Blume','Blumen'],['Kind','Kinder']])assert.ok(repeated(a,b,'de'),`${a}/${b}`);
  for(const [a,b,language] of [['Farm','Farmer','en'],['Steam','Steamer','en'],['Brot','Brötchen','de'],['Cousin','Cousine','de'],['Prinz','Prinzessin','de']])assert.ok(!repeated(a,b,language),`${a}/${b}`);
});

test('all English and German group pools avoid singular/plural repetitions',()=>{
  let groups=0;
  for(const language of ['en','de'])for(const theme of getCatalog({language}).themes){checkWords(theme.words,language,`${language}/${theme.id}/${theme.name}`);groups++;}
  assert.equal(groups,1717);
});

test('reviewed equivalent clues are replaced by distinct meaningful associations',()=>{
  assert.ok(revisions.length>0);
  for(const {language,id,old,replacement} of revisions){
    const theme=getCatalog({language}).themes.find(t=>t.id===id);
    assert.ok(theme,`${language}/${id}`);assert.ok(!theme.words.includes(old),`${theme.name}: redundant ${old}`);
    assert.ok(theme.words.includes(replacement),`${theme.name}: replacement ${replacement}`);
    assert.ok(theme.words.length>=4);
  }
  const library=getCatalog().themes.find(t=>t.id==='theme-245');
  assert.equal(library.words.filter(w=>/^books?$/i.test(w)).length,1);
});

test('generated ordinary and returning groups retain distinct clues in every language and pack',()=>{
  let boards=0,returns=0;
  for(const language of ['en','de'])for(const packIds of [...ALL_PACK_IDS.map(id=>[id]),ALL_PACK_IDS])for(const difficulty of ['gentle','balanced','tricky'])for(const round of [1,2,9,17]){
    const puzzle=createPuzzle({language,packIds,difficulty,mode:'endless',round});
    for(const group of puzzle.groups){checkWords(group.words,language,puzzle.id+' / '+group.name);if(group.parentId)returns++;}
    assert.ok(validateState(makeState(puzzle)));boards++;
  }
  assert.equal(boards,408);assert.ok(returns>0);
});

test('an existing saved Book/Books group keeps its exact clues and progress',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'picture'});
  puzzle.specials=[];puzzle.title='Word bubbles';
  puzzle.groups=[{id:'g0',name:'Library',words:['Book','Books','Librarian','Shelf']}];
  const state=JSON.parse(JSON.stringify(makeState(puzzle))),before=structuredClone(state);
  assert.ok(validateState(state));upgradeDealing(state);
  assert.deepEqual(state,before);assert.ok(validateState(state));
});
