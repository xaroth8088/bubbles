const fold=word=>word.trim().toLowerCase();

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
  const pools=path.map(theme=>mix(theme.words.filter(w=>!reserved.has(fold(w))),rng));
  const slots=path.flatMap((_,i)=>Array(i?3:4).fill(i)),owner=new Map(),assigned=[];
  // Match word slots to distinct clues. Reassign an earlier clue when a later
  // group needs it, rather than rejecting a valid chain after a greedy choice.
  function assign(slot,seen){
    for(const word of pools[slots[slot]]){
      const key=fold(word);if(seen.has(key))continue;seen.add(key);
      const previous=owner.get(key);
      if(previous===undefined||assign(previous,seen)){owner.set(key,slot);assigned[slot]=word;return true;}
    }
    return false;
  }
  for(let slot=0;slot<slots.length;slot++)if(!assign(slot,new Set()))return null;
  return path.map((_,i)=>assigned.filter((_,slot)=>slots[slot]===i));
}
function mix(items,rng){
  const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;
}
