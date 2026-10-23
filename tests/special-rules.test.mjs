import test from 'node:test';
import assert from 'node:assert/strict';
import {PACKS} from '../src/catalog.js';
import {createPuzzle,makeState,merge,refill,upgradeDealing,validateState,clearableGroups,countdownReady,isSplittableWord,bubbleText,liveLoad} from '../src/engine.js';

const all=s=>[...s.bubbles,...s.reserve.flat()];
const members=(s,id)=>s.bubbles.filter(b=>b.groupId===id);
function fixture(){
  const p=createPuzzle({mode:'lab',special:'picture'});p.specials=[];p.title='Word bubbles';
  const s=makeState(p);s.bubbles=all(s);s.reserve=[];s.capacity=24;return s;
}
function park(s,b){s.bubbles=s.bubbles.filter(x=>x!==b);s.reserve.push([b]);}
function timed(s,group='g0'){const b=members(s,group)[0];b.kind='burst';b.timer=9;return b;}
function join(s,group){const [a,b]=members(s,group);return merge(s,a.id,b.id);}
function clear(s,group){while(members(s,group).length>1)assert.ok(join(s,group).ok);}
function split(s,b){
  const atom=b.atoms[0],cut=Math.floor(atom.word.length/2),parts=[0,1].map(part=>({...b,id:`${b.id}-${part}`,kind:'split',atoms:[{...atom,part,label:(part?atom.word.slice(cut):atom.word.slice(0,cut)).toLowerCase()}]}));
  s.bubbles.splice(s.bubbles.indexOf(b),1,...parts);return parts;
}

test('failed screwdriver joins are repeatable and save-safe, even on a carried partial group',()=>{
  for(const reverse of[false,true]){
    let s=fixture();const tool=members(s,'g0')[0],partner=members(s,'g0')[1],wrong=members(s,'g1')[0],ring=members(s,'g2')[0];
    assert.ok(merge(s,partner.id,tool.id).ok);
    tool.driverColor='violet';ring.kind='screw';ring.turns=ring.screwTotal=2;ring.screwColor='violet';
    const words=structuredClone(all(s).flatMap(b=>b.atoms)),snapshot=structuredClone(s);
    for(let repeat=0;repeat<3;repeat++){
      const result=merge(s,...(reverse?[wrong.id,tool.id]:[tool.id,wrong.id]));
      assert.ok(result.mismatch);assert.equal(tool.driverColor,'violet');assert.equal(ring.turns,2);
      assert.deepEqual(all(s).flatMap(b=>b.atoms),words);assert.ok(validateState(s));
    }
    const reloaded=JSON.parse(JSON.stringify(s));upgradeDealing(reloaded);assert.deepEqual(reloaded,s);
    // Undo restores the tool; ring contact still cannot activate it, but a correct join can.
    s=structuredClone(snapshot);assert.equal(merge(s,tool.id,ring.id).ok,false);assert.deepEqual(s,snapshot);
    const next=members(s,tool.groupId).find(b=>b.id!==tool.id);assert.ok(merge(s,next.id,tool.id).ok);
    assert.equal(s.bubbles.find(b=>b.id===ring.id).turns,1);assert.equal(s.bubbles.find(b=>b.id===tool.id).driverColor,undefined);
    assert.ok(!merge(s,tool.id,ring.id).ok);assert.equal(s.bubbles.find(b=>b.id===ring.id).turns,1);assert.ok(validateState(s));
  }
});

test('invalid and blocked screwdriver interactions never mutate tools, rings, or move counters',()=>{
  const s=fixture(),tool=members(s,'g0')[0],wrong=members(s,'g1')[0],ring=members(s,'g2')[0];
  tool.driverColor='violet';ring.kind='screw';ring.turns=ring.screwTotal=2;ring.screwColor='violet';
  wrong.kind='screw';wrong.turns=wrong.screwTotal=2;wrong.screwColor='coral';
  for(const ids of[[tool.id,tool.id],[tool.id,'missing'],[tool.id,wrong.id],[wrong.id,tool.id],[tool.id,ring.id],[ring.id,tool.id]]){
    const before=structuredClone(s);assert.equal(merge(s,...ids).ok,false);assert.deepEqual(s,before);
  }
  s.status='paused';const before=structuredClone(s);assert.equal(merge(s,tool.id,ring.id).ok,false);assert.deepEqual(s,before);
});

