import {readFile,writeFile} from 'node:fs/promises';
import {deepseek} from './services.mjs';
import {verifiedSpeech,voiceEndpoint,recognitionSession} from './realtime-voice.mjs';
import {WebSocket} from './vendor/ws/wrapper.mjs';
const c=JSON.parse(await readFile(new URL('./.local/config.json',import.meta.url),'utf8'));
async function analysis(){let content='',reasoning=false;const start=Date.now();try{
 for await(const d of deepseek(c,[{role:'system',content:'这是一项连接测试。不要检索或编造项目。只用简短中文回答。'},{role:'user',content:'虚构测试企业希望减少零件抛光损伤，但材料和验收标准未知。请只提出一个最关键的追问，不超过60字。'}],[],AbortSignal.timeout(90000))){if(d.reasoning_content)reasoning=true;content+=d.content||'';}
 console.log('DEEPSEEK',JSON.stringify({ok:!!content,reasoning,content,ms:Date.now()-start}));
 if(content){const audio=await verifiedSpeech(c,content,{signal:AbortSignal.timeout(120000)});await writeFile(new URL('./.local/deepseek-verified-speech.wav',import.meta.url),audio);console.log('DEEPSEEK_SPEECH',JSON.stringify({ok:true,verified:true,bytes:audio.length}));}
 }catch(e){console.log('DEEPSEEK_OR_SPEECH_ERROR',e.message);}}
async function recognition(){let ws;await new Promise(resolve=>{const timer=setTimeout(()=>{console.log('VOICE_INPUT_TIMEOUT');ws?.close();resolve();},30000);ws=new WebSocket(voiceEndpoint(c),{headers:{Authorization:`Bearer ${c.bailianKey}`},handshakeTimeout:20000});
 const done=()=>{clearTimeout(timer);ws.close();resolve();};ws.on('open',()=>ws.send(JSON.stringify({event_id:crypto.randomUUID(),type:'session.update',session:recognitionSession(c)})));
 ws.on('message',raw=>{const e=JSON.parse(raw);if(e.type==='session.updated'){console.log('VOICE_INPUT_SESSION',JSON.stringify({ok:true,model:c.voiceModel,modalities:e.session?.modalities}));done();}if(e.type==='error'){console.log('VOICE_INPUT_ERROR',String(e.error?.code||'unknown'));done();}});
 ws.on('error',()=>{console.log('VOICE_INPUT_CONNECTION_FAILED');done();});ws.on('unexpected-response',(_req,res)=>{res.resume();console.log('VOICE_INPUT_HTTP',res.statusCode);done();});});}
await Promise.allSettled([analysis(),recognition()]);
