// Labels and dictionary clues use the same key, including composed/decomposed
// accents and incidental spacing. Keep the original display text unchanged.
export const normalizeLabel=word=>word.normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
const fold=normalizeLabel;

// A category can return wherever its name is an ordinary dictionary clue.
// No connection recipes or companion words are stored separately from the pools.
export function assembleThemeChain(themes,{rng=Math.random,maxDifficulty=3,maxDepth=2,minDepth=1,usedWords=new Set(),usedThemes=new Set()}={}){
  const used=new Set([...usedWords].map(fold)),eligible=themes.filter(t=>t.difficulty<=maxDifficulty&&!usedThemes.has(t.id)&&!used.has(fold(t.name)));
  const byWord=new Map();
  for(const parent of eligible)for(const word of parent.words){
    const key=fold(word);if(!byWord.has(key))byWord.set(key,[]);byWord.get(key).push(parent);
  }
  const paths=[];
  function visit(path){
    if(path.length>1)paths.push(path);
    if(path.length>maxDepth)return;
    for(const parent of byWord.get(fold(path.at(-1).name))||[]){
      if(path.some(t=>t.id===parent.id||fold(t.name)===fold(parent.name)))continue;
      visit([...path,parent]);
    }
  }
  if(maxDepth<1)return [];
  for(const root of eligible)visit([root]);
  const candidates=mix(paths,rng).sort((a,b)=>Number(b.length-1>=minDepth)-Number(a.length-1>=minDepth));
  for(const path of candidates){
    // Reserve every returning category before choosing words, so a later label
    // cannot duplicate a clue or create a dependency back into its own chain.
    const reserved=new Set([...used,...path.map(t=>fold(t.name))]);
    const clues=distinctClues(path,reserved,rng);
    if(clues)return path.map((theme,i)=>({...theme,words:i?[path[i-1].name,...clues[i]]:clues[i]}));
  }
  return [];
}
function distinctClues(path,reserved,rng){
  const memberships=new Map();
  for(const theme of path)for(const word of theme.words){
    const key=fold(word);if(!memberships.has(key))memberships.set(key,new Set());memberships.get(key).add(theme.id);
  }
  // Returning labels are future clues too. A label must fit its immediate
  // parent alone, even while that label has not appeared on the live board.
  for(let i=1;i<path.length;i++)if(memberships.get(fold(path[i-1].name))?.size!==1)return null;
  const pools=path.map(theme=>mix(theme.words.filter(word=>!reserved.has(fold(word))&&memberships.get(fold(word)).size===1),rng));
  // Exclusive pools cannot compete for a clue. Sharing unused catalog words
  // is fine; only the four words actually chosen must have one membership.
  if(pools.some((pool,i)=>pool.length<(i?3:4)))return null;
  return pools.map((pool,i)=>pool.slice(0,i?3:4));
}
function mix(items,rng){
  const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;
}
