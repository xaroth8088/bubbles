import { PICTURES, SPECIALS, INTRO_LEVELS, themeName } from './data.js';
import { getCatalog, CATALOG_VERSION } from './catalog.js';
import { assembleThemeChain, normalizeLabel } from './nesting.js';

export const SCHEMA = 1;
export const FROZEN_MERGES = 4;
export const PICTURE_MAJORITY_INTERVAL = 8;
export const KEY_COLORS = ['amber','azure','coral','violet'];
export function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function random(seed) {
  let value = typeof seed === 'number' ? seed : hash(seed);
  return () => { value += 0x6D2B79F5; let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const titles = ['A little connection','Picture this','Let it thaw','Better together','Between the letters','The key to it','A little twist','A different direction','Ties that bind','A little spark','The bigger picture','Unwind a little','Little pin moments','Room for one more'];
const canonicalSpecials = specials => [...new Set(specials.map(s=>s==='hidden'?'cryptic':s).filter(s=>SPECIALS.some(x=>x.id===s)))];

export function createPuzzle({mode = 'journey', level = 1, date = localDate(), round = 1, difficulty = 'balanced', special = null, language = 'en', packIds} = {}) {
  const catalog=getCatalog({language,packIds}),themes=catalog.themes,pictures=catalog.pictures;
  language=catalog.language;packIds=[...catalog.packIds].sort();
  const catalogKey=`${language}-${hash(`${CATALOG_VERSION}:${packIds.join(',')}`).toString(36)}`;
  if (mode === 'daily') difficulty = 'balanced';
  const baseSeed = mode === 'daily' ? `daily-v10-${date}` : mode === 'lab' ? `lab-v10-${special}-${round}` : `${mode}-v10-${level}-${round}-${difficulty}`;
  const seed=`${baseSeed}-${catalogKey}`;
  const rng = random(seed);
  let count = mode === 'lab' ? 4 : difficulty === 'tricky' ? 17 : difficulty === 'gentle' || (mode === 'journey' && level <= 4) ? 10 : 14;
  let maxDifficulty = mode === 'journey' && level <= 5 ? 1 : difficulty === 'gentle' ? 1 : difficulty === 'tricky' || (mode === 'journey' && level > 30) || mode === 'daily' ? 3 : 2;
  // A selected pack may contain mostly advanced themes. Widen difficulty
  // within that pack rather than silently adding unselected vocabulary.
  while(maxDifficulty<3&&themes.filter(t=>t.difficulty<=maxDifficulty).length<count)maxDifficulty++;
  const introduction=mode==='journey'&&level<=INTRO_LEVELS;
  // Theme returns are a regular part of play: four boards in each five,
  // independent of the selected language/packs. Keep focused tutorials/labs
  // and explicit mechanic requests intact, and retain the usual twist budget.
  const day=Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
  const sequence=mode==='daily'?(Number.isFinite(day)?day:hash(date)):mode==='journey'?level-INTRO_LEVELS:round;
  const withTheme=!special&&mode!=='lab'&&!introduction&&sequence%5!==0;
  const twists=shuffle(SPECIALS.filter(s=>s.id!=='nested').map(s=>s.id),rng);
  let specials=special?canonicalSpecials([special]):introduction?[SPECIALS.find(s=>s.level===level)?.id].filter(Boolean)
    :[...(withTheme?['nested']:[]),...twists.slice(0,(level>35||difficulty==='tricky'?3:2)-Number(withTheme))];
  // Daily boards remain deterministic; their one obstacle accompanies the
  // returning-category chain on four out of every five calendar days.
  if(mode==='daily'&&!special)specials=[...(withTheme?['nested']:[]),shuffle(['picture','frozen','split','cryptic','keylock','screw','backward','pinlock'],rng)[0]];
  const splitCount=specials.includes('split')?4+hash(`${seed}-split-count`)%5:0;
  count=Math.min(count,Math.floor((70-specials.reduce((n,s)=>n+(s==='split'?splitCount:['linked','bonus'].includes(s)?1:0),0))/4));
  let planned=[];
  if(specials.includes('nested')){
    const maxDepth=mode==='lab'?2:difficulty==='tricky'?3:difficulty==='gentle'?1:2;
    const minDepth=mode==='lab'?2:rng()<.65?Math.min(2,maxDepth):1;
    planned=assembleThemeChain(themes,{rng,maxDifficulty,maxDepth,minDepth});
    // Some standalone packs have their first valid connection above the
    // opening difficulty. Widen only the chain search within those packs;
    // never silently drop a scheduled Theme board or add another genre.
    for(let limit=maxDifficulty+1;!planned.length&&limit<=3;limit++)planned=assembleThemeChain(themes,{rng,maxDifficulty:limit,maxDepth,minDepth});
    if(planned.length){
      count=Math.min(count,Math.floor((70-(planned.length-1)*3-specials.reduce((n,s)=>n+(s==='split'?splitCount:['linked','bonus'].includes(s)?1:0),0))/4));
    }else specials=specials.filter(s=>s!=='nested');
  }
  const chain=planned.slice(1);
  let selected=[];
  // Dense standalone packs may need another draw to reach the usual deck size.
  // Retries remain seeded and bounded, and never relax exclusive membership.
  for(let attempt=0;attempt<24;attempt++){
    const candidate=selectDeckThemes({themes,planned,count,maxDifficulty,specials,pictures,rng});
    if(candidate.length>selected.length)selected=candidate;
    if(selected.length===count)break;
  }
  const buildGroups=selected=>{
    const groups=selected.map((t,i)=>({id:`g${i}`,name:t.name,domain:t.domain,words:t.words}));
    let child=groups[0];
    for(const layer of chain){
      const parent={id:`g${groups.length}`,name:layer.name,domain:layer.domain,words:layer.words,childId:child.id};
      child.parentId=parent.id;groups.push(parent);child=parent;
    }
    return groups;
  };
  const groups=buildGroups(selected);
  const puzzle={id:seed,seed,language,packIds,catalogKey,mode,level,date,round,difficulty,specials,splitCount,groups,
    title:mode === 'lab' ? SPECIALS.find(s => s.id === specials[0])?.name || 'Word bubbles' : mode === 'daily' ? 'A fresh little challenge' : mode === 'journey' && level <= INTRO_LEVELS ? titles[level-1] : mode === 'endless' ? 'Follow your curiosity' : ['Little discoveries','Find your flow','Room for wonder','One thing leads to another'][level%4]};
  // Every eighth post-introduction board can be picture-led. Keep explicit
  // mechanics/tutorials intact, preserve the scheduled returning chain, and
  // fall back to this ordinary deck if the selected vocabulary cannot do it.
  if(!special&&mode!=='lab'&&!introduction&&sequence%PICTURE_MAJORITY_INTERVAL===1){
    const majoritySpecials=[...(specials.includes('nested')?['nested']:[]),'picture'];
    const total=count*4+chain.length*3;
    if(new Set(Object.values(pictures)).size>total/2){
      const pictureRng=random(`${seed}-majority`);
      for(let attempt=0;attempt<24;attempt++){
        const picked=selectDeckThemes({themes,planned,count,maxDifficulty,specials:majoritySpecials,pictures,rng:pictureRng,preferPictures:true});
        if(picked.length!==count)continue;
        const candidate={...puzzle,specials:majoritySpecials,splitCount:0,groups:buildGroups(picked),pictureMajority:true};
        if(makeState(candidate).puzzle.pictureMajority)return candidate;
      }
    }
  }
  return puzzle;
}

const fold=normalizeLabel;
const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});
const letters=word=>[...graphemes.segment(word)].map(part=>part.segment);
export const isSplittableWord=word=>/^\p{L}[\p{L}\p{M}]+$/u.test(word)&&letters(word).length>=2;
export function selectDeckThemes({themes,planned,count,maxDifficulty,specials,pictures,rng,preferPictures=false}){
  const selected=planned.length?[planned[0]]:[],chosenIds=new Set(planned.map(t=>t.id));
  const used=new Set(planned.map(t=>fold(t.name))),dealtWords=new Set(),selectedPool=new Set(),domains=new Set();
  const pictureGlyphs=new Set();
  const originals=new Map(themes.map(t=>[t.id,t]));
  const addTheme=theme=>{
    used.add(fold(theme.name));
    theme.words.forEach(word=>{used.add(fold(word));dealtWords.add(fold(word));if(pictures[word])pictureGlyphs.add(pictures[word]);});
    originals.get(theme.id).words.forEach(word=>selectedPool.add(fold(word)));
    domains.add(theme.domain);chosenIds.add(theme.id);
  };
  for(const theme of planned)addTheme(theme);
  const pictureCandidate=theme=>theme.words.some(w=>pictures[w]);
  // Widen within the selected packs only if the easier pools cannot fill a deck.
  for(let limit=maxDifficulty;limit<=3&&selected.length<count;limit++){
    for(let pass=0;pass<2&&selected.length<count;pass++){
      const candidates=shuffle(themes.filter(t=>t.difficulty<=limit),rng);
      // Randomize ties, then favor recognizable, distinct images. Never add
      // mappings or relax the full-pool exclusivity/label ledgers below.
      const pictureScore=theme=>Math.min(4,new Set(theme.words.filter(w=>pictures[w]&&!pictureGlyphs.has(pictures[w])&&!used.has(fold(w))&&!selectedPool.has(fold(w))).map(w=>pictures[w])).size);
      if(preferPictures)candidates.sort((a,b)=>pictureScore(b)-pictureScore(a));
      for(const theme of candidates){
        if(selected.length>=count)break;
        // Only the preassembled chain may deliberately reuse a label as a
        // clue. Ordinary themes cannot reuse any earlier label or dealt word,
        // and their own name must be reserved before drawing their clues.
        const name=fold(theme.name);
        if(chosenIds.has(theme.id)||used.has(name)||(!preferPictures&&pass===0&&domains.has(theme.domain)))continue;
        // Compare full catalog pools in both directions. Existing clues must
        // not gain a second meaning, and new clues must not fit prior themes.
        // The ledger includes nested labels before those labels become live.
        if(theme.words.some(word=>dealtWords.has(fold(word))))continue;
        const pool=theme.words.filter(w=>fold(w)!==name&&!used.has(fold(w))&&!selectedPool.has(fold(w)));
        if(pool.length<4)continue;
        const pictureWords=pool.filter(w=>pictures[w]);
        if(specials.includes('picture')&&Object.keys(pictures).length&&!selected.some(pictureCandidate)&&selected.length===count-1&&!pictureWords.length)continue;
        // Prefer contiguous words on split decks without weakening exclusive membership.
        const draw=shuffle(pool,rng);
        if(specials.includes('split'))draw.sort((a,b)=>Number(isSplittableWord(b))-Number(isSplittableWord(a)));
        if(preferPictures){
          const seen=new Set(pictureGlyphs),rank=new Map();
          for(const word of draw){const glyph=pictures[word];rank.set(word,glyph&&!seen.has(glyph)?1:0);if(glyph)seen.add(glyph);}
          draw.sort((a,b)=>rank.get(b)-rank.get(a));
        }
        const words=draw.slice(0,4);
        if(specials.includes('picture')&&!selected.some(pictureCandidate)&&!words.some(w=>pictures[w])&&pictureWords.length){
          words[Math.floor(rng()*words.length)]=pictureWords[Math.floor(rng()*pictureWords.length)];
        }
        const chosen={...theme,words};selected.push(chosen);addTheme(chosen);
      }
    }
  }
  return selected;
}

