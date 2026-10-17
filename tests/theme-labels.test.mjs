import test from 'node:test';
import assert from 'node:assert/strict';
import {getCatalog} from '../src/catalog.js';
import {createPuzzle,makeState,upgradeDealing,validateState} from '../src/engine.js';

// Keep the stable IDs and the intended wording explicit. These are curated
// label changes, not a suffix-stripping rule that would erase meaning.
const renamed={
  "en": {
    "theme-016": [
      "Evergreen trees",
      "Evergreens"
    ],
    "theme-022": [
      "Named winds",
      "Winds"
    ],
    "theme-050": [
      "Household pets",
      "Pets"
    ],
    "theme-212": [
      "Classic toys",
      "Toys"
    ],
    "theme-153": [
      "Tempo markings",
      "Tempo"
    ],
    "theme-156": [
      "Classical composers",
      "Composers"
    ],
    "theme-157": [
      "Song sections",
      "Song"
    ],
    "theme-146": [
      "Cycling gear",
      "Cycling"
    ],
    "theme-182": [
      "World landmarks",
      "Landmarks"
    ],
    "theme-183": [
      "Famous bridges",
      "Bridges"
    ],
    "theme-040": [
      "Citrus fruits",
      "Citrus"
    ],
    "theme-044": [
      "Cooking methods",
      "Cooking"
    ],
    "theme-106": [
      "Kitchen utensils",
      "Utensils"
    ],
    "theme-116": [
      "Bed linens",
      "Bedding"
    ],
    "theme-125": [
      "Clothing patterns",
      "Patterns"
    ],
    "theme-126": [
      "Clothing fasteners",
      "Fasteners"
    ],
    "theme-236": [
      "Birthday party",
      "Birthday"
    ],
    "theme-242": [
      "Family relations",
      "Family"
    ],
    "theme-170": [
      "Famous painters",
      "Painters"
    ],
    "theme-171": [
      "Origami shapes",
      "Origami"
    ],
    "theme-086": [
      "Satellite purposes",
      "Satellites"
    ],
    "theme-089": [
      "Chemical elements",
      "Elements"
    ],
    "theme-091": [
      "Human bones",
      "Bones"
    ],
    "theme-092": [
      "Body organs",
      "Organs"
    ],
    "theme-096": [
      "Physics concepts",
      "Physics"
    ],
    "theme-099": [
      "Biology fields",
      "Biology"
    ],
    "theme-103": [
      "Blood components",
      "Blood"
    ],
    "theme-104": [
      "Scientific pioneers",
      "Scientists"
    ],
    "theme-192": [
      "Computer hardware",
      "Hardware"
    ],
    "theme-198": [
      "Coding concepts",
      "Coding"
    ],
    "theme-253": [
      "Statistical terms",
      "Statistics"
    ]
  },
  "de": {
    "de-nature-am-baum": [
      "Am Baum",
      "Baum"
    ],
    "de-games-skatkarten": [
      "Skatkarten",
      "Skat"
    ],
    "de-games-pokerbegriffe": [
      "Pokerbegriffe",
      "Poker"
    ],
    "de-music-auf-der-buhne": [
      "Auf der Bühne",
      "Bühne"
    ],
    "de-music-konzertbesuch": [
      "Konzertbesuch",
      "Konzert"
    ],
    "de-music-klang-beschreiben": [
      "Klang beschreiben",
      "Klang"
    ],
    "de-language-wochentage-co": [
      "Wochentage & Co.",
      "Woche"
    ],
    "de-language-maerchenwoerter": [
      "Märchenwörter",
      "Märchen"
    ],
    "de-travel-reisegepack": [
      "Reisegepäck",
      "Gepäck"
    ],
    "de-travel-am-flughafen": [
      "Am Flughafen",
      "Flughafen"
    ],
    "de-travel-im-flugzeug": [
      "Im Flugzeug",
      "Flugzeug"
    ],
    "de-travel-am-bahnhof": [
      "Am Bahnhof",
      "Bahnhof"
    ],
    "de-travel-zugreise": [
      "Zugreise",
      "Zug"
    ],
    "de-travel-im-hotel": [
      "Im Hotel",
      "Hotel"
    ],
    "de-travel-strandurlaub": [
      "Strandurlaub",
      "Strand"
    ],
    "de-travel-wintersportreise": [
      "Wintersportreise",
      "Skiurlaub"
    ],
    "de-travel-urlaubsinseln": [
      "Urlaubsinseln",
      "Inseln"
    ],
    "de-food-kocharten": [
      "Kocharten",
      "Garen"
    ],
    "de-food-reisgerichte": [
      "Reisgerichte",
      "Reis"
    ],
    "de-arts-bildmotive": [
      "Bildmotive",
      "Motive"
    ],
    "de-arts-im-museum": [
      "Im Museum",
      "Museum"
    ],
    "de-arts-buchgestaltung": [
      "Buchgestaltung",
      "Buch"
    ],
    "de-arts-antike-baukunst": [
      "Antike Baukunst",
      "Antike"
    ],
    "de-arts-gotische-kirchen": [
      "Gotische Kirchen",
      "Gotik"
    ],
    "de-arts-designberufe": [
      "Designberufe",
      "Design"
    ],
    "de-science-koerperwissen": [
      "Körperwissen",
      "Anatomie"
    ],
    "de-science-fahrradtechnik": [
      "Fahrradtechnik",
      "Fahrrad"
    ],
    "de-science-pflanzenleben": [
      "Pflanzenleben",
      "Pflanzen"
    ],
    "de-movies-im-kino": [
      "Im Kino",
      "Kino"
    ],
    "de-movies-am-filmset": [
      "Am Filmset",
      "Filmset"
    ],
    "de-movies-kriminalfilm": [
      "Kriminalfilm",
      "Krimi"
    ]
  }
};

