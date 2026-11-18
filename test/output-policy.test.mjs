import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {informationDimensions,reportParts,reportChapters,unknownInformationProfile,validateInformationProfile,chooseOutputPolicy,prepareAdaptiveAnswer,finalAnswerInstruction,presentAnswerTool} from '../output-policy.mjs';
import {groupAnswerDirections} from '../public/answer-layout.js';
const quotes={enterprise_profile:'我们生产工业阀门，客户是设备制造企业',business_process:'销售先收到邮件，人工摘录规格，再逐条整理报价',goal_baseline:'现在每单处理需要两小时，希望先缩短报价准备时间',digital_data:'已有ERP和历史报价文件，数据只允许在本机处理',organization:'销售主管负责验收，两位业务人员参与试点',delivery_constraints:'先在一个销售小组试点四周，预算上限十万元，报价须人工确认',investment_basis:'每月约三百单，人员投入和软件成本已登记，收益需按试点结果测算',cooperation_basis:'企业IT团队负责ERP接入，实验室仅负责方案讨论，权限和实施责任已确认'};
const user={role:'user',content:Object.values(quotes).join('。')};
const makeProfile=(adequateIds)=>informationDimensions.map(d=>({dimension:d.id,status:adequateIds.includes(d.id)?'adequate':'unknown',evidence:adequateIds.includes(d.id)?[quotes[d.id]]:[]}));
const complete=makeProfile(informationDimensions.map(d=>d.id));
const fullPolicy=chooseOutputPolicy(validateInformationProfile(complete,[user]));
test('稀疏输入保持初诊，不因长模板或完整报告要求升级',()=>{
 assert.equal(chooseOutputPolicy(unknownInformationProfile()).mode,'brief');
 const sparse=makeProfile(['enterprise_profile']);assert.equal(chooseOutputPolicy(validateInformationProfile(sparse,[user])).mode,'brief');
 assert.equal(chooseOutputPolicy(unknownInformationProfile()).readyChapters.length,0);
 assert.match(finalAnswerInstruction(chooseOutputPolicy()),/不强迫三个方向/);
});
test('足够业务背景但实施与数据不足，只选受支持章节',()=>{
 const p=chooseOutputPolicy(validateInformationProfile(makeProfile(['enterprise_profile','business_process','goal_baseline']),[user]));
 assert.equal(p.mode,'partial');assert.deepEqual(p.readyChapters,[1,2,3,5,11]);
 assert.ok(!p.readyChapters.includes(9));assert.ok(!p.readyChapters.includes(10));
 const sections=prepareAdaptiveAnswer({report_mode:'partial',segments:[{chapter_id:11,text:'建议先确认试点范围，再通过小样本验证报价准备时间。',project_ids:[]},{chapter_id:3,text:'目前流程由邮件、人工摘录规格及整理报价组成。',project_ids:[]}]},p);
 assert.match(sections[0].text,/第三章/);assert.match(sections[1].text,/第十一章/);
 assert.ok(!sections.some(s=>s.text.includes('第九章')));
 assert.throws(()=>prepareAdaptiveAnswer({report_mode:'partial',segments:[{chapter_id:9,text:'可测算回报。',project_ids:[]}]},p),/尚不足/);
});
test('完整覆盖时输出三部分十一章，并由服务端固定顺序与标题',()=>{
 assert.equal(fullPolicy.mode,'full');assert.equal(fullPolicy.readyChapters.length,11);
 const segments=[...reportChapters].reverse().map(ch=>({chapter_id:ch.id,text:'结合已知条件开展分析。方案和预测需要通过试点核验。',project_ids:[]}));
 const result=prepareAdaptiveAnswer({report_mode:'full',segments},fullPolicy);
 assert.equal(result.length,11);reportChapters.forEach((ch,i)=>assert.ok(result[i].text.includes(ch.title)));
 for(const part of reportParts)assert.equal(result.filter(s=>s.text.includes(part)).length,1);
 assert.match(result[0].text,/第一部分/);assert.match(result[4].text,/第二部分/);assert.match(result[8].text,/第三部分/);
});
test('评估引用必须属于用户原文，不接受助手补造或伪引用',()=>{
 const bad=structuredClone(complete);bad[0].evidence=['实验室已确认此企业预算五十万元'];
 assert.throws(()=>validateInformationProfile(bad,[user,{role:'assistant',content:'实验室已确认此企业预算五十万元'}]),/用户原文/);
 const missing=structuredClone(complete);missing[0].evidence=[];assert.throws(()=>validateInformationProfile(missing,[user]),/必须有/);
 const duplicate=structuredClone(complete);duplicate[1]=duplicate[0];assert.throws(()=>validateInformationProfile(duplicate,[user]),/重复/);
});
test('关键冲突阻止完整报告，但已知不存在数据可作为限制',()=>{
 const conflict=structuredClone(complete);conflict.find(p=>p.dimension==='digital_data').status='conflicting';
 const policy=chooseOutputPolicy(validateInformationProfile(conflict,[user]));assert.equal(policy.mode,'partial');assert.ok(!policy.readyChapters.includes(7));
 const absent={role:'user',content:'没有ERP系统，也没有结构化数据，只能先访谈员工。'};
 const p=unknownInformationProfile();p.find(d=>d.dimension==='digital_data').status='adequate';p.find(d=>d.dimension==='digital_data').evidence=[absent.content];
 assert.doesNotThrow(()=>validateInformationProfile(p,[absent]));
});
test('未获支持不能升级，空壳、漏章和重复章节被拒绝',()=>{
 assert.throws(()=>prepareAdaptiveAnswer({report_mode:'full',segments:[]},chooseOutputPolicy()),/不能/);
 const one={chapter_id:1,text:'待补充',project_ids:[]};assert.throws(()=>prepareAdaptiveAnswer({report_mode:'full',segments:[one]},fullPolicy),/空章节/);
 assert.throws(()=>prepareAdaptiveAnswer({report_mode:'full',segments:[{...one,text:'有条件的建议。'}]},fullPolicy),/不得漏章/);
 assert.throws(()=>prepareAdaptiveAnswer({report_mode:'full',segments:[{...one,text:'有条件的建议。'},{...one,text:'重复章。'}]},fullPolicy),/重复/);
 const dupTitle=prepareAdaptiveAnswer({report_mode:'brief',segments:[{chapter_id:null,text:'请先说明最希望改善的业务环节，可以从报价准备开始。',project_ids:[]}]},chooseOutputPolicy());assert.equal(dupTitle.length,1);
});
test('完整报告章节不被方向分段器拆开，来源卡保留在章节下',()=>{
 const source={id:'p1',name:'来源项目'};
 const text='第一部分：企业现状与AI转型诊断\n\n第一章 企业AI转型诊断摘要\n1. 已知业务\n2. 建议先试点。';
 const result=groupAnswerDirections([{text,projects:[source]},{text:'第二章 企业基本情况与所在行业画像\n正文',projects:[]}]);
 assert.equal(result.length,2);assert.equal(result[0].text,text);assert.deepEqual(result[0].projects,[source]);
 assert.equal(groupAnswerDirections(groupAnswerDirections(result)).length,2);
});
test('最终工具有明确模式和章节字段，服务流程全部使用统一策略',async()=>{
 const schema=presentAnswerTool().function.parameters;assert.ok(schema.required.includes('report_mode'));assert.ok(schema.properties.segments.items.required.includes('chapter_id'));
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');const services=await readFile(new URL('../services.mjs',import.meta.url),'utf8');
 assert.match(server,/validateInformationProfile\(args\.information_profile,preserveConversation\(messages\)\)/);
 assert.match(server,/finalAnswerInstruction\(outputPolicy\)/);assert.match(server,/prepareAdaptiveAnswer/);
 assert.match(server,/toolChoice:finalize/);assert.doesNotMatch(server,/答复严格控制在300至500字/);
 assert.match(services,/用户明确要完整方案不等于事实信息充分/);
});

