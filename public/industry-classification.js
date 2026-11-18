// Source-project classification only. Never changes need, relevance score or access rights.
const RULES=[
  {name:'医疗器械',pattern:/医疗(?:分类)?(?:垃圾|废物)|医用|手术机器人|消化道|诊疗|医疗器械|medical\s+waste|病房|康复设备/i},
  {name:'航空航天',pattern:/登机门|飞机|航空|航天|月球|卫星|宇航/i},
  {name:'汽车零部件',pattern:/车载|汽车|车辆|发动机/i},
  {name:'家用电器',pattern:/吸油烟机|抽油烟机|油烟机|冰箱|洗衣机|空调|家用电器|智能家电/i},
  {name:'新能源',pattern:/光伏|太阳能|风力发电|储能电池|氢能|燃料电池/i},
  {name:'消费电子',pattern:/智能手机|手机|摄像头升降模组|通信终端|智能手表|耳机|平板电脑/i},
  {name:'公共卫生',pattern:/(?:扶手|门把手|公共设施|公用).{0,16}(?:消毒|抑菌)|(?:消毒|抑菌).{0,16}(?:扶手|门把手|公共设施|公用)/i},
  {name:'环境治理',pattern:/空气净化|废气治理|污水处理|水质净化|污染治理/i},
  {name:'环保与环卫',pattern:/垃圾(?:智能)?分类|垃圾.{0,12}(?:回收|无害化|处理)|固废|环卫|清运|垃圾箱|废物回收/i},
  {name:'家居用品',pattern:/垃圾桶|家具|家居|收纳用品|厨具/i},
  {name:'金属加工',pattern:/内腔.{0,18}(?:加工|抛光)|磨粒流|深孔.{0,18}加工|金属.{0,12}加工/i},
  {name:'工业装备',pattern:/磁性液体.{0,12}密封|磁液密封|动密封|管道清理|工业机器人|工业装备|生产设备|加工装备|机器人/i},
  {name:'交通运输',pattern:/轨道交通|列车|铁路|物流|运输|船舶/i},
  {name:'农业装备',pattern:/农业机械|农机|农用|播种机|收割机/i},
  {name:'食品加工',pattern:/食品加工|食材加工|食品生产/i},
  {name:'纺织服装',pattern:/纺织|服装|织造/i}
];
const rank={unknown:0,tentative:1,inferred:2,declared:3};
export function normalizeIndustry(name){
  const value=String(name||'').trim();
  if(!value||/^(?:待分类|未分类|未知|不详|暂无|unknown|null|未研究)$/i.test(value))return '';
  if(/手机|摄像头升降模组|通信终端/.test(value))return '消费电子';
  if(/内腔.*加工|内流道.*加工|深孔.*加工|金属.*加工/.test(value))return '金属加工';
  if(/医疗器械|手术机器人/.test(value))return '医疗器械';
  return value.slice(0,24);
}
function matchIndustry(text){
  const source=String(text||'').normalize('NFKC').slice(0,6000);
  for(const rule of RULES){const m=source.match(rule.pattern);if(m){const start=Math.max(0,m.index-22),end=Math.min(source.length,m.index+m[0].length+35);return {name:rule.name,keyword:m[0],quote:source.slice(start,end)};}}
  return null;
}
export function inferProjectIndustry(project={}){
  const explicit=typeof project.industry==='string'?normalizeIndustry(project.industry):'';
  if(explicit)return {name:explicit,source:'资料字段',status:'declared',scope:'source_project',originalLabel:String(project.industry),basis:'项目行业字段'};
  for(const field of ['name','summary','usage','application']){const text=project[field];if(typeof text!=='string'||!text.trim())continue;const match=matchIndustry(text);if(match)return {...match,source:field==='name'?'题名暂定':'用途暂定',status:'tentative',scope:'source_project',basis:field==='name'?'项目名称':'项目用途摘要',reason:'仅用于宽口径分组，待资料核实；不构成关联评分证据'};}
  return {name:'待分类',source:'缺少明确行业线索',status:'unknown',scope:'source_project',basis:'未发现明确名称或用途线索'};
}
export function preferIndustry(current,next){
  if(!next?.name)return current;
  const r=i=>rank[i?.status]??(i?.source==='资料字段'?3:i?.source==='资料推定'?2:i?.name&&i.name!=='待分类'?1:0);
  return r(next)>=r(current)?next:current;
}
export function inferIndustryFromAnchors(anchors=[]){
  for(const r of anchors){
    if(r.metadata||!r.original||!/industry|application|scenario|usage|scope_included|original_text|archive_text|description|introduction/.test(r.field||''))continue;
    const match=matchIndustry(r.text);
    if(match)return {...match,source:'正文推定',status:'inferred',scope:'source_project',basis:'已读取正文的应用领域',ref:r.ref,reason:'依据原文应用领域推定，并非来源明示的行业字段'};
  }
  return null;
}
export function industryDisplay(industry){
  return industry?.name||'待分类';
}
