import {MCP_URL,normalizeMcpUrl} from './project-library.mjs';
import {createReasoningStream} from './reasoning-stream.mjs';
import {selectCatalog} from './public/dense-topology.js';
import {inspectCandidates,candidatePairs} from './association-pipeline.mjs';
import {AssociationEvidence,assessAssociation,assessmentTool,assessmentInstruction,geometry} from './association-score.mjs';
import {loadProjectArchive} from './project-archive.mjs';
import {registerProjectRead,attachProjectReferences} from './project-references.mjs';
import {informationProfileSchema,informationAssessmentInstruction,validateInformationProfile,chooseOutputPolicy,unknownInformationProfile,finalAnswerInstruction,presentAnswerTool as createPresentAnswerTool,prepareAdaptiveAnswer} from './output-policy.mjs';
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
const defaults={mcpUrl:MCP_URL,mcpToken:'',deepseekModel:'deepseek-v4.1-flash-1017',bailianKey:'',workspaceId:'',region:'cn-beijing',voiceModel,voice:''};
async function config(){try{const c={...defaults,...JSON.parse(await readFile(path.join(root,'.local/config.json'),'utf8'))};c.mcpUrl=normalizeMcpUrl(c.mcpUrl);if(c.deepseekModel==='deepseek-flash')c.deepseekModel=defaults.deepseekModel;c.voiceModel=voiceModel;delete c.asrModel;delete c.ttsModel;if(c.voice==='Cherry')c.voice='';return c;}catch(e){if(e.code==='ENOENT')return {...defaults};throw Error('本机配置文件无效');}}
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
        c.mcpUrl=normalizeMcpUrl(c.mcpUrl);
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
    send('catalog_graph',{projects:selectCatalog(catalog.projects),total:catalog.projects.length,scope:'catalog_membership_only'});
    messages.splice(1,0,{role:'system',content:catalogContext(catalog)});
    const projectIds=new Set(catalog.projects.map(p=>p.id)),methodIds=new Set(catalog.methods.map(m=>m.method_id));
    send('stage',{text:'连接项目与方法库'});const list=await rpc(c,'tools/list',{},controller.signal);const permitted=list.tools.filter(t=>t.name.startsWith('inno_')&&t.annotations?.readOnlyHint);
    const tools=permitted.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.inputSchema}}));tools.push({type:'function',function:{name:'show_analysis',description:'向企业展示可核对的工作摘要：已知需求、抽象功能、正在比较的依据维度或下一步核查。不得提供私有逐字思维链。',parameters:{type:'object',properties:{summary:{type:'string'}},required:['summary']}}});
    tools.push({type:'function',function:{name:'map_need',description:'从全库题录跨行业联想，将已知需求、功能抽象、来源候选和待核验的迁移设想展示给企业；必须在形成初步方向前调用。',parameters:{type:'object',properties:{information_profile:informationProfileSchema,need:{type:'string'},unknowns:{type:'array',items:{type:'string'}},routes:{type:'array',items:{type:'object',properties:{function:{type:'string'},hypothesis:{type:'string'},project_ids:{type:'array',items:{type:'string'}},method_ids:{type:'array',items:{type:'string'}}},required:['function','hypothesis','project_ids','method_ids']}}},required:['information_profile','need','unknowns','routes']}}});
    const presentAnswerTool=createPresentAnswerTool();
    // Profile is attached to the current verified user context. Technical retrieval
    // may refine a route, but it cannot change enterprise information coverage.
    let informationProfile=unknownInformationProfile(),outputPolicy=chooseOutputPolicy(informationProfile);
    const verifiedProjectIds=new Set();let mapped=false,analysisShown=false,mappedRoutes=[],externalCallCount=0;
    const associationEvidence=new AssociationEvidence(),associationScores=new Map(),inspections=new Map(),scoreSignatures=new Map();let scoringRound=0,scoreDirty=false;
    const emitRecords=projectId=>send('graph_records',{records:associationEvidence.graphRecords(projectId),scope:'actually_read_fields'});
    const emitIndustries=()=>send('industry_classifications',{projects:[...new Set(mappedRoutes.flatMap(r=>r.project_ids))].map(projectId=>({projectId,industry:associationEvidence.industry(projectId)}))});
    const emitScores=()=>send('association_scores',{assessments:[...associationScores.values()].map(a=>({...a,industry:associationEvidence.industry(a.projectId)}))});
    const emitAssociation=()=>send('association',{need:mappedNeed,unknowns:mappedUnknowns,routes:mappedRoutes.map(route=>({...route,projects:route.project_ids.map(pid=>({...catalog.projects.find(p=>p.id===pid),industry:associationEvidence.industry(pid)})),methods:(route.method_ids||[]).map(mid=>catalog.methods.find(m=>m.method_id===mid))}))});
    let mappedNeed='',mappedUnknowns=[];
    async function readCandidate(name,args){
      const callId=crypto.randomUUID(),started=Date.now();send('tool_start',{id:callId,name,args});let result;
      try{result=await rpc(c,'tools/call',{name,arguments:args},controller.signal);}catch(e){if(controller.signal.aborted)throw e;result={isError:true,content:[{type:'text',text:e.message}]};}
      associationEvidence.register(name,args,result);emitRecords(args.project_id);emitIndustries();scoreDirty=true;send('tool_result',{id:callId,name,args,result,ms:Date.now()-started,failed:!!result.isError});
      if(registerProjectRead(verifiedProjectIds,name,args,result))send('project_verified',{projectId:args.project_id});return result;
    }
    async function inspectProjects(ids){
      const result=await inspectCandidates(ids,{evidence:associationEvidence,signal:controller.signal,read:readCandidate,onProgress:e=>{inspections.set(e.projectId,e);send('candidate_status',e);emitRecords(e.projectId);emitIndustries();},readArchive:async project_id=>{
        const id=crypto.randomUUID(),started=Date.now();send('tool_start',{id,name:'read_original_archive',args:{project_id}});const archive=await loadProjectArchive(project_id);
        send('tool_result',{id,name:'read_original_archive',args:{project_id},ms:Date.now()-started,failed:false,result:{structuredContent:{status:archive.status,source_url:archive.sourceUrl,page_url:archive.pageUrl}}});return archive;
      }});return [...result.values()].map(r=>({project_id:r.id,status:r.status,pages:r.pages,source:associationEvidence.context([r.id]).map(p=>({...p,anchors:p.anchors.slice(0,24)}))}));
    }
    async function evaluateRoutes(){
      if(!mapped||!scoreDirty)return;scoreDirty=false;
      const pairs=candidatePairs(mappedRoutes).filter(pair=>{
        const key=`${pair.route_index}:${pair.project_id}`,signature=JSON.stringify(associationEvidence.context([pair.project_id]));return signature!==scoreSignatures.get(key);
      });
      if(!pairs.length)return;
      send('stage',{text:'逐项评估候选项目与企业问题的关联度'});
      for(let offset=0;offset<pairs.length;offset+=2){
        const batch=pairs.slice(offset,offset+2),context=associationEvidence.context(batch.map(p=>p.project_id));
        for(const pair of batch){const key=`${pair.route_index}:${pair.project_id}`;scoreSignatures.set(key,JSON.stringify(associationEvidence.context([pair.project_id])));}
        const request={enterprise:preserveConversation(messages).filter(m=>m.role==='user'),routes:mappedRoutes,pairs_to_assess:batch,sources:context};
        let remaining=batch;
        for(let attempt=0;attempt<2&&remaining.length;attempt++){
          const scoreCalls=[],issues=[];let pulse=false;
          try{
            const round=`评估${++scoringRound}`;send('model_wait',{round,model:c.deepseekModel});
            const assessmentMessages=[{role:'system',content:assessmentInstruction+' 本次只评估pairs_to_assess中的每一对，route_index不能改。必须一项不漏；没有正文也返回明确原因。不要把来源项目所属行业当作企业需求行业。'},{role:'user',content:JSON.stringify({...request,pairs_to_assess:remaining})}];
            const reasoning=createReasoningStream(send,{round,kind:'assessment'});let reasoningFailed=true;
            try{for await(const delta of deepseek(c,assessmentMessages,[assessmentTool],controller.signal,{toolChoice:{type:'function',function:{name:'assess_associations'}},onTelemetry:stats=>send('model_stats',{round,...stats})})){
              if(delta.reasoning_content){reasoning.append(delta.reasoning_content);if(!pulse){send('thinking_started',{round});pulse=true;}}
              for(const tc of delta.tool_calls||[]){const i=tc.index??0;scoreCalls[i]??={function:{name:'',arguments:''}};if(tc.function?.name)scoreCalls[i].function.name+=tc.function.name;if(tc.function?.arguments)scoreCalls[i].function.arguments+=tc.function.arguments;}
            }reasoningFailed=false;}finally{reasoning.finish({failed:reasoningFailed});}
            const accepted=new Set();
            for(const call of scoreCalls){if(call.function.name!=='assess_associations')continue;const data=JSON.parse(call.function.arguments);for(const item of data.assessments||[]){if(!remaining.some(p=>p.project_id===item.project_id&&p.route_index===item.route_index))continue;try{
              const assessed=assessAssociation(item,{routes:mappedRoutes,evidence:associationEvidence}),key=`${item.route_index}:${item.project_id}`;
              if(assessed.score===null){assessed.status=inspections.get(item.project_id)?.status==='requires_auth'?'原件需授权 · 未评分':inspections.get(item.project_id)?.status==='read_failed'?'读取失败 · 未评分':'已核验 · 依据不足';}
              associationScores.set(key,assessed);accepted.add(key);
            }catch(e){issues.push({projectId:item.project_id,text:e.message});}}}
            remaining=remaining.filter(p=>!accepted.has(`${p.route_index}:${p.project_id}`));emitScores();
            send('assessment_complete',{completed:offset+batch.length-remaining.length,total:pairs.length});
          }catch(e){if(controller.signal.aborted)throw e;issues.push({text:'评分调用暂未完成'});}
          if(attempt===1)for(const pair of remaining){const key=`${pair.route_index}:${pair.project_id}`,previous=associationScores.get(key);associationScores.set(key,{...previous,projectId:pair.project_id,routeIndex:pair.route_index,score:null,status:'评分未完成 · 可重试',reason:issues.map(e=>e.text).join('；'),...geometry(null)});send('assessment_warning',{projectId:pair.project_id,text:'该候选评分未通过校验，保持未评分，不当作无关。'});}
        }
        emitScores();
      }
    }
    async function syncFinalGraph(segments){
      for(const segment of segments){for(const p of segment.projects||[]){associationEvidence.seed(p);if(!mappedRoutes.some(r=>r.project_ids.includes(p.id))){mappedRoutes.push({function:segment.text.slice(0,140),hypothesis:'最终建议中使用的来源参考，迁移条件仍需核验',project_ids:[p.id],method_ids:[]});scoreDirty=true;}}}
      if(scoreDirty){emitAssociation();await evaluateRoutes();}
      const adopted=new Set(segments.flatMap(s=>(s.projects||[]).map(p=>p.id)));send('association_adopted',{projectIds:[...adopted]});
    }
    for(let turn=0;turn<=4;turn++){
      await evaluateRoutes();
      const finalize=turn>=3;
      if(!mapped&&!finalize)messages.push({role:'system',content:`当前处于需求关联阶段。${analysisShown?'继续形成关联，不要重复展示开场摘要。':'先调用show_analysis展示不超过两句的可核对工作摘要：企业已知目标、抽象出的功能，以及准备比较的资料维度；这是整理后的工作摘要，不是私有逐字思维链。'}随后调用map_need，基于已知信息形成1到3条功能迁移假设及真实目录候选，没有业务背景时可以少给，不硬凑。在提交关联前按用户实际信息评估完整度。此阶段不要输出最终答复，系统随后读取候选正文供核验。未知标待确认，不等全部补齐才给初步帮助。\n${informationAssessmentInstruction}`});
      if(finalize){messages.push({role:'system',content:finalAnswerInstruction(outputPolicy)});send('stage',{text:outputPolicy.mode==='full'?'按三部分十一章整理报告':outputPolicy.mode==='partial'?'整理可支撑的诊断章节':'整理初步方向与关键补充信息'});}
      send('answer_start');send('model_wait',{round:turn+1,model:c.deepseekModel});send('stage',{text:turn?'结合资料继续分析':'梳理企业业务与需求'});let message={role:'assistant',content:'',reasoning_content:''},calls=[];let pulse=false,lastThinkingUpdate=0;
      const roundTools=finalize?[presentAnswerTool]:!mapped?tools.filter(t=>t.function.name==='map_need'||t.function.name==='show_analysis'):tools;
      const reasoning=createReasoningStream(send,{round:turn+1,kind:'analysis'});let reasoningFailed=true;
      try{for await(const delta of deepseek(c,messages,roundTools,controller.signal,{toolChoice:finalize?{type:'function',function:{name:'present_answer'}}:undefined,onTelemetry:stats=>{send('model_stats',{round:turn+1,...stats});appendFile(path.join(root,'.local/model-audit.jsonl'),JSON.stringify({time:new Date().toISOString(),sessionId:id,round:turn+1,...stats})+'\n').catch(()=>{});}})){
        if(delta.reasoning_content){reasoning.append(delta.reasoning_content);message.reasoning_content+=delta.reasoning_content;if(!pulse){send('thinking_started',{round:turn+1});send('stage',{text:'DeepSeek 思考模式正在分析'});pulse=true;}if(message.reasoning_content.length-lastThinkingUpdate>=80){lastThinkingUpdate=message.reasoning_content.length;send('thinking_progress',{round:turn+1,chars:lastThinkingUpdate});}}
        if(delta.content){message.content+=delta.content;send('delta',{text:delta.content});}
        for(const tc of delta.tool_calls||[]){const index=tc.index??0;calls[index]??={id:'',type:'function',function:{name:'',arguments:''}};if(tc.id)calls[index].id=tc.id;if(tc.function?.name)calls[index].function.name+=tc.function.name;if(tc.function?.arguments)calls[index].function.arguments+=tc.function.arguments;}
      }reasoningFailed=false;}finally{reasoning.finish({failed:reasoningFailed});}
      if(!calls.length&&!mapped&&!finalize){messages.push(message,{role:'system',content:'请先调用map_need，把已知需求与功能/原理关联展示出来，并从题录选择候选后核验。不可以仅回复关键词没有命中或只追问而不给任何初步方向。'});continue;}
      if(!calls.length&&mapped&&turn<4){messages.push(message,{role:'system',content:'最终答复必须通过present_answer工具返回分段文字与项目ID关联。只写给企业看的正式建议，不要输出任何核验记录、阶段小结或说明自己正在分析。请现在调用工具。'});continue;}
      if(!calls.length){send('error',{text:'正式结果未通过自适应结构提交，请保留本轮输入并重试；不会用未核对的自由文本冒充完整报告。'});res.end();return;}
      for(const call of calls)if(!call.id)call.id=crypto.randomUUID();message.tool_calls=calls;messages.push(message);
      for(const call of calls){const name=call.function.name;let args;try{args=JSON.parse(call.function.arguments||'{}');}catch{call.function.arguments='{}';send('tool_argument_retry',{name:name||'未知工具',text:'参数格式未通过校验，正在重新生成结构化调用。'});messages.push({role:'tool',tool_call_id:call.id,content:'上一次工具参数不是合法JSON。请检查参数结构并重新调用工具；字符串中的引号必须转义，参数必须完整。'});continue;}
        if(name==='present_answer'){
          let prepared;
          try{prepared=prepareAdaptiveAnswer({...args,segments:Array.isArray(args.segments)?args.segments.map(segment=>({...segment,text:cleanEnterpriseText(segment.text)})):args.segments},outputPolicy);}catch(e){messages.push({role:'tool',tool_call_id:call.id,content:e.message+'。'+finalAnswerInstruction(outputPolicy)});continue;}
          const segments=attachProjectReferences(prepared,catalog.projects,verifiedProjectIds);
          if(!segments.length){messages.push({role:'tool',tool_call_id:call.id,content:'请按每个建议方向返回独立segment及对应档案ID。'});continue;}
          const answerText=segments.map(segment=>segment.text).join('\n\n');messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({status:'已接受结构化答复，项目来源均来自本轮已读取档案'})},{role:'assistant',content:answerText});sessions.set(id,messages);if(sessions.size>10)sessions.delete(sessions.keys().next().value);const answerId=crypto.randomUUID();approvedSpeech.set(answerId,answerText);if(approvedSpeech.size>101)approvedSpeech.delete([...approvedSpeech.keys()].find(key=>key!=='introduction'));await syncFinalGraph(segments);send('answer_segments',{segments,reportMode:outputPolicy.mode});send('done',{answerId,reportMode:outputPolicy.mode});res.end();return;
        }
        if(name==='show_analysis'){analysisShown=true;send('analysis',{text:String(args.summary||'')});messages.push({role:'tool',tool_call_id:call.id,content:'工作摘要已展示'});continue;}
        if(name==='map_need'){
          try{informationProfile=validateInformationProfile(args.information_profile,preserveConversation(messages));outputPolicy=chooseOutputPolicy(informationProfile);}catch(e){messages.push({role:'tool',tool_call_id:call.id,content:e.message+'。'+informationAssessmentInstruction});continue;}
          const valid=typeof args.need==='string'&&Array.isArray(args.unknowns)&&Array.isArray(args.routes)&&args.routes.length>0&&args.routes.every(route=>route&&typeof route==='object'&&typeof route.function==='string'&&typeof route.hypothesis==='string'&&Array.isArray(route.project_ids)&&route.project_ids.every(p=>typeof p==='string'&&projectIds.has(p))&&Array.isArray(route.method_ids)&&route.method_ids.every(m=>typeof m==='string'&&methodIds.has(m)));
          if(valid){
            mapped=true;mappedRoutes=args.routes.slice(0,3).map(r=>({...r,project_ids:[...new Set(r.project_ids)].slice(0,2)}));mappedNeed=args.need;mappedUnknowns=args.unknowns;
            for(const [routeIndex,route] of mappedRoutes.entries())for(const projectId of route.project_ids){associationEvidence.seed(catalog.projects.find(p=>p.id===projectId));associationScores.set(`${routeIndex}:${projectId}`,{projectId,routeIndex,industry:associationEvidence.industry(projectId),score:null,status:'候选 · 等待读取',anchors:[],...geometry(null)});}
            emitAssociation();emitScores();
            const candidates=[...new Set(mappedRoutes.flatMap(r=>r.project_ids))];
            const verified=await inspectProjects(candidates);
            for(const method_id of [...new Set(args.routes.flatMap(r=>r.method_ids))].slice(0,2)){const result=await readCandidate('inno_read_method',{method_id,section:'overview'});verified.push({name:'inno_read_method',arguments:{method_id,section:'overview'},result});const boundaries=await readCandidate('inno_read_method',{method_id,section:'boundaries'});verified.push({name:'inno_read_method',arguments:{method_id,section:'boundaries'},result:boundaries});}
            messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({instructions:finalAnswerInstruction(outputPolicy),informationProfile,verified,instruction:`以实际返回资料核对每条假设。题录只有名称的项目不能当作技术机制证据；资料不支持就舍弃，不硬凑。原理事实、迁移设想、待验证条件分清。当前信息完整度策略：${JSON.stringify(outputPolicy)}。检索只能补技术依据，不能把目录或助手推测当作本企业资料；最终严格按该策略展开。`})});
          }else messages.push({role:'tool',tool_call_id:call.id,content:'关联候选中有目录不存在的ID或格式无效，请根据题录纠正后再调用。'});continue;
        }
        if(!permitted.some(t=>t.name===name)){send('tool_argument_retry',{name:name||'未知工具',text:'工具名称未获准，正在重新规划查询。'});messages.push({role:'tool',tool_call_id:call.id,content:'该工具不可用。请从当前提供的只读工具中重新选择，不要重试这个工具。'});continue;}
        if(externalCallCount>=12){send('stage',{text:'资料核验已完成，正在整理建议'});messages.push({role:'tool',tool_call_id:call.id,content:'本轮资料查询上限已到，请使用已读取来源完成建议，不要继续查询。'});continue;}externalCallCount++;
        const callId=crypto.randomUUID(),started=Date.now();send('tool_start',{id:callId,name,args});let result;
        try{result=await rpc(c,'tools/call',{name,arguments:args},controller.signal);associationEvidence.register(name,args,result);emitRecords(args.project_id);emitIndustries();if(['inno_read_project','inno_read_evidence'].includes(name))scoreDirty=true;if(registerProjectRead(verifiedProjectIds,name,args,result))send('project_verified',{projectId:args.project_id});send('tool_result',{id:callId,name,result,ms:Date.now()-started,failed:!!result.isError});}
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
server.listen(port,'127.0.0.1',async()=>{if(port===5188){await mkdir(path.join(root,'.local'),{recursive:true});await writeFile(path.join(root,'.local/runtime.json'),JSON.stringify({pid:process.pid,root,port,startedAt:Date.now()})).catch(()=>{});}console.log(`企业访谈 AI · http://127.0.0.1:${port}`);});
