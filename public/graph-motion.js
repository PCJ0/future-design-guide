// Visual-only continuous clocks; never changes scores, requests or business phases.
const terminal=phase=>['idle','complete','stopped','error'].includes(phase);
const smooth=u=>u*u*(3-2*u);
const preset=phase=>({work:terminal(phase)?0:1,rest:terminal(phase)?1:0,speed:terminal(phase)?.14:phase==='synth'?.65:phase==='reveal'?.5:1,scan:terminal(phase)?0:phase==='synth'?.6:phase==='reveal'?.4:1});
export function createMotionClock(phase='idle',now=0){
  let current=preset(phase),from={...current},target={...current},changed=now,last=now,elapsed=0,flow=0,duration=0;
  function parameters(time,reduced){const u=reduced?1:duration?Math.min(1,Math.max(0,(time-changed)/duration)):1,e=smooth(u);const value={};for(const key of Object.keys(target))value[key]=from[key]+(target[key]-from[key])*e;return {...value,transitioning:u<1};}
  function advance(time,reduced=false){const value=parameters(time,reduced),delta=Math.max(0,Math.min(.05,(time-last)/1000));last=time;elapsed+=reduced?0:delta;flow+=reduced?0:delta*(current.speed+value.speed)/2;current=value;return {...value,work:reduced?0:value.work,rest:reduced?(terminal(phase)?1:0):value.rest,delta,flowTime:flow,ambientTime:elapsed,phase};}
  return {advance,setPhase(next,time,reduced=false){if(next===phase)return;const nextTarget=preset(next);if(Object.keys(nextTarget).every(key=>nextTarget[key]===target[key])){phase=next;return;}current=parameters(time,reduced);from={...current};phase=next;target=nextTarget;changed=time;duration=reduced?0:1800;},resume(time){last=time;},phase:()=>phase};
}
const previousAttributes=new WeakMap();
export function setSvg(node,key,value){if(!node)return;let cache=previousAttributes.get(node);if(!cache){cache=new Map();previousAttributes.set(node,cache);}const text=typeof value==='number'?String(Math.round(value*1000)/1000):String(value);if(cache.get(key)!==text){node.setAttribute(key,text);cache.set(key,text);}}
export function sampleCubic(a,c1,c2,b,segments=64){return Array.from({length:segments+1},(_,i)=>{const t=i/segments,v=1-t;return{x:v*v*v*a.x+3*v*v*t*c1.x+3*v*t*t*c2.x+t*t*t*b.x,y:v*v*v*a.y+3*v*v*t*c1.y+3*v*t*t*c2.y+t*t*t*b.y};});}
export function samplePath(path,segments=64){const length=path.getTotalLength();return Array.from({length:segments+1},(_,i)=>{const p=path.getPointAtLength(length*i/segments);return{x:p.x,y:p.y};});}
export function sampledPoint(points,u){const p=((u%1)+1)%1*(points.length-1),i=Math.floor(p),a=points[i],b=points[Math.min(i+1,points.length-1)],f=p-i;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}
export function approach(value,target,delta,reduced=false){if(reduced||Math.abs(value-target)<.0001)return target;return value+(target-value)*(1-Math.exp(-Math.max(0,delta)*6.2));}
