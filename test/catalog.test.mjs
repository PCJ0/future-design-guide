import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogContext,toolData} from '../catalog.mjs';
test('跨行业发现上下文包含全部题录而不按企业词筛掉候选',()=>{const text=catalogContext({projects:[{id:'p1',name:'压力容器密封'},{id:'p2',name:'工业视觉检测'}],methods:[{method_id:'m1',name:'功能分析',summary:'抽象功能'}]});assert.ok(text.includes('压力容器密封'));assert.ok(text.includes('工业视觉检测'));assert.ok(text.includes('功能分析'));assert.ok(text.includes('仍需读取档案与证据'));});
test('资料库工具错误不能当作已读目录',()=>{assert.throws(()=>toolData({isError:true,content:[{type:'text',text:'limit invalid'}]}),/工具错误/);assert.deepEqual(toolData({content:[{type:'text',text:'{"data":[]}'}]}),{data:[]});});
