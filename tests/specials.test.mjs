import test from 'node:test';
import assert from 'node:assert/strict';
import {THEMES,SPECIALS,INTRO_LEVELS} from '../src/data.js';
import {createPuzzle,makeState,merge,magnet,bubbleText,isBlocked,validateState,upgradeDealing,arrivalDependency} from '../src/engine.js';
import {specialArt} from '../src/art.js';
import {translateBoundedGroup,stepPhysics,resetPhysics} from '../src/physics.js';
const all=s=>[...s.bubbles,...s.reserve.flat()];
const demo=s=>makeState(createPuzzle({mode:'lab',special:s}));
function clear(s,id){while(s.bubbles.filter(b=>b.groupId===id).length>1){const [a,b]=s.bubbles.filter(b=>b.groupId===id);assert.ok(merge(s,a.id,b.id).ok);}}

test('the catalogue introduces thirteen distinct mechanics without duplicate hidden variants',()=>{
  assert.equal(SPECIALS.length,13);assert.equal(INTRO_LEVELS,14);
  assert.deepEqual(SPECIALS.map(s=>s.level),Array.from({length:13},(_,i)=>i+2));
  assert.equal(SPECIALS.find(s=>s.id==='cryptic').name,'Dots');
  assert.equal(SPECIALS.find(s=>s.id==='pinlock').name,'Pinned');
  assert.equal(SPECIALS.find(s=>s.id==='sealed').name,'Tangled');
});
test('linked decoys belong to no deck theme, reject matches, and pop on a partial real merge',()=>{
  for(let seed=0;seed<40;seed++){
    const s=makeState(createPuzzle({mode:'lab',special:'linked'}),{shuffleSeed:`decoy-${seed}`}),fake=all(s).find(b=>b.decoy),real=all(s).find(b=>b.link&&!b.decoy);
    assert.equal(fake.groupId,null);assert.equal(fake.atoms.length,1);assert.equal(arrivalDependency(fake,all(s)),real);
    assert.ok(!s.puzzle.groups.some(g=>g.words.includes(fake.atoms[0].word)||THEMES.find(t=>t.name===g.name)?.words.includes(fake.atoms[0].word)));
    // Supply the real group for this small practice-board check.
    s.bubbles=all(s);s.reserve=[];s.capacity=24;
    const mate=s.bubbles.find(b=>b.groupId===real.groupId&&b.id!==real.id),before=structuredClone(fake);
    assert.ok(merge(s,fake.id,mate.id).mismatch);assert.deepEqual(fake,before);assert.ok(validateState(s));
    const result=merge(s,real.id,mate.id);assert.ok(result.ok);assert.deepEqual(result.poppedDecoys,[fake.id]);assert.equal(mate.atoms.length,2);
    assert.ok(!all(s).some(b=>b.decoy||b.link));assert.ok(validateState(JSON.parse(JSON.stringify(s))));
  }
});
test('assistance pops linked decoys and legacy pairs keep both original words',()=>{
  const s=demo('linked'),fake=all(s).find(b=>b.decoy),real=all(s).find(b=>b.link&&!b.decoy);
  const partner=s.bubbles.find(b=>b.groupId!==real.groupId&&!b.decoy);
  s.bubbles=s.bubbles.filter(b=>b!==fake);s.reserve=s.reserve.map(c=>c.filter(b=>b!==fake)).filter(c=>c.length);
  partner.link=real.link;partner.kind='linked';const ledger=all(s).flatMap(b=>b.atoms.map(a=>a.word)).sort(),moves=s.moves;
  assert.ok(validateState(s));upgradeDealing(s);assert.equal(partner.link,undefined);assert.equal(s.moves,moves);
  assert.deepEqual(all(s).filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>a.word)).sort(),ledger);assert.ok(validateState(s));
  const added=all(s).find(b=>b.decoy);upgradeDealing(s);assert.equal(all(s).filter(b=>b.decoy).length,1);
  const result=magnet(s);assert.ok(result.ok);assert.deepEqual(result.poppedDecoys,[added.id]);assert.ok(!all(s).some(b=>b.decoy));assert.ok(validateState(s));
});
test('colored locks conceal every word until the corresponding key merges',()=>{
  const s=demo('keylock');
  for(const lock of all(s).filter(b=>b.lockColor)){
    assert.equal(bubbleText(lock),'•••');assert.ok(isBlocked(lock));
    const key=s.bubbles.find(b=>b.keyColor===lock.lockColor),mate=s.bubbles.find(b=>b.groupId===key.groupId&&b.id!==key.id);
    merge(s,key.id,mate.id);assert.equal(bubbleText(lock),lock.atoms[0].word);assert.ok(!isBlocked(lock));
  }
});
test('kelp and pins have distinct art without padlocks and release on their original triggers',()=>{
  const tangled=demo('sealed'),kelp=all(tangled).find(b=>b.clearsNeeded);
  assert.match(specialArt(kelp),/kelp-wrap/);assert.doesNotMatch(specialArt(kelp),/lock-hardware/);
  clear(tangled,'g0');assert.ok(!isBlocked(kelp));assert.equal(specialArt(kelp),'');
  const pinned=demo('pinlock'),pins=all(pinned).find(b=>b.pinsNeeded);
  assert.match(specialArt(pins),/pinned-art/);assert.doesNotMatch(specialArt(pins),/lock-hardware/);
  assert.equal((specialArt(pins).match(/data-pin-index/g)||[]).length,2);
  clear(pinned,'g0');assert.equal(pins.pinsNeeded,1);clear(pinned,'g1');assert.equal(pins.pinsNeeded,0);
});
test('theme returns can form a logical chain with a valid save at every step',()=>{
  const s=demo('nested'),child=s.puzzle.groups[0],parent=s.puzzle.groups.find(g=>g.id===child.parentId),grand=s.puzzle.groups.find(g=>g.id===parent.parentId);
  for(const [c,p] of[[child,parent],[parent,grand]])assert.ok(THEMES.find(t=>t.name===p.name).words.includes(c.name));
  // All parent clues are available, but their returning fourth words must still be earned.
  s.bubbles=all(s);s.reserve=[];s.capacity=24;
  for(const g of [child,parent]){
    assert.equal(s.bubbles.filter(b=>b.groupId===g.parentId).length,3);clear(s,g.id);
    const returned=s.bubbles.find(b=>b.id===`${g.id}-theme`);assert.equal(returned.groupId,g.parentId);assert.equal(returned.kind,'normal');assert.equal(returned.atoms[0].word,g.name);
    assert.ok(validateState(JSON.parse(JSON.stringify(s))));
  }
  clear(s,grand.id);assert.ok(validateState(s));
});
test('bonus bubbles require a move budget and the demo enables only its own budget',()=>{
  for(let level=1;level<=120;level++){
    const puzzle=createPuzzle({level}),relaxed=makeState(puzzle),counted=makeState(puzzle,{challenge:true});
    assert.equal(relaxed.remaining,null);assert.ok(!all(relaxed).some(b=>b.kind==='bonus'));
    assert.equal(all(counted).some(b=>b.kind==='bonus'),puzzle.specials.includes('bonus'));
  }
  const practice=demo('bonus');assert.ok(practice.remaining>0);assert.ok(practice.bubbles.some(b=>b.kind==='bonus'));
  const legacy=demo('bonus');legacy.remaining=null;upgradeDealing(legacy);assert.ok(!all(legacy).some(b=>b.kind==='bonus'));assert.ok(validateState(legacy));
});
test('linked translations bound both surfaces at every wall and held physics retains those bounds',()=>{
  const bounds={width:358,height:456,top:12},a={id:'a',x:80,y:110,r:37,vx:0,vy:0},b={id:'b',x:245,y:340,r:37,vx:0,vy:0};
  const spacing={x:b.x-a.x,y:b.y-a.y};
  for(const delta of [{x:900,y:0},{x:-900,y:0},{x:0,y:-900},{x:0,y:900},{x:900,y:900}]){
    translateBoundedGroup([a,b],delta,bounds);
    assert.ok(Math.abs(b.x-a.x-spacing.x)<.001);assert.ok(Math.abs(b.y-a.y-spacing.y)<.001);
    for(const p of[a,b]){assert.ok(p.x-p.r>=2&&p.x+p.r<=bounds.width-2);assert.ok(p.y-p.r>=bounds.top+2&&p.y+p.r<=bounds.height-2);}
  }
  resetPhysics();a.x=-100;a.y=900;stepPhysics([a],{...bounds,held:new Set(['a'])});assert.ok(a.x-a.r>=2&&a.y+a.r<=bounds.height-2);resetPhysics();
});
