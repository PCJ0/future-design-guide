const labels={summary:'项目简介',description:'详细介绍',scope_included:'项目范围',scope_excluded:'范围说明',current_stage:'当前进展',owner:'所属单位',scenario:'应用场景',goal:'设计目标',constraints:'设计约束',function:'主要功能',principle:'技术原理',materials:'材料',interfaces:'系统配合',original_statement:'原文介绍',conditions:'适用条件',subject:'对象',value:'指标数值',unit:'单位',qualifier:'数值说明',value_kind:'指标来源',award_name:'奖项',year:'年份',level:'获奖等级',organizer:'组织单位',name_original:'单位名称',project_role:'参与角色',role_evidence:'资料依据',name:'名称',title:'主题',problem:'解决的问题',solution:'解决方案',features:'设计特点',advantages:'项目优势',applications:'应用领域',mechanism:'实现机制',background:'项目背景',content:'详细内容',text:'介绍',limitations:'适用边界',evidence:'资料依据',results:'实施效果'};
function readable(value){if(value==null)return '';if(typeof value==='string'||typeof value==='number')return String(value);if(Array.isArray(value))return value.map(readable).filter(Boolean).join('；');if(typeof value==='object')return readable(value.text||value.description||value.summary||value.name||value.title);return '';}
export function projectSections(data){
 const p={...data.project,...data.overview?.project};
 const sections=[{title:'项目概况',fields:[['年份',p.year],['获奖情况',p.award],['完成单位',p.unit]].filter(x=>x[1]).map(([label,value])=>({label,text:String(value)}))}];
 if(data.archive?.text)sections.push({title:'项目原始介绍',fields:[{label:'档案原文',text:data.archive.text}]});
 else if(data.archive?.summary)sections.push({title:'原始项目简介（题录摘录）',fields:[{label:'项目简介',text:data.archive.summary}]});
 for(const record of data.records?.data||[]){
  const fields=[];
  for(const [key,label] of Object.entries(labels)){const cell=record.cells?.[key];if(!cell||['not_researched','unknown','not_available'].includes(cell.value_state))continue;const text=readable(cell.value);if(!text.trim())continue;fields.push({label,text,interpretation:cell.content_nature==='platform_analysis'||cell.content_nature==='ai_interpretation'});}
  if(fields.length)sections.push({title:record.title||'项目介绍',fields});
 }
 return sections;
}
export function renderProjectSections(container,data,{append=false}={}){
 if(!append)container.replaceChildren();
 const sections=projectSections(data);if(append)sections.shift();
 for(const item of sections){if(!item.fields.length)continue;const section=document.createElement('section'),h=document.createElement('h3'),dl=document.createElement('dl');h.textContent=item.title;for(const field of item.fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=field.label+(field.interpretation?' · 资料解读':'');dd.textContent=field.text;dl.append(dt,dd);}section.append(h,dl);container.append(section);}
 if(!append&&data.archive){const note=document.createElement('p');note.className='archive-note';note.textContent=data.archive.text?'以上介绍来自知识库保存的项目原文。':data.archive.status==='requires_auth'?'已接入原始资料入口；当前正文需要知识库登录授权。题录摘录仅是部分简介，不是完整介绍。':'当前仅能提供已获取的资料，原文尚未读取成功。';container.append(note);const link=document.createElement('a');link.href=data.archive.sourceUrl||data.archive.pageUrl;link.target='_blank';link.rel='noopener noreferrer';link.className='archive-link';link.textContent=data.archive.sourceUrl?'在知识库中查看完整原件 ↗':'查看知识库项目档案 ↗';container.append(link);}
 if(!append&&sections.length<=1&&!data.archive){const p=document.createElement('p');p.textContent='该项目当前暂无更多可展示的正文介绍。';container.append(p);}
}
