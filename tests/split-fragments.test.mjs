import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS} from '../src/catalog.js';
import {normalizeLabel} from '../src/nesting.js';
import {createPuzzle,makeState,merge,magnet,validateState,upgradeDealing,bubbleText} from '../src/engine.js';

const all=state=>[...state.bubbles,...state.reserve.flat()];
const parts=state=>all(state).filter(b=>b.atoms.some(a=>a.part!==undefined));
const splitWords=state=>[...new Set(parts(state).map(b=>b.atoms[0].word))];
function assertUnique(state){
  const owners=new Map();
  for(const bubble of parts(state)){
    const key=normalizeLabel(bubbleText(bubble)),atom=bubble.atoms[0];
    assert.ok(!owners.has(key)||owners.get(key)===atom.id,`${state.puzzle.id}: ${key} belongs to both ${owners.get(key)} and ${atom.id} (${atom.word})`);
    owners.set(key,atom.id);
  }
}
function fixture(words,{count=4,language='en',challenge=false}={}){
  const puzzle={...createPuzzle({mode:'lab',special:'split',language}),splitCount:count,
    groups:words.map((word,i)=>({id:`g${i}`,name:`Fixture ${i}`,words:[word,`Clue ${i}a`,`Clue ${i}b`,`Clue ${i}c`]}))};
  return makeState(puzzle,{challenge});
}

test('split selection rejects shared prefixes, suffixes and opposite-side labels across the whole deck',()=>{
  for(const [first,conflict]of[['Pause','Paper'],['Planet','Magnet'],['Winter','Terror'],['Terror','Winter']]){
    const state=fixture([first,conflict,'Maple','River','Thunder']);
    assertUnique(state);assert.equal(state.puzzle.splitCount,4);
    assert.deepEqual(new Set(splitWords(state)),new Set([first,'Maple','River','Thunder']));
    assert.equal(all(state).filter(b=>b.atoms[0].word===conflict).length,1,'A skipped word stays whole');
    assert.ok(parts(state).some(b=>state.reserve.flat().includes(b)),'Check waiting fragments as well as the opening');
    assert.ok(validateState(state));
  }
});

test('fragment ownership uses lowercase Unicode-normalized labels without changing canonical spelling',()=>{
  for(const language of['en','de'])for(const pair of[['PAPER','Pause'],['Ärger','A\u0308rzte'],['A\u0308rger','Ärzte']]){
    const state=fixture([...pair,'Maple','River','Thunder'],{language});
    assertUnique(state);assert.equal(state.puzzle.splitCount,4);
    assert.ok(splitWords(state).includes(pair[0]));assert.ok(!splitWords(state).includes(pair[1]));
    for(const b of parts(state)){
      assert.equal(bubbleText(b),bubbleText(b).toLowerCase());
      assert.doesNotMatch(bubbleText(b),/^\p{M}/u,'Combining marks stay with their grapheme');
    }
    assert.ok(validateState(state));
  }
});

test('a rejected pair does not reserve its unused half and equal halves of one word remain playable',()=>{
  // Paper is rejected because of pa, but its unused per must not exclude person.
  const state=fixture(['Pause','Paper','Person','Murmur','Thunder']);
  assertUnique(state);assert.deepEqual(new Set(splitWords(state)),new Set(['Pause','Person','Murmur','Thunder']));
  for(const reverse of[false,true]){
    const copy=structuredClone(state);copy.bubbles=all(copy);copy.reserve=[];copy.capacity=24;
    const pair=copy.bubbles.filter(b=>b.atoms[0].word==='Murmur');
    assert.deepEqual(pair.map(b=>bubbleText(b)),['mur','mur']);if(reverse)pair.reverse();
    assert.ok(merge(copy,pair[0].id,pair[1].id).assembled);
    assert.equal(copy.bubbles.find(b=>b.id===pair[1].id).atoms[0].word,'Murmur');assert.ok(validateState(copy));
  }
});

test('collision-heavy custom decks fall back safely and budgets use the actual safe split count',()=>{
  const none=fixture(['Pause','Paper','Party','Pasta'],{count:8,challenge:true});
  assert.equal(none.puzzle.splitCount,0);assert.ok(!none.puzzle.specials.includes('split'));assert.equal(parts(none).length,0);
  assert.equal(none.remaining,none.puzzle.groups.length*3+7);assert.equal(all(none).length,16);assert.ok(validateState(none));
  const fewer=fixture(['Pause','Paper','Party','Maple','River','Thunder'],{count:8,challenge:true});
  assertUnique(fewer);assert.equal(fewer.puzzle.splitCount,4);assert.ok(fewer.puzzle.specials.includes('split'));
  assert.equal(fewer.remaining,fewer.puzzle.groups.length*3+4+7);assert.ok(validateState(fewer));
});

