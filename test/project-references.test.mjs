import test from 'node:test';
import assert from 'node:assert/strict';
import {registerProjectRead,attachProjectReferences} from '../project-references.mjs';
const phone={id:'2019-04',name:'手机摄像头升降模组设计'};
const result=data=>({content:[{type:'text',text:JSON.stringify(data)}]});
test('supplementary archive reads remain eligible for direction cards',()=>{
 const verified=new Set();
 assert.equal(registerProjectRead(verified,'inno_read_project',{project_id:phone.id,section:'overview'},result({project:phone})),true);
 const segments=attachProjectReferences([{text:'方向一：先简化投放。',project_ids:[]},{text:'方向二：手机摄像头升降模组设计项目可供参考。',project_ids:[phone.id]}],[phone],verified);
 assert.deepEqual(segments[0].projects,[]);assert.deepEqual(segments[1].projects,[phone]);
});
test('explicitly cited read archives survive missing model IDs; unused or failed candidates do not appear',()=>{
 const verified=new Set([phone.id]);const other={id:'other',name:'未被引用的候选项目'};
 const segments=attachProjectReferences([{text:'方向一：普通设计。\n方向二：手机摄像头升降模组设计项目可供参考。',project_ids:[]}],[phone,other],verified);
 assert.deepEqual(segments[0].projects,[]);assert.deepEqual(segments[1].projects,[phone]);
 assert.deepEqual(attachProjectReferences([{text:phone.name,project_ids:[phone.id]}],[phone],new Set())[0].projects,[]);
 assert.equal(registerProjectRead(verified,'inno_read_project',{project_id:other.id},result({project:phone})),false);
 assert.equal(registerProjectRead(verified,'inno_read_project',{project_id:other.id},{isError:true}),false);
});
test('record reads register only a returned matching project',()=>{
 const verified=new Set();assert.equal(registerProjectRead(verified,'inno_read_project',{project_id:phone.id,section:'records'},result({data:[{project_id:phone.id}]})),true);
 assert.equal(registerProjectRead(verified,'inno_search_projects',{project_id:'other'},result({project:{id:'other'}})),false);
});
