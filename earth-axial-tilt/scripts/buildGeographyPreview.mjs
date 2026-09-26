/** Dependency-free static preview build. Uses the project's TypeScript compiler
 * when installed, otherwise a tsc on PATH. This does not replace Vite's release build. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'dist/geography-preview');
if(out===root||out===path.dirname(root)||root.startsWith(out+path.sep))throw new Error('Unsafe output location.');
fs.mkdirSync(out,{recursive:true});
const local=path.join(root,'node_modules/.bin/tsc'),tsc=process.env.TSC||(fs.existsSync(local)?local:'tsc');
const result=spawnSync(tsc,['--target','ES2022','--module','ESNext','--moduleResolution','bundler','--strict',
  '--noUnusedLocals','--noUnusedParameters','--lib','ES2022,DOM,DOM.Iterable','--rootDir','src','--outDir',path.join(out,'src'),
  'src/geographyLab/page.ts','src/physics/geography.worker.ts'],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of files(path.join(out,'src')).filter(f=>f.endsWith('.js'))){
  let text=fs.readFileSync(file,'utf8');
  text=text.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"]+)(['"])/g,(_s,a,b,c)=>a+b+(path.extname(b)?'':'.js')+c);
  text=text.replace(/geography\.worker\.ts/g,'geography.worker.js');fs.writeFileSync(file,text);
}
fs.mkdirSync(path.join(out,'data'),{recursive:true});fs.copyFileSync(path.join(root,'data/land-fractions.json'),path.join(out,'data/land-fractions.json'));
fs.copyFileSync(path.join(root,'data/README.md'),path.join(out,'data/README.md'));
fs.copyFileSync(path.join(root,'src/geographyLab/lab.css'),path.join(out,'src/geographyLab/lab.css'));
fs.writeFileSync(path.join(out,'geography-lab.html'),fs.readFileSync(path.join(root,'geography-lab.html'),'utf8').replace('src/geographyLab/page.ts','src/geographyLab/page.js'));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Geography integration preview</title><body style="max-width:48rem;margin:3rem auto;padding:1rem;font:18px/1.7 system-ui"><h1>地理実験・接続試験版</h1><p>これは独立した検証用ページです。既存の3D Earth LabやM4の配信を置き換えたものではありません。</p><p><a href="./geography-lab.html">地理実験ページを開く / Open geography experiment</a></p><p>18×36セルの教材モデル。都市の天気予報ではありません。実ブラウザWorker/Vite/WebKitの通し試験は、このパッチのローカル受入工程で確認してください。</p></body></html>`);
fs.writeFileSync(path.join(out,'package.json'),'{"type":"module"}\n');
console.log(`Geography preview written to ${out}`);
