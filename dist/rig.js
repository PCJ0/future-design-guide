/* Registered raster poses, continuous phase interpolation and captured transitions. */
window.createGuideRig=function(canvas,atlas,leftAtlas,seatAtlas,motionAtlas,sitAtlas){
 const ctx=canvas.getContext('2d');canvas.width=1040;canvas.height=1000;
 function extract(sheet,cols,rows){return Array.from({length:cols*rows},(_,index)=>{
  const cellW=sheet.width/cols,cellH=sheet.height/rows,pad=sheet===motionAtlas||sheet===seatAtlas?Math.round(cellW*.18):0;
  const sx=Math.max(0,index%cols*cellW-pad),sy=Math.max(0,Math.floor(index/cols)*cellH-pad);
  const sw=Math.min(sheet.width-sx,cellW+pad+(index%cols?pad:0)),sh=Math.min(sheet.height-sy,cellH+pad+(Math.floor(index/cols)?pad:0));
  const c=document.createElement('canvas'),w=c.width=Math.floor(sw),h=c.height=Math.floor(sh),cc=c.getContext('2d',{willReadFrequently:true});
  cc.drawImage(sheet,sx,sy,sw,sh,0,0,w,h);
  const pixels=cc.getImageData(0,0,w,h),a=pixels.data,seen=new Uint8Array(w*h);let largest=[];
  // Keep the character's connected silhouette; discard isolated generated alpha flecks.
  for(let seed=0;seed<w*h;seed++){if(seen[seed]||a[seed*4+3]<150)continue;const q=[seed];seen[seed]=1;for(let k=0;k<q.length;k++){const n=q[k],x=n%w;for(const v of [x?n-1:-1,x<w-1?n+1:-1,n-w,n+w])if(v>=0&&v<w*h&&!seen[v]&&a[v*4+3]>=150){seen[v]=1;q.push(v)}}if(q.length>largest.length)largest=q}
  const mask=new Uint8Array(w*h);let x0=w,y0=h,x1=0,y1=0;for(const n of largest){const x=n%w,y=Math.floor(n/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h)mask[(y+dy)*w+x+dx]=1}
  for(let n=0;n<w*h;n++)if(!mask[n])a[n*4+3]=0;cc.putImageData(pixels,0,0);
  const headY=Math.round(y0+(y1-y0)*(sheet===seatAtlas ? .8 : .3));let total=0,count=0;for(let x=x0;x<=x1;x++)if(a[(headY*w+x)*4+3]>150){total+=x;count++}
  return{image:c,x:Math.max(0,x0-2),y:Math.max(0,y0-2),w:Math.min(w-x0,x1-x0+5),h:Math.min(h-y0,y1-y0+5),center:count?total/count:(x0+x1)/2};
 })}

 const frames=[...extract(atlas,8,4),...extract(leftAtlas,4,2),...extract(motionAtlas,8,4),...(seatAtlas?extract(seatAtlas,8,4):[])];
 const sitParts=sitAtlas?extract(sitAtlas,3,3):null;
 const gaitHeight=[0,8].map(start=>frames.slice(start,start+8).map(f=>f.h).sort((a,b)=>a-b)[4]);
 const transition=document.createElement('canvas');transition.width=1040;transition.height=1000;const transitionCtx=transition.getContext('2d');
 const seatedHeight=seatAtlas?Math.max(...frames.slice(72,104).map(f=>f.h)):430;
 let lastT=0,gesture=0,cycle=0,lastMode='',modeAt=0,lastPosition=23,previousPosition=23,talkingSince=0,wasTalking=false,handAmount=0;
 function paint(position,alpha,seated,gait=null){
  const f=frames[position];if(!f||alpha<=0)return;const scale=430/(seated?seatedHeight:gait===null?f.h:gaitHeight[gait]);
  ctx.globalAlpha=alpha;ctx.drawImage(f.image,f.x,f.y,f.w,f.h,260-(f.center-f.x)*scale,470-f.h*scale,f.w*scale,f.h*scale);
 }
 function blend(position,alpha,seated,loopStart=null,loopLength=0){
  const a=Math.floor(position),raw=position-a,fraction=raw,b=loopLength&&a+1>=loopStart+loopLength?loopStart:a+1;
  const gait=loopLength===8&&loopStart<16?loopStart/8:null;
  paint(a,alpha*(1-fraction),seated,gait);if(fraction)paint(b,alpha*fraction,seated,gait);
 }
 const fixedPoses=new Map();
 function poseImage(index,seated=false){
  if(fixedPoses.has(index))return fixedPoses.get(index);
  const c=document.createElement('canvas');c.width=520;c.height=500;const cctx=c.getContext('2d'),f=frames[index],scale=430/(seated?seatedHeight:f.h);
  cctx.drawImage(f.image,f.x,f.y,f.w,f.h,260-(f.center-f.x)*scale,470-f.h*scale,f.w*scale,f.h*scale);fixedPoses.set(index,c);return c;
 }
 function walking(side,phase,amount,opacity=1){
  const start=side?8:0;
  const position=start+(phase/Math.PI/2*8)%8;
  ctx.globalCompositeOperation='lighter';blend(position,opacity,false,start,8);
  canvas.dataset.gaitPhase=String((phase%(Math.PI*2)).toFixed(3));
 }
 const seatLayer=document.createElement('canvas');seatLayer.width=520;seatLayer.height=500;const seatCtx=seatLayer.getContext('2d');
 function separatedSeat(progress,time,talk,dt,reduced){
  const chair=sitParts[0],chairW=350,chairH=chairW*chair.h/chair.w;
  // The furniture uses exactly one raster at exactly one transform in every state.
  ctx.drawImage(chair.image,chair.x,chair.y,chair.w,chair.h,85,470-chairH,chairW,chairH);
  const scale=460/sitParts[1].h;
  const position=1+Math.min(1,Math.max(0,progress))*7,a=Math.floor(position),fraction=position-a;
  const registeredHeight=sitParts[a].h*(1-fraction)+(sitParts[Math.min(8,a+1)].h)*fraction;
  function robot(i,alpha){const f=sitParts[i];seatCtx.globalAlpha=alpha;seatCtx.drawImage(f.image,f.x,f.y,f.w,f.h,260-(f.center-f.x)*scale,470-registeredHeight*scale,f.w*scale,f.h*scale)}
  seatCtx.clearRect(0,0,520,500);seatCtx.globalCompositeOperation='lighter';robot(a,1-fraction);if(fraction)robot(a+1,fraction);ctx.drawImage(seatLayer,0,0);
  canvas.dataset.frame='separate-'+position.toFixed(3);canvas.dataset.chair='fixed';
 }
 function seatedStill(time,talk,dt,reduced){
  const base=poseImage(96,true);ctx.drawImage(base,0,0);
  if(talk&&!wasTalking)talkingSince=time;wasTalking=!!talk;
  const t=time-talkingSince;
  // One restrained hand emphasis per utterance; never loop the head or chair.
  const desired=talk&&!reduced&&t>1&&t<4?Math.sin((t-1)/3*Math.PI):0;
  handAmount=talk?handAmount+(desired-handAmount)*(1-Math.exp(-dt*5)):0;
  if(handAmount>.001){ctx.save();ctx.beginPath();ctx.ellipse(310,348,24,18,-.3,0,Math.PI*2);ctx.clip();ctx.translate(0,-handAmount*1.3);ctx.drawImage(base,0,0);ctx.restore()}
  canvas.dataset.frame='96';canvas.dataset.hand=handAmount.toFixed(3);
 }
 return{draw(time,walk,talk,reduced,facing=0,point=0,mode='auto',progress=1){
  const dt=Math.max(0,Math.min(.05,time-lastT||.016));lastT=time;
  cycle+=reduced?0:dt*7.2*Math.min(1,walk/.7);gesture+=(Math.abs(point)-gesture)*Math.min(1,dt*6);
  const seated=mode.startsWith('seated');let position=23,loopStart=null,loopLength=0;
  if(mode==='side'&&walk>.1){position=40+cycle%16;loopStart=40;loopLength=16}
  else if(facing>.94&&walk>.1){position=56+(cycle*.5)%8;loopStart=56;loopLength=8}
  else if(facing>.04)position=16+(1-facing)*7;
  else if(Math.abs(point)>.1)position=point<0?32+Math.min(3,gesture*3):64+Math.min(7,gesture*7);
  else position=23;
  if(seated){
   if(mode==='seated-sit')position=72+Math.min(1,Math.max(0,progress))*15;
   else {position=96}
  }
  if(reduced){position=seated?87:walk>.1?(mode==='side'?40:56):Math.round(position);loopLength=0}
  const key=seated?mode:walk>.1?mode+'walk':Math.abs(point)>.1?'point'+Math.sign(point):facing>.04?'turn':'idle';
  if(key!==lastMode){transitionCtx.clearRect(0,0,1040,1000);transitionCtx.drawImage(canvas,0,0);previousPosition=lastPosition;modeAt=time;lastMode=key}
  const fadeT=reduced?1:Math.min(1,(time-modeAt)/.32),fade=fadeT*fadeT*(3-2*fadeT);
  function previous(){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=1-fade;ctx.drawImage(transition,0,0,520,500);ctx.globalAlpha=1}
  ctx.clearRect(0,0,1040,1000);ctx.save();ctx.scale(2,2);
  if(seated&&sitParts){separatedSeat(mode==='seated-sit'?progress:1,time,talk,dt,reduced);ctx.restore();canvas.dataset.mode=mode;return}
  if(seated&&mode!=='seated-sit'){seatedStill(time,talk,dt,reduced);ctx.restore();canvas.dataset.mode=mode;return}
  if(walk>.1&&(mode==='side'||facing>.94)){if(fade<1)previous();walking(mode==='side',cycle,reduced?0:Math.min(1,walk/.65),fade);lastPosition=(mode==='side'?8:0)+(cycle/Math.PI/2*8)%8;ctx.restore();canvas.dataset.mode=mode;canvas.dataset.frame=String(lastPosition);return}
  ctx.globalCompositeOperation='lighter';
  if(fade<1)previous();blend(position,fade,seated,loopStart,loopLength);ctx.restore();
  lastPosition=position;canvas.dataset.frame=String(position.toFixed(2));canvas.dataset.mode=mode;canvas.dataset.point=String(Math.sign(point));canvas.dataset.sourceFrames=String(frames.length);
 }};
};
