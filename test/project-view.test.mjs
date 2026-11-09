import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSections} from '../public/project-view.js';
test('project detail displays readable fields and preserves interpretation labels without raw metadata',()=>{
 const sections=projectSections({project:{name:'项目',year:2025,unit:'研究单位'},records:{data:[{title:'技术介绍',cells:{principle:{value:'通过柔性结构保护样品',content_nature:'source_statement'},constraints:{value:['低能耗','小体积'],content_nature:'platform_analysis'},summary:{value:null,value_state:'not_researched'},project_id:{value:'internal-id'}}}]}});
 assert.equal(sections[1].fields[0].text,'低能耗；小体积');assert.equal(sections[1].fields[0].interpretation,true);
 assert.ok(sections[1].fields.some(f=>f.label==='技术原理'));assert.ok(!JSON.stringify(sections).includes('internal-id'));assert.ok(!sections[1].fields.some(f=>f.label==='项目简介'));
});
