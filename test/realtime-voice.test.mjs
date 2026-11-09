import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {verifiedSpeech,sameSpeechText,voiceEndpoint,recognitionSession,playbackSession} from '../realtime-voice.mjs';
const cfg={voiceModel:'qwen-audio-3.1-realtime-flash',workspaceId:'test-space',region:'cn-beijing',bailianKey:'test-key',voice:''};
function fixture(transcript,{omitTranscript=false,status='completed'}={}){
  const events=[];let socket;
  const connect=(url,options)=>{socket=new EventEmitter();socket.close=()=>{};socket.send=raw=>{const e=JSON.parse(raw);events.push(e);if(e.type==='session.update')queueMicrotask(()=>socket.emit('message',JSON.stringify({type:'session.updated'})));if(e.type==='response.create')queueMicrotask(()=>{socket.emit('message',JSON.stringify({type:'response.audio.delta',delta:Buffer.from([0,0,1,0]).toString('base64')}));if(!omitTranscript)socket.emit('message',JSON.stringify({type:'response.audio_transcript.done',transcript}));socket.emit('message',JSON.stringify({type:'response.done',response:{status}}));});};queueMicrotask(()=>socket.emit('open'));return socket;};return {connect,events};
}
test('语音端点保持用户指定模型，识别不输出音频且朗读关闭自动接话',()=>{assert.match(voiceEndpoint(cfg),/model=qwen-audio-3.1-realtime-flash$/);assert.deepEqual(recognitionSession(cfg).modalities,['text']);assert.equal(playbackSession(cfg).turn_detection,null);assert.equal('voice' in playbackSession(cfg),false);});
test('语音转写必须保持数字、标点和全部内容，仅容忍空白排版差异',()=>{assert.equal(sameSpeechText('试点需2周。','试点需 2 周。'),true);assert.equal(sameSpeechText('试点需2周。','试点需3周。'),false);assert.equal(sameSpeechText('成本1.5万元。','成本15万元。'),false);assert.equal(sameSpeechText('建议先验证。','建议先验证。我们可以保证落地。'),false);assert.equal(sameSpeechText('建议先验证。',''),false);});
test('核对通过才返回24kHz WAV，送入模型的原文未改写',async()=>{const f=fixture('先做小范围验证。');const audio=await verifiedSpeech(cfg,'先做小范围验证。',{connect:f.connect});assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.readUInt32LE(24),24000);assert.equal(audio.length,48);assert.equal(f.events.find(e=>e.type==='conversation.item.create').item.content[0].text,'先做小范围验证。');});
test('改写、缺少转写、未完成的语音均不返回音频',async()=>{for(const f of [fixture('我们已经替您联系好了。'),fixture('',{omitTranscript:true}),fixture('先验证。',{status:'cancelled'})])await assert.rejects(()=>verifiedSpeech(cfg,'先验证。',{connect:f.connect}),/未播放|阻止播放/);});
test('已取消的播报不会发起上游请求',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(()=>verifiedSpeech(cfg,'先验证。',{signal:controller.signal,connect:()=>{throw Error('不应连接');}}),/取消/);});
