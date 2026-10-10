// Original vector artwork. Decorations live below the interactive bubble layer.
const svg=(body,cls='',attrs='')=>`<svg class="bubble-art ${cls}" viewBox="0 0 100 100" aria-hidden="true" ${attrs}>${body}</svg>`;
const screw=(x,y)=>`<g class="screw-head" transform="translate(${x} ${y})"><g class="screw-spin"><circle r="6.5" fill="#dbe3e8" stroke="#6c8190" stroke-width="2"/><path d="M-4 0h8M0-4v8" stroke="#526775" stroke-width="2.4"/><path d="M-3-4a5 5 0 0 1 6 0" stroke="#fff" fill="none"/></g></g>`;
export const KEY_PALETTE={amber:{fill:'#f0c56f',ink:'#a66d17'},azure:{fill:'#79c9f0',ink:'#2477bb'},coral:{fill:'#f39da2',ink:'#bd445d'},violet:{fill:'#c3a4f1',ink:'#8154b9'}};
const padlock=color=>`<path d="M42 76v-7a8 8 0 0 1 16 0v7" fill="none" stroke="${color.ink}" stroke-width="4"/><rect x="36" y="74" width="28" height="20" rx="5" fill="${color.fill}" stroke="${color.ink}" stroke-width="2"/><path d="M50 81v7" stroke="${color.ink}" stroke-width="3"/>`;
const pin=(x,y)=>`<g transform="translate(${x} ${y}) rotate(30)"><path d="M0 0v14" stroke="#789199" stroke-width="2"/><path d="M-5-4h10l-2 6 4 4H-7l4-4Z" fill="#64bdac" stroke="#348d82" stroke-width="1.5"/></g>`;
function iceArt(b){
  const fraction=Math.min(1,b.ice/Math.max(b.iceTotal||4,b.ice)),pieces=Math.ceil(fraction*4),stage=4-pieces;
  const facets=[
    'M15 80 2 44 10 36 28 53 39 76 47 98Z',
    'M47 98 80 86 98 53 72 61 59 79Z',
    'M87 19 98 53 72 61 64 34 78 25Z',
    'M23 7 58 3 87 19 64 34 35 32 10 36Z'
  ];
  const fractures=['M58 5 49 26 56 40 46 55 52 71 44 93','M49 26 29 20 18 30M46 55 25 60 15 78','M56 40 74 34 87 21M52 71 73 77 80 89'];
  return svg(`<path class="ice-surface" d="M23 7 58 3 87 19 98 53 80 86 47 98 15 80 2 44Z" fill="#c7f0ff" fill-opacity="${(.12+fraction*.43).toFixed(2)}" stroke="#eafdff" stroke-opacity="${fraction.toFixed(2)}" stroke-width="2"/>
    ${facets.slice(0,pieces).map((d,i)=>`<path class="ice-facet" data-facet="${i}" d="${d}" fill="#bceeff" fill-opacity=".68" stroke="#f2feff" stroke-width="2"/>`).join('')}
    ${fractures.slice(0,stage).map(d=>`<path class="ice-fracture" d="${d}" fill="none" stroke="#598da6" stroke-width="3"/><path class="ice-fracture" d="${d}" fill="none" stroke="#f5ffff" stroke-width="1.2"/>`).join('')}
    ${stage===0?'<path class="ice-snowflake" d="M21 21v15m-7-11 14 8m-14 0 14-8M78 70v15m-7-11 14 8m-14 0 14-8" stroke="#fff" stroke-width="2"/>':''}`,
    'ice-coat',`data-thaw-stage="${stage}" data-ice-remaining="${b.ice}"`);
}
export function specialArt(b){
  let content='';const pair=KEY_PALETTE[b.lockColor||b.keyColor||b.screwColor||b.driverColor]||KEY_PALETTE.amber;
  if(b.ice>0)content+=iceArt(b);
  if(b.turns>0)content+=svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="${pair.ink}" stroke-width="7"/><circle cx="50" cy="50" r="44" fill="none" stroke="${pair.fill}" stroke-width="3"/>${Array.from({length:b.turns},(_,i)=>{const angle=(-130+i*360/(b.screwTotal||b.turns))*Math.PI/180;return screw((50+44*Math.cos(angle)).toFixed(2),(50+44*Math.sin(angle)).toFixed(2));}).join('')}`,'screw-ring',`data-pair-color="${b.screwColor||'violet'}"`);
  if(b.lockColor)content+=svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="${pair.ink}" stroke-width="3" stroke-dasharray="7 4"/>${padlock(pair)}`,'lock-hardware',`data-pair-color="${b.lockColor}"`);
  if(b.clearsNeeded>0)content+=svg(`<g class="kelp-strand"><path d="M18 86Q0 64 16 41T31 7M18 57Q8 49 11 38Q26 39 18 57M23 32Q36 24 33 13Q19 17 23 32"/></g><g class="kelp-strand"><path d="M77 94Q101 74 86 49T75 8M86 62Q99 52 96 40Q80 47 86 62M78 29Q64 21 67 10Q83 16 78 29"/></g><path d="M14 76Q32 101 59 92T89 71" fill="none" stroke="#408f73" stroke-width="4"/><path d="M39 90Q41 75 51 78Q60 90 39 90"/>`,'kelp-wrap');
  if(b.pinsNeeded>0)content+=svg(`${Array.from({length:b.pinsNeeded},(_,i)=>`<g data-pin-index="${i}"><path class="pin-ribbon" d="${i%2?'M78 9 94 23 86 33 70 19Z':'M8 22 24 8 33 17 17 31Z'}" fill="#b8e0d0" stroke="#72b49c" stroke-width="1.3"/>${pin(i%2?80:20,16)}</g>`).join('')}`,'pinned-art');
  if(b.keyColor)content+=svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="${pair.ink}" stroke-width="2" opacity=".4"/><g transform="translate(48 82) rotate(-25)"><circle cx="-11" cy="0" r="6" fill="${pair.fill}" stroke="${pair.ink}" stroke-width="3"/><path d="M-5 0h23m-2 0v5m-6-5v5" stroke="${pair.ink}" stroke-width="4"/></g>`,'key-art',`data-pair-color="${b.keyColor}"`);
  if(b.driverColor)content+=svg(`<circle cx="50" cy="50" r="44" fill="none" stroke="${pair.ink}" stroke-width="2" opacity=".4"/><g transform="translate(50 81) rotate(-25)"><path d="M-4 0h21l4-2v4l-4-2" stroke="#607a89" stroke-width="3" fill="none"/><rect x="-19" y="-5" width="17" height="10" rx="3" fill="${pair.fill}" stroke="${pair.ink}" stroke-width="2"/><path d="M-15-2h9m-9 4h9" stroke="${pair.ink}" stroke-width="1.4"/></g>`,'screwdriver-art',`data-pair-color="${b.driverColor}"`);
  if(b.pinCarrier&&!b.pinsNeeded)content+=svg(pin(50,82),'pin-art');
  if(typeof b.timer==='number')content+=svg(`${Array.from({length:9},(_,i)=>{const angle=(i*40-90)*Math.PI/180;return `<circle cx="${50+44*Math.cos(angle)}" cy="${50+44*Math.sin(angle)}" r="3.5" fill="${i<b.timer?'#df865a':'#d5e6e5'}"/>`;}).join('')}<path d="M78 21q5-6 8 0m-4-5v-5" stroke="#cf7651" stroke-width="2" fill="none"/>`,'fuse-art');
  if(b.kind==='backward')content+=svg('<path d="M39 86h24m-19-5-5 5 5 5" stroke="#6c8fab" stroke-width="2" fill="none"/>');
  if(b.atoms.some(a=>a.part!==undefined))content+=svg(`<path d="M50 4v16m0 60v16" stroke="#bb9b6b" stroke-width="2" stroke-dasharray="3 3"/>`,'fragment-art');
  return content;
}
export function oceanArt(){return `<div class="ocean" aria-hidden="true">
  <div class="water-light light-a"></div><div class="water-light light-b"></div>
  <svg class="sea-garden" viewBox="0 0 360 456" preserveAspectRatio="none">
    <path d="M0 431Q80 416 161 440T360 430V456H0Z" fill="#93c5bb" opacity=".28"/>
    <g class="kelp kelp-a"><path d="M19 456Q39 416 22 375T31 299"/><path d="M24 402Q0 385 12 356M24 375Q47 358 38 335"/></g>
    <g class="kelp kelp-b"><path d="M47 456Q32 416 55 376T53 333"/><path d="M47 421Q67 406 67 390"/></g>
    <g class="kelp kelp-c"><path d="M336 456Q311 414 331 379T327 319"/><path d="M329 398Q350 380 351 355M332 369Q307 359 312 343"/></g>
    <g class="kelp kelp-d"><path d="M302 456Q322 420 301 397T307 357"/></g>
    <g fill="#abcfc5" opacity=".45"><ellipse cx="21" cy="450" rx="23" ry="9"/><ellipse cx="314" cy="452" rx="25" ry="10"/><ellipse cx="265" cy="450" rx="12" ry="6"/></g>
  </svg>
  ${[0,1,2].map(i=>`<div class="fish fish-${i}"><svg viewBox="0 0 90 40"><path d="M60 20 83 5v30Z" fill="currentColor"/><path d="M6 20Q28-3 65 20 28 43 6 20Z" fill="currentColor"/><path d="m31 9 13-8 3 12m-17 20 14 6-2-10" fill="currentColor"/><circle cx="17" cy="17" r="2" fill="#356779"/></svg></div>`).join('')}
  <div class="sea-specks"><i></i><i></i><i></i><i></i></div>
