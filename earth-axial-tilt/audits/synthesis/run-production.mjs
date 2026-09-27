import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(process.argv[2]??'/tmp/earth-synthesis-audit');
if(!relative(root,out).startsWith('..'))throw new Error('Generated audit output must be outside the project.');
mkdirSync(out,{recursive:true});
const cache=new Map(),hashes={};
function load(path){
 const file=resolve(path.endsWith('.ts')?path:path+'.ts');
 if(!file.startsWith(root+'/src/'))throw new Error('Audit imports restricted to project src');
 if(cache.has(file))return cache.get(file).exports;
 const source=readFileSync(file,'utf8');hashes[relative(root,file)]=createHash('sha256').update(source).digest('hex');
 const m={exports:{}};cache.set(file,m);
 new Function('require','exports','module',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
  id=>{if(!id.startsWith('.'))throw new Error('Unexpected external import');return load(resolve(dirname(file),id));},m.exports,m);
 return m.exports;
}
const {calculateRow,validateSweep,DEFAULT_SWEEP}=load(root+'/src/synthesis/model.ts');
const configs=[
 {...DEFAULT_SWEEP},
 {...DEFAULT_SWEEP,latitude:-65,summer:270,base:{tilt:90,eccentricity:.3,perihelion:87,axis:41}},
 {...DEFAULT_SWEEP,latitude:90,parameter:'tilt',start:0,end:90,count:7,selected:0,comparison:6},
 {...DEFAULT_SWEEP,latitude:0,parameter:'eccentricity',start:0,end:.3,count:7,selected:0,comparison:6},
];
const results=configs.map(c=>{const s=validateSweep(c);return{settings:s,rows:Array.from({length:s.count},(_,i)=>{const r=calculateRow(s,i);return{...r,daily:Array.from(r.daily),seasonal:Array.from(r.seasonal)};})};});
writeFileSync(out+'/production.json',JSON.stringify({hashes,results}));
const before=performance.now();const s=validateSweep({...DEFAULT_SWEEP,count:41});for(let i=0;i<41;i++)calculateRow(s,i);
console.log(JSON.stringify({cases:results.length,rows:results.reduce((n,r)=>n+r.rows.length,0),maxSweepMs:performance.now()-before,arrayBytesAt41:41*(365+72)*8}));
