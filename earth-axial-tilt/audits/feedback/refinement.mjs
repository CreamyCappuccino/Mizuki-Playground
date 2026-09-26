/** Execute actual trusted project TypeScript through in-memory compilation.
 * No copied solver, no candidate-generated golden. Outputs go to a caller directory. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import * as ts from 'typescript';
const root=path.resolve(import.meta.dirname,'../..'),out=path.resolve(process.argv[2]??'');
if(!process.argv[2]||out.startsWith(root+path.sep))throw new Error('Supply a generated-output directory outside the repository.');
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
const {solveFeedback}=load(root+'/src/feedback/model.ts');
const reports=[];
for(const [tilt,seed,e] of [[23.44,'warm',0],[60,'warm',0],[90,'cold',.3]]){
 const c={tilt,depth:10,enabled:true,solarScale:1,orbit:{eccentricity:e,perihelion:e?90:0,axis:0}};
 const runs=[2,4,8].map(stepsPerDay=>solveFeedback(c,seed,{stepsPerDay}));
 const comparisons=[0,1].map(i=>{let max=0,sum=0;for(let k=0;k<32850;k++){const d=runs[i].temperatures[k]-runs[i+1].temperatures[k];max=Math.max(max,Math.abs(d));sum+=d*d*runs[i].weight[k%90]/730;}return {maxAbsC:max,areaTimeRmsC:Math.sqrt(sum)};});
 reports.push({tilt,seed,e,converged:runs.map(r=>r.converged),differences:comparisons});
}
const c={tilt:23.44,depth:10,enabled:true,solarScale:1,orbit:{eccentricity:0,perihelion:0,axis:0}};
const coarse=solveFeedback(c,'warm',{bands:90,stepsPerDay:4}),fine=solveFeedback(c,'warm',{bands:180,stepsPerDay:4});
let max=0,sum=0;
for(let day=0;day<365;day++)for(let i=0;i<90;i++){
 const t=(fine.temperatures[day*180+2*i]*fine.weight[2*i]+fine.temperatures[day*180+2*i+1]*fine.weight[2*i+1])/coarse.weight[i];
 const d=t-coarse.temperatures[day*90+i];max=Math.max(max,Math.abs(d));sum+=d*d*coarse.weight[i]/730;
}
fs.writeFileSync(path.join(out,'refinement.json'),JSON.stringify({scope:'actual production refinement, not a physical uncertainty bound',time:reports,grid:{converged:coarse.converged&&fine.converged,maxAbsC:max,areaTimeRmsC:Math.sqrt(sum)}},null,2));
console.log(JSON.stringify(reports));
