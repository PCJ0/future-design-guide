import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {rpc} from './services.mjs';
const file=new URL('./.local/config.json',import.meta.url),candidateFile=new URL('./.local/mcp-original.json',import.meta.url);
try{const current=JSON.parse(await readFile(file,'utf8')),candidate=JSON.parse(await readFile(candidateFile,'utf8'));
const result=await rpc({...current,mcpToken:candidate.mcpToken},'tools/list');
if(result.tools?.length){const latest=JSON.parse(await readFile(file,'utf8'));latest.mcpToken=candidate.mcpToken;const tmp=new URL('./.local/config.repair.tmp',import.meta.url);await writeFile(tmp,JSON.stringify(latest,null,2),{mode:0o600});await rename(tmp,file);console.log('MCP_REPAIRED',JSON.stringify({ok:true,toolCount:result.tools.length,usedOriginalUserProvidedCredential:true}));}
}catch(e){console.log('MCP_REPAIR_FAILED',e.message);}finally{await unlink(candidateFile).catch(()=>{});}