test('all languages, standalone packs and modes keep unique fragments with deterministic generation and shuffle',()=>{
  let checked=0,waiting=0;
  for(const language of['en','de'])for(const {id}of PACKS)for(const difficulty of['gentle','balanced','tricky'])for(let round=1;round<=8;round++){
    const puzzle=createPuzzle({mode:'endless',special:'split',language,packIds:[id],difficulty,round});
    const state=makeState(puzzle,{challenge:true});assertUnique(state);
    assert.equal(state.puzzle.splitCount,puzzle.splitCount);assert.equal(parts(state).length,puzzle.splitCount*2);assert.ok(validateState(state));
    const shuffled=makeState(puzzle,{challenge:true,shuffleSeed:`fragment-${round}`});assertUnique(shuffled);
    assert.deepEqual(shuffled,makeState(puzzle,{challenge:true,shuffleSeed:`fragment-${round}`}));
    assert.deepEqual(new Set(splitWords(shuffled)),new Set(splitWords(state)));
    const saved=JSON.parse(JSON.stringify(state));upgradeDealing(saved);assert.deepEqual(saved,state);
    waiting+=Number(state.reserve.flat().some(b=>b.kind==='split'));checked++;
  }
  for(const language of['en','de'])for(const mode of['journey','endless','lab','daily'])for(let round=1;round<=40;round++){
    const puzzle=createPuzzle({mode,special:'split',language,level:round,round,date:`2026-11-${String(round%28+1).padStart(2,'0')}`});
    assertUnique(makeState(puzzle));checked++;
  }
  assert.ok(checked>=700);assert.ok(waiting>300);
});

test('split uniqueness survives stacked mechanics without duplicating one-shot tools',()=>{
  for(const language of['en','de'])for(let round=1;round<=25;round++){
    const puzzle=createPuzzle({mode:'endless',special:'split',language,difficulty:'tricky',round});
    puzzle.specials=['split','linked','screw','keylock','frozen','bonus'];puzzle.splitCount=8;puzzle.groups=puzzle.groups.slice(0,15);
    const state=makeState(puzzle,{challenge:true});assertUnique(state);assert.equal(state.puzzle.splitCount,8);
    assert.ok(parts(state).every(b=>!b.link&&!b.decoy&&!b.keyColor&&!b.pinCarrier));
    assert.ok(parts(state).filter(b=>b.atoms[0].part===1).every(b=>!b.driverColor));assert.ok(validateState(state));
  }
});

test('legacy duplicate fragments retain identities and progress on resume and still join only their own mate',()=>{
  for(const language of['en','de'])for(const reverse of[false,true])for(const metadata of[false,true]){
    const words=language==='en'?['Pause','Paper','Maple','River']:['Ärger','A\u0308rzte','Maple','River'];
    const state=fixture(words,{language,challenge:true});
    // Recreate an old midpoint-split deck, including duplicate labels. Do not
    // regenerate it through the new collision-aware selector on resume.
    state.bubbles=all(state).flatMap(b=>{
      if(b.atoms[0].part!==undefined)return [b];
      const atom=b.atoms[0];if(!words.includes(atom.word))return [b];
      const chars=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(atom.word)].map(p=>p.segment),cut=Math.floor(chars.length/2);
      return [0,1].map(part=>({...b,id:`${b.id}${part?'r':'l'}`,kind:'split',atoms:[{...atom,part,label:(part?chars.slice(cut):chars.slice(0,cut)).join('').toLowerCase()}]}));
    });
    state.reserve=[];state.capacity=24;state.puzzle.specials=['split'];state.puzzle.splitCount=4;
    if(!metadata)delete state.puzzle.splitCount;
    const pair=word=>state.bubbles.filter(b=>b.atoms[0].word===word);
    const assembled=pair(words[2]);assert.ok(merge(state,assembled[0].id,assembled[1].id).assembled);
    // Preserve a partial join, solved group, and waiting half as well as counters.
    const plain=state.bubbles.filter(b=>b.groupId==='g0'&&b.kind==='normal');assert.ok(merge(state,plain[0].id,plain[1].id).ok);
    const tail=pair(words[3]);assert.ok(merge(state,tail[0].id,tail[1].id).assembled);
    while(state.bubbles.filter(b=>b.groupId==='g3').length>1){const [a,b]=state.bubbles.filter(b=>b.groupId==='g3');assert.ok(merge(state,a.id,b.id).ok);}
    const waiting=pair(words[1]).find(b=>b.atoms[0].part===1);state.bubbles=state.bubbles.filter(b=>b!==waiting);state.reserve=[[waiting]];
    const before=structuredClone(state),loaded=JSON.parse(JSON.stringify(state));assert.ok(validateState(loaded));
    upgradeDealing(loaded);assert.deepEqual(loaded,before);assert.ok(validateState(loaded));
    const again=structuredClone(loaded);upgradeDealing(loaded);assert.deepEqual(loaded,again);
    loaded.bubbles=all(loaded);loaded.reserve=[];
    const first=loaded.bubbles.find(b=>b.atoms[0].word===words[0]&&b.atoms[0].part===0);
    const wrong=loaded.bubbles.find(b=>b.atoms[0].word===words[1]&&b.atoms[0].part===1);
    const atoms=structuredClone(all(loaded).flatMap(b=>b.atoms));assert.ok(merge(loaded,first.id,wrong.id).mismatch);
    assert.deepEqual(all(loaded).flatMap(b=>b.atoms),atoms);
    for(const word of words.slice(0,2)){
      const pieces=loaded.bubbles.filter(b=>b.atoms[0].word===word);if(reverse)pieces.reverse();
      assert.ok(merge(loaded,pieces[0].id,pieces[1].id).assembled);
      assert.equal(loaded.bubbles.find(b=>b.id===pieces[1].id).atoms[0].word,word);
    }
    while(loaded.status==='playing')assert.ok(magnet(loaded).ok);
    assert.equal(loaded.status,'won');assert.ok(validateState(loaded));
  }
});