test('concise theme names retain stable IDs and leave no stale category references',()=>{
  for(const [language,changes] of Object.entries(renamed)){
    const catalog=getCatalog({language}),names=new Set(catalog.themes.map(t=>t.name.toLocaleLowerCase(language)));
    assert.equal(names.size,catalog.themes.length);
    for(const [id,[old,name]] of Object.entries(changes)){
      const theme=catalog.themes.find(t=>t.id===id);
      assert.equal(theme?.name,name);assert.ok(theme.legacyNames.includes(old));assert.ok(Object.isFrozen(theme.legacyNames));
      assert.ok(!theme.words.includes(name),'A shortened name must not give away one of its own clues');
      assert.ok(!catalog.themes.some(t=>t.name===old||t.words.includes(old)),`${language}: stale ${old}`);
      assert.ok(!Object.hasOwn(catalog.pictures,old));
    }
  }
});

test('renamed category words keep their parent connections and pictures',()=>{
  const en=getCatalog(),de=getCatalog({language:'de'});
  assert.ok(en.themes.find(t=>t.name==='Fruit bowl').words.includes('Citrus'));
  assert.ok(de.themes.find(t=>t.id==='de-travel-urlaub').words.includes('Strand'));
  assert.ok(de.pictures.Strand);
});

test('meaningful relations and recognizable titles survive the simplification pass',()=>{
  const names=new Set(getCatalog().themes.map(t=>t.name));
  for(const name of ['Cake','Cake compounds','Night rhymes','With keys','The Beatles','Harry Potter','The Lord of the Rings'])assert.ok(names.has(name),name);
});


test('renamed themes still exclude their full pools from legacy linked decoys',()=>{
  const catalog=getCatalog(),theme=catalog.themes.find(t=>t.name==='Family');
  const puzzle=createPuzzle({mode:'lab',special:'linked'});
  puzzle.groups[1]={...puzzle.groups[1],name:'Family relations',domain:theme.domain,words:theme.words.slice(0,4)};
  const state=makeState(puzzle),all=()=>[...state.bubbles,...state.reserve.flat()];
  const fake=all().find(b=>b.decoy);fake.atoms[0].word=theme.words.find(word=>!puzzle.groups.some(g=>g.words.includes(word)));
  assert.ok(fake.atoms[0].word);assert.ok(validateState(state));
  const groups=structuredClone(state.puzzle.groups),ledger=all().filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>[a.id,a.word]));
  upgradeDealing(state);
  assert.ok(!theme.words.includes(fake.atoms[0].word));assert.deepEqual(state.puzzle.groups,groups);
  assert.deepEqual(all().filter(b=>!b.decoy).flatMap(b=>b.atoms.map(a=>[a.id,a.word])),ledger);
  assert.ok(validateState(state));
});
