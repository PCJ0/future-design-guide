import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,reduceEvent} from '../public/thinking-state.js';

test('motion advances without jumping back during repeated analysis and tool rounds',()=>{
 let s=initialState();assert.equal(s.phase,'idle');
 s=reduceEvent(s,{type:'work_started'});assert.equal(s.phase,'prepare');
 s=reduceEvent(s,{type:'model_wait',round:1});assert.equal(s.phase,'think');
 s=reduceEvent(s,{type:'tool_start'});assert.equal(s.phase,'retrieve');assert.equal(s.calls,1);
 s=reduceEvent(s,{type:'tool_result',failed:true});assert.equal(s.phase,'retrieve');assert.equal(s.failed,1);
 s=reduceEvent(s,{type:'model_wait',round:2});assert.equal(s.phase,'retrieve');assert.equal(s.round,2);
 s=reduceEvent(s,{type:'stage',text:'整理关联依据、迁移设想与验证步骤'});
 s=reduceEvent(s,{type:'model_wait',round:3});assert.equal(s.phase,'synth');
 s=reduceEvent(s,{type:'thinking_started'});assert.equal(s.phase,'synth');
 s=reduceEvent(s,{type:'done'});assert.equal(s.phase,'synth','wait for display completion before successful terminal state');
 s=reduceEvent(s,{type:'error'});assert.equal(s.phase,'error');
 assert.equal(initialState().calls,0);
});