test('保留整段语音核对后逐字显示，不按报告长度提前呈现',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 // Verified against the pre-adaptive-output source. Normalize line endings so
 // this exact-source invariant works in clean clones without private backups.
 const normalized=app.replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(normalized,'utf8').digest('hex'),'c4c6e831656e16111ba478e7a0b837baf8ca785701c649cf4dfa9e510579e4e6');
 assert.doesNotMatch(app,/shouldRevealImmediately|immediate:true|displaySegments/);
 const speech=app.indexOf('const blob=await prepareSpeech(answerId);');
 const show=app.indexOf('reasoningView.showResult()',speech);
 const reveal=app.indexOf('await revealStructuredAnswer(reasoningView.result,',speech);
 assert.ok(speech>=0&&show>speech&&reveal>show);
 assert.match(app,/await revealLikeChatGPT\(p,segment\.text\)/);
});
test('正文重复章节标题被准确移除，但实质正文完整保留',()=>{
 const p=chooseOutputPolicy(validateInformationProfile(makeProfile(['enterprise_profile','business_process','goal_baseline']),[user]));
 const title=reportChapters.find(c=>c.id===3).title;
 const result=prepareAdaptiveAnswer({report_mode:'partial',segments:[{chapter_id:3,text:title+'：\n销售先收到邮件，再人工整理报价。',project_ids:[]}]},p);
 assert.equal(result[0].text.split(title).length-1,1);
 assert.ok(result[0].text.endsWith('销售先收到邮件，再人工整理报价。'));
 assert.throws(()=>prepareAdaptiveAnswer({report_mode:'partial',segments:[{chapter_id:3,text:title+'：\n待补充',project_ids:[]}]},p),/章节/);
});
