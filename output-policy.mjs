// Adaptive depth is based on evidence coverage, never message length or a request for a report.
export const reportParts=Object.freeze([
  '第一部分：企业现状与AI转型诊断',
  '第二部分：AI应用机会与技术方案',
  '第三部分：投资价值与合作落地'
]);
export const informationDimensions=Object.freeze([
  {id:'enterprise_profile',label:'企业与行业画像',criteria:'企业业务、产品服务、客户或经营模式足以定位对象；不是只有企业名称'},
  {id:'business_process',label:'业务流程与实际痛点',criteria:'至少一个真实业务流程、工作步骤、瓶颈或重复任务；仅行业常见痛点不算企业事实'},
  {id:'goal_baseline',label:'目标与现状基线',criteria:'希望改善的目标和当前状况足以比较；定性基线也可，但无数值时不可承诺定量收益'},
  {id:'digital_data',label:'数字化与数据条件',criteria:'已有系统、数据种类、可用性或访问限制足以判断应用条件；不知道或没有数据的明确事实也可'},
  {id:'organization',label:'组织与实施能力',criteria:'业务负责人、参与角色、人员能力、治理或责任安排足以判断谁实施及谁确认'},
  {id:'delivery_constraints',label:'实施约束与验收',criteria:'周期、预算或资源范围、系统集成/安全限制、验收方式有足够实际约束；非必须每个字段有数字'},
  {id:'investment_basis',label:'投入产出与风险依据',criteria:'有成本/效率/增长的实际基线及可说明的风险或测算假设，可做定性或有依据的量化分析；只有愿望不算依据'},
  {id:'cooperation_basis',label:'技术资源与合作分工',criteria:'已知可用技术资源、合作方能力事实或实施责任边界，能区分现有能力与待商议合作；不得仅凭模型宣称实验室能力'}
]);
export const reportChapters=Object.freeze([
  {id:1,part:0,title:'第一章 企业AI转型诊断摘要',requires:['enterprise_profile','business_process','goal_baseline'],focus:'企业整体情况、核心问题、AI转型准备度、推荐应用场景、优先实施建议及主要风险；结论先行'},
  {id:2,part:0,title:'第二章 企业基本情况与所在行业画像',requires:['enterprise_profile'],focus:'行业定位、主营产品与服务、产业链位置、主要客户、经营模式、核心竞争力及发展目标，仅写已知项'},
  {id:3,part:0,title:'第三章 企业业务流程与经营痛点分析',requires:['business_process'],focus:'业务价值链、关键流程、经营瓶颈、人工密集与重复任务，区分业务问题与技术问题'},
  {id:4,part:0,title:'第四章 企业AI转型准备度评估',requires:['digital_data','organization'],focus:'数字化基础、数据条件、组织能力、技术适配性及制约因素；没有量表和逐维依据，不编六维分数或成熟度百分比'},
  {id:5,part:1,title:'第五章 列出ai可以在 该企业的实现的场景',requires:['enterprise_profile','business_process','goal_baseline'],focus:'按已知业务域识别候选AI场景；研发、生产、营销、服务、管理不强求全部覆盖，场景必须贴合输入'},
  {id:6,part:1,title:'第六章 AI应用场景价值评估与优先级排序',requires:['goal_baseline','digital_data','delivery_constraints'],focus:'业务价值、数据可得性、技术可行性、成本、集成难度、风险和周期；给排序依据，不虚构评分'},
  {id:7,part:1,title:'第七章 重点场景AI技术解决方案',requires:['digital_data','organization','delivery_constraints'],focus:'推荐技术、架构、数据、应用流程、人工参与、预期能力和验收；架构是建议，不能冒称已经部署'},
  {id:8,part:1,title:'第八章 企业AI转型实施路线图',requires:['organization','delivery_constraints'],focus:'短期试点、中期集成、长期优化，明确任务、资源、节点和验收；未知日期不补造'},
  {id:9,part:2,title:'第九章 投入产出与风险评估',requires:['goal_baseline','investment_basis'],focus:'建设运维成本、效率、节约、增长、风险与回报；已核实数据与预测假设分开；无测算数据则定性分析，不编金额/ROI'},
  {id:10,part:2,title:'第十章 技术资源与合作能力介绍',requires:['cooperation_basis'],focus:'匹配未来设计实验室、智慧绿洲等实际资源及分工；能力、合作关系和报价必须有用户确认或已读取可靠来源，未知只提合作需求'},
  {id:11,part:2,title:'第十一章 结论及下一步行动建议',requires:['business_process','goal_baseline'],focus:'1至3个建议优先场景、缺失条件、所需材料、PoC及推进方式；逐项对应，未知责任人或时间不填造'}
]);
const normalized=t=>String(t||'').normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
const statuses=new Set(['adequate','partial','unknown','conflicting']);
export const unknownInformationProfile=()=>informationDimensions.map(d=>({dimension:d.id,status:'unknown',evidence:[]}));

