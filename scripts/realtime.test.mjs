import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {mkdir,mkdtemp,readFile,copyFile} from 'node:fs/promises';
import vm from 'node:vm';
import {WebSocket,WebSocketServer} from './vendor/ws/wrapper.mjs';
import {attachRealtime,makeInstructions} from './realtime-server.mjs';
import {defaults,validateConfig,publicConfig,endpoint,sessionConfig} from './realtime-config.mjs';
import {loadKnowledgeBase,searchKnowledge} from './knowledge-base.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture={...defaults,apiKey:'sk-test-placeholder',workspaceId:'workspace-test'};

test('configuration validates destinations, excludes keys, and maps model-specific VAD',()=>{
  assert.throws(()=>validateConfig({...fixture,workspaceId:'evil.example/?x='}));
  assert.throws(()=>validateConfig({...fixture,model:'unadapted-model'}));
  assert.throws(()=>validateConfig({...fixture,region:'evil.example'}));
  assert.throws(()=>validateConfig({...fixture,apiKey:'secret\r\ninjected'}));
  assert.equal(publicConfig(fixture).apiKey,undefined);
  assert.equal(publicConfig(defaults).ready,false);
  assert.match(endpoint(fixture),/^wss:\/\/workspace-test.cn-beijing.maas.aliyuncs.com\//);
  assert.equal(sessionConfig(fixture,'prompt').turn_detection.type,'smart_turn');
  const omni=sessionConfig({...fixture,model:'qwen3.8-omni-flash-realtime'},'prompt');
  assert.equal(omni.turn_detection.type,'semantic_vad');assert.equal(omni.voice,'Tina');
  assert.equal(omni.input_audio_transcription.model,'qwen3-asr-flash-realtime');
  assert.equal(sessionConfig(fixture,'prompt').tools[0].function.name,'search_lab_knowledge');
  assert.equal(sessionConfig(fixture,'prompt').tools[1].function.name,'open_lab_media');
  assert.deepEqual(sessionConfig(fixture,'prompt').tools[1].function.parameters.properties.kind.enum,['direction','project','image','video']);
});

test('local retrieval ranks relevant source-backed passages and abstains on unknown facts',async()=>{
  const kb=await loadKnowledgeBase(root);
  const cases=[
    ['介绍一下这个实验室',/未来设计实验室|创新设计.*人工智能/],
    ['具体介绍一下你们的实验室',/未来设计实验室|创新设计.*人工智能/],
    ['实验室主要研究方向是什么？',/数据智能与产品创新/],
    ['未来设计实验室和智慧绿洲是什么关系？',/智慧绿洲/],
    ['你们做服装设计吗？',/服饰|服装/],
    ['怎么检索非标库存？',/非标准物品|非标库存/],
    ['第三师45团项目建成了吗？',/不能证明项目已经获批|实施状态尚未确认/]
  ];
  for(const [query,expected]of cases){const found=searchKnowledge(query,kb);assert.match(found[0]?.excerpt||'',expected,query);assert(found[0]?.source);}
  assert.deepEqual(searchKnowledge('谁是实验室导师？',kb).map(x=>x.title),['尚未确认的对外信息']);
  assert.equal(searchKnowledge('小 D 你好，今天天气怎么样？',kb).length,0);
});

test('every project title and alias from the new PPTs is retrievable, including Hanfu',async()=>{
  const sandbox={window:{}};vm.runInNewContext(await readFile(path.join(root,'dist/content.js'),'utf8'),sandbox);
  vm.runInNewContext(await readFile(path.join(root,'dist/projects.js'),'utf8'),sandbox);
  const kb=await loadKnowledgeBase(root),projects=sandbox.window.LAB_CONTENT.projects;
  for(const p of projects){
    const exact=searchKnowledge(`请介绍${p.title}`,kb,{limit:5});
    const compact=s=>s.replace(/[\s\u3000]/g,'');
    assert(exact.some(x=>compact(x.title)===compact(p.title)),`No top-five exact project hit: ${p.title}`);
    for(const alias of p.aliases||[]){
      const hits=searchKnowledge(`我想了解${alias}方面`,kb,{limit:5});
      assert(hits.length>0,`Alias '${alias}' had no sourced result for project: ${p.title}`);
    }
  }
  const hanfu=searchKnowledge('我想了解汉服方面的案例',kb);
  assert.equal(hanfu[0]?.title,'汉服的挖掘与创新');
});

test('full-screen media stage stops and unloads the old video before showing the next item',async()=>{
  class Node{
    constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.currentSrc='';this.paused=false;}
    append(node){this.children.push(node);}replaceChildren(){this.children=[];}
    querySelectorAll(tag){return this.children.filter(x=>x.tagName===tag);}
    pause(){this.paused=true;}removeAttribute(key){delete this[key];this.currentSrc='';}load(){this.unloaded=true;}
    setAttribute(key,value){this.attrs[key]=value;}play(){this.paused=false;return Promise.resolve();}
  }
  const document={createElement:tag=>new Node(tag)},sandbox={window:{OFFLINE_ASSETS:{'case.png':'data:image/png;base64,AA=='}},document};
  vm.runInNewContext(await readFile(path.join(root,'dist/media-stage.js'),'utf8'),sandbox);
  const frame=new Node('frame'),stage=sandbox.window.LabMediaStage;
  const first=stage.mount(frame,{src:'first.mp4',title:'第一段'});
  const second=stage.mount(frame,{src:'second.mp4',title:'第二段'});
  assert.equal(first.paused,true);assert.equal(first.currentSrc,'');assert.equal(first.unloaded,true);
  assert.deepEqual(frame.children,[second]);assert.equal(second.src,'second.mp4');assert.equal(second.controls,false);assert.equal(second.autoplay,true);
  const image=stage.mount(frame,{image:'case.png',title:'案例图片'});
  assert.equal(second.paused,true);assert.equal(second.currentSrc,'');assert.deepEqual(frame.children,[image]);
  assert.equal(image.src,'data:image/png;base64,AA==','offline project images must resolve from embedded assets');
});

