import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog, PACKS, normalizePackIds} from '../src/catalog.js';
import {SPECIALS} from '../src/data.js';
import {createPuzzle, makeState, merge, tapSpecial, isBlocked, clearableGroups, validateState, upgradeDealing, bubbleText} from '../src/engine.js';

const all = state => [...state.bubbles, ...state.reserve.flat()];
function solve(state) {
  for (let step = 0; state.status === 'playing' && step < 180; step++) {
    assert.ok(validateState(JSON.parse(JSON.stringify(state))), `Invalid save: ${state.puzzle.id}`);
    assert.ok(clearableGroups(state).length, `No playable group: ${state.puzzle.id}`);
    const extra = state.bubbles.find(b => b.shell || b.kind === 'bonus');
    if (extra) { assert.ok(tapSpecial(state, extra.id).ok); continue; }
    let pair;
    for (const group of state.puzzle.groups) {
      const members = state.bubbles.filter(b => b.groupId === group.id && !isBlocked(b));
      const fragment = members.find(b => b.atoms.some(a => a.part !== undefined));
      const mate = fragment && members.find(b => b !== fragment && b.atoms[0].id === fragment.atoms[0].id);
      if (mate) { pair = [fragment, mate]; break; }
      const whole = members.filter(b => b.atoms.every(a => a.part === undefined));
      if (whole.length >= 2) { pair = whole.slice(0, 2); break; }
    }
    assert.ok(pair, `No merge: ${state.puzzle.id}`);
    assert.ok(merge(state, pair[0].id, pair[1].id).ok);
  }
  assert.equal(state.status, 'won', `${state.puzzle.id} ${state.puzzle.specials}`);
  assert.equal(all(state).length, 0);
  assert.ok(validateState(state));
}
function checkCatalog(state) {
  const catalog = getCatalog(state.puzzle);
  for (const group of state.puzzle.groups) {
    const theme = catalog.themes.find(t => t.name === group.name && group.words.every(w => t.words.includes(w)));
    assert.ok(theme, `Foreign theme/word: ${state.puzzle.id}, ${group.name}`);
  }
  // Inspect each selected theme's full catalog membership, not only its four
  // sampled clues. Includes future category returns before they are dealt.
  const pools=state.puzzle.groups.map(group=>({id:group.id,words:new Set(catalog.themes.find(t=>t.name===group.name).words.map(w=>w.trim().toLocaleLowerCase(catalog.language)))}));
  for(const group of state.puzzle.groups)for(const word of group.words){
    const matches=pools.filter(pool=>pool.words.has(word.trim().toLocaleLowerCase(catalog.language))).map(pool=>pool.id);
    assert.deepEqual(matches,[group.id],`Ambiguous clue: ${state.puzzle.id}, ${group.name}: ${word}`);
  }
  const words = state.puzzle.groups.flatMap(g => g.words.map(w => w.toLocaleLowerCase(catalog.language)));
  assert.equal(new Set(words).size, words.length, `Duplicate word: ${state.puzzle.id}`);
  assert.ok(all(state).length <= 70, `Oversized deck: ${state.puzzle.id}`);
  for (const decoy of all(state).filter(b => b.decoy)) {
    assert.ok(catalog.themes.some(t => t.words.includes(decoy.atoms[0].word)));
    const excluded = state.puzzle.groups.flatMap(g => catalog.themes.filter(t => t.name === g.name).flatMap(t => [t.name, ...t.words]));
    assert.ok(!excluded.includes(decoy.atoms[0].word));
  }
}

test('every standalone localized pack supports every practice mechanic with real merges', () => {
  for (const language of ['en', 'de']) for (const {id} of PACKS) for (const {id: special} of SPECIALS) {
    const state = makeState(createPuzzle({language, packIds: [id], mode: 'lab', special}));
    checkCatalog(state);
    if (special === 'picture') assert.ok(state.bubbles.some(b => b.kind === 'picture'), `Missing picture: ${language}/${id}`);
    if (special === 'nested') assert.ok(state.puzzle.groups.some(g => g.parentId), `Missing category return: ${language}/${id}`);
    solve(state);
  }
});

test('standalone daily and nested decks retain selection provenance and solve', () => {
  for (const language of ['en', 'de']) for (const {id} of PACKS) {
    for (const mode of ['daily', 'endless']) for (let seed = 1; seed <= 5; seed++) {
      const puzzle = createPuzzle({language, packIds: [id], mode, special: 'nested', round: seed, date: `2026-10-${String(seed).padStart(2, '0')}`, difficulty: 'tricky'});
      const state = makeState(puzzle); checkCatalog(state); solve(state);
    }
  }
});

