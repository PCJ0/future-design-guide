import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadCatalog} from './catalog.mjs';
const c=JSON.parse(await readFile(new URL('./.local/config.json',import.meta.url),'utf8'));
const result=await loadCatalog(c,{root:fileURLToPath(new URL('.',import.meta.url)),onProgress:e=>console.log('CATALOG',JSON.stringify(e))});
console.log('CATALOG_READY',JSON.stringify({projects:result.projects.length,methods:result.methods.length,projectSample:result.projects.slice(0,1),methodSample:result.methods.slice(0,1)}));
