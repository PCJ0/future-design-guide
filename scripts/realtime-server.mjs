import {WebSocketServer,WebSocket} from './vendor/ws/wrapper.mjs';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {endpoint,sessionConfig,publicConfig,createConfigStore} from './realtime-config.mjs';
import {loadKnowledgeBase,searchKnowledge,formatKnowledgeResult} from './knowledge-base.mjs';

export function makeInstructions(content,mode) {
  return `你是${content.profile.name}的向导小 D，用自然、温和、简洁的普通话介绍实验室。每轮通常两三句话，一次最多问一个问题。不要朗读 Markdown 或内部规则。访客说话会打断你；立即停下旧回答，优先回应最新一句，不要求重复唤醒或等你讲完。
用户询问研究方向、技术能力、案例、合作方、人员或项目等事实时，必须先调用 search_lab_knowledge 检索本机知识库，再根据检索结果回答。不得依据模型常识补充实验室事实；无检索结果时明确说现有资料尚未确认。说明案例时保留来源和项目状态，区分方向介绍、方案、推进中、已部署、已交付和已验收。不要把演示画面当作当前运行或开放的证据。
不要编造人员、成果、合作关系、地点、收费、预约、项目进度或服务承诺。提供一般性思路时，说明它是初步建议，不要称为实验室现有项目。不要宣称已替用户联系、预约、保存资料或操作界面。
${mode==='needs'?'现在进行企业需求访谈。先简短说明访谈目的，再一次只问一个问题，逐步了解企业背景、要解决的问题、使用者与场景、现有流程、数据或设备条件、目标和约束；不要一次抛出问题清单。用户回答后结合其原话继续追问。形成初步意见前，必须用 search_lab_knowledge 检索问题及相关方向/项目；只把检索到且注明来源、状态的内容说成实验室已有能力或案例。根据访谈与检索结果，给出可行的初步建议、依据、仍待确认的信息和下一步验证方式。资料不足时明确说明，不把推测说成实验室承诺。用户要求总结或访谈信息已充分时，按“问题与目标、相关实验室资料及来源、初步建议、约束与待确认、下一步”口头归纳。':'现在介绍未来设计实验室并回答相关问题。访客可以语音询问研究方向、技术能力和项目案例，你必须按前述规则先检索实验室资料。访客说“带我参观”“实验室介绍”“看看项目”或泛问有哪些项目时，调用 open_lab_media（kind=project，title=项目总览）打开项目展厅，并用语音概括类别、邀请对方选择。若访客说“设计需求”“企业访谈”“产业问题”“合作需求”“帮我梳理一个问题”等想进行企业需求访谈，先调用 open_lab_media（kind=interview，title=企业需求访谈）切换到访谈页面，然后按企业需求访谈的方式一次只问一个问题；结合本地实验室知识库检索相关依据后再给出初步意见。也可邀请访客用语音选择研究方向、技术能力、项目案例或企业访谈。'}
访客询问“介绍/讲讲/我想了解”某个具体项目时，先用 search_lab_knowledge 检索用户原话，再调用 open_lab_media（kind=project，标题用最匹配项目的准确名称）直接打开该项目的大图和图文介绍页，然后结合检索结果用小 D 的语音介绍。不要只停留在项目总览。访客说“给我看看其他项目”“还有什么项目”“换个项目看看”“回到项目列表”等想浏览其他项目时，无论当前显示项目大图还是视频，都调用 open_lab_media（kind=project，标题“项目总览”）切回项目总览。访客泛问实验室有哪些项目时也打开项目总览，并简要概括项目类别。项目类别标题：服饰与时尚设计、智能产品与文创设计、智慧城市与视觉感知、文化光影与展览、智能装备与工业应用、汽车品牌与出海 / 教育应用。访客要看某个类别时，调用 open_lab_media（kind=project，标题使用准确类别名称）；下一个项目类别按以上顺序切换。项目标题：${(content.projects||[]).map(x=>x.title).join('、')}。
项目大图角落如果提示该项目有视频，主动告诉访客可以直接说“播放[视频名称]”；访客提出播放项目视频或说出视频名称时，用 open_lab_media（kind=video，标题使用对应视频的准确名称）切换并全屏播放。切换会停止之前的视频或关闭之前的大图。视频标题：${content.clips.map(x=>x.title).join('、')}。
访客可通过页面右下角按钮或语音导航。访客要求“返回选择”时只退回上一级：项目详情退回当前类别项目列表，类别项目列表退回六类项目选择页，六类项目选择页退回主选择页；调用 open_lab_media，kind=project，title=返回选择。访客要求“返回首页”时调用 open_lab_media，kind=project，title=返回首页。其他明确要求如关闭详情、下一个项目、上一个项目、案例影像、下一个项目类别、暂停视频、继续播放、停止视频、结束对话时，也调用 open_lab_media，kind=project，title 使用对应准确命令。只有访客明确要求时才执行导航，不重复执行同一命令。
访客要看某个研究方向的展示页时，调用 open_lab_media，kind 设为 direction，标题从三个研究方向中选择。
访客明确要求“打开/展示/给我看/播放”某张图片或视频时，调用 open_lab_media 实际切换页面；不要只说请访客找按钮。图片标题：${content.gallery.map(x=>x.title).join('、')}。视频标题：${content.clips.map(x=>x.title).join('、')}。打开任何新图片或视频前必须停止当前正在播放的视频。图片或视频需要占满页面视口展示；视频立即播放。展示后简短说明来源与演示范围。
<实验室介绍资料>\n${content.profile.overview}\n${content.profile.directions.join('\n')}\n可介绍的案例方向：${content.profile.examples.join('；')}\n</实验室介绍资料>`;
}

