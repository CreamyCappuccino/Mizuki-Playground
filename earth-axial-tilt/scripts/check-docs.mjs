import {readFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import ts from 'typescript';
const root=process.cwd();
const files=['README.md','START_HERE.md','ROADMAP.md',...readdirSync('docs').filter(n=>n.endsWith('.md')).map(n=>`docs/${n}`)];
const problems=[];
for(const file of files){
 const body=readFileSync(file,'utf8');
 for(const match of body.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)){
  const path=match[1].split('#')[0];
  if(!path||/^(?:https?:|mailto:)/i.test(path))continue;
  if(!existsSync(resolve(dirname(file),decodeURIComponent(path))))problems.push(`${file}: missing link ${path}`);
 }
}
const html=readFileSync('index.html','utf8');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
for(const id of new Set(ids))if(ids.filter(n=>n===id).length>1)problems.push(`Duplicate HTML id: ${id}`);
const source=ts.createSourceFile('messages.ts',readFileSync('src/ui/messages.ts','utf8'),ts.ScriptTarget.Latest,true);
const keys=new Set();
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='jaMessages'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){
  for(const p of node.initializer.properties){const key=p.name?.text;if(keys.has(key))problems.push(`Duplicate Japanese key: ${key}`);keys.add(key);}
 }
 ts.forEachChild(node,visit);
}visit(source);
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
for(const m of html.matchAll(/\sdata-i18n(?:-(?:aria-label|title|content))?="([^"]+)"/g)){
 const key=decode(m[1]);if(!keys.has(key))problems.push(`Missing static Japanese translation: ${key}`);
}
function checkTree(path){for(const name of readdirSync(path)){const child=resolve(path,name);if(statSync(child).isDirectory())checkTree(child);else if(['.ts','.css','.html'].includes(extname(child))&&/^(?:<<<<<<< |>>>>>>> )/m.test(readFileSync(child,'utf8')))problems.push(`Conflict marker: ${child.slice(root.length+1)}`);}}
checkTree('src');
if(problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log(`Checked ${files.length} documents, ${ids.length} unique HTML IDs and ${keys.size} Japanese message keys.`);
