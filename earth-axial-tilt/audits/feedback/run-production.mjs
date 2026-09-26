/** Execute actual trusted project TypeScript through in-memory compilation.
 * No copied solver, no candidate-generated golden. Outputs go to a caller directory. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import * as ts from 'typescript';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??'');
const repository=path.dirname(root);
if(!process.argv[2]||out===repository||out.startsWith(repository+path.sep))throw new Error('Supply a generated-output directory outside the repository.');
fs.mkdirSync(out,{recursive:true});const cache=new Map(),sources={};
function load(file){
 const full=path.resolve(file);if(!full.startsWith(root+'/src/'))throw new Error('Only trusted project modules are allowed');
 if(cache.has(full))return cache.get(full).exports;
 const source=fs.readFileSync(full,'utf8');sources[path.relative(root,full)]=createHash('sha256').update(source).digest('hex');
 const module={exports:{}};cache.set(full,module);
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('module','exports','require',code)(module,module.exports,id=>{if(!id.startsWith('.'))throw new Error('External execution import rejected');return load(path.resolve(path.dirname(full),id+'.ts'));});
 return module.exports;
}
const {solveFeedback}=load(root+'/src/feedback/model.ts');const cases=[];
for(const [tilt,initial,enabled,eccentricity,perihelion] of [[23.44,20,true,0,0],[23.44,-60,true,0,0],
 [23.44,20,false,0,0],[23.44,-60,false,0,0],[90,20,true,.3,90],[90,-60,true,.3,90]]){
 const input={tilt,initial,enabled,depth:10,solarScale:1,orbit:{eccentricity,perihelion,axis:0}};
 const result=solveFeedback(input,initial===20?'warm':'cold');
 const bytes=Buffer.alloc(result.temperatures.length*8);result.temperatures.forEach((v,i)=>bytes.writeDoubleLE(v,i*8));
 fs.writeFileSync(path.join(out,`case-${cases.length}.f64`),bytes);
 cases.push({input,converged:result.converged,mean:result.mean,periodicError:result.periodicError,energyResidual:result.energyResidual});
}
fs.writeFileSync(path.join(out,'production.json'),JSON.stringify(cases,null,2));
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(sources,null,2));
