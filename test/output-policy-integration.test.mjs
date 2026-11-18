// Entire HTTP/streaming path, with network and credentials simulated in a temporary copy.
// Never touches the production service, .local/config.json or paid model APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,copyFile,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {informationDimensions,reportChapters} from '../output-policy.mjs';
const fields={enterprise_profile:'我们生产工业阀门，客户是设备制造企业',business_process:'销售先收到邮件，人工摘录规格，再逐条整理报价',goal_baseline:'现在每单处理需要两小时，希望先缩短报价准备时间',digital_data:'已有ERP和历史报价文件，数据只允许在本机处理',organization:'销售主管负责验收，两位业务人员参与试点',delivery_constraints:'先在一个销售小组试点四周，预算上限十万元，报价须人工确认',investment_basis:'每月约三百单，人员投入和软件成本已登记，收益需按试点结果测算',cooperation_basis:'企业IT团队负责ERP接入，实验室仅负责方案讨论，权限和实施责任已确认'};
const preload=`import {writeFileSync} from 'node:fs';
const dimensions=${JSON.stringify(informationDimensions.map(d=>d.id))};
const fields=${JSON.stringify(fields)};
const chapterRequirements=${JSON.stringify(reportChapters.map(ch=>({id:ch.id,requires:ch.requires})))};
function event(name,args){return new Response('data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'tool-'+crypto.randomUUID(),type:'function',function:{name,arguments:JSON.stringify(args)}}]}}]})+'\\n\\ndata: [DONE]\\n\\n');}
globalThis.fetch=async(url,options)=>{
 const request=JSON.parse(options.body);
 if(request.jsonrpc){
  const name=request.params?.name;
  let result=request.method==='tools/list'?{tools:[]}:{structuredContent:{data:[]}};
  if(name==='inno_search_projects')result={structuredContent:{data:[],total:0,next_offset:null}};
  if(name==='inno_search_methods')result={structuredContent:{data:[],total:0,next_offset:null}};
  return new Response(JSON.stringify({id:request.id,result}));
 }
 if(request.model){
  const userText=request.messages.filter(m=>m.role==='user').map(m=>m.content).join('\\n');
  const adequate=dimensions.filter(id=>userText.includes(fields[id]));
  const ready=chapterRequirements.filter(ch=>ch.requires.every(id=>adequate.includes(id))).map(ch=>ch.id);
  const mode=ready.length===11?'full':adequate.length>=3?'partial':'brief';
  if(request.tools.some(t=>t.function.name==='map_need')){
   const profile=dimensions.map(d=>({dimension:d,status:adequate.includes(d)?'adequate':'unknown',evidence:adequate.includes(d)?[fields[d]]:[]}));
   return event('map_need',{information_profile:profile,need:'优化报价准备流程',unknowns:[],routes:[{function:'减少重复摘录',hypothesis:'可先对邮件规格字段提取开展人工核验试点',project_ids:[],method_ids:[]}]});
  }
  const last=request.messages.at(-1)?.content||'';
  writeFileSync('latest-final-request.json',JSON.stringify({mode,toolChoice:request.tool_choice,instructions:last}));
  const ids=mode==='full'?ready:mode==='partial'?[2,3,5,11].filter(id=>ready.includes(id)):[null];
  return event('present_answer',{report_mode:mode,segments:ids.map(id=>({chapter_id:id,text:id===null?'建议先梳理报价准备环节，选择小样本验证提取规格的可行性。请确认最耗时的工作步骤。':'结合已确认的业务条件，建议先形成可人工核验的小范围方案。预期能力和投入须在试点后核对，不能承诺收益。',project_ids:[]}))});
 }
 throw Error('Unexpected external request');
};
`;
test('完整请求链：简短输入→业务补充→完备资料，自动brief→partial→full',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'enterprise-output-integration-'));
 const source=new URL('..',import.meta.url);
 const modules=['server.mjs','services.mjs','output-policy.mjs','project-library.mjs','reasoning-stream.mjs','association-pipeline.mjs','association-score.mjs','project-archive.mjs','project-references.mjs','realtime-voice.mjs','catalog.mjs','conversation.mjs'];
 let child;
 try{
  for(const name of modules)await copyFile(new URL(name,source),path.join(folder,name));
  await mkdir(path.join(folder,'public'));for(const name of ['dense-topology.js','answer-layout.js','industry-classification.js'])await copyFile(new URL('public/'+name,source),path.join(folder,'public',name));
  // Reuse the read-only vendor library through a file URL shim (no installed packages).
  await mkdir(path.join(folder,'vendor','ws'),{recursive:true});
  const library=new URL('vendor/ws/wrapper.mjs',source).href;
  await writeFile(path.join(folder,'vendor','ws','wrapper.mjs'),`export * from ${JSON.stringify(library)};`,'utf8');
  await mkdir(path.join(folder,'.local'));await writeFile(path.join(folder,'.local','config.json'),JSON.stringify({bailianKey:'test-not-real',mcpToken:'test-not-real',workspaceId:'test',region:'cn-beijing'}));
  await writeFile(path.join(folder,'package.json'),'{"type":"module"}');await writeFile(path.join(folder,'preload.mjs'),preload);
  child=spawn(process.execPath,['--import','./preload.mjs','./server.mjs'],{cwd:folder,env:{...process.env,PORT:'5196'},stdio:['ignore','pipe','pipe']});
  let childError='';child.stderr.on('data',chunk=>{childError+=chunk.toString();});
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('test server failed: '+childError);}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('test server startup timeout')),10000);timer.unref();})]);
  let sessionId;
  for(const [mode,text] of [['brief',fields.enterprise_profile],['partial',[fields.business_process,fields.goal_baseline].join('。')],['full',Object.values(fields).join('。')]]){
   const base='http://127.0.0.1:5196';const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({text,sessionId})});assert.equal(response.status,200);
   const events=(await response.text()).trim().split('\n').map(s=>JSON.parse(s));assert.ok(!events.some(e=>e.type==='error'),JSON.stringify(events.filter(e=>e.type==='error')));
   sessionId=events.find(e=>e.type==='session').id;const result=events.find(e=>e.type==='answer_segments');assert.equal(result.reportMode,mode);
   if(mode==='full'){assert.equal(result.segments.length,11);reportChapters.forEach((ch,i)=>assert.ok(result.segments[i].text.includes(ch.title)));}
   if(mode==='partial')assert.ok(!result.segments.some(s=>s.text.includes('第九章')));
   if(mode==='brief')assert.equal(result.segments.length,1);
   assert.equal(events.at(-1).type,'done');
  }
  const final=JSON.parse(await readFile(path.join(folder,'latest-final-request.json'),'utf8'));assert.equal(final.toolChoice.function.name,'present_answer');assert.match(final.instructions,/十一章/);
 }finally{
  if(child&&child.exitCode===null){child.kill();await once(child,'exit');}
  // Only the exact newly-created test directory is removed; never the project or user files.
  await rm(folder,{recursive:true,force:true});
 }
});