export function makeState(puzzle, {challenge = false, shuffleSeed = null} = {}) {
  const pictures=getCatalog(puzzle).pictures;
  puzzle={...puzzle,specials:canonicalSpecials(puzzle.specials).filter(s=>s!=='bonus'||challenge||puzzle.mode==='lab')};
  if(puzzle.pictureMajority&&!puzzle.specials.includes('picture'))puzzle.pictureMajority=false;
  if(shuffleSeed)puzzle={...puzzle,shuffleSeed};
  let chunks = puzzle.groups.map(group => group.words.filter(w => !(group.childId && w === puzzle.groups.find(g => g.id === group.childId).name)).map((word,i) => ({id:`${group.id}w${i}`,groupId:group.id,atoms:[{id:`${group.id}a${i}`,word}],kind:'normal'})));
  const special = puzzle.specials;
  const target = chunks[Math.min(3,chunks.length-1)][0];
  if (special.includes('frozen')) { target.ice = target.iceTotal = FROZEN_MERGES; target.kind = 'frozen'; }
  if (special.includes('keylock')) {
    for(const [keyGroup,lockGroup,color]of[[0,3,'amber'],[1,2,'azure'],[4,5,'coral']]){
      if(!chunks[keyGroup]||!chunks[lockGroup])continue;
      chunks[keyGroup][0].keyColor=color;chunks[lockGroup][0].lockColor=color;chunks[lockGroup][0].kind='keylock';
    }
  }
  if (special.includes('sealed')) { target.clearsNeeded=1; target.kind='sealed'; }
  if (special.includes('pinlock')) { target.pinsNeeded=2; target.kind='pinlock'; chunks[0][1].pinCarrier=true; chunks[1][1].pinCarrier=true; }
  if (special.includes('backward')) chunks[1][0].kind='backward';
  if (special.includes('cryptic')) {const b=chunks[2][2]; b.kind='cryptic'; b.atoms[0].revealed=Math.min(1,letterCount(b.atoms[0].word));}
  if (special.includes('burst')) { const b=chunks[0][2]; b.timer=9; b.kind='burst'; }
  if (special.includes('linked')) {const real=chunks[0][3];real.link='pair-a';real.kind='linked';chunks[0].push(makeDecoy(puzzle,real.link));}
  if (special.includes('split')) {
    // Split four to eight distinct words, spread across themes. Never inherit a decoy
    // link or duplicate keys, pins, locks, or other one-shot decorations.
    const eligible=(b,group,index)=>b.kind==='normal'&&!b.link&&!b.decoy&&!b.keyColor&&!b.pinCarrier&&isSplittableWord(b.atoms[0].word)&&!(special.includes('screw')&&group===1&&index<=1);
    const pools=chunks.map((chunk,group)=>chunk.filter((b,index)=>eligible(b,group,index)).sort((a,b)=>Number(b.atoms[0].word.length>=5)-Number(a.atoms[0].word.length>=5)));
    const requested=Number.isInteger(puzzle.splitCount)&&puzzle.splitCount>=4&&puzzle.splitCount<=8?puzzle.splitCount:4+hash(`${puzzle.seed}-split-count`)%5;
    const chosen=[];
    for(let i=0;chosen.length<requested&&pools.some(pool=>pool[i]);i++)for(const pool of pools)if(pool[i]&&chosen.length<requested)chosen.push(pool[i]);
    // A legacy/custom phrase-only deck may lack four eligible words. Keep
    // its clues intact rather than splitting a phrase or creating an invalid save.
    if(chosen.length<4){chosen.length=0;puzzle.specials=puzzle.specials.filter(s=>s!=='split');}
    puzzle.splitCount=chosen.length;
    for(const b of chosen){
      const chunk=chunks.find(c=>c.includes(b)),at=chunk.indexOf(b),atom=b.atoms[0],characters=letters(atom.word),cut=Math.floor(characters.length/2);
      chunk.splice(at,1,{...b,id:`${b.id}l`,atoms:[{...atom,part:0,label:characters.slice(0,cut).join('').toLowerCase()}],kind:'split'},
        {...b,id:`${b.id}r`,atoms:[{...atom,part:1,label:characters.slice(cut).join('').toLowerCase()}],kind:'split'});
    }
  }
  if(!special.includes('split'))puzzle.splitCount=0;
  if (special.includes('screw')) {
    const lock=chunks[1][1];lock.kind='screw';lock.screwColor='violet';
    lock.turns=lock.screwTotal=2+hash(`${puzzle.shuffleSeed||puzzle.seed}-screws`)%4;
    // Spread tools across themes with ordinary partners, preferring groups that can already merge.
    const tools=[];
    for(const blocked of[false,true]){
      const pools=chunks.filter(c=>c.some(hardBlocked)===blocked)
        .map(c=>c.filter(b=>!b.decoy&&b.groupId!==lock.groupId&&!isBlocked(b)&&!b.keyColor&&!b.pinCarrier&&b.atoms[0].part!==1));
      for(let i=0;pools.some(pool=>pool[i]);i++)for(const pool of pools)if(pool[i])tools.push(pool[i]);
    }
    for(const b of tools.slice(0,lock.turns))b.driverColor=lock.screwColor;
  }
  if(puzzle.shuffleSeed||special.includes('split')){
    const rng=random(puzzle.shuffleSeed||`${puzzle.seed}-deck`);
    chunks=shuffle(chunks.map(chunk=>shuffle(chunk,rng)),rng);
  }
  const state={schema:SCHEMA,puzzle,bubbles:[],reserve:chunks,solved:[],moves:0,mistakes:0,hints:0,assists:0,
    remaining:challenge||puzzle.mode==='lab'&&special.includes('bonus') ? puzzle.groups.length*3+puzzle.splitCount+7 : null,
    capacity:puzzle.mode==='lab'?12:24,dealVersion:4,pressure:0,pins:0,keys:[],status:'playing',bonusCollected:0};
  if(puzzle.pictureMajority){
    const seen=new Set();
    const candidates=shuffle(state.reserve.flat().filter(b=>pictureEligible(b,pictures)),random(`${puzzle.shuffleSeed||puzzle.seed}-majority-pictures`));
    for(const b of candidates){const glyph=pictures[b.atoms[0].word];if(seen.has(glyph))continue;seen.add(glyph);b.kind='picture';b.picture=glyph;}
    if(seen.size<=state.reserve.flat().length/2){
      puzzle.pictureMajority=false;
      for(const b of candidates)if(b.kind==='picture'){b.kind='normal';delete b.picture;}
    }
  }
  refill(state,{initial:true});
  if(puzzle.pictureMajority&&state.bubbles.filter(b=>b.kind==='picture').length<=state.bubbles.length/2){
    // A custom/legacy deck may be too obstructed to show a real majority.
    // Preserve its mechanics instead of advertising a text-heavy board.
    puzzle.pictureMajority=false;
    for(const b of allBubbles(state))if(b.kind==='picture'){b.kind='normal';delete b.picture;}
  }
  if(special.includes('picture')&&!puzzle.pictureMajority) {
    // Decorate after other mechanics and dealing so a picture never replaces
    // a split, timer, lock, or cryptic clue. Every suitable live clue can win.
    const eligible=b=>pictureEligible(b,pictures);
    const rng=random(`${puzzle.shuffleSeed||puzzle.seed}-picture`);
    const visible=state.bubbles.filter(eligible),waiting=state.reserve.flat().filter(eligible);
    // If all mapped clues carry other mechanics, leave those clues intact.
    const candidates=visible.length?visible:waiting;
    const picture=candidates[Math.floor(rng()*candidates.length)];
    if(picture){
      picture.kind='picture';picture.picture=pictures[picture.atoms[0].word];
      if(!visible.length){
        // The lab previews every group, but its mapped word may be waiting.
        // Exchange equal-load ordinary clues within that group to show the
        // picture immediately without taking away a playable connection.
        const index=state.bubbles.findIndex(b=>b.groupId===picture.groupId&&b.kind==='normal'&&!isBlocked(b)&&!b.keyColor&&!b.driverColor&&!b.pinCarrier&&b.atoms.length===1&&b.atoms[0].part===undefined);
        if(index!==-1){
          const chunk=state.reserve.find(c=>c.includes(picture)),at=chunk.indexOf(picture);
          [state.bubbles[index],chunk[at]]=[picture,state.bubbles[index]];
        }
      }
    }
  }
  if(special.includes('bonus')) state.bubbles.push({id:'bonus',groupId:null,atoms:[],kind:'bonus'});
  return state;
}

