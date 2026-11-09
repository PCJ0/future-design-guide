import {writeFile,mkdir,appendFile} from 'node:fs/promises';
const base='http://127.0.0.1:5188',dir=new URL('./.local/',import.meta.url);
await mkdir(dir,{recursive:true});
const post=(url,data,timeout=180000)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(data),signal:AbortSignal.timeout(timeout)});
const results={time:new Date().toISOString()};
async function check(){const r=await post('/api/check',{});const data=await r.json();results.mcp={status:r.status,count:data.count,error:data.error};console.log('MCP',JSON.stringify(results.mcp));}
async function speech(answerId,label){const started=Date.now(),r=await post('/api/tts',{answerId},140000);if(!r.ok){const data=await r.json();results[label]={status:r.status,error:data.error,ms:Date.now()-started};}else{const bytes=Buffer.from(await r.arrayBuffer());await writeFile(new URL(label+'.wav',dir),bytes);results[label]={status:r.status,verified:r.headers.get('X-Voice-Text-Verified'),bytes:bytes.length,ms:Date.now()-started};}console.log(label,JSON.stringify(results[label]));}
async function chat(){const text='这是一条虚构场景的系统联调测试：我们是一家金属零部件加工企业，想降低异形零件内腔抛光的表面损伤，改善去除均匀性。材料、尺寸、现有设备和验收阈值暂未确定。请基于项目库和方法库给出初步匹配意见，保留证据和未知条件，包含匹配项目、为什么匹配、怎么合作、实施步骤。请先实际检索和核对资料。最多选1个项目、1个方法展开，正文简洁，不超过700字，不要反复扩大检索。';
 const started=Date.now(),r=await post('/api/chat',{text},360000);if(!r.ok){results.chat={status:r.status,error:(await r.json()).error};console.log('CHAT',JSON.stringify(results.chat));return;}
 const events=[];let pending='',answer='',answerId=null;const decoder=new TextDecoder();for await(const chunk of r.body){pending+=decoder.decode(chunk,{stream:true});let n;while((n=pending.indexOf('\n'))>=0){const line=pending.slice(0,n);pending=pending.slice(n+1);if(!line)continue;const e=JSON.parse(line);events.push(e);await appendFile(new URL('live-chat-events.jsonl',dir),JSON.stringify(e)+'\n');if(e.type==='answer_start')answer='';if(e.type==='delta')answer+=e.text;if(e.type==='done')answerId=e.answerId;if(['stage','tool_start','error','done'].includes(e.type))console.log('CHAT_EVENT',JSON.stringify(e));}}
 await writeFile(new URL('live-chat-events.json',dir),JSON.stringify(events,null,2));await writeFile(new URL('live-answer.txt',dir),answer);
 results.chat={status:r.status,done:!!answerId,ms:Date.now()-started,toolCalls:events.filter(e=>e.type==='tool_start').length,toolErrors:events.filter(e=>e.type==='tool_result'&&e.failed).length,error:events.find(e=>e.type==='error')?.text,answerLength:answer.length};console.log('CHAT',JSON.stringify(results.chat));if(answerId)await speech(answerId,'answerSpeech');
}
await check();
await Promise.allSettled([speech('introduction','introSpeech'),chat()]).then(items=>items.forEach((r,i)=>{if(r.status==='rejected'){results['error'+i]=r.reason.message;console.log('TEST_ERROR',i,r.reason.message);}}));
await writeFile(new URL('live-test-report.json',dir),JSON.stringify(results,null,2));
