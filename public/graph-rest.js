// Original quiet standby before a run; C-style point motion only after successful completion.
// Ambient decorations never own project identities, scores, progress or API calls.
import {setSvg,sampleCubic} from './graph-motion.js';
import {GRAPH,point} from './association-layout.js';
import {createRestScene as createOriginalRest,paintRestScene as paintOriginalRest,restMotion} from './graph-rest-original.js';
export {restMotion};
const ns='http://www.w3.org/2000/svg',STRENGTH=1.15;
const add=(tag,attrs,parent)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
const clamp=v=>Math.max(0,Math.min(1,v));
const at=(angle,scale=1)=>{const p=point(angle);return{x:GRAPH.cx+(p.x-GRAPH.cx)*scale,y:GRAPH.cy+(p.y-GRAPH.cy)*scale};};
function position(points,u){const p=clamp(u)*(points.length-1),i=Math.floor(p),a=points[i],b=points[Math.min(i+1,points.length-1)],f=p-i;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
function validTrack(track){return Array.isArray(track?.points)&&track.points.length>1&&track.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));}
function flow(track,index,parent,{tail=false}={}){
 const c=tail?(index%2?'#65aaff':'#92d9dd'):(index%3?'#b7eeee':'#64adff');
 const group=add('g',{'data-kind':tail?'ambient_afterglow_flow':'ambient_chord_flow',opacity:0},parent);
 // Points only: no trailing stroke, connecting segment, or decorative afterglow track line.
 const haze=add('circle',{r:tail?6:8,fill:c,opacity:.1},group),head=add('circle',{r:tail?2.6:3.5,fill:c,opacity:1},group);
 return{group,haze,head,points:track.points,offset:tail?index/10:((index*23)%97)/97,period:tail?8+index*.35:8+index%6,reverse:!tail&&index%2===1,tail};
}
export function createRestScene(layer,{empty=false,tracks=[]}={}){
 const original=createOriginalRest(layer,{empty});
 layer.setAttribute('data-style','original_ambient');layer.setAttribute('pointer-events','none');
 const environment=[];
 if(empty){
   // The exact 48 original ambient chord coordinates, sampled only to position optional completion dots.
   for(let i=0;i<48;i++){const a=point(174+130*i/47),b=point(-38.4+190.7*((i*17)%48)/47);environment.push({points:sampleCubic(a,{x:GRAPH.cx+(a.x-GRAPH.cx)*.32,y:GRAPH.cy+(a.y-GRAPH.cy)*.36},{x:GRAPH.cx+(b.x-GRAPH.cx)*.28,y:GRAPH.cy+(b.y-GRAPH.cy)*.4},b,80)});}
 }
 const flowLayer=add('g',{'data-kind':'ambient_flow_layer',opacity:0},layer),tailLayer=add('g',{'data-kind':'ambient_afterglow',opacity:0},layer),tails=[];
 for(let i=0;i<10;i++){const a=at(48+i*8.5,.84),b={x:GRAPH.cx+(-220+i*44)*GRAPH.rx/320,y:Math.min(GRAPH.height-110,GRAPH.cy+(540+(i%3)*24)*GRAPH.rx/320)};const points=sampleCubic(a,{x:a.x,y:a.y+158},{x:b.x+25,y:b.y-183},b,80);tails.push(flow({points},i,tailLayer,{tail:true}));}
 const scene={...original,environment,flowLayer,tailLayer,tails,flows:[]};setRestTracks(scene,tracks);return scene;
}
export function setRestTracks(scene,tracks=[]){
 // Copy coordinates only; real graph paths and scoring values remain untouched.
 const available=scene.empty?scene.environment:tracks.filter(validTrack);
 const count=Math.min(32,available.length);scene.flowLayer.replaceChildren();scene.flows=[];
 for(let i=0;i<count;i++){const index=Math.floor(i*available.length/count),track=available[index];scene.flows.push(flow({points:track.points.map(p=>({x:p.x,y:p.y}))},i,scene.flowLayer));}
 setSvg(scene.layer,'data-track-source',scene.empty?'ambient_geometry':'existing_graph_geometry');setSvg(scene.layer,'data-flow-count',count);
}
function paintFlow(v,t,mix,reduced){
 if(reduced||mix<.002){setSvg(v.group,'opacity',0);return;}
 const u=((t/v.period+v.offset)%1+1)%1,fade=Math.min(1,u/.05,(1-u)/.05),p=position(v.points,v.reverse?1-u:u);
 setSvg(v.head,'cx',p.x);setSvg(v.head,'cy',p.y);setSvg(v.haze,'cx',p.x);setSvg(v.haze,'cy',p.y);
 setSvg(v.group,'opacity',mix*fade*STRENGTH*(v.tail?.42:.8));
}
export function paintRestScene(scene,{phase,now,reduced=false,motion=null}){
 if(!scene)return;
 paintOriginalRest(scene,{phase,now,reduced,motion});
 // Strict successful-completion gate. Idle, reset, stopped and errors keep the original quiet ambient scene.
 const completed=phase==='complete',mix=completed?(motion?.rest??1):0,t=reduced?0:motion?.ambientTime??now/1000;
 setSvg(scene.layer,'data-style',completed?'C_points_only':'original_ambient');
 setSvg(scene.flowLayer,'opacity',mix);setSvg(scene.tailLayer,'opacity',mix);
 scene.flows.forEach(v=>paintFlow(v,t,mix,reduced));scene.tails.forEach(v=>paintFlow(v,t,mix,reduced));
}