const pictureEligible=(b,pictures)=>b.kind==='normal'&&!isBlocked(b)&&!b.decoy&&!b.keyColor&&!b.driverColor&&!b.pinCarrier&&b.atoms.length===1&&b.atoms[0].part===undefined&&pictures[b.atoms[0].word];

export function linkedPartner(bubble,bubbles){
  if(!bubble?.link||bubble.atoms.some(a=>a.part!==undefined))return null;
  return bubbles.find(other=>other.id!==bubble.id&&other.link===bubble.link&&Boolean(other.decoy)!==Boolean(bubble.decoy)&&!other.atoms.some(a=>a.part!==undefined))||null;
}

export function isBlocked(bubble) {
  return Boolean(bubble.ice>0 || bubble.lockColor || bubble.clearsNeeded>0 || bubble.pinsNeeded>0 || bubble.turns>0 || bubble.shell || bubble.hiddenUntil>0);
}
export function blockedReason(b) {
  if(b.ice>0) return `Make ${b.ice} successful merge${b.ice===1?'':'s'} to thaw this bubble.`;
  if(b.lockColor) return `Merge the ${b.lockColor} key bubble to open this lock.`;
  if(b.pinsNeeded>0) return `Collect ${b.pinsNeeded} green pin${b.pinsNeeded===1?'':'s'} by completing their groups.`;
  if(b.clearsNeeded>0) return 'Clear another group to loosen the kelp.';
  if(b.hiddenUntil>0) return 'Clear another group to lift this cloud.';
  if(b.turns>0) return `Merge a ${b.screwColor||'matching'} screwdriver word correctly; ${b.turns} screws remain.`;
  if(b.shell) return 'Tap to break the shell first.';
  return '';
}

