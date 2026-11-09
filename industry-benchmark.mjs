import {writeFile} from 'node:fs/promises';
const scenarios=[
{industry:'精密制造',input:'我们是一家精密金属零件企业，希望降低异形零件内腔加工损伤，材料与验收阈值还没确定。请从库里的原理和方法给我们初步创新方向。'},
{industry:'连锁零售',input:'我们做社区生鲜连锁零售，主要想减少门店临期食品损耗，但不希望单纯增加打折。请从不同领域的项目与方法联想可能的改进方向，数据条件待确认。'},
{industry:'餐饮服务',input:'我们经营连锁餐厅，希望减少后厨食材浪费，预算和浪费环节还没摸清。除了同类餐饮案例，也想听听其他行业原理怎样迁移。'},
{industry:'冷链物流',input:'我们是一家冷链物流企业，想减少多次交接过程中货物温度异常后的责任争议，现有传感和数据情况还没整理。请给出初步关联与验证方向。'},
{industry:'养老服务',input:'我们是社区养老上门服务公司，想让老人家属更信任服务过程，但不希望用全程摄像打扰老人。请从项目库跨行业关联，给出可讨论的方向。'}];
const reports=[];
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
for(const scenario of scenarios.filter(s=>!only||s.industry===only)){console.log('START',scenario.industry);let answer='',mapped=[],models=[],reads=[],errors=[],done=false;const started=Date.now();try{
 const r=await fetch('http://127.0.0.1:5188/api/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5188'},body:JSON.stringify({text:scenario.input}),signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error((await r.json()).error);let pending='';const decoder=new TextDecoder();for await(const chunk of r.body){pending+=decoder.decode(chunk,{stream:true});let n;while((n=pending.indexOf('\n'))>=0){const raw=pending.slice(0,n);pending=pending.slice(n+1);if(!raw)continue;const e=JSON.parse(raw);if(e.type==='answer_start')answer='';if(e.type==='delta')answer+=e.text;if(e.type==='association'){mapped.push(e);console.log('ROUTES',scenario.industry,e.routes.map(x=>x.function).join(' / '));}if(e.type==='model_stats'){models.push(e);console.log('THINKING',scenario.industry,e.round,e.reasoningTokens);}if(e.type==='tool_start')reads.push(e);if(e.type==='error'||e.type==='tool_result'&&e.failed)errors.push(e);if(e.type==='done')done=true;}}
 }catch(e){errors.push({type:'test_error',text:e.message});}
 reports.push({...scenario,done,ms:Date.now()-started,answer,mapped,models,reads,errors});await writeFile(new URL(only?'./.local/industry-'+only+'.json':'./.local/industry-benchmark.json',import.meta.url),JSON.stringify(reports,null,2));console.log('RESULT',JSON.stringify({industry:scenario.industry,done,seconds:(Date.now()-started)/1000,routes:mapped.length,calls:reads.length,errors:errors.length,answer}));
}
