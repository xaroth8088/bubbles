import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {THEMES,LIBRARY_STATS,SPECIALS} from '../src/data.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'portrait-primary');assert.equal(manifest.start_url,'./');
for(const icon of manifest.icons){const file=await readFile(path.join(root,icon.src));assert.equal(file.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(file.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
const worker=await readFile(path.join(root,'dist/sw.js'),'utf8');
const assets=JSON.parse(worker.match(/const ASSETS = (\[[^\]]+\])/)[1]);
for(const asset of assets)await stat(path.join(root,'dist',asset==='./'?'index.html':asset));
assert.ok(assets.some(asset=>/\.webp$/.test(asset)),'Original reef artwork is missing from the offline bundle');
assert.ok(assets.some(asset=>/\.woff2$/.test(asset)),'Local typeface is missing from the offline bundle');
assert.ok(assets.some(asset=>/assets\/.+\.js$/.test(asset)),'Bundled game libraries are missing');
const unique=new Set();
for(const theme of THEMES){assert.ok(theme.name);assert.ok(theme.words.length>=4,theme.name);assert.equal(new Set(theme.words.map(w=>w.toLowerCase())).size,theme.words.length,theme.name);assert.ok(!unique.has(theme.name),theme.name);unique.add(theme.name);}
assert.equal(SPECIALS.length,13);
console.log(`Checked ${LIBRARY_STATS.themes} themes, ${LIBRARY_STATS.entries} associations, ${LIBRARY_STATS.words} distinct words, all PWA assets, and install icons.`);