export function bubbleLoad(bubble){return bubble.atoms.reduce((sum,atom)=>sum+(atom.part===undefined?1:.5),0);}
export function liveLoad(state){return state.bubbles.reduce((sum,b)=>sum+bubbleLoad(b),0);}
const hardBlocked=b=>Boolean(b.ice>0||b.lockColor||b.turns>0||b.clearsNeeded>0||b.pinsNeeded>0||b.hiddenUntil>0);
const completeAtoms=bubbles=>{const atoms=bubbles.flatMap(b=>b.atoms),ids=new Set(atoms.map(a=>a.id));return ids.size===4&&[...ids].every(id=>{const parts=atoms.filter(a=>a.id===id);return parts.some(a=>a.part===undefined)||parts.some(a=>a.part===0)&&parts.some(a=>a.part===1);});};
// Shells/fragments can be prepared using only the live board; hard locks cannot.
export function clearableGroups(state){return state.puzzle.groups.filter(g=>!state.solved.some(s=>s.id===g.id)&&completeAtoms(state.bubbles.filter(b=>b.groupId===g.id))&&!state.bubbles.some(b=>b.groupId===g.id&&hardBlocked(b)));}
export function countdownReady(state,b,bubbles=state.bubbles){
  const members=bubbles.filter(other=>other.groupId===b.groupId);
  return members.includes(b)&&completeAtoms(members)&&!members.some(hardBlocked);
}

export function refill(state,{initial=false,budget=4}={}) {
  retireKeys(state);
  let room=Math.max(0,state.capacity-liveLoad(state));
  let allowance=Math.min(room,initial?room:budget);
  const dealt=new Map();
  const prerequisite=b=>arrivalDependency(b,state.bubbles)?null:arrivalDependency(b,state.reserve.flat());
  // Plan before mutating: a countdown arrives last, together with every missing
  // constituent (including both fragments and tool prerequisites), or waits.
  const plan=items=>{
    const result=[],visiting=new Set(),waiting=state.reserve.flat();
    const add=b=>{
      if(state.bubbles.includes(b)||result.includes(b))return true;
      if(!waiting.includes(b)||visiting.has(b))return false;
      visiting.add(b);
      const lock=prerequisite(b);
      if(lock&&!add(lock))return false;
      if(typeof b.timer==='number'){
        const members=allBubbles(state).filter(other=>other.groupId===b.groupId);
        if(!completeAtoms(members)||members.some(hardBlocked))return false;
        for(const other of members)if(other!==b&&!add(other))return false;
      }
      visiting.delete(b);result.push(b);return true;
    };
    return items.every(add)?result:null;
  };
  const cost=items=>items?.reduce((sum,b)=>sum+bubbleLoad(b),0)??Infinity;
  const canTake=b=>cost(plan([b]))<=allowance+.001;
  const take=b=>{
    if(!state.reserve.some(chunk=>chunk.includes(b)))return false;
    const incoming=plan([b]);if(cost(incoming)>allowance+.001)return false;
    state.bubbles.push(...incoming);
    state.reserve=state.reserve.map(chunk=>chunk.filter(item=>!incoming.includes(item))).filter(chunk=>chunk.length);
    allowance-=cost(incoming);return true;
  };
  const seed=state.puzzle.shuffleSeed||state.puzzle.seed;
  const groupOrder=state.puzzle.shuffleSeed?shuffle(state.puzzle.groups,random(`${seed}-groups-${state.solved.length}`)):[...state.puzzle.groups];
  // Start picture-led boards with picture-rich complete groups. Ordinary
  // connection-first dealing and later refills otherwise stay unchanged.
  if(initial&&state.puzzle.pictureMajority){
    const score=group=>state.reserve.flat().filter(b=>b.groupId===group.id&&b.kind==='picture').length;
    groupOrder.sort((a,b)=>score(b)-score(a));
  }
  const candidates=()=>groupOrder.filter(g=>!state.solved.some(s=>s.id===g.id)).map(g=>{
    const live=state.bubbles.filter(b=>b.groupId===g.id),waiting=state.reserve.flat().filter(b=>b.groupId===g.id),all=[...live,...waiting];
    const required=plan(waiting);
    return {g,live,waiting,complete:completeAtoms(all),blocked:all.some(hardBlocked),urgent:all.some(b=>typeof b.timer==='number'),cost:cost(required)};
  });
  // First reserve enough space for a playable four, regardless of merge order.
  if(!clearableGroups(state).length){
    const candidate=candidates().filter(c=>c.complete&&!c.blocked&&c.cost<=allowance+.001).sort((a,b)=>Number(b.urgent)-Number(a.urgent)||a.cost-b.cost)[0];
    if(candidate)for(const b of candidate.waiting)take(b);
  }
  if(initial){
    // A second full connection plus a mixture of other themes, including visible obstacles.
    const next=candidates().find(c=>!c.live.length&&c.complete&&!c.blocked&&c.cost<=allowance+.001);
    if(next)for(const b of next.waiting)take(b);
    // Introduce the level's obstacles even when its deck order is shuffled.
    const previewSpecial=b=>!['normal','split'].includes(b.kind);
    const previews=[...state.reserve].sort((a,b)=>Number(b.some(previewSpecial))-Number(a.some(previewSpecial)));
    for(const chunk of previews){
      if(allowance<=0)break;
      const preview=[...chunk].sort((a,b)=>Number(previewSpecial(b))-Number(previewSpecial(a)));
      for(const b of preview.slice(0,2))take(b);
    }
  }
  // Outside the guaranteed connection, deal one clue from each of several themes.
  // This seeds future connections instead of repeatedly dropping ready-made fours.
  const order=shuffle(state.puzzle.groups.map(g=>g.id),random(`${seed}-deal-${state.moves}-${state.solved.length}`));
  while(allowance>0&&state.reserve.length){
    const choices=state.reserve.map(chunk=>chunk.find(canTake)).filter(Boolean)
      .sort((a,b)=>(dealt.get(a.groupId)||0)-(dealt.get(b.groupId)||0)||order.indexOf(a.groupId)-order.indexOf(b.groupId));
    if(!choices.length)break;
    const b=choices[0];if(take(b))dealt.set(b.groupId,(dealt.get(b.groupId)||0)+1);
  }
}