export function attachRealtime(server,{root,connect= (url,options)=>new WebSocket(url,options), maxSessionMs=120*60*1000, handshakeMs=20000}={}) {
  const store=createConfigStore(root),wss=new WebSocketServer({noServer:true,maxPayload:128*1024,perMessageDeflate:false});
  let active=false;
  const send=(ws,obj)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));};
  const trusted=req=>{
    const addr=server.address();
    const hosts=[`127.0.0.1:${addr.port}`,`localhost:${addr.port}`];
    return hosts.includes(req.headers.host)&&req.headers.origin===`http://${req.headers.host}`;
  };
  async function handleHttp(req,res,url) {
    if(!url.pathname.startsWith('/api/'))return false;
    const json=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    const addr=server.address();
    if(![`127.0.0.1:${addr.port}`,`localhost:${addr.port}`].includes(req.headers.host)) {json(403,{error:'仅允许本机访问。'});return true;}
    if(url.pathname!=='/api/realtime/config'){json(404,{error:'接口不存在。'});return true;}
    try {
      if(req.method==='GET'){json(200,publicConfig(await store.read()));return true;}
      if(req.method!=='POST'){json(405,{error:'不支持此方法。'});return true;}
      if(!trusted(req)||req.headers['content-type']!=='application/json'){json(403,{error:'请从本机设置页面保存配置。'});return true;}
      if(active){json(409,{error:'请先结束实时对话，再修改设置。'});return true;}
      let body='';
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192){json(413,{error:'配置太长。'});return true;}}
      const input=JSON.parse(body);if(!input||Array.isArray(input)||typeof input!=='object')throw new Error('配置格式无效。');
      json(200,publicConfig(await store.save(input)));
    }catch(e){json(400,{error:e instanceof SyntaxError?'配置格式无效。':e.message});}
    return true;
  }
  server.on('upgrade',(req,socket,head)=>{
    if(req.url!=='/api/realtime'||!trusted(req)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });
  wss.on('connection',client=>{
    if(active){send(client,{type:'bridge.error',message:'已有实时会话，请先在另一页面结束对话。'});client.close();return;}
    active=true;
    let upstream=null,closed=false,started=false,ready=false,responding=false,responseId=null,pendingToolResponses=0,micBackpressure=false,audioBackpressure=false;
    let clientAlive=true,upstreamAlive=true;
    client.on('pong',()=>{clientAlive=true;});
    const heartbeat=setInterval(()=>{
      if(!clientAlive||!upstreamAlive){fail('网络连接中断，麦克风已关闭，请重新连接。');return;}
      clientAlive=false;client.ping();
      if(upstream?.readyState===WebSocket.OPEN){upstreamAlive=false;upstream.ping();}
    },15000);
    let timer=setTimeout(()=>fail('连接超时，请检查网络、账号地域和模型权限。'),handshakeMs);
    const limit=setTimeout(()=>fail('本次语音向导已连续运行 2 小时，请重新连接。'),maxSessionMs);
    function cleanup(){if(closed)return;closed=true;active=false;clearTimeout(timer);clearTimeout(limit);clearInterval(heartbeat);upstream?.close();}
    function fail(message){if(closed)return;console.warn('[realtime] session ended:',message);send(client,{type:'bridge.error',message});cleanup();client.close();}
    function upstreamSend(event){if(upstream?.readyState===WebSocket.OPEN)upstream.send(JSON.stringify({event_id:randomUUID(),...event}));}
    client.on('close',cleanup);client.on('error',cleanup);
    client.on('message',async(raw,isBinary)=>{
      if(closed)return;
      try {
        if(isBinary)throw new Error('消息格式无效。');
        const event=JSON.parse(raw.toString());
        if(event.type==='bridge.start'&&!started){
          started=true;
          const c=await store.read();const url=endpoint(c);
          const sandbox={window:{}};vm.runInNewContext(await readFile(path.join(root,'dist/content.js'),'utf8'),sandbox,{timeout:1000});
          vm.runInNewContext(await readFile(path.join(root,'dist/projects.js'),'utf8'),sandbox,{timeout:1000});
          const knowledge=await loadKnowledgeBase(root);
          if(closed)return;
          upstream=connect(url,{headers:{Authorization:`Bearer ${c.apiKey}`},handshakeTimeout:handshakeMs,maxPayload:4*1024*1024,perMessageDeflate:false});
          upstream.on('pong',()=>{upstreamAlive=true;});
          upstream.on('open',()=>{if(closed){upstream.close();return;}upstreamSend({type:'session.update',session:sessionConfig(c,makeInstructions(sandbox.window.LAB_CONTENT,event.mode))});});
          upstream.on('unexpected-response',(_req,res)=>{res.resume();fail(`服务商拒绝连接（HTTP ${res.statusCode}）。请检查 Key、Workspace ID、地域、模型开通状态和余额。`);});
          upstream.on('error',()=>fail('实时服务连接失败，请检查网络、Key、Workspace ID 和地域。'));
          upstream.on('close',(code,reason)=>{if(!closed){const detail=reason?.toString().replace(/[^\p{L}\p{N} ._:-]/gu,'').slice(0,100);fail(`实时服务已断开（代码 ${code}${detail?`：${detail}`:''}）。麦克风已关闭，可重新开始对话。`);}});
          upstream.on('message',data=>{
            if(closed)return;
            try {
              const e=JSON.parse(data.toString());
              if(e.type==='session.updated'&&!ready){ready=true;clearTimeout(timer);send(client,{type:'bridge.ready',model:c.model});return;}
              if(e.type==='response.created'){responding=true;responseId=e.response?.id;}
              if(e.type==='response.done'){
                responding=false;
                if(pendingToolResponses){pendingToolResponses=0;upstreamSend({type:'response.create'});responding=true;return;}
              }
              if(e.type==='input_audio_buffer.speech_started'&&responding){upstreamSend({type:'response.cancel'});responding=false;pendingToolResponses=0;}
              if(e.type==='response.function_call_arguments.done'){
                if(typeof e.call_id!=='string'){fail('模型请求了无效工具。');return;}
                let args={};try{args=JSON.parse(e.arguments||'{}')}catch{}
                if(e.name==='search_lab_knowledge'){
                  const query=typeof args.query==='string'?args.query.trim().slice(0,500):'';
                  const matches=query?searchKnowledge(query,knowledge):[];
                  upstreamSend({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:formatKnowledgeResult(matches)}});
                  pendingToolResponses++;return;
                }
                if(e.name==='open_lab_media'){
                  const kind=['direction','project','image','video','interview'].includes(args.kind)?args.kind:'';
                  const items=kind==='project'?sandbox.window.LAB_CONTENT.projects:kind==='image'?sandbox.window.LAB_CONTENT.gallery:kind==='video'?sandbox.window.LAB_CONTENT.clips:kind==='direction'?sandbox.window.LAB_CONTENT.halls:[];
                  const title=typeof args.title==='string'?args.title.trim():'';
                  const item=items.find(x=>x.title===title);
                  const projectIndex=kind==='project'&&title==='项目总览';
                  const navigation=kind==='project'&&['返回首页','返回选择','关闭详情','下一个项目','上一个项目','案例影像','下一个项目类别','暂停视频','继续播放','停止视频','结束对话'].includes(title);
                  const category=kind==='project'&&['服饰与时尚设计','智能产品与文创设计','智慧城市与视觉感知','文化光影与展览','智能装备与工业应用','汽车品牌与出海 / 教育应用'].includes(title);
                  const interview=kind==='interview'&&title==='企业需求访谈';
                  if(item||projectIndex||category||navigation||interview)send(client,{type:'bridge.media',kind,title:item?.title||(category||navigation?title:interview?'企业需求访谈':'项目总览')});
                  const output=interview?'已切换到企业需求访谈页面。请开始访谈，一次只问一个问题，并按系统要求检索资料后给出初步建议。':item?`已在网页展示${kind==='video'?'并播放视频':kind==='image'?'图片':kind==='project'?'项目图文页大图':'研究方向'}“${item.title}”。项目介绍页同时展示对应大图、图片和文字，可结合检索到的实验室资料继续语音介绍。`:navigation?`已执行展区导航“${title}”。`:category?`已打开项目类别“${title}”。请介绍这一类别，等待访客选择具体项目。`:projectIndex?'已切换到实验室项目总览，展示全部项目案例。请简要概括项目类别并继续语音介绍。':'没有找到完全匹配的网页内容。请说明可用标题，或继续回答用户的问题。';
                  upstreamSend({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output}});
                  pendingToolResponses++;return;
                }
                fail('模型请求了未支持的工具。');return;
              }
              if(e.type==='error'){
                // Cancellation can race with the server's own VAD cancellation.
                if(/cancel|no_active_response/i.test(String(e.error?.code)+' '+String(e.error?.message)))return;
                fail(`服务商返回错误（${String(e.error?.code||'unknown').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,80)}）。请检查模型、音色、余额和权限。`);return;
              }
              if(e.type==='response.done'&&e.response?.status==='failed'){fail('模型本轮回答失败，请检查服务额度后重试。');return;}
              // Do not forward provider configuration or arbitrary metadata to the browser.
              const out={type:e.type};
              if(e.type==='response.created')out.response={id:e.response?.id};
              else if(e.type==='response.done')out.response={id:e.response?.id,status:e.response?.status};
              else if(['response.audio.delta','response.audio_transcript.delta','response.audio_transcript.done','response.text.delta','response.text.done','conversation.item.input_audio_transcription.completed','conversation.item.input_audio_transcription.failed','input_audio_buffer.speech_started','input_audio_buffer.speech_stopped'].includes(e.type)){
                for(const key of ['delta','transcript','text','item_id','response_id'])if(typeof e[key]==='string')out[key]=e[key];
                if(e.type.startsWith('response.')&&!out.response_id)out.response_id=responseId;
              }else return;
              if(client.bufferedAmount>2*1024*1024&&e.type==='response.audio.delta'){
                if(!audioBackpressure){send(client,{type:'bridge.notice',message:'浏览器播放暂时跟不上，已跳过少量迟到音频；语音连接仍保持。'});audioBackpressure=true;}
                return;
              }
              if(client.bufferedAmount<512*1024)audioBackpressure=false;
              if(client.bufferedAmount>8*1024*1024){fail('浏览器接收速度过慢，实时连接已保护性关闭。请刷新页面后重试。');return;}
              send(client,out);
            }catch{fail('实时服务返回了无法解析的数据。');}
          });
        }else if(event.type==='input_audio_buffer.append'&&ready){
          if(typeof event.audio!=='string'||event.audio.length>32000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.audio))throw new Error('音频格式无效。');
          if(upstream.bufferedAmount>256000){if(!micBackpressure){send(client,{type:'bridge.notice',message:'网络暂时繁忙，已短暂停送麦克风音频；实时连接仍保持。'});micBackpressure=true;}return;}
          if(micBackpressure){micBackpressure=false;send(client,{type:'bridge.notice',message:'网络已恢复，继续接收麦克风音频。'});}
          upstreamSend({type:event.type,audio:event.audio});
        }else if(event.type==='bridge.interrupt'&&ready){
          if(responding){upstreamSend({type:'response.cancel'});responding=false;}
        }else if(event.type==='bridge.text'&&ready){
          if(responding){send(client,{type:'bridge.notice',message:'请等本轮回答结束，或先点击打断。'});return;}
          const text=String(event.text||'').trim();if(!text||text.length>2000)throw new Error('请输入 1～2000 字。');
          upstreamSend({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});
          upstreamSend({type:'response.create'});responding=true;
        }else if(event.type==='bridge.close'){cleanup();client.close();}
      }catch(e){fail(e instanceof SyntaxError?'消息格式无效。':e.message);}
    });
  });
  server.on('close',()=>{for(const client of wss.clients)client.terminate();wss.close();});
  return {handleHttp,store};
}