test('split/link/tool mixtures stay independent and preserve selected language on save migration', () => {
  for (const language of ['en', 'de']) for (const {id} of PACKS) for (let round = 1; round <= 3; round++) {
    const puzzle = createPuzzle({language, packIds: [id], mode: 'endless', difficulty: 'tricky', special: 'split', round});
    puzzle.specials = ['split', 'linked', 'screw', 'keylock', 'frozen', 'bonus'];
    puzzle.groups=puzzle.groups.slice(0,Math.floor((70-puzzle.splitCount-2)/4));
    let state = makeState(puzzle, {challenge: true, shuffleSeed: `mixed-${round}`});
    checkCatalog(state);
    const fragments = all(state).filter(b => b.kind === 'split');
    assert.equal(fragments.length, state.puzzle.splitCount*2); assert.equal(new Set(fragments.map(b => b.atoms[0].word)).size, state.puzzle.splitCount);
    assert.ok(fragments.every(b => !b.link)); assert.equal(state.bubbles.filter(b => b.kind === 'split').length, state.puzzle.splitCount*2);
    state = JSON.parse(JSON.stringify(state));
    const before = structuredClone(state); upgradeDealing(state);
    assert.deepEqual(state, before); solve(state);
  }
});

test('legacy saves without catalog metadata preserve clue ledger and progress', () => {
  const state = makeState(createPuzzle({mode: 'endless', special: 'split'}));
  delete state.puzzle.language; delete state.puzzle.packIds; delete state.puzzle.catalogKey;
  const fragments = state.bubbles.filter(b => b.kind === 'split');
  const a = fragments[0], b = fragments.find(b => b !== a && b.atoms[0].id === a.atoms[0].id);
  assert.ok(merge(state, a.id, b.id).ok);
  const before = structuredClone(state); upgradeDealing(state);
  assert.deepEqual(state, before); solve(state);
});

test('punctuation and Unicode survive split assembly and saved-state round trips', () => {
  const words = ["Rock 'n' roll", 'A/B|C', 'Äpfel, Öl & Spaß', '東京：音楽'];
  const puzzle = createPuzzle({mode: 'lab', special: 'split', language: 'de'});
  puzzle.groups = words.map((word, i) => ({id: `g${i}`, name: `Thema ${i}`, domain: 'Fixture', words: [word, `Term ${i}a`, `Term ${i}b`, `Term ${i}c`]}));
  const state = makeState(puzzle);
  for (const word of words) {
    const pair = state.bubbles.filter(b => b.atoms[0].word === word);
    assert.equal(pair.length, 2); assert.equal(pair.map(bubbleText).join(''), word.toLowerCase());
    const result = merge(state, pair[0].id, pair[1].id); assert.ok(result.assembled);
    assert.equal(bubbleText(state.bubbles.find(b => b.id === result.bubbleId)), word);
  }
  assert.ok(validateState(JSON.parse(JSON.stringify(state)))); solve(state);
});

test('normalized selection deduplicates while keeping base optional and seeds scoped', () => {
  assert.deepEqual(normalizePackIds(['music', 'music', 'unknown']), ['music']);
  assert.deepEqual(normalizePackIds(['music', 'nature']), normalizePackIds(['nature', 'music']));
  const options = {mode: 'daily', date: '2026-10-10', language: 'de', packIds: ['music']};
  assert.deepEqual(createPuzzle(options), createPuzzle({...options, packIds: ['music', 'music', 'unknown']}));
  assert.notEqual(createPuzzle(options).seed, createPuzzle({...options, language: 'en'}).seed);
  assert.notEqual(createPuzzle(options).seed, createPuzzle({...options, packIds: ['music', 'base']}).seed);
});

test('German proper names conceal their initial capitals until both halves are joined', () => {
  const words=['Berlin','Ludwig van Beethoven','Österreich','München'];
  const puzzle=createPuzzle({mode:'lab',special:'split',language:'de'});puzzle.splitCount=4;
  puzzle.groups=words.map((word,i)=>({id:`g${i}`,name:`Thema ${i}`,domain:'Fixture',words:[word,`aa${i}`,`bb${i}`,`cc${i}`]}));
  const state=makeState(puzzle);
  for(const word of words){
    const pair=state.bubbles.filter(b=>b.atoms[0].word===word).sort((a,b)=>a.atoms[0].part-b.atoms[0].part);
    assert.equal(pair.length,2);assert.equal(pair.map(bubbleText).join(''),word.toLowerCase());
    for(const half of pair)assert.equal(bubbleText(half),bubbleText(half).toLowerCase());
    const joined=merge(state,pair[1].id,pair[0].id);assert.ok(joined.assembled);
    assert.equal(bubbleText(state.bubbles.find(b=>b.id===joined.bubbleId)),word);
  }
  assert.ok(validateState(state));solve(state);
});
