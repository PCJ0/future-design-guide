import {toolData} from './catalog.mjs';
export async function inspectCandidates(projectIds,{read,readArchive,evidence,onProgress=()=>{},signal,concurrency=2}){
  const ids=[...new Set(projectIds)],results=new Map();let cursor=0,completed=0;
  async function worker(){while(cursor<ids.length){const id=ids[cursor++];if(signal?.aborted)throw signal.reason;onProgress({projectId:id,status:'reading',completed,total:ids.length});const pack=[];let overview=null,failed=false,pages=0;
    async function call(args){const result=await read('inno_read_project',{project_id:id,...args});pack.push({name:'inno_read_project',arguments:{project_id:id,...args},result});evidence.register('inno_read_project',{project_id:id,...args},result);try{return toolData(result);}catch{failed=true;return null;}}
    overview=await call({section:'overview'});
    if(overview?.record_count>0){let offset=0;for(let page=0;page<3;page++){const batch=await call({section:'records',revision:overview.publication_revision||null,offset,limit:20});pages++;const next=batch?.next_offset;if(next==null||!Number.isInteger(next)||next<=offset)break;offset=next;}}
    if(signal?.aborted)throw signal.reason;
    const archive=await readArchive(id);if(archive?.status==='available'&&archive.text){const result={structuredContent:{project_id:id,original_text:archive.text,source_url:archive.sourceUrl,page_url:archive.pageUrl}};evidence.register('inno_read_project',{project_id:id,section:'original'},result);pack.push({name:'read_original_archive',arguments:{project_id:id},result});}
    const anchors=evidence.context().find(p=>p.project_id===id)?.anchors||[];
    const status=anchors.length?'source_ready':archive?.status==='requires_auth'?'requires_auth':failed?'read_failed':'insufficient_source';const result={id,pack,pages,status,anchorCount:anchors.length};results.set(id,result);onProgress({projectId:id,status,completed:++completed,total:ids.length,anchorCount:anchors.length});
  }}
  await Promise.all(Array.from({length:Math.min(concurrency,ids.length)},worker));return results;
}
export const candidatePairs=routes=>routes.flatMap((r,i)=>(r.project_ids||[]).map(project_id=>({project_id,route_index:i})));
