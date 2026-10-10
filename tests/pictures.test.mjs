import test from 'node:test';
import assert from 'node:assert/strict';
import {PICTURES, THEMES, SPECIALS} from '../src/data.js';
import {createPuzzle, makeState, bubbleText, isBlocked, merge, validateState, upgradeDealing} from '../src/engine.js';

const all = state => [...state.bubbles, ...state.reserve.flat()];
const pictures = state => all(state).filter(b => b.kind === 'picture');
const fixture = (theme, words, seed) => ({
  ...createPuzzle({mode:'lab', special:'picture'}), seed,
  groups:[{id:'g0', name:theme.name, domain:theme.domain, words}]
});

test('every mapped picture is a real dictionary clue and can be selected and rendered', () => {
  for (const [word, emoji] of Object.entries(PICTURES)) {
    const theme = THEMES.find(t => t.difficulty <= 3 && t.words.includes(word));
    assert.ok(theme, `${word} must be reachable through a theme`);
    assert.equal(typeof emoji, 'string');
    assert.ok(/\p{Extended_Pictographic}/u.test(emoji), `${word} needs pictorial art`);
    const words = [word, ...theme.words.filter(w => w !== word).slice(0,3)];
    let selected;
    // A full real group tests selection rather than bypassing it with bubbleText.
    for (let seed = 0; seed < 80 && !selected; seed++) {
      const state = makeState(fixture(theme, words, `reach-${seed}`));
      selected = pictures(state).find(b => b.atoms[0].word === word);
      assert.ok(validateState(state));
      if (selected) {
        assert.ok(state.bubbles.includes(selected));
        assert.equal(bubbleText(selected), emoji);
      }
    }
    assert.ok(selected, `${word} must get a chance beyond the first mapped clue`);
  }
});

test('picture generation is seeded, diverse, and keeps the clue ledger distinct', () => {
  const seen = new Set();
  for (let round = 1; round <= 180; round++) {
    const options = {mode:'endless', round, difficulty:'tricky', special:'picture'};
    const puzzle = createPuzzle(options), state = makeState(puzzle);
    assert.deepEqual(puzzle, createPuzzle(options));
    assert.deepEqual(state, makeState(createPuzzle(options)));
    assert.match(puzzle.seed, /-v7-/);
    const words = puzzle.groups.flatMap(g => g.words.map(w => w.toLowerCase()));
    assert.equal(new Set(words).size, words.length);
    assert.equal(pictures(state).length, 1);
    const picture = pictures(state)[0];
    assert.ok(!isBlocked(picture));
    assert.equal(bubbleText(picture), PICTURES[picture.atoms[0].word]);
    seen.add(picture.atoms[0].word);
    assert.ok(validateState(state));
  }
  assert.ok(seen.size >= Math.min(35, Object.keys(PICTURES).length), `${seen.size} different pictures`);
  const date = '2026-10-10';
  assert.deepEqual(createPuzzle({mode:'daily',date,difficulty:'gentle'}), createPuzzle({mode:'daily',date,difficulty:'tricky'}));
});

test('every live eligible candidate can win on the same board across deterministic seeds', () => {
  const theme = THEMES.find(t => t.words.filter(w => PICTURES[w]).length >= 4);
  assert.ok(theme);
  const words = theme.words.filter(w => PICTURES[w]).slice(0,4), seen = new Set();
  for (let index = 0; index < 80; index++) {
    const puzzle = fixture(theme, words, `fair-${index}`);
    const state = makeState(puzzle);
    seen.add(pictures(state)[0].atoms[0].word);
    assert.deepEqual(state, makeState(puzzle));
  }
  assert.deepEqual([...seen].sort(), [...words].sort());
});

test('picture lab always opens with a visible picture, including shuffled dealing', () => {
  for (let index = 0; index < 100; index++) {
    const state = makeState(createPuzzle({mode:'lab',special:'picture'}), {shuffleSeed:`lab-picture-${index}`});
    assert.equal(pictures(state).length, 1);
    assert.ok(state.bubbles.includes(pictures(state)[0]));
    assert.ok(validateState(state));
  }
});

