/* Deterministic choreography shared by the live renderer and sequence checks. */
window.GuideMotion={
 clamp(v){return Math.max(0,Math.min(1,v))},
 ease(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)},
 viewport(w,h){const scale=Math.min(w/1672,h/941);return{scale,x:(w-1672*scale)/2,y:(h-941*scale)/2,width:1672*scale,height:941*scale}},
 pose(phase,elapsed,progress,arrivalElapsed=0){const e=this.ease.bind(this);if(phase==='intro'){const turning=e((elapsed-.8)/1.35),walking=e((elapsed-2.2)/.8),depth=e(progress)*walking;return{facing:turning,walk:walking*.86,depth,travel:e(elapsed/3),mist:e(elapsed/3)*.22,x:25*walking+Math.sin(progress*Math.PI)*9,y:-118*depth,scale:1-.17*depth}}
 if(phase==='arriving'){const stop=e(arrivalElapsed/.65),turn=e((arrivalElapsed-.85)/1.35),settle=e(arrivalElapsed/2.7);return{facing:1-turn,walk:.5*(1-stop),depth:1,travel:1-settle,mist:.17*(1-settle),x:25,y:-118+63*settle,scale:.83+.11*settle}}
 if(phase==='tour')return{facing:0,walk:0,depth:1,travel:0,mist:0,x:465,y:-38,scale:.82};
 const idle=phase==='idle';return{facing:0,walk:0,depth:idle?0:1,travel:0,mist:0,x:idle?0:25,y:idle?0:-55,scale:idle?1:.94}}
};

// Choreographed project entrance: walk away, settle, then turn to the visitor.
window.GuideMotion.labEntry=function(elapsed,from){
 const e=this.ease.bind(this),t=e((elapsed-450)/3150),turn=e(elapsed/450)*(1-e((elapsed-3500)/900));
 const move=(a,b)=>a+(b-a)*t;
 return {scene:e(elapsed/4000),pose:{x:move(from.x,163),foot:move(from.foot,650),scale:move(from.scale,.70),facing:turn,walk:.8*e((elapsed-300)/450)*(1-e((elapsed-3000)/600)),point:0}};
};
