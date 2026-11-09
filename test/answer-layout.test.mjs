import test from 'node:test';
import assert from 'node:assert/strict';
import {groupAnswerDirections} from '../public/answer-layout.js';
const a={id:'a',name:'模块回收'},b={id:'b',name:'气流循环'};
test('direction paragraphs collect their own cards, deduplicated under that direction',()=>{
 const result=groupAnswerDirections([{text:'第一条：便捷清理。',projects:[]},{text:'参考模块回收，采用可拆内桶。',projects:[a,a]},{text:'第二条：减少异味。',projects:[b]}]);
 assert.equal(result.length,2);assert.deepEqual(result[0].projects,[a]);assert.deepEqual(result[1].projects,[b]);
});
test('whole-answer fallback places only explicitly mentioned sources under each direction',()=>{
 const result=groupAnswerDirections([{text:'第一条：参考模块回收改善清洁。\n第二条：参考气流循环改善通风。',projects:[a,b,{id:'c',name:'无关候选'}]}]);
 assert.equal(result.length,2);assert.deepEqual(result[0].projects,[a]);assert.deepEqual(result[1].projects,[b]);
});
test('Arabic numbered directions are separated, while decimal values remain in the paragraph',()=>{
 const result=groupAnswerDirections([{text:'1、方向：采用0.5毫米材料。\n2、方向：参考气流循环。',projects:[b]}]);
 assert.equal(result.length,2);assert.deepEqual(result[0].projects,[]);assert.deepEqual(result[1].projects,[b]);
});