test('picture decoration does not erase any other special mechanic or its clue data', () => {
  for (const special of SPECIALS.filter(s => s.id !== 'picture')) {
    for (let round = 1; round <= 8; round++) {
      const puzzle = createPuzzle({mode:'endless',round,difficulty:'tricky',special:special.id});
      const options = {challenge:true,shuffleSeed:`pair-${special.id}-${round}`};
      const baseline = makeState(puzzle, options);
      const state = makeState({...puzzle,specials:[...puzzle.specials,'picture']}, options);
      const normalize = s => all(s).map(({picture,...b}) => ({...b,kind:b.kind === 'picture' ? 'normal' : b.kind})).sort((a,b) => a.id.localeCompare(b.id));
      assert.deepEqual(normalize(state), normalize(baseline), special.id);
      for (const group of puzzle.groups) {
        const ledger = s => [...new Set(all(s).filter(b => b.groupId === group.id).flatMap(b => b.atoms.map(a => a.word)))].sort();
        assert.deepEqual(ledger(state),ledger(baseline));
      }
      assert.ok(validateState(state));
      for (const picture of pictures(state)) {
        assert.ok(!isBlocked(picture));
        assert.equal(picture.atoms.length,1);
        assert.equal(picture.atoms[0].part,undefined);
        assert.equal(bubbleText(picture),PICTURES[picture.atoms[0].word]);
      }
    }
  }
});

test('pictures survive save and resume, and reveal their word when merged', () => {
  const theme = THEMES.find(t => t.words.filter(w => PICTURES[w]).length >= 4);
  const state = makeState(fixture(theme, theme.words.filter(w => PICTURES[w]).slice(0,4), 'resume-picture'));
  const saved = JSON.parse(JSON.stringify(state));
  assert.ok(validateState(saved));
  upgradeDealing(saved);
  assert.deepEqual(saved,state);
  const picture = pictures(saved)[0], partner = saved.bubbles.find(b => b.id !== picture.id);
  const word = picture.atoms[0].word;
  assert.ok(merge(saved,partner.id,picture.id).ok);
  assert.equal(picture.kind,'normal');
  assert.ok(bubbleText(picture).includes(word));
  assert.ok(validateState(saved));
  const legacy = JSON.parse(JSON.stringify(state));
  legacy.puzzle.id = legacy.puzzle.seed = 'lab-v5-picture';
  const before = structuredClone(legacy);
  upgradeDealing(legacy);
  assert.deepEqual(legacy,before);
  assert.ok(validateState(legacy));
});


test('fully obstructed picture clues retain their original special mechanics', () => {
  const theme = THEMES.find(t => t.words.some(w => PICTURES[w] && w.length >= 5) && t.words.filter(w => !PICTURES[w]).length >= 3);
  assert.ok(theme);
  const mapped = theme.words.find(w => PICTURES[w] && w.length >= 5);
  for (const [special, groupIndex, wordIndex] of [['frozen',3,0],['cryptic',2,2],['split',0,0]]) {
    const used = new Set(theme.words), groups = [];
    for (let i = 0; i < 4; i++) {
      let chosen, words;
      if (i === groupIndex) {
        chosen = theme;
        words = theme.words.filter(w => !PICTURES[w]).slice(0,3);
        words.splice(wordIndex,0,mapped);
      } else {
        chosen = THEMES.find(t => t.words.filter(w => !PICTURES[w] && !used.has(w)).length >= 4);
        words = chosen.words.filter(w => !PICTURES[w] && !used.has(w)).slice(0,4);
      }
      words.forEach(w => used.add(w));
      groups.push({id:`g${i}`,name:chosen.name,domain:chosen.domain,words});
    }
    const puzzle = {...createPuzzle({mode:'lab',special}),specials:[special,'picture'],groups};
    const state = makeState(puzzle);
    assert.equal(pictures(state).length,0,special);
    assert.ok(all(state).some(b => b.kind === special && b.atoms[0].word === mapped));
    assert.ok(all(state).some(b => b.kind === special));
    assert.ok(validateState(state));
    if (special === 'split') {
      const halves = all(state).filter(b => b.kind === 'split');
      assert.equal(halves.length,state.puzzle.splitCount*2);
      for(const id of new Set(halves.map(b=>b.atoms[0].id))){
        const pair=halves.filter(b=>b.atoms[0].id===id).sort((a,b)=>a.atoms[0].part-b.atoms[0].part);
        assert.equal(pair.map(b=>b.atoms[0].label).join(''),pair[0].atoms[0].word.toLowerCase());
      }
    }
  }
});
