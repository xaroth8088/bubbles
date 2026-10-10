// JSON is the source of truth: punctuation is data, never a delimiter.
import en_base from './packs/en/base.json' with {type:'json'};
import en_nature from './packs/en/nature.json' with {type:'json'};
import en_food from './packs/en/food.json' with {type:'json'};
import en_science from './packs/en/science.json' with {type:'json'};
import en_sports from './packs/en/sports.json' with {type:'json'};
import en_travel from './packs/en/travel.json' with {type:'json'};
import en_arts from './packs/en/arts.json' with {type:'json'};
import en_language from './packs/en/language.json' with {type:'json'};
import en_games from './packs/en/games.json' with {type:'json'};
import en_video_games from './packs/en/video-games.json' with {type:'json'};
import en_movies from './packs/en/movies.json' with {type:'json'};
import en_music from './packs/en/music.json' with {type:'json'};
import de_base from './packs/de/base.json' with {type:'json'};
import de_nature from './packs/de/nature.json' with {type:'json'};
import de_food from './packs/de/food.json' with {type:'json'};
import de_science from './packs/de/science.json' with {type:'json'};
import de_sports from './packs/de/sports.json' with {type:'json'};
import de_travel from './packs/de/travel.json' with {type:'json'};
import de_arts from './packs/de/arts.json' with {type:'json'};
import de_language from './packs/de/language.json' with {type:'json'};
import de_games from './packs/de/games.json' with {type:'json'};
import de_video_games from './packs/de/video-games.json' with {type:'json'};
import de_movies from './packs/de/movies.json' with {type:'json'};
import de_music from './packs/de/music.json' with {type:'json'};

export const CATALOG_VERSION = 1;
export const PACKS = Object.freeze([
  {
    "id": "base",
    "name": {
      "en": "Everyday",
      "de": "Alltag"
    }
  },
  {
    "id": "nature",
    "name": {
      "en": "Nature & animals",
      "de": "Natur & Tiere"
    }
  },
  {
    "id": "food",
    "name": {
      "en": "Food & drink",
      "de": "Essen & Trinken"
    }
  },
  {
    "id": "science",
    "name": {
      "en": "Science & technology",
      "de": "Wissenschaft & Technik"
    }
  },
  {
    "id": "sports",
    "name": {
      "en": "Sports",
      "de": "Sport"
    }
  },
  {
    "id": "travel",
    "name": {
      "en": "Travel & places",
      "de": "Reisen & Orte"
    }
  },
  {
    "id": "arts",
    "name": {
      "en": "Arts & creativity",
      "de": "Kunst & Kreativität"
    }
  },
  {
    "id": "language",
    "name": {
      "en": "Language & wordplay",
      "de": "Sprache & Wortspiele"
    }
  },
  {
    "id": "games",
    "name": {
      "en": "Tabletop & games",
      "de": "Brettspiele & Spiele"
    }
  },
  {
    "id": "video-games",
    "name": {
      "en": "Video games",
      "de": "Videospiele"
    }
  },
  {
    "id": "movies",
    "name": {
      "en": "Movies & TV",
      "de": "Film & Fernsehen"
    }
  },
  {
    "id": "music",
    "name": {
      "en": "Music & artists",
      "de": "Musik & Interpreten"
    }
  }
].map(pack=>Object.freeze({...pack,name:Object.freeze(pack.name)})));
export const ALL_PACK_IDS = Object.freeze(PACKS.map(pack=>pack.id));
const source = {
en:[en_base,en_nature,en_food,en_science,en_sports,en_travel,en_arts,en_language,en_games,en_video_games,en_movies,en_music],
de:[de_base,de_nature,de_food,de_science,de_sports,de_travel,de_arts,de_language,de_games,de_video_games,de_movies,de_music],
};
export function normalizeLanguage(language) { return language === 'de' ? 'de' : 'en'; }
export function normalizePackIds(packIds) {
  if (packIds == null) return [...ALL_PACK_IDS];
  const selected = new Set(Array.isArray(packIds) ? packIds : []);
  const ids = ALL_PACK_IDS.filter(id=>selected.has(id));
  return ids.length ? ids : ['base'];
}
const cache = new Map();
export function getCatalog({language='en',packIds}={}) {
  language = normalizeLanguage(language);
  packIds = normalizePackIds(packIds);
  const key = language + ':' + packIds.join(',');
  if (cache.has(key)) return cache.get(key);
  const selected = source[language].filter(pack=>packIds.includes(pack.id));
  const themes = Object.freeze(selected.flatMap(pack=>pack.themes.map(theme=>Object.freeze({...theme,packId:pack.id,words:Object.freeze([...theme.words])}))).sort((a,b)=>a.id.localeCompare(b.id)));
  const eligible = new Set(themes.flatMap(theme=>theme.words));
  const pictures = Object.freeze(Object.fromEntries(selected.flatMap(pack=>Object.entries(pack.pictures||{})).filter(([word])=>eligible.has(word))));
  const stats = Object.freeze({themes:themes.length,entries:themes.reduce((sum,theme)=>sum+theme.words.length,0),words:new Set(themes.flatMap(theme=>theme.words.map(word=>word.toLocaleLowerCase(language)))).size,domains:new Set(themes.map(theme=>theme.domain)).size,popCulture:themes.filter(theme=>theme.popCulture).length,pictures:Object.keys(pictures).length});
  const catalog = Object.freeze({version:CATALOG_VERSION,language,packIds:Object.freeze(packIds),themes,pictures,stats});
  cache.set(key,catalog);
  return catalog;
}