export function upgradeDealing(state){
  state.pressure=0;
  state.puzzle.specials=canonicalSpecials(state.puzzle.specials).filter(s=>s!=='bonus'||state.remaining!==null);
  if(state.puzzle.mode==='lab')state.puzzle.title=SPECIALS.find(s=>s.id===state.puzzle.specials[0])?.name||'Word bubbles';
  if(state.remaining===null){state.bubbles=state.bubbles.filter(b=>b.kind!=='bonus');state.reserve=state.reserve.map(c=>c.filter(b=>b.kind!=='bonus')).filter(c=>c.length);}
  for(const group of state.puzzle.groups){
    const old=group.name,name=themeName(old);if(old===name)continue;
    const parent=state.puzzle.groups.find(g=>g.id===group.parentId);
    // A child label is also a word in its parent. Keep that ledger consistent,
    // and retain a legacy clue if shortening it would introduce a duplicate.
    if(parent){
      if(state.puzzle.groups.some(g=>g.words.some(w=>w.toLowerCase()===name.toLowerCase())))continue;
      parent.words=parent.words.map(w=>w===old?name:w);
      const solvedParent=state.solved.find(g=>g.id===parent.id);if(solvedParent)solvedParent.words=[...parent.words];
      for(const b of allBubbles(state).filter(b=>b.groupId===parent.id))for(const atom of b.atoms)if(atom.word===old){
        atom.word=name;if(atom.revealed!==undefined)atom.revealed=Math.min(atom.revealed,letterCount(name));
      }
    }
    group.name=name;const solved=state.solved.find(g=>g.id===group.id);if(solved)solved.name=name;
  }
  for(const b of allBubbles(state)){
    // Normalize display only: never add new fragments to an in-progress save.
    for(const atom of b.atoms)if(atom.part!==undefined)atom.label=atom.label.toLowerCase();
    if(b.kind==='theme')b.kind='normal';
    if(b.shell||b.kind==='crack'){delete b.shell;if(b.kind==='crack')b.kind='normal';}
    if(b.kind==='hidden'||b.hiddenUntil>0){b.kind='cryptic';b.atoms[0].revealed??=0;delete b.hiddenUntil;}
    // Existing frozen saves used group clears. Convert only their remaining ice.
    if(b.ice>0&&b.iceTotal===undefined)b.ice=b.iceTotal=b.ice*FROZEN_MERGES;
    if((b.hiddenUntil>0||b.kind==='cryptic')&&b.atoms[0].revealed===undefined){b.atoms[0].revealed=0;delete b.hiddenUntil;}
    // Dictionary additions can give an older decoy a new meaning. Keep the
    // fixed clue ledger intact and refresh only that foreign word if needed.
    if(b.decoy&&!decoyPool(state.puzzle).includes(b.atoms[0].word))b.atoms[0].word=makeDecoy(state.puzzle,b.link).atoms[0].word;
  }
  // Old split decoration copied a real clue's link onto both fragments.
  // Detach fragments without changing their words, progress, or identities.
  for(const b of allBubbles(state))if(b.atoms.some(a=>a.part!==undefined))delete b.link;
  const orphanDecoys=new Set(allBubbles(state).filter(b=>b.decoy&&!allBubbles(state).some(real=>!real.decoy&&real.link===b.link)).map(b=>b.id));
  state.bubbles=state.bubbles.filter(b=>!orphanDecoys.has(b.id));
  state.reserve=state.reserve.map(c=>c.filter(b=>!orphanDecoys.has(b.id))).filter(c=>c.length);
  // Preserve every real clue in older linked saves; add a separate decoy.
  const links=new Set(allBubbles(state).filter(b=>b.link).map(b=>b.link));
  for(const link of links){
    const pair=allBubbles(state).filter(b=>b.link===link);if(pair.some(b=>b.decoy))continue;
    const real=pair[0];for(const b of pair.slice(1)){delete b.link;if(b.kind==='linked')b.kind='normal';}
    const decoy=makeDecoy(state.puzzle,link);
    if(state.bubbles.includes(real)&&liveLoad(state)<32){state.bubbles.push(decoy);state.capacity=Math.max(state.capacity,liveLoad(state));}
    else state.reserve.push([decoy]);
  }
  const migratedScrews=upgradeScrews(state);
  // Older partial joins carried their key until the group cleared. Apply the
  // new trigger once, and bring any waiting lock onto an existing key's board.
  useKeys(state,state.bubbles.filter(b=>b.keyColor&&b.atoms.length>1));
  // A saved screwdriver remains available until an actual successful action.
  retireKeys(state);
  for(const key of state.bubbles.filter(b=>b.keyColor||b.driverColor))if(!toolLock(key,state.bubbles)){
    const lock=toolLock(key,state.reserve.flat());if(!lock)continue;
    state.reserve=state.reserve.map(chunk=>chunk.filter(b=>b!==lock)).filter(chunk=>chunk.length);state.bubbles.push(lock);
    lock.position={x:.5,y:.25};
    state.capacity=Math.max(state.capacity,liveLoad(state));
  }
  if(migratedScrews&&state.status==='playing'&&!clearableGroups(state).length){
    // Old dealers counted a tappable screw group as their guaranteed connection.
    // Supply the cheapest free connection without taking away any seen clues.
    const all=allBubbles(state),costs=state.puzzle.groups.map(g=>{
      const members=all.filter(b=>b.groupId===g.id);
      if(!completeAtoms(members)||members.some(hardBlocked))return Infinity;
      const waiting=state.reserve.flat().filter(b=>b.groupId===g.id);
      const required=new Set([...waiting,...waiting.map(b=>toolLock(b,state.bubbles)?null:toolLock(b,state.reserve.flat())).filter(Boolean)]);
      return [...required].reduce((sum,b)=>sum+bubbleLoad(b),0);
    }),cost=Math.min(...costs);
    if(Number.isFinite(cost)&&liveLoad(state)+cost<=32){state.capacity=Math.max(state.capacity,liveLoad(state)+cost);refill(state,{budget:cost});}
  }
  upgradeCountdowns(state);
  if(state.dealVersion===4)return state;
  // Shorten older oversized decks using only untouched, ordinary reserve groups.
  // Keep every seen word, completed connection, special, and parent/child dependency.
  const protectedIds=new Set([...state.bubbles.map(b=>b.groupId),...state.solved.map(g=>g.id),...state.puzzle.groups.filter(g=>g.parentId||g.childId).map(g=>g.id)]);
  for(const g of [...state.puzzle.groups].reverse()){
    if(state.puzzle.groups.length<=17)break;
    if(protectedIds.has(g.id)||state.reserve.flat().some(b=>b.groupId===g.id&&b.kind!=='normal'))continue;
    state.puzzle.groups=state.puzzle.groups.filter(group=>group.id!==g.id);
    state.reserve=state.reserve.map(chunk=>chunk.filter(b=>b.groupId!==g.id)).filter(chunk=>chunk.length);
  }
  const previous=state.dealVersion;state.dealVersion=4;
  if(previous===3)return state;
  state.capacity=state.puzzle.mode==='lab'?12:24;
  if(state.status==='won')return state;
  const all=allBubbles(state),bonuses=all.filter(b=>b.kind==='bonus');
  state.reserve=[...state.puzzle.groups.map(g=>all.filter(b=>b.groupId===g.id)),all.filter(b=>b.decoy)].filter(chunk=>chunk.length);
  state.bubbles=[];refill(state,{initial:true});state.bubbles.push(...bonuses);
  return state;
}
function allBubbles(state){return [...state.bubbles,...state.reserve.flat()];}
// A final thaw/unlock can release only the waiting timer between clears;
// ordinary clues still wait for the next refill, and capacity is never raised.
function releaseCountdowns(state){
  for(const b of state.reserve.flat().filter(b=>typeof b.timer==='number')){
    if(liveLoad(state)+bubbleLoad(b)>state.capacity+.001||!countdownReady(state,b,[...state.bubbles,b]))continue;
    const dependency=arrivalDependency(b,state.reserve.flat());
    if(dependency&&!arrivalDependency(b,state.bubbles))continue;
    state.reserve=state.reserve.map(chunk=>chunk.filter(other=>other!==b)).filter(chunk=>chunk.length);
    state.bubbles.push(b);
  }
}
function upgradeCountdowns(state){
  let repairedExpiration=false;
  for(const b of [...state.bubbles].filter(b=>typeof b.timer==='number'&&!countdownReady(state,b))){
    state.bubbles=state.bubbles.filter(other=>other!==b);
    const chunk=state.reserve.find(chunk=>chunk.some(other=>other.groupId===b.groupId));
    if(chunk)chunk.push(b);else state.reserve.push([b]);
    delete b.position;
  }
  // Old dealers spent timers even in reserve. Keep real progress, but repair a
  // countdown that already expired before its group could ever be played.
  for(const b of state.reserve.flat())if(typeof b.timer==='number'&&b.timer<=0){b.timer=9;repairedExpiration=true;}
  if(repairedExpiration&&state.status==='paused'&&(state.remaining===null||state.remaining>0)&&!state.bubbles.some(b=>typeof b.timer==='number'&&b.timer<=0))state.status='playing';
  releaseCountdowns(state);
}