// This verifies quotation provenance and schema. Semantic adequacy remains the model's assessment.
// Only user messages provide enterprise facts. Assistant guesses and library text cannot fill gaps.
export function validateInformationProfile(raw,userMessages){
  if(!Array.isArray(raw)||raw.length!==informationDimensions.length)throw Error('信息评估须逐项覆盖8个维度');
  const users=userMessages.filter(m=>m.role==='user').map(m=>normalized(m.content));
  const ids=new Set(informationDimensions.map(d=>d.id)),seen=new Set();
  const profile=raw.map(item=>{
    if(!item||!ids.has(item.dimension)||seen.has(item.dimension)||!statuses.has(item.status))throw Error('信息维度重复或状态无效');
    seen.add(item.dimension);
    if(!Array.isArray(item.evidence)||item.evidence.length>4)throw Error('每个维度须提供0至4段用户原文依据');
    const evidence=item.evidence.map(quote=>{
      if(typeof quote!=='string'||quote.length>700||normalized(quote).length<4||!users.some(t=>t.includes(normalized(quote))))throw Error('信息评估引用必须来自本场访谈的用户原文，不得用模型猜测补全');
      return quote.trim();
    });
    if(item.status!=='unknown'&&!evidence.length)throw Error('非未知状态必须有用户原文依据');
    if(item.status==='unknown'&&evidence.length)throw Error('未知维度不应填已知依据；明确没有系统或数据属于已知限制，不是未知');
    return {dimension:item.dimension,status:item.status,evidence};
  });
  return informationDimensions.map(d=>profile.find(p=>p.dimension===d.id));
}
export function chooseOutputPolicy(profile=unknownInformationProfile()){
  const byId=new Map(profile.map(p=>[p.dimension,p]));
  const readyChapters=reportChapters.filter(ch=>ch.requires.every(id=>byId.get(id)?.status==='adequate')).map(ch=>ch.id);
  const adequate=informationDimensions.filter(d=>byId.get(d.id)?.status==='adequate').length;
  const mode=readyChapters.length===reportChapters.length?'full':adequate>=3?'partial':'brief';
  return {mode,readyChapters,adequateDimensions:adequate,missing:informationDimensions.filter(d=>byId.get(d.id)?.status!=='adequate').map(d=>({dimension:d.id,label:d.label,status:byId.get(d.id)?.status||'unknown'}))};
}
export const informationProfileSchema={type:'array',minItems:8,maxItems:8,items:{type:'object',additionalProperties:false,properties:{dimension:{type:'string',enum:informationDimensions.map(d=>d.id)},status:{type:'string',enum:[...statuses]},evidence:{type:'array',maxItems:4,items:{type:'string',description:'本场访谈用户消息的连续原文引用；不得用助手输出、网页或目录填充企业现状'}}},required:['dimension','status','evidence']}};
export const informationAssessmentInstruction=`在map_need中同时提交information_profile：按以下8个维度判断输入的实质覆盖，使用adequate（足以形成有条件的分析）、partial（仅部分已知）、unknown（未提供）、conflicting（关键冲突尚未解开）。每个非unknown维度引用1至4段用户连续原文，引用必须来自本轮或同场此前用户消息，不引用助手先前判断或资料库推测，不跨两段拼成一句。用户说“请生成完整报告”只表达需求，不是任何维度的事实证据；长文字、所有维度名称和完备模板也不等于资料充分。后续明确更正覆盖旧信息，未解释的矛盾标conflicting。明确没有系统/数据/预算等是已知限制，可据实际影响判partial或adequate，不能改写成存在这些条件。各维度标准：${informationDimensions.map(d=>`${d.id}（${d.label}）：${d.criteria}`).join('；')}。没有足够信息也照常提交unknown项并形成少量探索路线，不阻断初步答复。`;
export const adaptiveReportInstruction=`输出深度随信息完整度改变，准确性和诚实性不降级。信息评估和最终输出范围由本轮output policy约束；按已有输入可支撑的内容给出建议，不靠字数、输入长短或“完整报告”要求决定。快速初诊用简洁已知情况与1至3个条件化方向；部分诊断仅展开有依据章节，省略无依据章节，不输出空章节和大段待补充；完整报告按下列三部分十一章组织。资料库可补充技术原理来源，但不能补造本企业流程、基线、预算、人员或合作能力。建议方案与企业事实、预测假设、待核条件须区分。全文结构：${reportParts.map((p,i)=>p+'；'+reportChapters.filter(c=>c.part===i).map(c=>c.title+'：'+c.focus).join('；')).join('\n')}。完整目录不强制每项都有数字或图表，数据不足时以边界清楚的定性分析替代，不编评分、收益、报价和合作承诺。`;
export function finalAnswerInstruction(policy){
  const common='资料读取到此结束，使用present_answer提交正式结果，report_mode须与输出策略一致。每个段的project_ids只关联本轮已读且实际使用的档案，无来源则为空。不要输出内部思考、检索日志或开发说明。每段正文不重复章节/部分标题，服务器负责准确添加目录标题。用清楚中文段落，不用Markdown表格、代码块、HTML或装饰符；列表用简洁小标题，便于原样播报。最多问一个最影响下一步判断的问题；缺失资料只简述3项优先补充，不反复问卷。';
  const evidence='允许通用方法和有条件的迁移设想，但不要把未确认信息当事实；“建议/可尝试”不是验证完成。预算、回报率、成熟度分数和实验室能力没有来源不得补造。';
  if(policy.mode==='full')return `${common}\n输出策略full：输入足以支撑三部分十一章。必须返回chapter_id=1至11各一段，顺序不缺；每章按其重点充分展开但不机械凑字，建议总体1800至3500字。每章保持主体内容与实际依据对应。必要的待确认或假设放本章末尾，完整报告也不能伪装成已完成实测或已签约。${evidence}`;
  if(policy.mode==='partial')return `${common}\n输出策略partial：仅展开可支撑章节，允许的chapter_id为${policy.readyChapters.join('、')||'无'}，按原目录顺序保留原编号，不重排为新章；不需要全选，选择有实际帮助的内容。其他少量有条件建议或补充信息放chapter_id=null的独立短段，总体约600至1800字，随实际资料调整，不为字数填空话。没有充分依据的章不写空壳，不以“待补充”铺满十一章。${evidence}`;
  return `${common}\n输出策略brief：信息仍处快速初诊。所有chapter_id为null，给1至3个贴近已知业务的问题分析或可验证方向，加最多一段关键补充问题；一般300至500字，输入几乎没有业务内容时可以更短。不重复固定场景，不强迫三个方向，更不能硬凑十一章。${evidence}`;
}
export function presentAnswerTool(){return {type:'function',function:{name:'present_answer',description:'按本轮信息充分度策略提交最终结果：brief为短建议，partial为有依据章节，full为三部分十一章；每章独立segment，章节标题由服务端添加，来源卡紧随对应内容。',parameters:{type:'object',additionalProperties:false,properties:{report_mode:{type:'string',enum:['brief','partial','full']},segments:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,properties:{chapter_id:{type:['integer','null'],minimum:1,maximum:11},text:{type:'string'},project_ids:{type:'array',items:{type:'string'}}},required:['chapter_id','text','project_ids']}}},required:['report_mode','segments']}}};}
const emptyBody=/^(?:\s|[\[\]【】。:：、，,-]|待补充|待填写|暂无|未知|内容待填|待确认|无资料)+$/u;
export function prepareAdaptiveAnswer(args,policy){
  if(args?.report_mode!==policy.mode)throw Error(`当前输出策略为${policy.mode}，不能因为要求完整而升级范围`);
  if(!Array.isArray(args.segments)||!args.segments.length||args.segments.length>12)throw Error('最终输出须含1至12段');
  const chapters=new Set(),nulls=[];
  const segments=args.segments.map(s=>{
    if(!s||typeof s.text!=='string'||!s.text.trim()||emptyBody.test(s.text.trim())||!Array.isArray(s.project_ids)||!s.project_ids.every(id=>typeof id==='string'))throw Error('每段须有实质正文及项目ID数组，不接受空章节或纯待补充');
    const id=s.chapter_id;
    if(id!==null&&(!Number.isInteger(id)||id<1||id>11||chapters.has(id)))throw Error('章节ID无效或重复');
    if(policy.mode==='brief'&&id!==null)throw Error('快速初诊只提交无章节短建议');
    if(policy.mode==='partial'&&id!==null&&!policy.readyChapters.includes(id))throw Error('不能输出当前资料尚不足支撑的章节');
    if(policy.mode==='full'&&id===null)throw Error('完整报告仅提交十一章，待核信息放在各章内');
    if(id!==null)chapters.add(id);else nulls.push(s);
    const ch=id===null?null:reportChapters.find(c=>c.id===id);
    const rawBody=s.text.trim();
    const body=ch&&rawBody.startsWith(ch.title)?rawBody.slice(ch.title.length).replace(/^[\s：:]+/u,'').trim():rawBody;
    if(!body||emptyBody.test(body))throw Error('章节不可只有标题');
    return {chapter_id:id,text:body,project_ids:[...new Set(s.project_ids)]};
  });
  if(policy.mode==='full'&&chapters.size!==11)throw Error('完整报告必须按目录提交1至11章，不得漏章');
  if(policy.mode==='brief'&&segments.length>4)throw Error('快速初诊不超过三个方向及一个补充段');
  if(policy.mode==='partial'&&nulls.length>1)throw Error('部分诊断的条件化建议与缺口合并为一个短段');
  const ordered=[...segments.filter(s=>s.chapter_id!==null).sort((a,b)=>a.chapter_id-b.chapter_id),...segments.filter(s=>s.chapter_id===null)];
  const partsShown=new Set();
  return ordered.map(s=>{
    if(s.chapter_id===null)return {text:s.text,project_ids:s.project_ids};
    const chapter=reportChapters.find(c=>c.id===s.chapter_id),prefix=partsShown.has(chapter.part)?'':reportParts[chapter.part]+'\n\n';partsShown.add(chapter.part);
    return {text:prefix+chapter.title+'\n'+s.text,project_ids:s.project_ids};
  });
}