test('microphone worklet preserves sample count and amplitude across block boundaries',async()=>{
  const code=await readFile(path.join(root,'dist/pcm-worklet.js'),'utf8');
  for(const rate of [44100,48000,16000]){
    let Processor;const output=[];
    class Base{constructor(){this.port={postMessage:b=>output.push(new Int16Array(b))};}}
    vm.runInNewContext(code,{sampleRate:rate,AudioWorkletProcessor:Base,registerProcessor:(_name,p)=>{Processor=p;}});
    const node=new Processor();
    for(let offset=0;offset<rate;offset+=128)node.process([[new Float32Array(Math.min(128,rate-offset)).fill(.5)]]);
    assert.equal(output.reduce((n,x)=>n+x.length,0),16000,`rate=${rate}`);
    for(const frame of output)for(const sample of frame)assert(Math.abs(sample-16384)<=1);
  }
});

function inbox(ws){
  const messages=[],waiters=[];
  ws.on('message',data=>{const e=JSON.parse(data.toString());messages.push(e);for(const w of [...waiters])if(w.p(e)){waiters.splice(waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(e);}});
  return {messages,wait(p){const hit=messages.find(p);if(hit)return Promise.resolve(hit);return new Promise((resolve,reject)=>{const w={p,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Event timeout'));},2000)};waiters.push(w);});}};
}
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}

test('local mock provider: authentication, audio, interruption, transcripts, teardown and origin protection',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'yuhuan-realtime-'));
  await mkdir(path.join(dir,'dist'));await mkdir(path.join(dir,'knowledge'));
  await copyFile(path.join(root,'dist/content.js'),path.join(dir,'dist/content.js'));
  await copyFile(path.join(root,'dist/projects.js'),path.join(dir,'dist/projects.js'));
  await copyFile(path.join(root,'knowledge','lab-kb.json'),path.join(dir,'knowledge','lab-kb.json'));
  await copyFile(path.join(root,'knowledge','lab-projects.json'),path.join(dir,'knowledge','lab-projects.json'));
  const providerHttp=http.createServer(),provider=new WebSocketServer({server:providerHttp});
  const pp=await listen(providerHttp);let providerSocket,providerInbox,headers,requestedUrl;
  provider.on('connection',(ws,req)=>{
    providerSocket=ws;headers=req.headers;providerInbox=inbox(ws);
    ws.on('message',raw=>{const e=JSON.parse(raw);if(e.type==='session.update')ws.send(JSON.stringify({type:'session.updated',session:{secret:'must-not-forward'}}));});
  });
  let bridge;
  const server=http.createServer(async(req,res)=>{
    if(!await bridge.handleHttp(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}
  });
  bridge=attachRealtime(server,{root:dir,connect:(url,options)=>{requestedUrl=url;return new WebSocket(`ws://127.0.0.1:${pp}`,options);}});
  const port=await listen(server),base=`http://127.0.0.1:${port}`;
  const clients=[];
  t.after(async()=>{for(const ws of clients)ws.terminate();for(const ws of provider.clients)ws.terminate();server.closeAllConnections();await new Promise(r=>server.close(r));provider.close();await new Promise(r=>providerHttp.close(r));});
  const post=body=>fetch(base+'/api/realtime/config',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
  let r=await post(fixture);assert.equal(r.status,200);assert.equal((await r.json()).hasKey,true);
  assert.equal((await fetch(base+'/api/realtime/config').then(r=>r.json())).apiKey,undefined);
  r=await post({...defaults,workspaceId:'workspace-test',apiKey:''});assert.equal((await r.json()).hasKey,true,'blank input preserves key');
  const bad=await fetch(base+'/api/realtime/config',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
  const forged=new WebSocket(`ws://127.0.0.1:${port}/api/realtime`,{origin:'https://evil.example'});
  const denied=new Promise(resolve=>forged.on('unexpected-response',(_req,res)=>{res.resume();forged.terminate();resolve(res.statusCode);}));forged.on('error',()=>{});assert.equal(await denied,403);
  const client=new WebSocket(`ws://127.0.0.1:${port}/api/realtime`,{origin:base});clients.push(client);const events=inbox(client);await once(client,'open');
  client.send(JSON.stringify({type:'bridge.start',mode:'needs'}));await events.wait(e=>e.type==='bridge.ready');
  assert.equal(headers.authorization,'Bearer sk-test-placeholder');assert.match(requestedUrl,/model=qwen-audio-3.1-realtime-plus/);
  assert.match(providerInbox.messages[0].session.instructions,/协助用户梳理产业问题/);
  assert.match(providerInbox.messages[0].session.instructions,/必须先调用 search_lab_knowledge/);
  assert(!providerInbox.messages[0].session.instructions.includes('第三师45团项目可行性研究报告'));
  assert.equal(providerInbox.messages[0].session.tools[0].function.name,'search_lab_knowledge');
  assert(!JSON.stringify(events.messages).includes('must-not-forward'));assert(!JSON.stringify(events.messages).includes('sk-test'));
  assert.equal((await post(fixture)).status,409,'configuration locked while connected');
  const competing=new WebSocket(`ws://127.0.0.1:${port}/api/realtime`,{origin:base});clients.push(competing);const competingEvents=inbox(competing);await competingEvents.wait(e=>e.type==='bridge.error');
  const audio=Buffer.alloc(3200).toString('base64');client.send(JSON.stringify({type:'input_audio_buffer.append',audio}));
  assert.equal((await providerInbox.wait(e=>e.type==='input_audio_buffer.append')).audio,audio);
  providerSocket.send(JSON.stringify({type:'response.created',response:{id:'answer-1'}}));
  providerSocket.send(JSON.stringify({type:'response.audio.delta',response_id:'answer-1',delta:audio}));
  assert.equal((await events.wait(e=>e.type==='response.audio.delta')).delta,audio);
  providerSocket.send(JSON.stringify({type:'input_audio_buffer.speech_started'}));
  await providerInbox.wait(e=>e.type==='response.cancel');await events.wait(e=>e.type==='input_audio_buffer.speech_started');
  providerSocket.send(JSON.stringify({type:'conversation.item.input_audio_transcription.completed',item_id:'user-1',transcript:'我们想改进阀门。'}));
  assert.equal((await events.wait(e=>e.type==='conversation.item.input_audio_transcription.completed')).transcript,'我们想改进阀门。');
  providerSocket.send(JSON.stringify({type:'response.created',response:{id:'tool-round'}}));
  providerSocket.send(JSON.stringify({type:'response.function_call_arguments.done',response_id:'tool-round',call_id:'kb-1',name:'search_lab_knowledge',arguments:JSON.stringify({query:'实验室主要研究方向是什么？'})}));
  const knowledgeOutput=await providerInbox.wait(e=>e.type==='conversation.item.create'&&e.item.type==='function_call_output');
  assert.match(knowledgeOutput.item.output,/数据智能与产品创新/);
  assert.match(knowledgeOutput.item.output,/未来设计实验室介绍-202604_精简版/);
  providerSocket.send(JSON.stringify({type:'response.done',response:{id:'tool-round',status:'completed'}}));
  await providerInbox.wait(e=>e.type==='response.create');
  providerSocket.send(JSON.stringify({type:'response.created',response:{id:'project-round'}}));
  providerSocket.send(JSON.stringify({type:'response.function_call_arguments.done',response_id:'project-round',call_id:'project-1',name:'open_lab_media',arguments:JSON.stringify({kind:'project',title:'汉服的挖掘与创新'})}));
  const projectPage=await events.wait(e=>e.type==='bridge.media'&&e.kind==='project');
  assert.equal(projectPage.title,'汉服的挖掘与创新');
  const projectOutput=await providerInbox.wait(e=>e.type==='conversation.item.create'&&e.item.type==='function_call_output'&&e.item.call_id==='project-1');
  assert.match(projectOutput.item.output,/项目图文页/);assert.match(projectOutput.item.output,/图片和文字/);
  providerSocket.send(JSON.stringify({type:'response.function_call_arguments.done',response_id:'project-round',call_id:'category-1',name:'open_lab_media',arguments:JSON.stringify({kind:'project',title:'服饰与时尚设计'})}));
  const categoryPage=await events.wait(e=>e.type==='bridge.media'&&e.title==='服饰与时尚设计');
  assert.equal(categoryPage.kind,'project');
  const categoryOutput=await providerInbox.wait(e=>e.type==='conversation.item.create'&&e.item.type==='function_call_output'&&e.item.call_id==='category-1');
  assert.match(categoryOutput.item.output,/已打开项目类别/);
  providerSocket.send(JSON.stringify({type:'response.function_call_arguments.done',response_id:'project-round',call_id:'nav-1',name:'open_lab_media',arguments:JSON.stringify({kind:'project',title:'返回首页'})}));
  const navPage=await events.wait(e=>e.type==='bridge.media'&&e.title==='返回首页');
  assert.equal(navPage.kind,'project');
  const navOutput=await providerInbox.wait(e=>e.type==='conversation.item.create'&&e.item.type==='function_call_output'&&e.item.call_id==='nav-1');
  assert.match(navOutput.item.output,/已执行展区导航/);
  providerSocket.send(JSON.stringify({type:'response.done',response:{id:'project-round',status:'completed'}}));
  await providerInbox.wait(e=>e.type==='response.create');
  providerSocket.send(JSON.stringify({type:'response.created',response:{id:'kb-answer'}}));
  providerSocket.send(JSON.stringify({type:'response.audio_transcript.done',response_id:'kb-answer',transcript:'实验室有三个重点方向。'}));
  providerSocket.send(JSON.stringify({type:'response.done',response:{id:'kb-answer',status:'completed'}}));
  client.send(JSON.stringify({type:'bridge.text',text:'请总结需求。'}));
  assert.equal((await providerInbox.wait(e=>e.type==='conversation.item.create'&&e.item.type==='message')).item.content[0].text,'请总结需求。');
  await providerInbox.wait(e=>e.type==='response.create');
  const providerClosed=once(providerSocket,'close');client.close();await once(client,'close');await providerClosed;
  r=await post({clearKey:true});assert.equal((await r.json()).hasKey,false);
  const noKey=new WebSocket(`ws://127.0.0.1:${port}/api/realtime`,{origin:base});clients.push(noKey);const noKeyEvents=inbox(noKey);await once(noKey,'open');noKey.send(JSON.stringify({type:'bridge.start'}));
  assert.match((await noKeyEvents.wait(e=>e.type==='bridge.error')).message,/API Key/);
});

test('prompt introduces the future design lab and routes lab facts to retrieval',async()=>{
  const sandbox={window:{}};vm.runInNewContext(await readFile(path.join(root,'dist/content.js'),'utf8'),sandbox);
  vm.runInNewContext(await readFile(path.join(root,'dist/projects.js'),'utf8'),sandbox);
  const prompt=makeInstructions(sandbox.window.LAB_CONTENT,'general');
  assert.match(prompt,/浙江大学未来设计实验室/);assert.match(prompt,/不得依据模型常识补充实验室事实/);assert.match(prompt,/一次最多问一个问题/);
  assert.match(prompt,/调用 open_lab_media/);assert.match(prompt,/汉服设计演示/);assert.match(prompt,/智慧城市感知系统/);assert.match(prompt,/kind 设为 direction/);
  assert.match(prompt,/汉服的挖掘与创新/);assert.match(prompt,/kind=project/);assert.match(prompt,/停止当前正在播放的视频/);
  assert(prompt.length<4500,`Base prompt should stay compact (${prompt.length} chars)`);
  assert(!prompt.includes('好设计馆'));assert(!prompt.includes('第三师45团项目可行性研究报告'));
});

async function clientHarness({deferMic=false}={}){
  class Element{
    constructor(){this.value='';this.textContent='';this.children=[];this.disabled=false;this.hidden=false;}
    append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
    querySelector(){return null;}remove(){}addEventListener(){}showModal(){}close(){}click(){}
  }
  const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const tracks=[{enabled:true,stopped:false,stop(){this.stopped=true;}}];
  const media={getTracks:()=>tracks,getAudioTracks:()=>tracks};let grant;
  const microphone=deferMic?new Promise(r=>{grant=r;}):Promise.resolve(media);
  const sockets=[],audioContexts=[],nodes=[];let begin=0,end=0;
  class MockSocket{
    static OPEN=1;
    constructor(){this.readyState=1;this.bufferedAmount=0;this.sent=[];sockets.push(this);}
    send(value){this.sent.push(JSON.parse(value));}close(){this.closed=true;this.readyState=3;}
    emit(event){this.onmessage?.({data:JSON.stringify(event)});}
  }
  class Audio{
    constructor(){this.currentTime=0;this.audioWorklet={addModule:async()=>{}};this.destination={};this.played=[];audioContexts.push(this);}
    async resume(){}async close(){this.closed=true;}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createGain(){return {gain:{value:1},connect(){},disconnect(){}};}
    createBuffer(_channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){this.stopped=true;}};this.played.push(source);return source;}
  }
  class Worklet{constructor(){this.port={};nodes.push(this);}connect(){}disconnect(){this.disconnected=true;}}
  const window={GuideRealtimeBridge:{begin(){begin++;},end(){end++;}}};
  const document={body:new Element(),createElement:()=>new Element(),getElementById:el,addEventListener(){}};
  const sandbox={window,document,location:{protocol:'http:',host:'localhost:5173'},navigator:{mediaDevices:{getUserMedia:()=>microphone}},
    AudioContext:Audio,AudioWorkletNode:Worklet,WebSocket:MockSocket,Option:Element,crypto:{randomUUID:()=>String(Math.random())},
    fetch:async()=>({ok:true,json:async()=>publicConfig(fixture)}),setTimeout,clearTimeout,addEventListener(){},
    atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')};
  vm.runInNewContext(await readFile(path.join(root,'dist/realtime.js'),'utf8'),sandbox);
  await new Promise(setImmediate);
  return {el,window,tracks,sockets,audioContexts,nodes,grant:()=>grant(media),counts:()=>({begin,end})};
}

test('client plays streamed PCM, drops interrupted audio, merges captions, and releases mic on errors',async()=>{
  const h=await clientHarness();await h.el('rtStart').onclick();const socket=h.sockets[0];socket.onopen();
  assert.equal(socket.sent[0].type,'bridge.start');
  socket.emit({type:'bridge.ready'});assert.equal(h.el('rtText').disabled,false);
  h.nodes[0].port.onmessage({data:new Int16Array(1600).buffer});assert.equal(socket.sent.at(-1).type,'input_audio_buffer.append');
  socket.emit({type:'response.created',response:{id:'r1'}});
  socket.emit({type:'response.text.delta',response_id:'r1',delta:'你好'});
  socket.emit({type:'response.audio_transcript.delta',response_id:'r1',delta:'你好'});
  assert.equal(h.el('rtTranscript').children[0].children[1].textContent,'你好','text and audio captions must not double');
  const audio=Buffer.alloc(4800).toString('base64');socket.emit({type:'response.audio.delta',response_id:'r1',delta:audio});
  assert.equal(h.window.RealtimeGuide.speaking,true);
  socket.emit({type:'input_audio_buffer.speech_started'});
  assert.equal(h.audioContexts[0].played[0].stopped,true);assert.equal(h.window.RealtimeGuide.speaking,false);
  socket.emit({type:'response.audio.delta',response_id:'r1',delta:audio});assert.equal(h.audioContexts[0].played.length,1);
  socket.emit({type:'response.created',response:{id:'r2'}});socket.emit({type:'response.audio_transcript.done',response_id:'r2',transcript:'请继续'});
  socket.emit({type:'response.done',response:{id:'r2',status:'completed'}});socket.emit({type:'input_audio_buffer.speech_started'});
  assert.equal(h.el('rtTranscript').children[1].children[1].textContent,'请继续','completed answer must not be marked interrupted');
  h.el('rtMute').onclick();assert.equal(h.tracks[0].enabled,false);
  socket.emit({type:'bridge.error',message:'模拟网络断开'});
  assert.equal(h.tracks[0].stopped,true);assert.equal(h.audioContexts[0].closed,true);assert.equal(socket.closed,true);
  assert.deepEqual(h.counts(),{begin:1,end:1});assert.equal(h.window.RealtimeGuide.active,false);
  assert.equal(h.el('rtStatus').textContent,'模拟网络断开');
});

test('stopping while microphone permission is pending cannot start a late cloud session',async()=>{
  const h=await clientHarness({deferMic:true});const start=h.el('rtStart').onclick();await new Promise(setImmediate);
  h.el('rtStop').onclick();h.grant();await start;
  assert.equal(h.tracks[0].stopped,true);assert.equal(h.sockets.length,0);assert.equal(h.audioContexts[0].closed,true);
  assert.deepEqual(h.counts(),{begin:1,end:1});
});