function decoyPool(puzzle){
  const themes=getCatalog(puzzle).themes;
  // Old boards keep their displayed labels. Resolve renamed categories only
  // for membership checks so a refreshed decoy still fits none of their pools.
  const original=g=>themes.find(t=>t.name===g.name)||themes.find(t=>t.legacyNames?.includes(g.name));
  const excluded=new Set(puzzle.groups.flatMap(g=>[g.name,...g.words,...(original(g)?.words||[])]).map(w=>w.toLowerCase()));
  return [...new Set(themes.flatMap(t=>t.words))].filter(w=>!excluded.has(w.toLowerCase()));
}
function makeDecoy(puzzle,link){
  const pool=decoyPool(puzzle),word=pool[hash(`${puzzle.shuffleSeed||puzzle.seed}-${link}-decoy`)%pool.length];
  return {id:`decoy-${link}`,groupId:null,atoms:[{id:`decoy-${link}-atom`,word}],kind:'linked',link,decoy:true};
}
export function arrivalDependency(b,bubbles){
  return b.decoy?bubbles.find(other=>other.link===b.link&&!other.decoy):toolLock(b,bubbles);
}
// Both the dealer and arrival animation use the same tool dependency.
export function toolLock(tool,bubbles){
  return bubbles.find(lock=>tool.keyColor&&lock.lockColor===tool.keyColor||tool.driverColor&&lock.turns>0&&lock.screwColor===tool.driverColor);
}
function upgradeScrews(state){
  const all=allBubbles(state),colors=new Set(all.flatMap(b=>[b.keyColor,b.lockColor,b.screwColor]).filter(Boolean));
  const legacy=all.filter(b=>b.turns>0&&!b.screwColor);
  for(const lock of legacy){
    lock.screwColor=KEY_COLORS.find(c=>!colors.has(c))||'violet';colors.add(lock.screwColor);
    const tools=all.filter(b=>!b.decoy&&b.groupId!==lock.groupId&&!isBlocked(b)&&!b.keyColor&&!b.driverColor&&!b.pinCarrier&&b.atoms[0]?.part!==1)
      .sort((a,b)=>Number(a.atoms.length>1)-Number(b.atoms.length>1));
    // A late legacy save may have no other words left to carry tools. Keep its
    // remaining clues playable without inventing or discarding words.
    lock.turns=Math.min(lock.turns,tools.length,5);lock.screwTotal=Math.max(2,lock.turns);
    for(const b of tools.slice(0,lock.turns))b.driverColor=lock.screwColor;
    if(!lock.turns){delete lock.screwColor;if(!isBlocked(lock))lock.kind='normal';}
  }
  return legacy.length>0;
}
function retireKeys(state){
  const all=allBubbles(state);
  for(const b of all)if(b.keyColor&&(state.keys.includes(b.keyColor)||!all.some(lock=>lock.lockColor===b.keyColor)))delete b.keyColor;
  for(const b of all)if(b.driverColor&&!toolLock(b,all))delete b.driverColor;
}
function useDrivers(state,bubbles){
  const colors=bubbles.map(b=>b.driverColor).filter(Boolean);
  for(const b of bubbles)delete b.driverColor;
  for(const color of colors){
    for(const lock of allBubbles(state))if(lock.screwColor===color&&lock.turns>0){
      lock.turns--;if(!lock.turns){delete lock.screwColor;if(!isBlocked(lock))lock.kind='normal';}
    }
  }
  return colors;
}
export const canUseDriver=b=>Boolean(b?.driverColor&&!isBlocked(b));
function useKeys(state,bubbles){
  const colors=new Set(bubbles.map(b=>b.keyColor).filter(Boolean));
  for(const b of bubbles)delete b.keyColor;
  for(const color of colors){
    if(!state.keys.includes(color))state.keys.push(color);
    for(const lock of allBubbles(state))if(lock.lockColor===color){delete lock.lockColor;if(!isBlocked(lock))lock.kind='normal';}
  }
  return [...colors];
}
function thawIce(state){
  for(const b of allBubbles(state))if(b.ice>0){
    b.ice--;
    if(!isBlocked(b)&&b.kind==='frozen')b.kind='normal';
  }
}
export const letterCount=word=>[...word].filter(c=>/\p{L}/u.test(c)).length;
export function revealLetters(state){
  for(const b of allBubbles(state)){
    for(const atom of b.atoms)if(atom.revealed!==undefined)atom.revealed=Math.min(letterCount(atom.word),atom.revealed+1);
    if(['hidden','cryptic'].includes(b.kind)&&b.atoms.every(a=>a.revealed>=letterCount(a.word)))b.kind='normal';
  }
}
export function atomText(atom){
  if(atom.part!==undefined)return atom.label.toLowerCase();
  if(atom.revealed===undefined||atom.revealed>=letterCount(atom.word))return atom.word;
  let index=0;
  // A stable scattered reveal avoids giving away every word from its prefix alone.
  const order=shuffle(Array.from({length:letterCount(atom.word)},(_,i)=>i),random(atom.id));
  const visible=new Set(order.slice(0,atom.revealed));
  return [...atom.word].map(c=>/\p{L}/u.test(c)?visible.has(index++)?c:'·':c).join('');
}
function spendMove(state,activeTimers) {
  state.moves++;
  if(state.remaining!==null) state.remaining--;
  for(const b of state.bubbles)if(typeof b.timer==='number'&&activeTimers.has(b.groupId))b.timer--;
}
function checkFailure(state) {
  if(state.status==='won') return;
  if(state.remaining!==null && state.remaining<=0) state.status='paused';
  if(state.bubbles.some(b=>typeof b.timer==='number'&&b.timer<=0&&countdownReady(state,b))) state.status='paused';
}
function unlink(state, bubble) {
  if(!bubble.link) return [];
  const link=bubble.link;
  const popped=allBubbles(state).filter(b=>b.link===link&&b.decoy).map(b=>b.id);
  state.bubbles=state.bubbles.filter(b=>!popped.includes(b.id));state.reserve=state.reserve.map(c=>c.filter(b=>!popped.includes(b.id))).filter(c=>c.length);
  for(const b of allBubbles(state)) if(b.link===link) { delete b.link; if(b.kind==='linked') b.kind='normal'; }
  return popped;
}
function clearGroup(state, bubble) {
  const group=state.puzzle.groups.find(g=>g.id===bubble.groupId);
  useKeys(state,[bubble]);useDrivers(state,[bubble]);const completed=structuredClone(bubble);
  state.bubbles=state.bubbles.filter(b=>b.id!==bubble.id);
  state.solved.push({id:group.id,name:group.name,words:[...group.words]});
  state.pressure=Math.max(0,state.pressure-3);
  if(bubble.pinCarrier) state.pins+=bubble.pinCarrier===true?1:bubble.pinCarrier;
  let released=0;
  for(const b of allBubbles(state)) {
    const was=isBlocked(b);
    if(b.clearsNeeded>0) b.clearsNeeded--;
    if(b.hiddenUntil>0) b.hiddenUntil--;
    if(b.lockColor && state.keys.includes(b.lockColor)) delete b.lockColor;
    if(b.pinsNeeded>0 && bubble.pinCarrier) b.pinsNeeded=Math.max(0,b.pinsNeeded-(bubble.pinCarrier===true?1:bubble.pinCarrier));
    if(was&&!isBlocked(b)) {b.kind='normal';released++;}
  }
  if(group.parentId) {
    state.bubbles.push({id:`${group.id}-theme`,groupId:group.parentId,atoms:[{id:`${group.id}-theme-atom`,word:group.name}],kind:'normal'});
  }
  refill(state,{budget:group.parentId?3:4});
  if(state.solved.length===state.puzzle.groups.length) {state.status='won';state.bubbles=state.bubbles.filter(b=>b.kind!=='bonus');}
  return {group,released,completed,returnedId:group.parentId?`${group.id}-theme`:null};
}

