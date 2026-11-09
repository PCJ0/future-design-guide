import {readFile,writeFile} from 'node:fs/promises';
import {WebSocket} from './vendor/ws/wrapper.mjs';
import {voiceEndpoint,recognitionSession} from './realtime-voice.mjs';
const wav=await readFile(new URL('./.local/deepseek-verified-speech.wav',import.meta.url));
const pcm=wav.subarray(44),samples=pcm.length/2,resampled=Buffer.alloc(Math.floor(samples*2/3)*2);
for(let i=0;i<resampled.length/2;i++){const source=i*1.5,index=Math.floor(source),fraction=source-index;const a=pcm.readInt16LE(index*2),b=pcm.readInt16LE(Math.min(index+1,samples-1)*2);resampled.writeInt16LE(Math.round(a*(1-fraction)+b*fraction),i*2);}
const direct=process.argv.includes('--direct');const cfg=direct?JSON.parse(await readFile(new URL('./.local/config.json',import.meta.url),'utf8')):null;
const ws=new WebSocket(direct?voiceEndpoint(cfg):`ws://127.0.0.1:${process.argv.includes('--diagnostic')?'5189':'5188'}/api/asr`,{headers:direct?{Authorization:`Bearer ${cfg.bailianKey}`}:{Origin:`http://127.0.0.1:${process.argv.includes('--diagnostic')?'5189':'5188'}`}});
let ticker,timer,offset=0,transcripts=[];
const result=await new Promise(resolve=>{
const done=result=>{clearInterval(ticker);clearTimeout(timer);ws.close();resolve(result);};
timer=setTimeout(()=>done({ok:false,error:'没有在30秒内收到测试音频转写',transcripts}),30000);
ws.on('open',()=>{if(direct)ws.send(JSON.stringify({event_id:crypto.randomUUID(),type:'session.update',session:recognitionSession(cfg)}));});
ws.on('message',raw=>{const e=JSON.parse(raw);if(direct&&process.argv.includes('--cancel')&&e.type==='response.created')ws.send(JSON.stringify({event_id:crypto.randomUUID(),type:'response.cancel'}));if(direct)console.log('UPSTREAM_EVENT',e.type,e.error?.code||'',e.error?.message?String(e.error.message).replaceAll(cfg.bailianKey,'[redacted]').slice(0,400):'');if(e.type==='ready'||direct&&e.type==='session.updated'){ticker=setInterval(()=>{if(offset<resampled.length){const part=resampled.subarray(offset,offset+3200);offset+=part.length;ws.send(JSON.stringify({event_id:crypto.randomUUID(),type:direct?'input_audio_buffer.append':'audio',audio:part.toString('base64')}));}else if(offset<resampled.length+64000){offset+=3200;ws.send(JSON.stringify({event_id:crypto.randomUUID(),type:direct?'input_audio_buffer.append':'audio',audio:Buffer.alloc(3200).toString('base64')}));}},100);}if(e.type==='transcript'||direct&&e.type==='conversation.item.input_audio_transcription.completed'){transcripts.push(e.text||e.transcript);done({ok:true,transcripts,syntheticAudio:true});}if(e.type==='error')done({ok:false,error:e.text});});ws.on('error',()=>done({ok:false,error:'本机语音桥接连接失败'}));
});
await writeFile(new URL('./.local/recognition-test-report.json',import.meta.url),JSON.stringify(result,null,2));console.log('RECOGNITION',JSON.stringify(result));
