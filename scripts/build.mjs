import {mkdir,copyFile,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'vite';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=path.join(root,'dist');
await sharp(path.join(root,'assets/reef-source.png')).resize({width:800}).webp({quality:82}).toFile(path.join(root,'assets/reef.webp'));
for(const size of[192,512])await sharp(path.join(root,'icons/icon.svg')).resize(size,size).png().toFile(path.join(root,`icons/icon-${size}.png`));
await sharp(path.join(root,'icons/icon.svg')).resize(512,512).png().toFile(path.join(root,'icons/maskable-512.png'));
for(const file of['manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png']){
  const target=path.join(root,'public',file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,file),target);
}
await build({root,configFile:path.join(root,'vite.config.js')});
for(const file of['LICENSE','src/physics.js','src/engine.js','src/data.js','src/catalog.js','src/nesting.js','src/i18n.js','src/art.js','src/text-fit.js']){
  const target=path.join(dist,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,file),target);
}
// Keep the readable source exports usable by diagnostics and precache every locale.
for (const language of ['en','de']) for (const file of await readdir(path.join(root,'src/packs',language))) {
  if (!file.endsWith('.json')) continue;
  const target=path.join(dist,'src/packs',language,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,'src/packs',language,file),target);
}
const notices=[];
for(const name of['animejs','canvas-confetti','@fontsource-variable/nunito','@dimforge/rapier2d-compat']){
  const folder=path.join(root,'node_modules',name),pkg=JSON.parse(await readFile(path.join(folder,'package.json'),'utf8'));
  const license=(await readdir(folder)).find(file=>/^(license|ofl)(\.|$)/i.test(file));
  notices.push(`${name} ${pkg.version} — ${pkg.license}\n${license?await readFile(path.join(folder,license),'utf8'):''}`);
}
await writeFile(path.join(dist,'THIRD-PARTY-NOTICES.txt'),notices.join('\n\n'));
async function files(dir,prefix=''){const list=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const name=prefix+entry.name;list.push(...entry.isDirectory()?await files(path.join(dir,entry.name),name+'/'):[name]);}return list;}
const assets=(await files(dist)).filter(file=>file!=='sw.js'),hash=createHash('sha256');
for(const file of assets)hash.update(await readFile(path.join(dist,file)));
const worker=(await readFile(path.join(root,'sw.js'),'utf8'))
  .replace(/const CACHE = '[^']+';/,`const CACHE = 'bubble-grove-v11-${hash.digest('hex').slice(0,12)}';`)
  .replace(/const ASSETS = \[[^\]]+\];/,`const ASSETS = ${JSON.stringify(['./',...assets.map(file=>'./'+file)])};`);
await writeFile(path.join(dist,'sw.js'),worker);
const bytes=(await Promise.all(assets.map(async file=>(await stat(path.join(dist,file))).size))).reduce((a,b)=>a+b,0);
console.log(`Bundled ${assets.length+1} offline files · ${Math.round(bytes/1024)} KB · all fonts, artwork, and libraries stay on this site.`);