export function merge(state, sourceId, targetId, {visibleIds}={}) {
  if(state.status!=='playing') return {ok:false,message:'Take a little breathing room to continue.'};
  const a=state.bubbles.find(b=>b.id===sourceId),b=state.bubbles.find(b=>b.id===targetId);
  if(!a||!b||a.id===b.id) return {ok:false,message:'Choose two bubbles.'};
  const visible=visibleIds?state.bubbles.filter(b=>visibleIds.has(b.id)):state.bubbles;
  const activeTimers=new Set(state.bubbles.filter(b=>typeof b.timer==='number'&&countdownReady(state,b,visible)).map(b=>b.groupId));
  const aFragment=a.atoms.some(x=>x.part!==undefined),bFragment=b.atoms.some(x=>x.part!==undefined);
  const sameFragments=aFragment&&bFragment&&a.atoms[0].id===b.atoms[0].id&&a.atoms[0].part!==b.atoms[0].part;
  const wordPair=a.kind!=='bonus'&&b.kind!=='bonus',blocked=isBlocked(a)||isBlocked(b);
  const mismatch=a.decoy||b.decoy||a.groupId!==b.groupId||((aFragment||bFragment)&&!sameFragments);
  if(!wordPair||blocked||mismatch){
    if(!wordPair)return {ok:false,message:'Choose two word bubbles.'};
    if(blocked)return {ok:false,blocked:true,message:blockedReason(isBlocked(a)?a:b)};
    spendMove(state,activeTimers);state.mistakes++;checkFailure(state);
    return {ok:false,mismatch:true,message:aFragment||bFragment?'Join the two pieces of the same word first.':'Different connections. Try another pair.'};
  }
  // Tools activate only after the word join has passed every semantic and lock check.
  const usedDrivers=useDrivers(state,[a,b].filter(canUseDriver));
  // Positional merging keeps the bubble under the player's drop target.
  const usedKeys=useKeys(state,[a,b]);
  const carry={pinCarrier:(Number(a.pinCarrier)||0)+(Number(b.pinCarrier)||0),timer:Math.min(a.timer??Infinity,b.timer??Infinity)};
  const poppedDecoys=[...unlink(state,a),...unlink(state,b)];
  for(const atom of [...a.atoms,...b.atoms])if(atom.revealed!==undefined)atom.revealed=letterCount(atom.word);
  b.atoms=sameFragments?[{id:b.atoms[0].id,word:b.atoms[0].word}]:[...b.atoms,...a.atoms];
  b.kind='normal';
  if(carry.pinCarrier)b.pinCarrier=carry.pinCarrier;
  if(Number.isFinite(carry.timer)) {b.timer=carry.timer;b.kind='burst';}
  state.bubbles=state.bubbles.filter(x=>x.id!==a.id);
  revealLetters(state);
  thawIce(state);
  spendMove(state,activeTimers);
  let cleared=null;
  if(b.atoms.length===4&&!b.atoms.some(x=>x.part!==undefined)) cleared=clearGroup(state,b);
  releaseCountdowns(state);checkFailure(state);
  return {ok:true,bubbleId:b.id,assembled:sameFragments,cleared,usedKeys,usedDrivers,poppedDecoys,message:cleared?`${cleared.group.name} · a lovely connection${cleared.released?' · bubbles released':''}`:sameFragments?`${b.atoms[0].word} · better together`:`${b.atoms.length} of 4 connected`};
}

export function tapSpecial(state,id) {
  const b=state.bubbles.find(b=>b.id===id);
  if(!b||state.status!=='playing')return {ok:false};
  if(b.kind==='bonus'&&state.remaining!==null) {
    state.bubbles=state.bubbles.filter(x=>x.id!==id);state.bonusCollected++;
    if(state.remaining!==null)state.remaining+=5;
    refill(state);return {ok:true,message:state.remaining===null?'A little bonus, just for you.':'+5 moves. A little room to breathe.'};
  }
  return {ok:false,message:blockedReason(b)};
}

export function getHint(state) {
  const groups=state.puzzle.groups.filter(g=>!state.solved.some(s=>s.id===g.id));
  const group=groups.find(g=>state.bubbles.filter(b=>b.groupId===g.id&&!isBlocked(b)).reduce((n,b)=>n+b.atoms.filter(a=>a.part===undefined).length,0)===4)
    || groups.find(g=>state.bubbles.some(b=>b.groupId===g.id&&!isBlocked(b))) || groups[0];
  if(!group)return null;
  state.hints++;
  return {group,ids:state.bubbles.filter(b=>b.groupId===group.id).map(b=>b.id),message:`Look for ${group.name.toLowerCase()}.`};
}

export function magnet(state) {
  if(state.status!=='playing')return {ok:false};
  const hint=getHint(state);if(!hint)return {ok:false};
  const group=hint.group;
  // Assistance explicitly bypasses blockers and assembles fragments; keys/pins still trigger.
  const members=allBubbles(state).filter(b=>b.groupId===group.id);
  const words=new Map();
  for(const b of members)for(const atom of b.atoms)words.set(atom.id,{id:atom.id,word:atom.word});
  if(words.size!==4) return {ok:false,message:'Complete the smaller theme first to reveal its parent word.'};
  const poppedDecoys=members.flatMap(b=>unlink(state,b));
  useKeys(state,members);
  useDrivers(state,members);
  const bubble={id:`magnet-${group.id}`,groupId:group.id,atoms:[...words.values()],kind:'normal',pinCarrier:members.reduce((n,b)=>n+(Number(b.pinCarrier)||0),0)};
  state.bubbles=state.bubbles.filter(b=>b.groupId!==group.id);
  state.reserve=state.reserve.map(chunk=>chunk.filter(b=>b.groupId!==group.id)).filter(chunk=>chunk.length);
  state.bubbles.push(bubble);state.assists++;
  revealLetters(state);
  thawIce(state);
  const cleared=clearGroup(state,bubble);checkFailure(state);
  return {ok:true,cleared,poppedDecoys,message:`${group.name} · brought together for you`};
}

export function moreRoom(state) {
  if(state.status==='won')return;
  if(state.remaining!==null)state.remaining+=5;
  const previousCapacity=state.capacity;state.capacity=Math.min(state.puzzle.mode==='lab'?20:26,state.capacity+2);state.pressure=0;
  for(const b of allBubbles(state))if(typeof b.timer==='number')b.timer=Math.max(9,b.timer);
  state.status='playing';refill(state,{budget:state.capacity-previousCapacity});
}

