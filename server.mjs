import {loadProjectArchive} from './project-archive.mjs';
import {registerProjectRead,attachProjectReferences} from './project-references.mjs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,rename,appendFile} from 'node:fs/promises';
import {WebSocketServer,WebSocket} from './vendor/ws/wrapper.mjs';
import {rpc,publicConfig,systemPrompt,deepseek} from './services.mjs';
import {voiceModel,introduction,voiceEndpoint,recognitionSession,verifiedSpeech} from './realtime-voice.mjs';
import {loadCatalog,catalogContext,toolData} from './catalog.mjs';
import {preserveConversation} from './conversation.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||5188);
const defaults={mcpUrl:'https://opendesign.cc/inno/mcp/api',mcpToken:'',deepseekModel:'deepseek-v4.1-flash-1017',bailianKey:'',workspaceId:'',region:'cn-beijing',voiceModel,voice:''};
async function config(){try{const c={...defaults,...JSON.parse(await readFile(path.join(root,'.local/config.json'),'utf8'))};if(c.deepseekModel==='deepseek-flash')c.deepseekModel=defaults.deepseekModel;c.voiceModel=voiceModel;delete c.asrModel;delete c.ttsModel;if(c.voice==='Cherry')c.voice='';return c;}catch(e){if(e.code==='ENOENT')return {...defaults};throw Error('本机配置文件无效');}}
let saving=Promise.resolve(),busy=false;
const sessions=new Map();
const approvedSpeech=new Map([['introduction',introduction]]);
const internalMetaPattern=/核验记录|阶段小结|还不是给企业的答复|内部分析|模型思考|工具调用|写给开发者|草稿说明/;
function cleanEnterpriseText(text){return String(text||'').split(/\r?\n/).filter(line=>!internalMetaPattern.test(line)).join('\n').trim();}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
function trusted(req){return [`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)&&req.headers.origin===`http://${req.headers.host}`;}
async function body(req){let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>20000)throw Error('输入过长');}return JSON.parse(value);}
const server=http.createServer(async(req,res)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return json(res,403,{error:'仅允许本机访问'});
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='POST'&&(!trusted(req)||!req.headers['content-type']?.startsWith('application/json')))return json(res,403,{error:'请从本机页面操作'});
  try{
    if(url.pathname==='/api/config'&&req.method==='GET')return json(res,200,publicConfig(await config()));
    if(url.pathname==='/api/config'&&req.method==='POST'){
      if(busy)return json(res,409,{error:'请先停止当前分析'});
      const input=await body(req);const save=saving.then(async()=>{const c=await config();for(const key of Object.keys(defaults))if(typeof input[key]==='string'&&input[key].trim())c[key]=input[key].trim();
        if(c.mcpUrl!==defaults.mcpUrl)throw Error('此版本只连接已确认的好设计项目库');
        if(!['cn-beijing','ap-southeast-1'].includes(c.region)||!/^[\w-]*$/.test(c.workspaceId))throw Error('百炼地域或业务空间格式无效');
        for(const key of ['deepseekModel','voiceModel','voice'])if(c[key]&&!/^[\w./-]{1,120}$/.test(c[key]))throw Error('模型或音色ID无效');
        if(c.voiceModel!==voiceModel)throw Error(`本版实时语音使用 ${voiceModel}`);
        await mkdir(path.join(root,'.local'),{recursive:true});await writeFile(path.join(root,'.local/config.tmp'),JSON.stringify(c,null,2),{mode:0o600});await rename(path.join(root,'.local/config.tmp'),path.join(root,'.local/config.json'));return c;});saving=save.catch(()=>{});return json(res,200,publicConfig(await save));
    }
    if(url.pathname==='/api/check'&&req.method==='POST'){
      const c=await config();const data=await rpc(c,'tools/list');const cap=await rpc(c,'tools/call',{name:'inno_capabilities',arguments:{}});return json(res,200,{count:data.tools.length,capabilities:cap,tools:data.tools.map(t=>t.name)});
    }
    if(url.pathname==='/api/project'&&req.method==='POST'){
      const input=await body(req);if(typeof input.projectId!=='string'||!input.projectId)throw Error('项目编号无效');
      const c=await config();if(!c.mcpToken)throw Error('请先配置项目库访问密钥');
      const catalog=await loadCatalog(c,{root});const project=catalog.projects.find(p=>p.id===input.projectId);if(!project)return json(res,404,{error:'项目不在当前项目库目录中'});
      const overviewResult=await rpc(c,'tools/call',{name:'inno_read_project',arguments:{project_id:project.id,section:'overview'}});const overview=toolData(overviewResult);
      const offset=input.offset===undefined?0:input.offset;if(!Number.isInteger(offset)||offset<0||offset>10000)throw Error('资料页码无效');
      const archivePromise=offset===0?loadProjectArchive(project.id):Promise.resolve(null);
      let records=null,nextOffset=null;
      if(overview?.record_count>0){
        const items=[];let cursor=offset;
        for(let page=0;page<3;page++){
          const batch=toolData(await rpc(c,'tools/call',{name:'inno_read_project',arguments:{project_id:project.id,section:'records',revision:overview.publication_revision||null,offset:cursor,limit:5}}));
          items.push(...(batch.data||[]));records={...batch,data:items};nextOffset=batch.next_offset??null;
          if(nextOffset==null||nextOffset<=cursor)break;cursor=nextOffset;
        }
      }
      return json(res,200,{project,overview,records,nextOffset,archive:await archivePromise});
    }
    if(url.pathname==='/api/chat'&&req.method==='POST')return await chat(req,res);
    if(url.pathname==='/api/tts'&&req.method==='POST'){
      const input=await body(req);const text=typeof input.answerId==='string'?approvedSpeech.get(input.answerId):null;
      if(!text)return json(res,400,{error:'只能播报服务端保留的DeepSeek最终答复；请重新生成意见'});
      const c=await config();if(!c.bailianKey)throw Error('请先填写百炼密钥');
      const controller=new AbortController();res.on('close',()=>controller.abort());const audio=await verifiedSpeech(c,text,{signal:controller.signal});
      res.writeHead(200,{'Content-Type':'audio/wav','Cache-Control':'no-store','X-Voice-Text-Verified':'true'});return res.end(audio);
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'接口不存在'});
    if(req.method!=='GET')return json(res,405,{error:'方法不支持'});
    const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(root,'public','.'+name);if(!file.startsWith(path.join(root,'public')+path.sep))return json(res,403,{error:'路径无效'});
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
    const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; media-src 'self' https: blob:; connect-src 'self' ws://127.0.0.1:* ws://localhost:*; style-src 'self'; script-src 'self'; frame-ancestors 'none'"});res.end(data);
  }catch(e){if(!res.headersSent)json(res,e.code==='ENOENT'?404:400,{error:e.message});else res.end();}
});
async function chat(req,res){
  if(busy)return json(res,409,{error:'已有分析任务，请稍候'});const c=await config();if(!c.bailianKey)return json(res,400,{error:'请在连接设置中填写百炼 API Key，DeepSeek和语音共用该配置'});if(!c.deepseekModel)return json(res,400,{error:'请填写百炼中已开通的 DeepSeek 模型 ID'});if(!c.mcpToken)return json(res,400,{error:'请先配置项目库访问密钥'});
  const {text,sessionId}=await body(req);if(typeof text!=='string'||!text.trim()||text.length>6000)throw Error('请输入6000字以内的访谈内容');
  busy=true;const controller=new AbortController();res.on('close',()=>controller.abort());res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store'});
  const send=(type,data={})=>{if(!res.destroyed)res.write(JSON.stringify({type,...data})+'\n');};
  const id=typeof sessionId==='string'&&sessions.has(sessionId)?sessionId:crypto.randomUUID();
  let messages=[{role:'system',content:systemPrompt},...(sessions.get(id)||[]).filter(m=>m.role!=='system'),{role:'user',content:text.trim()}];send('session',{id});
  // Preserve confirmed user context even when a provider or tool fails this turn.
  sessions.set(id,preserveConversation(messages));
  if(sessions.size>10)sessions.delete(sessions.keys().next().value);
  try{
    send('work_started',{text:'访谈已提交，正在准备资料库与分析请求'});
    send('stage',{text:'读取全库题录，准备跨行业关联'});
    const catalog=await loadCatalog(c,{root,signal:controller.signal,onProgress:e=>send('catalog_progress',e)});
    send('catalog_ready',{projects:catalog.projects.length,methods:catalog.methods.length,cached:catalog.cached,fetchedAt:catalog.fetchedAt});
    messages.splice(1,0,{role:'system',content:catalogContext(catalog)});
    const projectIds=new Set(catalog.projects.map(p=>p.id)),methodIds=new Set(catalog.methods.map(m=>m.method_id));
    send('stage',{text:'连接项目与方法库'});const list=await rpc(c,'tools/list',{},controller.signal);const permitted=list.tools.filter(t=>t.name.startsWith('inno_')&&t.annotations?.readOnlyHint);
    const tools=permitted.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}));tools.push({type:'function',function:{name:'show_analysis',description:'向企业展示可核对的工作摘要：已知需求、抽象功能、正在比较的依据维度或下一步核查。不得提供私有逐字思维链。',parameters:{type:'object',properties:{summary:{type:'string'}},required:['summary']}}});
    tools.push({type:'function',function:{name:'map_need',description:'从全库题录跨行业联想，将已知需求、功能抽象、来源候选和待核验的迁移设想展示给企业；必须在形成初步方向前调用。',parameters:{type:'object',properties:{need:{type:'string'},unknowns:{type:'array',items:{type:'string'}},routes:{type:'array',items:{type:'object',properties:{function:{type:'string'},hypothesis:{type:'string'},project_ids:{type:'array',items:{type:'string'}},method_ids:{type:'array',items:{type:'string'}}},required:['function','hypothesis','project_ids','method_ids']}}},required:['need','unknowns','routes']}}});
    const presentAnswerTool={type:'function',function:{name:'present_answer',description:'以结构化分段提交最终企业建议。每个编号方向必须作为一个独立segment，包含该方向的完整说明；每个segment只关联实际用于该方向推理且本轮已读取档案的项目ID；若没有项目支撑则project_ids为空。不得为展示卡片而硬关联。',parameters:{type:'object',properties:{segments:{type:'array',items:{type:'object',properties:{text:{type:'string'},project_ids:{type:'array',items:{type:'string'}}},required:['text','project_ids']}}},required:['segments']}}};
    const verifiedProjectIds=new Set();let mapped=false,analysisShown=false,mappedRoutes=[],externalCallCount=0;
    for(let turn=0;turn<=4;turn++){
      const finalize=turn>=3;
      if(!mapped&&!finalize)messages.push({role:'system',content:`当前处于需求关联阶段。${analysisShown?'继续形成关联，不要重复展示开场摘要。':'先调用show_analysis展示不超过两句的可核对工作摘要：企业已知目标、抽象出的功能，以及准备比较的资料维度；这是整理后的工作摘要，不是私有逐字思维链。'}随后调用map_need，基于企业已知信息给2到3条功能迁移假设及真实目录候选。此阶段不要输出面向企业的最终答复，系统随后会自动读取候选正文供你核验。未知信息标为待确认，不必等企业回答所有问题才形成初步路线。`});
      if(finalize){messages.push({role:'system',content:'本轮资料读取到此结束。请将最终答复通过present_answer工具提交，按建议方向拆成segments，每个方向作为独立segment，编号、完整说明与该方向实际引用的project_ids放在一起；追问可独立成段，不要把全部档案集中放在末段；每段必须是直接对企业说的正式建议，并将该段确实引用的、已读取项目档案的项目ID放进project_ids。禁止在segments中出现“核验记录”“阶段小结”“还不是给企业的答复”“内部分析”“模型思考”“工具调用”等过程标签、写给开发者的话、免责声明式元评论或草稿说明。不要写答复前言，直接给企业建议。项目卡将紧跟对应文字段落。项目仅作概念参考时说明迁移假设与验证边界。没有项目依据的段落project_ids为空，不要强行关联。不要提搜索失败、档案缺失或“没有案例”。若企业尚处初步需求阶段，答复严格控制在300至500字，给2到3条贴近已知场景的方向；最多只问一个问题。'});send('stage',{text:'整理关联依据、迁移设想与验证步骤'});}
      send('answer_start');send('model_wait',{round:turn+1,model:c.deepseekModel});send('stage',{text:turn?'结合资料继续分析':'梳理企业业务与需求'});let message={role:'assistant',content:'',reasoning_content:''},calls=[];let pulse=false,lastThinkingUpdate=0;
      const roundTools=finalize?[presentAnswerTool]:!mapped?tools.filter(t=>t.function.name==='map_need'||t.function.name==='show_analysis'):tools;
      for await(const delta of deepseek(c,messages,roundTools,controller.signal,{onTelemetry:stats=>{send('model_stats',{round:turn+1,...stats});appendFile(path.join(root,'.local/model-audit.jsonl'),JSON.stringify({time:new Date().toISOString(),sessionId:id,round:turn+1,...stats})+'\n').catch(()=>{});}})){
        if(delta.reasoning_content){message.reasoning_content+=delta.reasoning_content;if(!pulse){send('thinking_started',{round:turn+1});send('stage',{text:'DeepSeek 思考模式正在分析'});pulse=true;}if(message.reasoning_content.length-lastThinkingUpdate>=80){lastThinkingUpdate=message.reasoning_content.length;send('thinking_progress',{round:turn+1,chars:lastThinkingUpdate});}}
        if(delta.content){message.content+=delta.content;send('delta',{text:delta.content});}
        for(const tc of delta.tool_calls||[]){const index=tc.index??0;calls[index]??={id:'',type:'function',function:{name:'',arguments:''}};if(tc.id)calls[index].id=tc.id;if(tc.function?.name)calls[index].function.name+=tc.function.name;if(tc.function?.arguments)calls[index].function.arguments+=tc.function.arguments;}
      }
      if(!calls.length&&!mapped&&!finalize){messages.push(message,{role:'system',content:'请先调用map_need，把已知需求与功能/原理关联展示出来，并从题录选择候选后核验。不可以仅回复关键词没有命中或只追问而不给任何初步方向。'});continue;}
      if(!calls.length&&mapped&&turn<4){messages.push(message,{role:'system',content:'最终答复必须通过present_answer工具返回分段文字与项目ID关联。只写给企业看的正式建议，不要输出任何核验记录、阶段小结或说明自己正在分析。请现在调用工具。'});continue;}
      if(!calls.length){const text=cleanEnterpriseText(message.content);if(!text){send('error',{text:'正式建议没有生成完整，请重新提交本轮需求。'});res.end();return;}messages.push({role:'assistant',content:text});sessions.set(id,preserveConversation(messages));if(sessions.size>10)sessions.delete(sessions.keys().next().value);const answerId=crypto.randomUUID();approvedSpeech.set(answerId,text);if(approvedSpeech.size>101)approvedSpeech.delete([...approvedSpeech.keys()].find(key=>key!=='introduction'));send('answer_segments',{segments:attachProjectReferences([{text,project_ids:[]}],catalog.projects,verifiedProjectIds)});send('done',{answerId});res.end();return;}
      for(const call of calls)if(!call.id)call.id=crypto.randomUUID();message.tool_calls=calls;messages.push(message);
      for(const call of calls){const name=call.function.name;let args;try{args=JSON.parse(call.function.arguments||'{}');}catch{call.function.arguments='{}';send('tool_argument_retry',{name:name||'未知工具',text:'参数格式未通过校验，正在重新生成结构化调用。'});messages.push({role:'tool',tool_call_id:call.id,content:'上一次工具参数不是合法JSON。请检查参数结构并重新调用工具；字符串中的引号必须转义，参数必须完整。'});continue;}
        if(name==='present_answer'){
          const valid=Array.isArray(args.segments)&&args.segments.length>0&&args.segments.every(segment=>segment&&typeof segment.text==='string'&&segment.text.trim()&&Array.isArray(segment.project_ids));
          if(!valid){messages.push({role:'tool',tool_call_id:call.id,content:'请重新提交有效的segments数组；每段包含text字符串和project_ids数组。'});continue;}
          const segments=attachProjectReferences(args.segments.map(segment=>({...segment,text:cleanEnterpriseText(segment.text)})),catalog.projects,verifiedProjectIds);
          if(!segments.length){messages.push({role:'tool',tool_call_id:call.id,content:'请按每个建议方向返回独立segment及对应档案ID。'});continue;}
          const answerText=segments.map(segment=>segment.text).join('\n\n');messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({status:'已接受结构化答复，项目来源均来自本轮已读取档案'})},{role:'assistant',content:answerText});sessions.set(id,messages);if(sessions.size>10)sessions.delete(sessions.keys().next().value);const answerId=crypto.randomUUID();approvedSpeech.set(answerId,answerText);if(approvedSpeech.size>101)approvedSpeech.delete([...approvedSpeech.keys()].find(key=>key!=='introduction'));send('answer_segments',{segments});send('done',{answerId});res.end();return;
        }
        if(name==='show_analysis'){analysisShown=true;send('analysis',{text:String(args.summary||'')});messages.push({role:'tool',tool_call_id:call.id,content:'工作摘要已展示'});continue;}
        if(name==='map_need'){
          const valid=typeof args.need==='string'&&Array.isArray(args.unknowns)&&Array.isArray(args.routes)&&args.routes.length>0&&args.routes.every(route=>route&&typeof route==='object'&&typeof route.function==='string'&&typeof route.hypothesis==='string'&&Array.isArray(route.project_ids)&&route.project_ids.every(p=>typeof p==='string'&&projectIds.has(p))&&Array.isArray(route.method_ids)&&route.method_ids.every(m=>typeof m==='string'&&methodIds.has(m)));
          if(valid){
            mapped=true;mappedRoutes=args.routes;send('association',{need:args.need,unknowns:args.unknowns,routes:args.routes.map(route=>({...route,projects:route.project_ids.map(pid=>catalog.projects.find(p=>p.id===pid)),methods:route.method_ids.map(mid=>catalog.methods.find(m=>m.method_id===mid))}))});
            const verified=[];
            async function readCandidate(name,args){externalCallCount++;const callId=crypto.randomUUID(),started=Date.now();send('tool_start',{id:callId,name,args});let result;try{result=await rpc(c,'tools/call',{name,arguments:args},controller.signal);}catch(e){if(controller.signal.aborted)throw e;result={isError:true,content:[{type:'text',text:e.message}]};}send('tool_result',{id:callId,name,result,ms:Date.now()-started,failed:!!result.isError});if(registerProjectRead(verifiedProjectIds,name,args,result))send('project_verified',{projectId:args.project_id});verified.push({name,arguments:args,result});return result;}
            const candidates=[...new Set(args.routes.flatMap(r=>r.project_ids))].slice(0,3);
            for(const project_id of candidates){const overview=await readCandidate('inno_read_project',{project_id,section:'overview'});let data;try{data=toolData(overview);}catch{}if(data?.record_count>0)await readCandidate('inno_read_project',{project_id,section:'records',revision:data.publication_revision||null,limit:3});}
            for(const method_id of [...new Set(args.routes.flatMap(r=>r.method_ids))].slice(0,2)){await readCandidate('inno_read_method',{method_id,section:'overview'});await readCandidate('inno_read_method',{method_id,section:'boundaries'});}
            messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({status:'关联假设已展示，已自动读取候选正文和方法边界',verified,instruction:'以实际返回资料核对每条假设。题录只有名称的项目不能当作技术机制的证据；读到的记录不支持就舍弃，不要硬凑。资料仍不够时可继续查询。用简洁的2到3条路线回答；原理事实、迁移设想、待验证条件分清楚。'})});
          }else messages.push({role:'tool',tool_call_id:call.id,content:'关联候选中有目录不存在的ID或格式无效，请根据题录纠正后再调用。'});continue;
        }
        if(!permitted.some(t=>t.name===name)){send('tool_argument_retry',{name:name||'未知工具',text:'工具名称未获准，正在重新规划查询。'});messages.push({role:'tool',tool_call_id:call.id,content:'该工具不可用。请从当前提供的只读工具中重新选择，不要重试这个工具。'});continue;}
        if(externalCallCount>=12){send('stage',{text:'资料核验已完成，正在整理建议'});messages.push({role:'tool',tool_call_id:call.id,content:'本轮资料查询上限已到，请使用已读取来源完成建议，不要继续查询。'});continue;}externalCallCount++;
        const callId=crypto.randomUUID(),started=Date.now();send('tool_start',{id:callId,name,args});let result;
        try{result=await rpc(c,'tools/call',{name,arguments:args},controller.signal);if(registerProjectRead(verifiedProjectIds,name,args,result))send('project_verified',{projectId:args.project_id});send('tool_result',{id:callId,name,result,ms:Date.now()-started,failed:!!result.isError});}
        catch(e){if(controller.signal.aborted)throw e;result={isError:true,content:[{type:'text',text:e.message}]};send('tool_result',{id:callId,name,result,ms:Date.now()-started,failed:true});}
        messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
      }
    }
    throw Error('已达到本轮查询上限，请缩小问题范围后重试');
  }catch(e){send('error',{text:controller.signal.aborted?'分析已停止':e.message});res.end();}finally{busy=false;}
}
const wss=new WebSocketServer({noServer:true,maxPayload:100000,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{if(req.url!=='/api/asr'||!trusted(req)){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
wss.on('connection',async client=>{
  let up,timer;const send=data=>{if(client.readyState===1)client.send(JSON.stringify(data));};
  const fail=text=>{send({type:'error',text});client.close();up?.close();clearTimeout(timer);};client.on('error',()=>up?.close());client.on('close',()=>{up?.close();clearTimeout(timer);});
  try{const c=await config();if(!c.bailianKey)throw Error('请先填写百炼密钥');
    up=new WebSocket(voiceEndpoint(c),{headers:{Authorization:`Bearer ${c.bailianKey}`},handshakeTimeout:20000,maxPayload:1024*1024});
    timer=setTimeout(()=>fail('语音连接超时'),25000);
    up.on('open',()=>{if(client.readyState!==1){up.close();return;}up.send(JSON.stringify({event_id:crypto.randomUUID(),type:'session.update',session:recognitionSession(c)}));});
    up.on('message',raw=>{try{const e=JSON.parse(raw);if(e.type==='session.updated'){clearTimeout(timer);send({type:'ready'});}if(e.type==='error'&&/cancel|no_active_response/i.test(String(e.error?.code)+' '+String(e.error?.message)))return;if(e.type==='conversation.item.input_audio_transcription.completed')send({type:'transcript',text:e.transcript});if(e.type==='error'){console.warn('[voice diagnostic]',String(e.error?.message||'').replaceAll(c.bailianKey,'[redacted]').slice(0,400));fail(`百炼语音识别返回错误（${String(e.error?.code||'unknown').replace(/[^\w.-]/g,'').slice(0,80)}），请检查地域、模型与额度`);}}catch{fail('语音数据格式异常');}});
    up.on('error',()=>fail('百炼语音连接失败'));up.on('unexpected-response',(_req,r)=>{r.resume();fail(`百炼拒绝语音连接（HTTP ${r.statusCode}）`);});up.on('close',()=>{send({type:'closed'});client.close();});
    client.on('message',raw=>{try{const e=JSON.parse(raw);if(e.type==='finish'&&up.readyState===1){up.close();return;}if(e.type==='audio'&&typeof e.audio==='string'&&up.readyState===1&&up.bufferedAmount<500000)up.send(JSON.stringify({event_id:crypto.randomUUID(),type:'input_audio_buffer.append',audio:e.audio}));}catch{fail('音频数据无效');}});
  }catch(e){fail(e.message);}
});
server.listen(port,'127.0.0.1',()=>console.log(`企业访谈 AI · http://127.0.0.1:${port}`));
