import {inferProjectIndustry} from './industry-classification.js';
const unique=(items,key)=>[...new Map(items.filter(Boolean).map(x=>[key(x),x])).values()];
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export const DENSE_LIMITS={catalog:160,records:84,sources:40};
export function selectCatalog(projects=[],limit=DENSE_LIMITS.catalog){
  const groups=new Map();for(const p of unique(projects,p=>p.id).filter(p=>p.id&&p.name)){const industry=p.industry&&typeof p.industry==='object'?p.industry:inferProjectIndustry(p);const list=groups.get(industry.name)||[];list.push({...p,industry});groups.set(industry.name,list);}
  const lists=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'zh')).map(([,rows])=>rows.sort((a,b)=>hash(a.id)-hash(b.id)));const out=[];
  for(let round=0;out.length<limit;round++){let any=false;for(const list of lists){if(list[round]){out.push(list[round]);any=true;if(out.length>=limit)break;}}if(!any)break;}
  return out;
}
export function denseTopology(state){
  const catalog=selectCatalog(state.catalog||[]),actualProjects=unique([...catalog,...(state.nodes||[])],p=>p.id),known=new Set(actualProjects.map(p=>p.id));
  const records=unique(state.records||[],r=>r.ref).filter(r=>known.has(r.projectId)).slice(0,DENSE_LIMITS.records);
  const sources=unique(records.flatMap(r=>(r.sources||[]).map(id=>({id:`${r.projectId}:${id}`,sourceId:id,projectId:r.projectId}))),s=>s.id).slice(0,DENSE_LIMITS.sources),sourceIds=new Set(sources.map(s=>s.id));
  const edges=[];
  for(const p of catalog)edges.push({key:`catalog:${p.id}`,kind:'catalog_membership',projectId:p.id,industry:p.industry.name,weight:null,meaning:'全库题录的行业归属，未声称与企业相关或已读取正文'});
  for(const r of records){edges.push({key:`record:${r.ref}`,kind:'record_membership',projectId:r.projectId,ref:r.ref,weight:null,meaning:'本轮已读取资料字段属于该项目'});for(const id of r.sources||[]){const sourceId=`${r.projectId}:${id}`;if(sourceIds.has(sourceId))edges.push({key:`source:${r.ref}:${id}`,kind:'source_reference',projectId:r.projectId,ref:r.ref,sourceId,weight:null,meaning:'已读取资料字段携带的来源引用，不表示专家核验'});}}
  for(const e of state.edges||[]){if(!known.has(e.projectId))continue;edges.push({...e,key:`association:${e.key}`,kind:'association',weight:Number.isFinite(e.score)?e.score:null,meaning:e.reason||'本轮候选功能迁移路线'});if(e.dimensions)for(const key of ['function','transfer','constraints','evidence']){const v=e.dimensions[key];edges.push({key:`dimension:${e.key}:${key}`,kind:'dimension',projectId:e.projectId,associationKey:e.key,dimension:key,weight:Number.isFinite(e.score)&&Number.isFinite(v)?key==='evidence'?v:v/4:null,meaning:'同一条关联的分维度评价，不是额外候选或额外查询'});}}
  const methods=unique((state.routes||[]).flatMap((r,i)=>(r.methods||[]).map(m=>({...m,routeIndex:i}))),m=>`${m.routeIndex}:${m.method_id||m.id}`);
  return {catalog,actualProjects,records,sources,methods,edges,counts:{catalog:catalog.length,records:records.length,sources:sources.length,paths:edges.length,associations:(state.edges||[]).length}};
}