export function bubbleText(b) {
  if(b.kind==='bonus')return '+5';
  if(b.lockColor)return '•••';
  if(b.hiddenUntil>0)return '???';
  if(b.atoms.some(a=>a.part!==undefined))return b.atoms.map(atomText).join('');
  if(b.kind==='picture')return b.picture||PICTURES[b.atoms[0].word]||b.atoms[0].word;
  if(b.kind==='backward')return [...b.atoms[0].word].reverse().join('');
  return b.atoms.map(atomText).join(' · ');
}
export function specialLabel(b) {
  if(b.ice>0)return `❄ ${b.ice}`;
  if(b.lockColor)return `🔒 ${b.lockColor}`;
  if(b.pinsNeeded>0)return `📌 ${b.pinsNeeded}`;
  if(b.clearsNeeded>0)return '🌿';
  if(b.turns>0)return `⊕ ${b.turns}`;
  if(b.hiddenUntil>0)return '☁';
  if(b.keyColor)return `🔑 ${b.keyColor}`;
  if(b.driverColor)return `🪛 ${b.driverColor}`;
  if(b.pinCarrier)return '📌 green';
  if(typeof b.timer==='number')return `✹ ${b.timer}`;
  if(b.atoms.some(a=>a.part!==undefined))return '◒';
  if(b.kind==='backward')return '↶';
  if(b.kind==='cryptic')return '∴';
  return '';
}

export function validateState(value) {
  if(!value||value.schema!==SCHEMA||!value.puzzle||!Array.isArray(value.puzzle.groups)||value.puzzle.groups.length<1||value.puzzle.groups.length>24)return false;
  if(!Array.isArray(value.bubbles)||!Array.isArray(value.reserve)||!value.reserve.every(Array.isArray)||!Array.isArray(value.solved))return false;
  if(!['playing','paused','won'].includes(value.status)||!Number.isInteger(value.moves)||value.moves<0||!Number.isFinite(value.capacity)||value.capacity<4||value.capacity>32)return false;
  if(value.remaining!==null&&!Number.isFinite(value.remaining))return false;
  const p=value.puzzle;
  if(p.shuffleSeed!==undefined&&(typeof p.shuffleSeed!=='string'||!p.shuffleSeed.length||p.shuffleSeed.length>128))return false;
  if(!['journey','daily','endless','lab'].includes(p.mode)||typeof p.id!=='string'||typeof p.seed!=='string'||typeof p.title!=='string'||!Number.isInteger(p.level)||p.level<1||!Number.isInteger(p.round)||p.round<1||typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Array.isArray(p.specials)||!p.specials.every(s=>['hidden','crack','octopus'].includes(s)||SPECIALS.some(x=>x.id===s)))return false;
  // Legacy saves omit this original-deck metadata; assembled pairs cannot be inferred.
  if(p.pictureMajority!==undefined&&typeof p.pictureMajority!=='boolean')return false;
  if(p.splitCount!==undefined&&(!Number.isInteger(p.splitCount)||(p.specials.includes('split')?p.splitCount<4||p.splitCount>8:p.splitCount!==0)))return false;
  if(!Array.isArray(value.keys)||!value.keys.every(color=>KEY_COLORS.includes(color))||!Number.isFinite(value.pressure)||!Number.isFinite(value.pins)||!Number.isFinite(value.mistakes)||!Number.isFinite(value.hints)||!Number.isFinite(value.assists))return false;
  if(!p.groups.every(g=>g&&typeof g.id==='string'))return false;
  const groupIds=new Set(value.puzzle.groups.map(g=>g.id));
  if(groupIds.size!==value.puzzle.groups.length||!value.puzzle.groups.every(g=>typeof g.id==='string'&&typeof g.name==='string'&&Array.isArray(g.words)&&g.words.length===4&&g.words.every(w=>typeof w==='string'&&w.length<100)))return false;
  if(!value.solved.every(g=>groupIds.has(g.id)&&typeof g.name==='string'&&Array.isArray(g.words)&&g.words.every(w=>typeof w==='string'))||new Set(value.solved.map(g=>g.id)).size!==value.solved.length)return false;
  const list=[...value.bubbles,...value.reserve.flat()];
  if(list.length>110||new Set(list.map(b=>b?.id)).size!==list.length)return false;
  const kinds=new Set(['normal','picture','frozen','hidden','keylock','sealed','pinlock','screw','crack','backward','cryptic','burst','linked','split','theme','bonus']);
  if(!list.every(b=>b&&typeof b.id==='string'&&kinds.has(b.kind)&&Array.isArray(b.atoms)&&b.atoms.length<=4
    && (b.kind==='bonus'?b.atoms.length===0:b.decoy?b.decoy===true&&b.groupId===null&&b.kind==='linked'&&b.atoms.length===1&&typeof b.link==='string'&&list.some(other=>!other.decoy&&other.link===b.link):groupIds.has(b.groupId)&&b.atoms.length>0)
    && ['ice','clearsNeeded','pinsNeeded','hiddenUntil','turns','timer'].every(key=>b[key]===undefined||Number.isFinite(b[key]))
    && ['keyColor','lockColor','driverColor','screwColor'].every(key=>b[key]===undefined||KEY_COLORS.includes(b[key]))
    && (b.screwTotal===undefined||Number.isInteger(b.screwTotal)&&b.screwTotal>=2&&b.screwTotal<=5&&Number.isInteger(b.turns)&&b.turns>=0&&b.turns<=b.screwTotal)
    && (b.iceTotal===undefined||Number.isInteger(b.iceTotal)&&b.iceTotal>0&&Number.isInteger(b.ice)&&b.ice>=0&&b.ice<=b.iceTotal)
    && b.atoms.every(a=>a&&typeof a.id==='string'&&typeof a.word==='string'&&a.word.length<100
      && (b.decoy?!p.groups.some(g=>[g.name,...g.words].some(w=>w.toLowerCase()===a.word.toLowerCase())):p.groups.find(g=>g.id===b.groupId)?.words.includes(a.word))
      && (a.revealed===undefined||Number.isInteger(a.revealed)&&a.revealed>=0&&a.revealed<=letterCount(a.word))
      && (a.part===undefined||((a.part===0||a.part===1)&&typeof a.label==='string')))))return false;
  if(p.splitCount!==undefined&&new Set(list.flatMap(b=>b.atoms.filter(a=>a.part!==undefined).map(a=>a.id))).size>p.splitCount)return false;
  // Validate the word ledger too: no discarded words, duplicated groups, or foreign atoms.
  for(const g of p.groups){
    const solved=value.solved.find(s=>s.id===g.id),atoms=list.filter(b=>b.groupId===g.id).flatMap(b=>b.atoms);
    if(solved){if(atoms.length||solved.name!==g.name||JSON.stringify(solved.words)!==JSON.stringify(g.words))return false;continue;}
    const expected=g.words.filter(w=>!(g.childId&&!value.solved.some(s=>s.id===g.childId)&&w===p.groups.find(child=>child.id===g.childId)?.name));
    if(new Set(atoms.map(a=>a.word)).size!==expected.length||!expected.every(w=>atoms.some(a=>a.word===w)))return false;
    for(const word of expected){const matches=atoms.filter(a=>a.word===word);if(matches.length===1){if(matches[0].part!==undefined)return false;}
      else if(matches.length!==2||matches[0].id!==matches[1].id||new Set(matches.map(a=>a.part)).size!==2||!matches.every(a=>a.part===0||a.part===1))return false;}
  }
  return true;
}