</div>`;}
// The paths are replaced with Rapier's membrane contour on every physics frame.
export function membraneArt(id){
  const key=String(id).replace(/[^a-zA-Z0-9-]/g,'_'),circle='M100 50A50 50 0 1 1 0 50A50 50 0 1 1 100 50Z';
  return `<svg class="bubble-membrane" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="glass-${key}" cx="30%" cy="18%" r="75%"><stop stop-color="#fffff5" stop-opacity=".85"/><stop offset=".28" stop-color="#fffff5" stop-opacity=".38"/><stop offset=".7" stop-color="#fffff5" stop-opacity="0"/></radialGradient><radialGradient id="shade-${key}" cx="80%" cy="86%" r="68%"><stop stop-color="#004751" stop-opacity=".2"/><stop offset="1" stop-color="#004751" stop-opacity="0"/></radialGradient><clipPath id="clip-${key}"><path class="membrane-contour" d="${circle}"/></clipPath></defs><path class="membrane-contour membrane-fill" d="${circle}"/><path class="membrane-contour membrane-light" d="${circle}" fill="url(#glass-${key})"/><path class="membrane-contour" d="${circle}" fill="url(#shade-${key})"/><path class="membrane-contour membrane-outline" d="${circle}"/><path class="membrane-contour membrane-inset" d="${circle}" transform="translate(4 4) scale(.92)"/><g clip-path="url(#clip-${key})"><ellipse class="membrane-glint" cx="33" cy="16" rx="15" ry="4.5" transform="rotate(-27 33 16)"/></g></svg>`;
}