test('single-word splits keep the requested 4–8 count across languages and every standalone pack',()=>{
  let waitingDecks=0,openingDecks=0;
  for(const language of['en','de'])for(const {id} of PACKS)for(let round=1;round<=12;round++){
    const p=createPuzzle({mode:'endless',special:'split',difficulty:'tricky',language,packIds:[id],round}),s=makeState(p);
    assert.equal(s.puzzle.splitCount,p.splitCount);assert.ok(s.puzzle.splitCount>=4&&s.puzzle.splitCount<=8);
    const parts=all(s).filter(b=>b.kind==='split');assert.equal(parts.length,p.splitCount*2);
    assert.ok(parts.every(b=>isSplittableWord(b.atoms[0].word)));assert.ok(parts.every(b=>bubbleText(b)===bubbleText(b).toLowerCase()));
    waitingDecks+=Number(s.reserve.flat().some(b=>b.kind==='split'));openingDecks+=Number(s.bubbles.some(b=>b.kind==='split'));
    assert.ok(clearableGroups(s).length);assert.ok(validateState(s));
    const saved=JSON.parse(JSON.stringify(s));upgradeDealing(saved);assert.deepEqual(saved,s,'Reload must not front-load waiting fragments');
  }
  assert.ok(waitingDecks>250,`Only ${waitingDecks} regular decks kept split clues in reserve`);
  assert.ok(openingDecks>250,'Ordinary dealing should also include opening fragments');
});

test('fragments arrive during ordinary later deals and remain solvable after partial assembly and resume',()=>{
  for(const language of['en','de']){
    const s=makeState(createPuzzle({mode:'endless',special:'split',language,round:9,difficulty:'tricky'}));
    const waiting=new Set(s.reserve.flat().filter(b=>b.kind==='split').map(b=>b.id));assert.ok(waiting.size);
    let later=0;
    while(s.status==='playing'){
      const group=clearableGroups(s)[0];assert.ok(group);
      let list=members(s,group.id);
      for(const b of list.filter(b=>b.atoms[0].part===0)){
        const mate=members(s,group.id).find(other=>other.atoms[0].id===b.atoms[0].id&&other.atoms[0].part===1);
        assert.ok(merge(s,b.id,mate.id).assembled);
      }
      clear(s,group.id);later+=s.bubbles.filter(b=>waiting.delete(b.id)).length;
      assert.ok(liveLoad(s)<=s.capacity);assert.ok(validateState(s));
      const saved=JSON.parse(JSON.stringify(s));upgradeDealing(saved);assert.deepEqual(saved,s);
    }
    assert.ok(later>0);assert.equal(waiting.size,0);assert.equal(s.status,'won');
  }
});

test('split eligibility preserves phrases and punctuation and never divides a combining mark',()=>{
  for(const phrase of['European Union','Europäische Union','Ludwig van Beethoven','New\u00a0York','ice-cream',"can't",'A/B',''])assert.equal(isSplittableWord(phrase),false,phrase);
  for(const word of['playground','Spielplatz','Österreich','A\u0308pfel','東京'])assert.equal(isSplittableWord(word),true,word);
  const p=createPuzzle({mode:'lab',special:'split'});p.splitCount=4;
  p.groups=['A\u0308pfel','Spielplatz','playground','Österreich'].map((word,i)=>({id:`g${i}`,name:`Theme ${i}`,words:[word,`European Union ${i}`,`Term ${i}b`,`Term ${i}c`]}));
  const s=makeState(p);
  for(const b of all(s).filter(b=>b.kind==='split'))assert.doesNotMatch(b.atoms[0].label,/^\p{M}/u);
  assert.equal(s.puzzle.splitCount,4);assert.ok(validateState(s));
  const phrases=structuredClone(p);phrases.groups.forEach((g,i)=>g.words[0]=`New York ${i}`);
  const ordinary=makeState(phrases);assert.equal(ordinary.puzzle.splitCount,0);assert.ok(!ordinary.puzzle.specials.includes('split'));assert.ok(validateState(ordinary));
});

test('countdown dealing is atomic within capacity and allowance and never ticks in reserve',()=>{
  const s=fixture(),timer=timed(s),mate=members(s,'g0')[1];park(s,timer);park(s,mate);
  s.capacity=16;const before=timer.timer;
  assert.ok(join(s,'g1').ok);assert.equal(timer.timer,before);
  refill(s,{budget:1});assert.ok(!s.bubbles.includes(timer));assert.equal(timer.timer,9);assert.ok(s.bubbles.includes(mate));
  refill(s,{budget:1});assert.ok(s.bubbles.includes(timer));assert.ok(countdownReady(s,timer));assert.equal(timer.timer,9);assert.ok(validateState(s));
  assert.ok(join(s,'g2').ok);assert.equal(timer.timer,8);
});

test('countdown eligibility counts both fragment halves and partially merged atoms',()=>{
  const s=fixture(),timer=timed(s),whole=members(s,'g0')[1],parts=split(s,whole);park(s,timer);park(s,parts[1]);
  const remaining=members(s,'g0').filter(b=>b!==parts[0]);assert.ok(merge(s,remaining[0].id,remaining[1].id).ok);
  assert.equal(countdownReady(s,timer,[...s.bubbles,timer]),false);
  s.capacity=liveLoad(s)+.5;refill(s,{budget:.5});assert.ok(s.bubbles.includes(parts[1]));assert.ok(!s.bubbles.includes(timer));
  s.capacity++;refill(s,{budget:1});assert.ok(s.bubbles.includes(timer));assert.ok(countdownReady(s,timer));
  assert.ok(merge(s,parts[0].id,parts[1].id).assembled);assert.equal(timer.timer,8);assert.ok(validateState(s));
});

