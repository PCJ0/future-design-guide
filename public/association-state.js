import {inferProjectIndustry,preferIndustry} from './industry-classification.js';
export const initialGraph=()=>({nodes:[],edges:[],routes:[],phase:'idle',catalog:[],records:[],catalogTotal:0,activeProject:null,activeProjects:[],need:'',processed:0,total:0,adopted:[]});
export function reduceGraph(state,event){
  const s={...state,nodes:state.nodes.map(n=>({...n})),edges:state.edges.map(e=>({...e})),activeProjects:[...(state.activeProjects||[])]};
  if(['work_started','catalog_progress','catalog_ready'].includes(event.type))s.phase='prepare';
  if(event.type==='catalog_graph'){s.catalog=event.projects||[];s.catalogTotal=event.total??s.catalog.length;}
  if(event.type==='graph_records'){const records=new Map((state.records||[]).map(r=>[r.ref,r]));for(const r of event.records||[])records.set(r.ref,r);s.records=[...records.values()];}
  if(event.type==='association'){
    s.routes=event.routes||[];s.need=event.need||s.need;s.phase='think';
    for(const [i,r] of s.routes.entries())for(const p of r.projects||[]){if(!s.nodes.some(n=>n.id===p.id))s.nodes.push({...p,industry:preferIndustry(inferProjectIndustry(p),p.industry&&typeof p.industry==='object'?p.industry:null),review:'queued'});if(!s.edges.some(e=>e.key===`${i}:${p.id}`))s.edges.push({key:`${i}:${p.id}`,projectId:p.id,routeIndex:i,score:null,status:'候选 · 等待读取',length:0,width:1,opacity:.16});}
  }
  if(event.type==='association_scores')for(const a of event.assessments||[]){const key=`${a.routeIndex}:${a.projectId}`,old=s.edges.find(e=>e.key===key);if(old)Object.assign(old,a);else s.edges.push({...a,key});const n=s.nodes.find(n=>n.id===a.projectId);if(n)n.industry=preferIndustry(n.industry,a.industry);}
  if(event.type==='industry_classifications')for(const p of event.projects||[]){const n=s.nodes.find(n=>n.id===p.projectId);if(n)n.industry=preferIndustry(n.industry,p.industry);}
  if(event.type==='candidate_status'){
    const n=s.nodes.find(n=>n.id===event.projectId);if(n)n.review=event.status;
    s.processed=event.completed??s.processed;s.total=event.total??s.total;
    if(event.status==='reading'){if(!s.activeProjects.includes(event.projectId))s.activeProjects.push(event.projectId);}else s.activeProjects=s.activeProjects.filter(id=>id!==event.projectId);
  }
  if(event.type==='tool_start'){s.phase='retrieve';s.activeProject=event.args?.project_id||null;}
  if(event.type==='tool_result')s.activeProject=null;
  if(event.type==='model_wait'||event.type==='thinking_started')s.phase='think';
  if(event.type==='association_adopted'){s.adopted=event.projectIds||[];s.nodes.forEach(n=>n.adopted=s.adopted.includes(n.id));}
  // Server done only means text exists. The UI still has voice preparation and reveal work.
  if(event.type==='done'||event.type==='answer_segments'||event.type==='presentation_wait')s.phase='synth';
  if(event.type==='presentation_started')s.phase='reveal';
  if(event.type==='presentation_complete')s.phase='complete';
  if(event.type==='error')s.phase='error';
  return s;
}
