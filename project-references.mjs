import {toolData} from './catalog.mjs';
import {groupAnswerDirections} from './public/answer-layout.js';

// Accessed means the requested archive was actually returned, not expert approval.
export function registerProjectRead(verified,name,args,result){
 if(name!=='inno_read_project'||result?.isError||!args?.project_id)return false;
 let data;try{data=toolData(result);}catch{return false;}
 const section=args.section||'overview';
 const matches=section==='overview'?data.project?.id===args.project_id:
   section==='records'&&Array.isArray(data.data)&&data.data.some(r=>r.project_id===args.project_id);
 if(matches)verified.add(args.project_id);
 return !!matches;
}
const normalized=text=>String(text||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
export function attachProjectReferences(segments,projects,verified){
 const available=projects.filter(p=>verified.has(p.id));
 return groupAnswerDirections(segments.map(s=>({text:s.text,projects:available.filter(p=>(s.project_ids||[]).includes(p.id))}))).map(segment=>{
   const text=normalized(segment.text);
   const explicit=available.filter(p=>{const name=normalized(p.name);return name.length>=4&&text.includes(name);});
   return {...segment,projects:[...new Map([...segment.projects,...explicit].map(p=>[p.id,p])).values()]};
 });
}
