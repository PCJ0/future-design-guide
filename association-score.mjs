// Scores are explainable ordinal assessments, never probabilities of implementation success.
import {toolData} from './catalog.mjs';
import {inferProjectIndustry,inferIndustryFromAnchors,normalizeIndustry,preferIndustry} from './public/industry-classification.js';
export const industryLabel=normalizeIndustry;
export const weights={function:.35,transfer:.30,constraints:.20,evidence:.15};
const textOf=v=>typeof v==='string'?v:Array.isArray(v)?v.map(textOf).filter(Boolean).join('；'):v&&typeof v==='object'?Object.values(v).map(textOf).filter(Boolean).join('；'):'';
const originalNature=/source_statement|original|archive_text/i;
export class AssociationEvidence {
  constructor(){this.projects=new Map();}
  seed(project){
    if(!project?.id)return;
    const p=this.projects.get(project.id)||{id:project.id,refs:new Map(),industry:null,read:false};
    p.industry=preferIndustry(p.industry,inferProjectIndustry(project));this.projects.set(project.id,p);
  }
  industry(projectId){return this.projects.get(projectId)?.industry||inferProjectIndustry();}
  register(name,args,result){
    if(result?.isError||!args?.project_id||!['inno_read_project','inno_read_evidence'].includes(name))return;
    let data;try{data=toolData(result);}catch{return;}
    const id=args.project_id,p=this.projects.get(id)||{id,refs:new Map(),industry:null,read:false};p.read=true;
    if(name==='inno_read_project'&&args.section==='overview'){
      for(const obj of [data.project,data])if(typeof obj?.industry==='string'&&normalizeIndustry(obj.industry))p.industry=preferIndustry(p.industry,{name:industryLabel(obj.industry),source:'资料字段',status:'declared',scope:'source_project',originalLabel:obj.industry,basis:'项目行业字段'});
    }
    const records=data.data||data.records||[];
    for(const record of Array.isArray(records)?records:[]){
      for(const [field,cell] of Object.entries(record.cells||{})){
        if(!cell||cell.value==null||/not_researched|not_available|unknown/.test(cell.value_state||''))continue;
        const value=textOf(cell.value).trim();if(!value)continue;
        const ref=`${id}:${record.id||record.title||'record'}:${field}`;
        const metadata=/metadata/.test(cell.content_nature||'')||/^title$|award|^year$|edition|level|organizer|official_number|completion_|name_original|name_canonical|project_role|role_evidence|source_ids|canonical_name|^project_id$|^aliases$|^english_name$|^unit$|^owner$|review_status/.test(field)||['organization','person','award'].includes(record.entity)||(field==='summary'&&record.id==='PROJECT');
        p.refs.set(ref,{ref,text:value,field,record:record.title||'',nature:cell.content_nature||'unspecified',sources:cell.source_ids||[],original:originalNature.test(cell.content_nature||''),metadata,evidenceRead:name==='inno_read_evidence'});
        if(field==='industry'&&normalizeIndustry(value))p.industry=preferIndustry(p.industry,{name:industryLabel(value),source:'资料字段',status:'declared',scope:'source_project',originalLabel:value,basis:'项目行业字段',ref});
      }
    }
    // Some archives expose their original introduction directly, without record cells.
    for(const obj of [data,data.project,data.archive])for(const field of ['original_text','archive_text','description','introduction']){
      const value=obj?.[field];if(typeof value!=='string'||!value.trim())continue;
      const ref=`${id}:${args.section||'source'}:${field}`;
      p.refs.set(ref,{ref,text:value,field,nature:'archive_text',sources:[],original:true,metadata:false,evidenceRead:name==='inno_read_evidence'});
    }
    p.industry=preferIndustry(p.industry,inferIndustryFromAnchors([...p.refs.values()]));
    this.projects.set(id,p);
  }
  graphRecords(projectId){const selected=projectId?[this.projects.get(projectId)].filter(Boolean):[...this.projects.values()];return selected.flatMap(p=>[...p.refs.values()].filter(r=>!r.metadata).slice(0,42).map(r=>({ref:r.ref,projectId:p.id,label:r.record?r.record+' · '+r.field:r.field,field:r.field,text:r.text.slice(0,1200),sources:r.sources,nature:r.nature,original:r.original})));}
  context(projectIds){const selected=projectIds?new Set(projectIds):null;return [...this.projects.values()].filter(p=>!selected||selected.has(p.id)).map(p=>({project_id:p.id,industry:p.industry,anchors:[...p.refs.values()].filter(r=>!r.metadata).sort((a,b)=>(/principle|mechanism|function|result|summary|description/.test(b.field)?1:0)-(/principle|mechanism|function|result|summary|description/.test(a.field)?1:0)).slice(0,60).map(r=>({ref:r.ref,text:r.text.slice(0,2400),nature:r.nature,source_ids:r.sources}))}));}
}
export function geometry(score){
  if(!Number.isFinite(score))return {width:1,length:0,opacity:.16};
  const s=Math.max(0,Math.min(1,score));return {width:+(1+8*s).toFixed(2),length:+(960*s).toFixed(1),opacity:+(.18+.7*s).toFixed(2)};
}
export function assessAssociation(item,{routes,evidence}){
  const route=routes[item.route_index];if(!route||!route.project_ids?.includes(item.project_id))throw Error('评分项目必须属于当前真实候选路线');
  const project=evidence.projects.get(item.project_id),matched=[];
  for(const anchor of item.anchors||[]){const source=project?.refs.get(anchor.ref);if(!source||source.metadata||typeof anchor.quote!=='string'||anchor.quote.trim().length<6||!source.text.includes(anchor.quote.trim()))throw Error('评分依据未对应本轮已读取的资料原文');matched.push({...source,quote:anchor.quote.trim()});}
  const scores={};
  for(const key of ['function','transfer','constraints']){const value=item[key];if(value!==null&&(!Number.isInteger(value)||value<0||value>4))throw Error('维度评分只能是0至4整数，未知填null');scores[key]=value;}
  const unknown=Object.keys(scores).filter(k=>scores[k]===null);
  let score=null,raw=null,quality=0,cap=1,status='待评估';
  if(matched.length&&scores.function!==null&&scores.transfer!==null){
    quality=matched.some(r=>r.evidenceRead&&r.original)?1:matched.some(r=>r.original&&r.sources.length)?.75:matched.some(r=>r.original)?.65:.4;
    if(scores.constraints===null)cap=.69;
    if(!matched.some(r=>r.original))cap=Math.min(cap,.49);
    if(scores.function===0||scores.transfer===0)cap=Math.min(cap,.29);
    if(item.conflict===true)cap=Math.min(cap,.29);
    raw=weights.function*scores.function/4+weights.transfer*scores.transfer/4+weights.constraints*(scores.constraints===null?.5:scores.constraints/4)+weights.evidence*quality;
    score=Math.round((Math.min(raw,cap)+Number.EPSILON)*1000)/1000;status=item.conflict?'约束冲突':scores.constraints===null?'初步评估 · 约束待确认':'已评估 · 迁移仍需验证';
  }
  let industry=project?.industry||inferProjectIndustry();
  if(industry.status!=='declared'&&item.industry?.name&&normalizeIndustry(item.industry.name)&&item.industry.ref&&item.industry.quote){const r=project?.refs.get(item.industry.ref);if(r&&!r.metadata&&r.original&&r.text.includes(item.industry.quote)&&item.industry.quote.length>=6)industry=preferIndustry(industry,{name:industryLabel(item.industry.name),scope:'source_project',originalLabel:String(item.industry.name),source:'资料推定',status:'inferred',basis:'已读取正文的应用领域',ref:r.ref,quote:item.industry.quote});}
  if(project&&industry.name!=='待分类')project.industry=industry;
  return {projectId:item.project_id,routeIndex:item.route_index,industry,score,raw:raw===null?null:Math.round((raw+Number.EPSILON)*1000)/1000,cap,status,dimensions:{...scores,evidence:quality},unknown,reason:String(item.reason||'').slice(0,400),conflict:!!item.conflict,anchors:matched.map(r=>({ref:r.ref,quote:r.quote,nature:r.nature,source_ids:r.sources})),...geometry(score)};
}
export const assessmentTool={type:'function',function:{name:'assess_associations',description:'对本轮候选项目与企业需求的创新迁移关联度进行分维度评估。只能使用本轮已读资料锚点；评分不是置信概率，不得按标题猜测。所有候选都返回，无依据的维度填null。',parameters:{type:'object',properties:{assessments:{type:'array',items:{type:'object',properties:{project_id:{type:'string'},route_index:{type:'integer'},function:{type:['integer','null']},transfer:{type:['integer','null']},constraints:{type:['integer','null']},conflict:{type:'boolean'},reason:{type:'string'},anchors:{type:'array',items:{type:'object',properties:{ref:{type:'string'},quote:{type:'string'}},required:['ref','quote']}},industry:{type:'object',properties:{name:{type:'string'},ref:{type:'string'},quote:{type:'string'}},required:['name','ref','quote']}},required:['project_id','route_index','function','transfer','constraints','conflict','reason','anchors']}}},required:['assessments']}}};
export const assessmentInstruction='现在评估当前每条路线的所有候选项目，调用assess_associations。只提交评分摘要和资料锚点，不提交内部思维过程。function功能相似、transfer原理可迁移、constraints目标企业约束适配，各为0不支持、1弱、2部分、3较强、4直接支持；不知道填null。constraints只根据企业明确的信息判断，预算/材料/尺度/安全等关键条件未明确就填null。function和transfer每个非空评级都必须有anchors里的真实资料支持，不能凭标题评分。reason用一句话区分来源事实与迁移假设并说明未知条件。anchors的ref与quote必须精确对应下方资料，不能发明。项目行业优先真实字段；无字段时可从原始介绍明确应用领域作资料推定并给原文锚点。industry.name须是行业名（例如金属加工、医疗器械、交通运输），不能写工艺过程、功能句子或项目名；不明确则不填industry。所有项目都给条目，没资料时anchors为空且维度为null。';
