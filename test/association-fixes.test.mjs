import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCandidates,candidatePairs} from '../association-pipeline.mjs';
import {AssociationEvidence,industryLabel} from '../association-score.mjs';
import {GRAPH,projectPosition,labelPlacement,labelLines} from '../public/association-layout.js';
test('所有六个候选都读取正文，元数据首页不截断机制资料',async()=>{
 const reads=[],completed=[];const evidence=new AssociationEvidence();
 const result=await inspectCandidates(['p1','p2','p3','p4','p5','p6'],{evidence,readArchive:async()=>({status:'unavailable'}),onProgress:e=>{if(e.status!=='reading')completed.push(e.projectId);},read:async(_name,args)=>{reads.push(args);return {structuredContent:args.section==='overview'?{project:{id:args.project_id},record_count:30,publication_revision:'r'}:args.offset===0?{data:[{id:'meta',entity:'award',cells:{award_name:{value:'测试奖',content_nature:'source_statement'}}}],next_offset:20}:{data:[{id:'tech',project_id:args.project_id,entity:'technical',cells:{mechanism:{value:'结构按轴向移动并带动盖板升降',content_nature:'source_statement',source_ids:['s1']}}}],next_offset:null}};}});
 assert.equal(result.size,6);assert.equal(completed.length,6);for(const id of result.keys()){assert.ok(reads.some(r=>r.project_id===id&&r.offset===20));assert.equal(result.get(id).status,'source_ready');}assert.equal(evidence.context().length,6);
});
test('跨行业来源手机细类规范到消费电子，不覆盖需求',()=>{assert.equal(industryLabel('智能手机'),'消费电子');const routes=[{function:'垃圾桶开盖',project_ids:['p1','p2']},{function:'分类',project_ids:['p3']}];assert.equal(candidatePairs(routes).length,3);assert.equal(routes[0].function,'垃圾桶开盖');});
test('权限跳转明确标记原件授权，而非吞成未知',async()=>{const evidence=new AssociationEvidence();const result=await inspectCandidates(['p1'],{evidence,readArchive:async()=>({status:'requires_auth'}),read:async()=>({structuredContent:{project:{id:'p1'},record_count:0}})});assert.equal(result.get('p1').status,'requires_auth');});
test('水平名称保留屏内空间，图谱与对话隔离',()=>{for(let count=1;count<=8;count++)for(let i=0;i<count;i++){const p=projectPosition(i,count),label=labelPlacement(p),extent=14*15;if(label.anchor==='start')assert.ok(label.x+extent<GRAPH.width);else assert.ok(label.x-extent>0);assert.ok(p.y+100<1150);}assert.equal(labelLines('高频正压低摩擦密封型垃圾处理结构及设备设计',14,3).length,2);});