test('countdowns wait through frozen companions and enter only after the thawing move',()=>{
  const s=fixture(),timer=timed(s),ice=members(s,'g0')[1];ice.kind='frozen';ice.ice=ice.iceTotal=4;park(s,timer);
  refill(s,{budget:4});assert.ok(!s.bubbles.includes(timer));
  for(const group of['g1','g1','g2','g2']){assert.ok(join(s,group).ok);assert.equal(timer.timer,9);}
  assert.equal(ice.ice,0);assert.ok(s.bubbles.includes(timer));assert.ok(countdownReady(s,timer));
  assert.ok(join(s,'g3').ok);assert.equal(timer.timer,8);assert.ok(validateState(s));
});

test('nested countdowns wait for their earned category word without charging the child clear',()=>{
  const s=makeState(createPuzzle({mode:'lab',special:'nested'}));s.bubbles=all(s);s.reserve=[];s.capacity=24;
  const child=s.puzzle.groups.find(g=>g.parentId),timer=timed(s,child.parentId);park(s,timer);
  assert.equal(countdownReady(s,timer,[...s.bubbles,timer]),false);refill(s,{budget:4});assert.ok(!s.bubbles.includes(timer));
  clear(s,child.id);assert.ok(s.bubbles.some(b=>b.id===`${child.id}-theme`));assert.ok(s.bubbles.includes(timer));assert.ok(countdownReady(s,timer));assert.equal(timer.timer,9);assert.ok(validateState(s));
});

test('timers wait for visible arrivals and rebirth even after logical dealing completes',()=>{
  const s=fixture(),timer=timed(s),mate=members(s,'g0')[1],a=members(s,'g1')[0],b=members(s,'g2')[0];
  for(const hidden of[timer,mate]){
    const visibleIds=new Set(s.bubbles.filter(other=>other!==hidden).map(other=>other.id));
    assert.ok(merge(s,a.id,b.id,{visibleIds}).mismatch);assert.equal(timer.timer,9);
  }
  assert.ok(merge(s,a.id,b.id,{visibleIds:new Set(s.bubbles.map(b=>b.id))}).mismatch);assert.equal(timer.timer,8);
});

test('timer prerequisites include off-group key locks without exceeding the deal budget',()=>{
  const s=fixture(),timer=timed(s),key=members(s,'g0')[1],lock=members(s,'g1')[0];
  key.keyColor='amber';lock.lockColor='amber';lock.kind='keylock';
  park(s,timer);park(s,key);park(s,lock);s.capacity=16;
  refill(s,{budget:2});assert.ok(!s.bubbles.includes(timer));assert.ok(liveLoad(s)<=15);
  refill(s,{budget:1});assert.ok(s.bubbles.includes(timer));assert.ok(s.bubbles.indexOf(lock)<s.bubbles.indexOf(key));assert.ok(countdownReady(s,timer));assert.ok(validateState(s));
});

test('legacy premature countdowns preserve merged words, progress and resume safely',()=>{
  for(const expired of[false,true])for(const challengeExpired of[false,true]){
    const s=fixture(),timer=timed(s),partner=members(s,'g0')[1];assert.ok(merge(s,partner.id,timer.id).ok);
    const missing=members(s,'g0').find(b=>b!==timer);park(s,missing);timer.timer=expired?0:6;timer.position={x:.5,y:.5};
    s.remaining=challengeExpired?0:null;s.status=expired||challengeExpired?'paused':'playing';
    const ledger=all(s).flatMap(b=>b.atoms).sort((a,b)=>a.id.localeCompare(b.id)),moves=s.moves;
    upgradeDealing(s);assert.ok(s.reserve.flat().includes(timer));assert.equal(timer.position,undefined);assert.equal(timer.timer,expired?9:6);
    assert.equal(s.moves,moves);assert.equal(s.status,challengeExpired?'paused':'playing');assert.deepEqual(all(s).flatMap(b=>b.atoms).sort((a,b)=>a.id.localeCompare(b.id)),ledger);assert.ok(validateState(s));
    const again=structuredClone(s);upgradeDealing(s);assert.deepEqual(s,again);
    if(!challengeExpired){refill(s,{budget:3});assert.ok(s.bubbles.includes(timer));assert.equal(timer.timer,expired?9:6);assert.ok(join(s,'g1').ok);assert.equal(s.status,'playing');}
  }
  const legitimate=fixture(),timer=timed(legitimate);timer.timer=0;legitimate.status='paused';upgradeDealing(legitimate);assert.equal(timer.timer,0);assert.equal(legitimate.status,'paused');
});
