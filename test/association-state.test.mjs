import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGraph,reduceGraph} from '../public/association-state.js';
test('真实候选有稳定身份，分值事件可以增加也可以下降',()=>{
 let s=reduceGraph(initialGraph(),{type:'association',need:'测试需求',routes:[{projects:[{id:'p1',name:'测试项目'}]}]});
 assert.equal(s.nodes.length,1);assert.equal(s.edges[0].score,null);
 s=reduceGraph(s,{type:'association_scores',assessments:[{projectId:'p1',routeIndex:0,score:.69,width:6.52,length:662.4,industry:{name:'测试行业',source:'测试夹具'}}]});
 assert.equal(s.nodes[0].industry.name,'测试行业');assert.equal(s.edges[0].score,.69);
 s=reduceGraph(s,{type:'association_scores',assessments:[{projectId:'p1',routeIndex:0,score:.29,width:3.32,length:278.4}]});assert.equal(s.edges[0].score,.29);assert.equal(s.edges.length,1);
});
test('查询命中只改变工作状态，不改变关联度',()=>{
 let s=reduceGraph(initialGraph(),{type:'association',routes:[{projects:[{id:'p1',name:'测试项目'}]}]});s=reduceGraph(s,{type:'tool_start',args:{project_id:'p1'}});assert.equal(s.phase,'retrieve');assert.equal(s.edges[0].score,null);assert.equal(s.activeProject,'p1');s=reduceGraph(s,{type:'tool_result'});assert.equal(s.activeProject,null);
});
test('服务端文本结束仍等语音，文字展示完才完成',()=>{let s=reduceGraph(initialGraph(),{type:'done'});assert.equal(s.phase,'synth');s=reduceGraph(s,{type:'presentation_wait'});assert.equal(s.phase,'synth');s=reduceGraph(s,{type:'presentation_started'});assert.equal(s.phase,'reveal');s=reduceGraph(s,{type:'presentation_complete'});assert.equal(s.phase,'complete');});
