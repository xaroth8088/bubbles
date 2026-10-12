// Compatibility exports for the default English dictionary. New puzzles use getCatalog.
import {getCatalog} from './catalog.js';
export {PACKS, ALL_PACK_IDS, getCatalog, normalizePackIds, normalizeLanguage} from './catalog.js';
const catalog = getCatalog();
export const THEMES = catalog.themes;
export const PICTURES = catalog.pictures;
export const LIBRARY_STATS = catalog.stats;
// Kept for legacy save normalization; current JSON themes already have concise names.
export function themeName(name){
  const shorter=name.replace(/^(?:Types|Kinds) of\s+/i,'').replace(/\s+Types$/i,'');
  return shorter===name?name:shorter.charAt(0).toUpperCase()+shorter.slice(1);
}

export const SPECIALS = Object.freeze([
  {id:'picture',icon:'🍎',name:'Picture',description:'An emoji stands in for a word. That word can have more than one meaning.',tip:'A picture of a bat can mean the animal or the sports tool.',level:2},
  {id:'frozen',icon:'❄️',name:'Frozen',description:'Four successful merges thaw the ice. Partial and split-word joins count too.',tip:'Cracks deepen and ice fragments fall away with each successful join.',level:3},
  {id:'split',icon:'◒',name:'Split word',description:'Join the two fragments before sorting the whole word.',tip:'Drag matching fragments together in either order.',level:4},
  {id:'cryptic',icon:'∴',name:'Dots',description:'Dots conceal letters that emerge as you make connections.',tip:'Every successful merge reveals a letter. Connecting this word reveals it completely.',level:5},
  {id:'keylock',icon:'🔐',name:'Lock & key',description:'Merge a key bubble to reveal the word in the lock of the same color.',tip:'Several colors can appear together. Locks arrive before their keys; a successful partial merge unlocks immediately.',level:6},
  {id:'screw',icon:'⊕',name:'Screw',description:'Merge a screwdriver word correctly, or drag its tool onto the matching screw ring.',tip:'Successful word joins and matching-ring contacts use the tool once. Failed word joins keep it. The ring arrives before its tools.',level:7},
  {id:'backward',icon:'↶',name:'Backward',description:'Read the letters from right to left.',tip:'The word is reversed; its meaning has not changed.',level:8},
  {id:'linked',icon:'⛓',name:'Linked',description:'Two words travel together, but one is a secret decoy.',tip:'Match the real word with its theme to pop its partner and break the link.',level:9},
  {id:'burst',icon:'✹',name:'Burst',description:'Finish this group before its move countdown reaches zero.',tip:'The countdown arrives only when every part of its group is on the board and unlocked. Thinking never spends a move.',level:10},
  {id:'nested',icon:'◎',name:'Theme bubble',description:'Some solved themes return as ordinary words, forming chains of connections.',tip:'Flowers can become Garden, then Outdoor places. A returning word can also take on a different meaning.',level:11},
  {id:'sealed',icon:'🌿',name:'Tangled',description:'Kelp holds this bubble until another group is completed.',tip:'Pop any group to loosen the kelp and set the word free.',level:12},
  {id:'pinlock',icon:'📌',name:'Pinned',description:'Clear the groups with green pins to release the held word.',tip:'Each completed pin group pulls one pin out of the bubble.',level:13},
  {id:'bonus',icon:'+5',name:'Bonus moves',description:'Tap this bubble for five extra moves in games with a move budget.',tip:'This demo uses a move budget without changing your settings.',level:14}
]);
export const INTRO_LEVELS = SPECIALS.length + 1;
