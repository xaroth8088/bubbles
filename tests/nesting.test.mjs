import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleThemeChain} from '../src/nesting.js';
import {THEMES} from '../src/data.js';
import {random,createPuzzle,makeState,merge,isBlocked,validateState,clearableGroups,liveLoad,upgradeDealing} from '../src/engine.js';
const theme=(name,words,difficulty=1)=>({id:name,name,words,difficulty,domain:'test'});
const fold=w=>w.toLowerCase();
function checkChain(chain){
  assert.ok(chain.length>=2);
  const words=chain.flatMap(t=>t.words.map(fold));assert.equal(new Set(words).size,words.length);
  for(let i=0;i<chain.length;i++){assert.equal(chain[i].words.length,4);if(i)assert.equal(chain[i].words[0],chain[i-1].name);}
}
test('new dictionary memberships create deeper chains without any template changes',()=>{
  const dictionary=[theme('Bells',['Chime','Gong','Peal','Clapper']),theme('Music',['Bells','Notes','Beat','Song','Tone','Melody']),theme('Arts',['Music','Painting','Dance','Drama','Cinema'])];
  const before=JSON.stringify(dictionary),chain=assembleThemeChain(dictionary,{rng:random('new-words'),minDepth:2});
  assert.deepEqual(chain.map(t=>t.name),['Bells','Music','Arts']);checkChain(chain);assert.equal(JSON.stringify(dictionary),before);
  dictionary.push(theme('Subjects',['Arts','Math','History','Science','Languages']));
  const deeper=assembleThemeChain(dictionary,{rng:random('new-words'),maxDepth:3,minDepth:3});
  assert.deepEqual(deeper.map(t=>t.name),['Bells','Music','Arts','Subjects']);checkChain(deeper);
});
test('nested paths need exclusive clues, not just a non-duplicating allocation',()=>{
  const ambiguous=[theme('Seed',['A','B','C','D','E','F']),theme('Garden',['sEeD','A','B','C','X'])];
  assert.deepEqual(assembleThemeChain(ambiguous),[],'Distributing shared A/B/C once each still leaves multiple theme memberships');
  const dictionary=[theme('Seed',['A','B','C','D','E','F','G']),theme('Garden',['sEeD','A','B','C','X','Y','Z']),theme('Unused',['D','E','F','G'])];
  const before=JSON.stringify(dictionary);
  for(let seed=0;seed<80;seed++){
    const chain=assembleThemeChain(dictionary,{rng:random(seed)});checkChain(chain);
    assert.equal(chain[1].words[0],'Seed');assert.deepEqual(chain[0].words.slice().sort(),['D','E','F','G']);
    assert.deepEqual(chain[1].words.slice(1).sort(),['X','Y','Z']);
    assert.equal(JSON.stringify(dictionary),before,'Do not remove overlap from the catalog itself');
  }
});
test('returning category labels have one membership across the entire path',()=>{
  const dictionary=[theme('Root',['A','B','C','D']),theme('Parent',['rOoT','E','F','G']),theme('Top',['Parent','ROOT','H','I','J'])];
  for(let seed=0;seed<80;seed++){
    const chain=assembleThemeChain(dictionary,{rng:random(seed),maxDepth:2,minDepth:2});checkChain(chain);
    assert.equal(chain.length,2,'Root cannot return along Root → Parent → Top when both later themes accept it');
    for(const owner of chain)for(const word of owner.words){
      const matches=chain.filter(chosen=>dictionary.find(t=>t.id===chosen.id).words.some(w=>fold(w)===fold(word)));
      assert.deepEqual(matches.map(t=>t.id),[owner.id]);
    }
  }
  assert.deepEqual(assembleThemeChain([theme('Root',['Root','A','B','C','D']),theme('Parent',['Root','E','F','G'])]),[],'A returned label cannot also be a clue for its own child theme');
});
test('runtime routes reject cycles, insufficient unique words, forbidden clues and difficulty violations',()=>{
  const cycle=[theme('Alpha',['Beta','A','B','C','D']),theme('Beta',['Alpha','E','F','G','H'])];
  const chain=assembleThemeChain(cycle,{rng:random(2),maxDepth:8,minDepth:8});checkChain(chain);assert.equal(chain.length,2);assert.equal(new Set(chain.map(t=>t.name)).size,chain.length);
  assert.deepEqual(assembleThemeChain([theme('Root',['A','B','C','D']),theme('Parent',['Root','A','B','X'])]),[]);
  const dictionary=[theme('Seed',['A','B','C','D']),theme('Garden',['Seed','E','F','G'],2)];
  assert.deepEqual(assembleThemeChain(dictionary,{maxDifficulty:1}),[]);
  assert.deepEqual(assembleThemeChain(dictionary,{usedWords:new Set(['seed'])}),[]);
  assert.deepEqual(assembleThemeChain(dictionary,{usedThemes:new Set(['Garden'])}),[]);
  assert.deepEqual(assembleThemeChain(dictionary,{usedWords:new Set(['E'])}),[]);
  assert.deepEqual(assembleThemeChain(dictionary,{maxDepth:0}),[]);
});
test('dictionary connections choose varying companion clues and alternate meanings at runtime',()=>{
  const dictionary=THEMES.filter(t=>['Bass','Strings','Freshwater fish','Voice'].includes(t.name)),parents=new Set(),companions=new Set();
  for(let seed=0;seed<120;seed++){
    const chain=assembleThemeChain(dictionary,{rng:random(seed)});checkChain(chain);assert.equal(chain[0].name,'Bass');
    parents.add(chain[1].name);companions.add(JSON.stringify(chain[1].words.slice(1).sort()));
  }
  assert.equal(parents.size,3);assert.ok(companions.size>20);
});
test('runtime nested decks are deterministic, varied, bounded, and solvable in arbitrary clear orders',()=>{
  const paths=new Set(),depths=new Set();
  for(let round=1;round<=160;round++){
    const puzzle=createPuzzle({mode:'endless',special:'nested',round,difficulty:round%2?'tricky':'balanced'});
    assert.deepEqual(puzzle,createPuzzle({mode:'endless',special:'nested',round,difficulty:round%2?'tricky':'balanced'}));
    let g=puzzle.groups[0],path=[g.name];
    while(g.parentId){const parent=puzzle.groups.find(p=>p.id===g.parentId);assert.ok(THEMES.find(t=>t.name===parent.name).words.includes(g.name));assert.ok(parent.words.every(w=>THEMES.find(t=>t.name===parent.name).words.includes(w)));g=parent;path.push(g.name);}
    paths.add(path.join(' → '));depths.add(path.length-1);
    const words=puzzle.groups.flatMap(g=>g.words.map(fold));assert.equal(new Set(words).size,words.length);
    for(const group of puzzle.groups)assert.equal(group.domain,THEMES.find(t=>t.name===group.name).domain);
    const s=makeState(puzzle,{shuffleSeed:`nested-order-${round}`}),rng=random(`actions-${round}`);
    assert.ok(s.bubbles.length+s.reserve.flat().length<=70);
    for(let step=0;s.status==='playing'&&step<80;step++){
      assert.ok(clearableGroups(s).length);assert.ok(liveLoad(s)<=s.capacity+.001);
      const groups=s.puzzle.groups.map(g=>s.bubbles.filter(b=>b.groupId===g.id&&!isBlocked(b))).filter(list=>list.length>1),members=groups[Math.floor(rng()*groups.length)];
      assert.ok(merge(s,members[0].id,members[1].id).ok);assert.ok(validateState(JSON.parse(JSON.stringify(s))));
    }
    assert.equal(s.status,'won');
  }
  assert.ok(paths.size>20);assert.deepEqual([...depths].sort(),[1,2,3]);
});
test('saved predefined chains retain their exact clues and return behavior after the update',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'nested'});puzzle.groups=[
    {id:'g0',name:'Flowers',domain:'nature',words:['Rose','Tulip','Daisy','Lily'],parentId:'g1'},
    {id:'g1',name:'Garden',domain:'nature',words:['Flowers','Soil','Seed','Trowel'],childId:'g0',parentId:'g2'},
    {id:'g2',name:'Outdoor places',domain:'nature',words:['Garden','Beach','Park','Forest'],childId:'g1'}];
  const s=makeState(puzzle),groups=structuredClone(s.puzzle.groups);upgradeDealing(s);assert.deepEqual(s.puzzle.groups,groups);
  for(const g of s.puzzle.groups){while(s.bubbles.filter(b=>b.groupId===g.id).length>1){const[a,b]=s.bubbles.filter(b=>b.groupId===g.id);assert.ok(merge(s,a.id,b.id).ok);}assert.ok(validateState(s));}
  assert.equal(s.status,'won');assert.deepEqual(s.solved.map(g=>g.name),['Flowers','Garden','Outdoor places']);
});
test('a dictionary expansion refreshes an old decoy without invalidating or changing real clues',()=>{
  const puzzle=createPuzzle({mode:'lab',special:'linked'}),garden=THEMES.find(t=>t.name==='Garden');
  puzzle.groups[1]={...puzzle.groups[1],name:'Garden',domain:garden.domain,words:['Soil','Seed','Trowel','Compost']};
  const s=makeState(puzzle),fake=[...s.bubbles,...s.reserve.flat()].find(b=>b.decoy);fake.atoms[0].word='Flowers';
  const realWords=[...s.bubbles,...s.reserve.flat()].filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>a.word));
  assert.ok(validateState(s),'The old save must load before migration');upgradeDealing(s);
  assert.notEqual(fake.atoms[0].word,'Flowers');assert.ok(validateState(s));
  assert.deepEqual([...s.bubbles,...s.reserve.flat()].filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>a.word)),realWords);assert.equal(s.moves,0);
});
