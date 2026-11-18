// Visual-only graph handoff. Stable geometry stays visible; only changed items crossfade.
// Outgoing copies are non-interactive and stripped of project/score/accessibility identities.
import {setSvg} from './graph-motion.js';
const ns='http://www.w3.org/2000/svg',ease=u=>u*u*(3-2*u),clamp=u=>Math.max(0,Math.min(1,u));
const shapeAttributes=['id','d','transform','cx','cy','x','y','class','data-kind','data-project','data-ref','data-key'];
export function createGraphHandoff({host,layers,duration=1200}){
 let sequence=0,initialized=false,previousDefs=null,last=null;
 const current=new Map(),wrappers=new WeakSet();let outgoing=[];
 const children=node=>Array.from(node.childNodes||node.children||[]);
 const tag=node=>(node.tagName||node.tag||'').toLowerCase();
 const attrs=node=>Array.from(node.attributes||[]);
 const value=(node,key)=>node.getAttribute?.(key)??node.attrs?.[key]??'';
 const alpha=(started,now,reduced)=>reduced?1:ease(clamp((now-started)/duration));
 function signature(node){return JSON.stringify([tag(node),...shapeAttributes.map(key=>value(node,key)),['text','title'].includes(tag(node))?node.textContent:'']);}
 function sanitize(nodes){
   const prefix=`handoff-${++sequence}-`,map=new Map(),elements=nodes.flatMap(node=>[node,...Array.from(node.querySelectorAll?.('*')||[])]);
   for(const node of elements){const id=value(node,'id');if(id)map.set(id,prefix+id);}
   for(const node of elements)for(const attr of attrs(node)){
     if(attr.name==='id')node.setAttribute('id',map.get(attr.value));
     else if(attr.name==='role'||attr.name==='tabindex'||attr.name.startsWith('data-')||attr.name.startsWith('aria-'))node.removeAttribute(attr.name);
     else{let v=attr.value.replace(/url\(#([^)]*)\)/g,(all,id)=>map.has(id)?`url(#${map.get(id)})`:all);if((attr.name==='href'||attr.name==='xlink:href')&&v.startsWith('#')&&map.has(v.slice(1)))v='#'+map.get(v.slice(1));if(v!==attr.value)node.setAttribute(attr.name,v);}
   }
 }
 function retire(items,now){
   const copies=items.filter(v=>typeof v.node.cloneNode==='function'&&v.mix>.001).map(v=>({node:v.node.cloneNode(true),mix:v.mix}));
   if(!copies.length)return;
   const group=document.createElementNS(ns,'g'),defs=previousDefs?.cloneNode(true),nodes=[...(defs?[defs]:[]),...copies.map(v=>v.node)];sanitize(nodes);
   group.setAttribute('data-kind','visual_handoff');group.setAttribute('aria-hidden','true');group.setAttribute('pointer-events','none');group.append(...nodes);host.append(group);
   outgoing.push({node:group,started:now});
   // No unlimited accumulation during a burst. At most four short-lived visual copies.
   while(outgoing.length>4){const v=outgoing.shift();v.node.remove?.();}
 }
 function paint(now,reduced=false){
   last=now;let entering=0;
   for(const entries of current.values())for(const v of entries.values()){v.mix=alpha(v.started,now,reduced);setSvg(v.node,'opacity',v.mix);if(v.mix<1)entering++;}
   outgoing=outgoing.filter(v=>{const mix=1-alpha(v.started,now,reduced);if(mix<.001){v.node.remove?.();return false;}setSvg(v.node,'opacity',mix);return true;});
   return {entering,outgoing:outgoing.length,transitioning:entering>0||outgoing.length>0};
 }
 return {
   beforeRender(now,reduced=false){paint(now,reduced);previousDefs=document.createElementNS(ns,'defs');const definitions=new Set(['lineargradient','radialgradient','filter','mask','clippath','pattern','marker','symbol']);for(const layer of layers){if(tag(layer)==='defs')previousDefs.append(...children(layer).map(node=>node.cloneNode?.(true)).filter(Boolean));else for(const node of layer.querySelectorAll?.('*')||[])if(definitions.has(tag(node)))previousDefs.append(node.cloneNode(true));}},
   afterRender(now,reduced=false){
     const removed=[];
     for(const layer of layers){
       if(tag(layer)==='defs')continue;
       const prior=current.get(layer)||new Map(),raw=children(layer),content=raw.flatMap(node=>wrappers.has(node)?children(node):[node]),entries=new Map(),counts=new Map(),byNode=new Map([...prior.values()].map(v=>[v.node.firstElementChild||children(v.node)[0],v])),reused=new Set();
       // Flatten our own wrappers before rebuilding so the unchanged rest layer never nests wrappers.
       layer.replaceChildren();
       for(const item of content){
         const shape=signature(item),index=counts.get(shape)||0;counts.set(shape,index+1);const key=shape+'#'+index,old=byNode.get(item)||prior.get(key);if(old)reused.add(old);
         const group=document.createElementNS(ns,'g');group.setAttribute('data-kind','graph_incoming');wrappers.add(group);group.append(item);layer.append(group);
         const started=old?old.started:!initialized||reduced?now-duration:now,mix=alpha(started,now,reduced);group.setAttribute('opacity',String(mix));entries.set(key,{node:group,started,mix});
       }
       for(const v of prior.values())if(!reused.has(v))removed.push(v);
       current.set(layer,entries);
     }
     if(!reduced)retire(removed,now);initialized=true;paint(now,reduced);previousDefs=null;
   },paint,resume(now){const delta=last===null?0:Math.max(0,now-last);for(const entries of current.values())for(const v of entries.values())v.started+=delta;for(const v of outgoing)v.started+=delta;last=now;}
 };
}
