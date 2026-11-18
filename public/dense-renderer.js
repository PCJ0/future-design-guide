import {sampleCubic,sampledPoint,setSvg,approach} from './graph-motion.js';
import {GRAPH,point} from './association-layout.js';
import {denseTopology} from './dense-topology.js';
const ns='http://www.w3.org/2000/svg';
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const at=(angle,scale=1)=>{const p=point(angle);return {x:GRAPH.cx+(p.x-GRAPH.cx)*scale,y:GRAPH.cy+(p.y-GRAPH.cy)*scale};};
function el(tag,attrs,parent,text){const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.append(n);return n;}
export function denseGroups(topology,nodes){
  const all=topology.actualProjects,counts=new Map();for(const p of all){const n=p.industry?.name||'待分类';counts.set(n,(counts.get(n)||0)+1);}
  const selected=[...new Set(nodes.map(p=>p.industry?.name||'待分类'))];const ranked=[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a.localeCompare(b,'zh'));
  for(const n of ranked)if(!selected.includes(n)&&selected.length<8)selected.push(n);
  const rest=ranked.filter(n=>!selected.includes(n));if(rest.length)selected.push('其他来源行业');
  const total=all.length||1,span=130-selected.length*2.1,minimum=7,balance=Math.max(0,span-selected.length*minimum);let angle=174;
  return selected.map(name=>{const members=all.filter(p=>name==='其他来源行业'?rest.includes(p.industry?.name||'待分类'):(p.industry?.name||'待分类')===name),width=minimum+balance*members.length/total;const g={name,members,from:angle,to:angle+width};angle+=width+2.1;return g;});
}
export function renderDense({state,origins,groupOf,color,onInspect,previous=new Map()}){
  const topology=denseTopology(state),views=[],beamViews=[],dots=[],positions=new Map(),layers={links:document.getElementById('graphContextLinks'),beams:document.getElementById('graphContextBeams'),nodes:document.getElementById('graphContextNodes'),labels:document.getElementById('graphContextLabels'),defs:document.getElementById('graphDefs')};
  for(const layer of Object.values(layers))layer.replaceChildren();
  const action=(node,type,item)=>{node.setAttribute('role','button');node.setAttribute('tabindex','0');node.addEventListener('click',()=>onInspect(type,item));node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onInspect(type,item);}});};
  function curve(key,a,b,c,{kind,projectId,ref,weight=null,width=1,opacity=.22,bias=0,dashed=false,trace=false}={}){
    const d=`M${a.x} ${a.y} C${a.x+(GRAPH.cx-a.x)*.58+bias} ${a.y+(GRAPH.cy-a.y)*.5} ${b.x+(GRAPH.cx-b.x)*.64-bias} ${b.y+(GRAPH.cy-b.y)*.56+bias*.5} ${b.x} ${b.y}`;
    const initial=previous.get(key)?.current??(Number.isFinite(weight)?0:null),pathWidth=previous.get(key)?.pathWidth??width,pathOpacity=previous.get(key)?.pathOpacity??opacity,p=el('path',{d,fill:'none',stroke:c,'stroke-width':pathWidth,'stroke-opacity':pathOpacity,'stroke-linecap':'round','stroke-dasharray':dashed?'3 6':'none','data-kind':kind,'data-project':projectId||'','data-ref':ref||'','data-key':key},layers.links);
    const pulse=trace?el('circle',{r:kind==='dimension'?2.4:1.7,fill:c,opacity:0,'aria-hidden':'true'},layers.links):null;
    const v={key,path:p,pulse,points:pulse?sampleCubic(a,{x:a.x+(GRAPH.cx-a.x)*.58+bias,y:a.y+(GRAPH.cy-a.y)*.5},{x:b.x+(GRAPH.cx-b.x)*.64-bias,y:b.y+(GRAPH.cy-b.y)*.56+bias*.5},b):null,kind,projectId,weight,current:initial,width,opacity,pathWidth,pathOpacity,offset:(hash(key)%1000)/1000,activity:previous.get(key)?.activity??0};views.push(v);return v;
  }
  function beam(key,p,c,{kind,projectId,weight=null,scanning=false,halfWidth=7}={}){
    const id='dense-beam-'+beamViews.length,g=el('linearGradient',{id,x1:0,y1:0,x2:0,y2:1},layers.defs);el('stop',{offset:0,'stop-color':c,'stop-opacity':scanning?.28:.68},g);el('stop',{offset:.35,'stop-color':c,'stop-opacity':scanning?.12:.36},g);el('stop',{offset:1,'stop-color':c,'stop-opacity':0},g);
    const n=el('g',{'data-kind':kind,'data-project':projectId||'',transform:`translate(${p.x} ${p.y})`},layers.beams),sheet=el('rect',{x:-halfWidth,y:0,width:halfWidth*2,height:0,fill:`url(#${id})`},n),core=el('rect',{x:-.8,y:0,width:1.6,height:0,fill:`url(#${id})`},n),spark=scanning?null:el('circle',{r:2.1,cx:0,cy:0,fill:c,opacity:0},n);
    beamViews.push({key,node:n,sheet,core,spark,kind,projectId,weight,scanning,current:previous.get(key)?.current??0,offset:(hash(key)%1000)/1000,maxLength:Math.min(960*GRAPH.beamScale,GRAPH.height-80-p.y),activity:previous.get(key)?.activity??0});
  }
  topology.catalog.forEach((p,i)=>{
    const angle=-38.4+190.7*i/Math.max(1,topology.catalog.length-1),end=at(angle),group=groupOf(p),sector=origins.get(group),siblings=sector?.members||[],index=siblings.findIndex(x=>x.id===p.id),origin=at((sector?.from??238)+((sector?.to??250)-(sector?.from??238))*(index+.5)/Math.max(1,siblings.length)),c=color(group);
    positions.set(p.id,end);curve(`catalog:${p.id}`,origin,end,c,{kind:'catalog_membership',projectId:p.id,width:2.4,opacity:.19,bias:(i%9-4)*6,trace:i%3===0});
    el('circle',{cx:origin.x,cy:origin.y,r:2.2,fill:c,opacity:.7},layers.nodes);
    const dot=el('circle',{cx:end.x,cy:end.y,r:3.2,fill:c,opacity:.55,'data-project':p.id,'data-kind':'catalog'},layers.nodes);el('title',{},dot,`${p.name} · 题录归属，非已评估关联`);action(dot,'catalog',p);
    if(i%3===0){const flip=angle>92,label=el('text',{x:flip?-14:14,y:3,transform:`translate(${end.x} ${end.y}) rotate(${angle+(flip?180:0)})`,'text-anchor':flip?'end':'start',class:'context-label','data-kind':'catalog'},layers.labels,Array.from(p.name).slice(0,17).join('')+(p.name.length>17?'…':''));el('title',{},label,p.name);}
    if(i%2===0)beam(`scan:${p.id}`,end,c,{kind:'catalog_scan',projectId:p.id,scanning:true,halfWidth:2.5});
  });
  for(const p of state.nodes)positions.set(p.id,p.position||positions.get(p.id));
  topology.records.forEach((r,i)=>{
    const p=at(-25+hash(r.ref)%17000/100,.83),owner=positions.get(r.projectId);if(!owner)return;const project=topology.actualProjects.find(n=>n.id===r.projectId),c=color(groupOf(project)),assessment=state.edges.filter(e=>e.projectId===r.projectId&&Number.isFinite(e.score)&&e.anchors?.some(a=>a.ref===r.ref)).sort((a,b)=>b.score-a.score)[0],supported=!!assessment,value=supported?assessment.score:null;positions.set(r.ref,p);
    curve(`record:${r.ref}`,owner,p,c,{kind:'record_membership',projectId:r.projectId,ref:r.ref,width:supported?2.7:1.3,opacity:supported?.6:.25,bias:(i%7-3)*14,trace:true});
    const dot=el('circle',{cx:p.x,cy:p.y,r:supported?4:2.8,fill:r.original?c:'#b0b9c0',opacity:.8,'data-ref':r.ref,'data-kind':'record'},layers.nodes);el('title',{},dot,`${r.label} · ${r.original?'原始性质字段':'平台资料字段'}`);action(dot,'record',r);
    if(supported)beam(`evidence:${r.ref}`,p,c,{kind:'score_projection',projectId:r.projectId,weight:value,halfWidth:10});else if(i%2===0)beam(`record-scan:${r.ref}`,p,c,{kind:'record_scan',projectId:r.projectId,scanning:true,halfWidth:2});
  });
  topology.sources.forEach((s,i)=>{const p=at(12+hash(s.id)%14600/100,.63);positions.set(s.id,p);const dot=el('rect',{x:p.x-2.7,y:p.y-2.7,width:5.4,height:5.4,fill:'#93a6b4',opacity:.8,'data-kind':'source'},layers.nodes);el('title',{},dot,'来源引用 '+s.sourceId+' · 不等于原件已打开');action(dot,'source',s);});
  for(const e of topology.edges.filter(e=>e.kind==='source_reference')){const a=positions.get(e.ref),b=positions.get(e.sourceId);if(a&&b)curve(e.key,a,b,'#83a8bc',{kind:e.kind,projectId:e.projectId,ref:e.ref,width:1.15,opacity:.24,bias:hash(e.key)%50-25,trace:true});}
  const titles={function:'功能',transfer:'原理迁移',constraints:'约束适配',evidence:'资料支撑'};
  for(const e of topology.edges.filter(e=>e.kind==='dimension')){const node=state.nodes.find(p=>p.id===e.projectId),p=positions.get(e.projectId);if(!node||!p)continue;const sector=origins.get(groupOf(node)),i=Object.keys(titles).indexOf(e.dimension),origin=at((sector?.from??238)+((sector?.to??250)-(sector?.from??238))*(i+1)/5),end={x:p.x+(i-1.5)*13,y:p.y+12},c=color(groupOf(node));
    const v=curve(e.key,origin,end,c,{kind:'dimension',projectId:e.projectId,weight:e.weight,width:1.2,opacity:.36,bias:(i-1.5)*33,dashed:e.weight===null,trace:true});el('title',{},v.path,`${node.name} · ${titles[e.dimension]} ${e.weight===null?'待确认':e.weight.toFixed(2)}（归一化分维度）`);
    beam(e.key,end,c,{kind:'dimension',projectId:e.projectId,weight:e.weight,halfWidth:5.5});
    const dot=el('circle',{cx:end.x,cy:end.y,r:2.5,fill:c,opacity:.85},layers.nodes);el('title',{},dot,titles[e.dimension]);
  }
  topology.methods.forEach((m,i)=>{const p=at(240+(i%6)*10,.48),hub={x:GRAPH.cx-32+m.routeIndex*32,y:GRAPH.cy-28};const id=m.method_id||m.id;curve(`method:${m.routeIndex}:${id}`,p,hub,'#99bbba',{kind:'method_route',width:1.6,opacity:.4,trace:true});});
  const actual=new Set(topology.catalog.map(p=>p.id));document.getElementById('graphTopology').textContent=topology.catalog.length?`题录展开 ${actual.size}/${state.catalogTotal||actual.size} · 已读字段 ${topology.records.length} · 来源引用 ${topology.sources.length}`:'';
  return {views,beams:beamViews,dots,topology};
}
export function paintDense(dense,{state,phase,now,reduced,motion=null}){
  if(!dense)return;const running=!['idle','complete','error','stopped'].includes(phase),work=reduced?0:motion?.work??(running?1:0),flow=motion?.flowTime??now/1000,delta=motion?.delta??1/60,scanMix=reduced?0:motion?.scan??(running?(phase==='synth'?.6:phase==='reveal'?.4:1):0),selected=id=>state.activeProject===id||state.activeProjects.includes(id),thinking=['think','synth','reveal'].includes(phase),coasting=phase==='complete';
  for(const v of dense.views){const numeric=Number.isFinite(v.weight);if(v.kind==='dimension'){const target=numeric?v.weight:0;v.current=approach(v.current||0,target,delta,reduced);v.pathWidth=approach(v.pathWidth,numeric?1+4*target:1.2,delta,reduced);v.pathOpacity=approach(v.pathOpacity,numeric?.2+.48*target:.22,delta,reduced);setSvg(v.path,'stroke-width',v.pathWidth);setSvg(v.path,'stroke-opacity',v.pathOpacity);}
    const targetActivity=v.kind==='catalog_membership'||thinking||coasting||selected(v.projectId)?1:0;v.activity=motion?approach(v.activity??0,targetActivity,delta,reduced):targetActivity;const lit=work*v.activity;if(v.pulse){setSvg(v.pulse,'opacity',.58*lit);if(lit>.002){const q=sampledPoint(v.points,flow/(v.kind==='catalog_membership'?8:4)+v.offset);setSvg(v.pulse,'cx',q.x);setSvg(v.pulse,'cy',q.y);}}}
  for(const v of dense.beams){const numeric=Number.isFinite(v.weight),targetActivity=(v.scanning&&v.kind==='catalog_scan')||thinking||coasting||selected(v.projectId)?1:0;v.activity=motion?approach(v.activity??0,targetActivity,delta,reduced):targetActivity;const scan=scanMix*v.activity;if(v.scanning){const u=(flow/3+v.offset)%1;if(scan>.002){setSvg(v.sheet,'height',(60+160*u)*scan);setSvg(v.core,'height',(60+160*u)*scan);setSvg(v.node,'opacity',Math.sin(u*Math.PI)*.65*scan);}else{setSvg(v.sheet,'height',0);setSvg(v.core,'height',0);setSvg(v.node,'opacity',0);}continue;}
    const target=numeric?v.weight:0;v.current=approach(v.current,target,delta,reduced);const length=v.maxLength*v.current;setSvg(v.sheet,'height',length);setSvg(v.core,'height',length);setSvg(v.node,'opacity',numeric?.85:0);if(v.spark){const lit=work*v.activity;setSvg(v.spark,'opacity',length>0?.7*lit:0);if(lit>.002)setSvg(v.spark,'cy',((flow/3+v.offset)%1)*length);}}
}
