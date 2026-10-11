import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const excluded=new Set(['.git','.local','.npm-cache','node_modules','test-artifacts']);
const entries=[];
async function visit(relative=''){
  for(const item of await readdir(path.join(root,relative),{withFileTypes:true})){
    if(excluded.has(item.name)||item.name.startsWith('.env')||item.name==='FILE_MANIFEST.json'||item.name.endsWith('.log'))continue;
    const name=relative?relative+'/'+item.name:item.name;
    if(item.isDirectory())await visit(name);
    else if(item.isFile()){const buffer=await readFile(path.join(root,name));entries.push({path:name,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});}
  }
}
await visit();entries.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(path.join(root,'FILE_MANIFEST.json'),JSON.stringify(entries,null,2)+'\n');
console.log(`Manifest updated: ${entries.length} public project files (credentials, dependencies and caches excluded).`);
