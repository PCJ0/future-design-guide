// Ambient-only standby scene. No project identities, scores, progress or API calls.
import {setSvg} from './graph-motion.js';
import {GRAPH,point} from './association-layout.js';
const ns='http://www.w3.org/2000/svg';
const add=(tag,attrs,parent)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
export function restMotion(phase,now,reduced=false){const resting=['idle','complete','stopped','error'].includes(phase),t=now/1000;return {resting,moving:resting&&!reduced,breath:reduced?.5:(1+Math.sin(t*.48))/2,angle:reduced?0:t*3.5};}
export function createRestScene(layer,{empty=false}={}){
  layer.replaceChildren();layer.setAttribute('aria-hidden','true');layer.setAttribute('data-kind','ambient_standby');
  const ring=add('circle',{cx:GRAPH.cx,cy:GRAPH.cy,r:GRAPH.rx,fill:'none',stroke:'#7eaebd','stroke-width':1,'stroke-dasharray':'2 14',opacity:.2},layer),arcs=[],orbits=[],chords=[];
  for(let i=0;i<4;i++){const a=point(18+i*90),b=point(45+i*90);arcs.push(add('path',{d:`M${a.x} ${a.y} A${GRAPH.rx} ${GRAPH.ry} 0 0 1 ${b.x} ${b.y}`,fill:'none',stroke:i%2?'#408aff':'#63bdc7','stroke-width':2.4,opacity:.32},layer));}
  for(let i=0;i<8;i++)orbits.push(add('circle',{r:i%2?2.5:3.1,fill:i%2?'#448ff2':'#99d6dc',opacity:.42},layer));
  if(empty){
    for(let i=0;i<48;i++){const a=point(174+130*i/47),b=point(-38.4+190.7*((i*17)%48)/47);chords.push(add('path',{d:`M${a.x} ${a.y} C${GRAPH.cx+(a.x-GRAPH.cx)*.32} ${GRAPH.cy+(a.y-GRAPH.cy)*.36} ${GRAPH.cx+(b.x-GRAPH.cx)*.28} ${GRAPH.cy+(b.y-GRAPH.cy)*.4} ${b.x} ${b.y}`,fill:'none',stroke:i%3?'#347dbd':'#40898e','stroke-width':1,opacity:.18},layer));}
    for(let i=0;i<56;i++){const p=point(i*360/56);add('circle',{cx:p.x,cy:p.y,r:2.1,fill:'#79a4bd',opacity:.28},layer);}
  }
  return {layer,ring,arcs,orbits,chords,empty};
}
export function paintRestScene(scene,{phase,now,reduced=false,motion=null}){
  if(!scene)return;const resting=restMotion(phase,now,reduced),mix=motion?.rest??(resting.resting?1:0),t=motion?.ambientTime??now/1000,breath=reduced?.5:(1+Math.sin(t*.48))/2,angle=reduced?0:t*3.5;
  setSvg(scene.layer,'opacity',.1+.9*mix);
  setSvg(scene.ring,'stroke-dashoffset',reduced?0:-t*3);setSvg(scene.ring,'opacity',.08+mix*(.08+.12*breath));
  scene.arcs.forEach((a,i)=>{setSvg(a,'transform',`rotate(${angle*(i%2?-1:1)} ${GRAPH.cx} ${GRAPH.cy})`);setSvg(a,'opacity',.08+mix*(.12+.2*breath));});
  scene.orbits.forEach((dot,i)=>{const p=point(i*45+angle*(i%2?-1:1));setSvg(dot,'cx',p.x);setSvg(dot,'cy',p.y);setSvg(dot,'opacity',mix*(.3+.26*breath));});
  scene.chords.forEach((path,i)=>setSvg(path,'opacity',.08+mix*(.01+.12*(reduced?.5:(1+Math.sin(t*.38+i*.28))/2))));
}
