import {phases,initialState,reduceEvent} from './thinking-state.js';
const $=id=>document.getElementById(id),canvas=$('thinkingCanvas'),ctx=canvas.getContext('2d');
let state=initialState(),w=0,h=0,time=0,last=0,started=0,elapsed=0,phaseAt=0,blend=0;
let visited=new Set([0]);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let seed=713;const rand=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646};
const nodes=Array.from({length:110},()=>({x:.32+rand()*.5,y:.16+rand()*.61,p:rand()*6.28}));
const edges=[];nodes.forEach((a,i)=>{nodes.map((b,j)=>({j,d:Math.hypot(a.x-b.x,(a.y-b.y)*.7)})).filter(b=>b.j!==i).sort((a,b)=>a.d-b.d).slice(0,3).forEach(b=>edges.push({a:i,b:b.j,p:rand(),s:.5+rand()}));});
const rays=Array.from({length:150},(_,i)=>({a:-1.03+i/149*2.06,len:.025+rand()*.14,p:rand()}));
const terminal=()=>['idle','complete','error','stopped'].includes(state.phase);
function ui(){const p=phases[state.phase];$('motionCode').textContent=p[0];$('motionEnglish').textContent=p[1];$('motionTitle').textContent=p[2];$('motionHint').textContent=p[3];$('motionRound').textContent=state.round?`第 ${state.round} 轮模型分析`:'尚未启动';$('motionSteps').querySelectorAll('span').forEach((el,i)=>{el.classList.toggle('current',i===p[4]);el.classList.toggle('visited',visited.has(i)&&i!==p[4]);});canvas.closest('.motion-panel').dataset.phase=state.phase;}
function set(next){if(next.phase!==state.phase){phaseAt=time;blend=0;}state=next;const index=phases[state.phase][4];if(index>=0)visited.add(index);ui();draw();}
export const thinkingMotion={
 start(){visited=new Set([0]);started=performance.now();elapsed=0;set({...initialState(),phase:'prepare'});},
 event(e){set(reduceEvent(state,e));},
 finish(){elapsed=started?(performance.now()-started)/1000:0;set({...state,phase:'complete'});},
 fail(stopped){elapsed=started?(performance.now()-started)/1000:0;set({...state,phase:stopped?'stopped':'error'});},
 reset(){visited=new Set([0]);started=0;elapsed=0;set(initialState());}
};
function color(a=1){return state.phase==='error'?`rgba(255,156,142,${a})`:state.phase==='stopped'?`rgba(213,184,129,${a})`:state.phase==='think'?`rgba(178,165,255,${a})`:`rgba(129,246,209,${a})`;}
function line(x,y,xx,yy,c){ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();}
function dot(x,y,r,a){ctx.fillStyle=color(a);ctx.beginPath();ctx.arc(x,y,r,0,6.283);ctx.fill();}
function label(s,x,y,c,size=8){ctx.font=`${size*w/1000}px Consolas,monospace`;ctx.fillStyle=c;ctx.fillText(s,x,y);}
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);draw();}
function draw(){if(!w||!h)return;ctx.clearRect(0,0,w,h);ctx.lineWidth=Math.max(.4,w/1500);
 const phase=state.phase,idle=phase==='idle',done=phase==='complete',quiet=terminal(),age=time-phaseAt;
 const speed=idle?.13:quiet?.22:phase==='retrieve'?1.8:phase==='synth'?.75:1;
 const glow=idle?.28:quiet?.45:.85;
 const g=ctx.createRadialGradient(w*.55,h*.45,0,w*.55,h*.45,w*.5);g.addColorStop(0,color(idle?.025:.065));g.addColorStop(1,color(0));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 for(let x=0;x<w;x+=w/24)line(x,0,x,h,'#8bb9b408');for(let y=0;y<h;y+=w/24)line(0,y,w,y,'#8bb9b408');
 // Four small instruments echo the standalone concept, now composed for this panel.
 const names=['CONTEXT','REASONING','EVIDENCE','SYNTHESIS'],active={prepare:0,think:1,retrieve:2,synth:3,complete:3}[phase];
 names.forEach((name,i)=>{const x=w*.022,y=h*(.10+i*.175),cw=w*.17,ch=h*.145,on=active===i;ctx.fillStyle=on?color(.065):'#111e2488';ctx.fillRect(x,y,cw,ch);ctx.strokeStyle=on?color(.48):'#30484b88';ctx.strokeRect(x,y,cw,ch);label(name,x+w*.01,y+h*.027,on?color(.9):'#68858b',9);let value=[state.phase==='idle'?'STANDBY':'CONTEXT',state.round?`ROUND ${state.round}`:'AWAITING',`${state.calls} CALLS`,done?'COMPLETE':phase==='synth'?'FORMING':'READY'][i];label(value,x+w*.01,y+h*.064,on?'#d4e9df':'#789294',11);for(let k=0;k<21;k++){const bh=(.2+Math.abs(Math.sin(k*1.7+i+time*speed*.5))*(on?.8:.25))*h*.035;ctx.fillStyle=on?color(.65):color(.16);ctx.fillRect(x+w*.012+k*cw*.043,y+ch-h*.015-bh,cw*.027,bh);}});
 // Curved routing spine and inbound pulses.
 const bx=w*.235,by=h*.43,rx=w*.072,ry=h*.35;
 for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(bx+j*w*.004,by,rx,ry,0,-1.15,1.15);ctx.strokeStyle=color(j===0?.38:.1);ctx.stroke();}
 for(let j=0;j<36;j++){const a=-1.12+j/35*2.24,x=bx+Math.cos(a)*rx,y=by+Math.sin(a)*ry;dot(x,y,w*.001,.4);if(j%3===0)label((j*7+128).toString(16).toUpperCase(),x-w*.023,y,'#54747a',7);}
 const convergence=phase==='synth'?Math.min(1,age*.2):done?1:0;blend+=(convergence-blend)*.04;
 const pos=nodes.map(n=>{const a=n.p+time*.022,r=.10+(n.x-.32)*.2;return {x:w*(n.x*(1-blend)+(.59+Math.cos(a)*r)*blend)+Math.sin(time*.2+n.p)*w*.003,y:h*(n.y*(1-blend)+(.43+Math.sin(a)*r*1.5)*blend)+Math.cos(time*.18+n.p)*h*.004};});
 for(let k=0;k<20;k++){const a=-1.1+k/19*2.2,sx=bx+Math.cos(a)*rx,sy=by+Math.sin(a)*ry,e=pos[k*5%nodes.length];ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(w*.43,sy,w*.4,e.y,e.x,e.y);ctx.strokeStyle=color(idle?.035:.12);ctx.stroke();if(!quiet){let u=(time*.10*speed+k*.067)%1,v=1-u;let x=v*v*v*sx+3*v*v*u*w*.43+3*v*u*u*w*.4+u*u*u*e.x,y=v*v*v*sy+3*v*v*u*sy+3*v*u*u*e.y+u*u*u*e.y;ctx.shadowBlur=8;ctx.shadowColor=color(.7);dot(x,y,w*.0017,.9);ctx.shadowBlur=0;}}
 edges.forEach((e,i)=>{const a=pos[e.a],b=pos[e.b];line(a.x,a.y,b.x,b.y,color(idle?.022:done?.12:.075));if(!quiet&&i%3===0){const u=(time*.16*speed*e.s+e.p)%1;dot(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,w*.0012,.75);}});
 pos.forEach((p,i)=>{let v=Math.pow(Math.max(0,Math.sin(time*(quiet?.35:.9)+nodes[i].p)),8);dot(p.x,p.y,w*(.001+v*.0015),glow*(.4+v*.6));if(!idle&&v>.65){ctx.strokeStyle=color(v*.18);ctx.beginPath();ctx.arc(p.x,p.y,w*(.004+v*.006),0,6.283);ctx.stroke();}if(i%22===0)label(['context.mesh','latent.echo','idea.cluster','source.link','synthesis'][i/22],p.x+w*.008,p.y-h*.01,'#6a8c86',8);});
 rays.forEach((r,i)=>{const sx=w*(.54+Math.cos(r.a)*.29),sy=h*(.43+Math.sin(r.a)*.42),le=r.len*w*(idle?.3:done?.55:1),ex=sx+Math.cos(r.a)*le,ey=sy+Math.sin(r.a)*le*.7;line(sx,sy,ex,ey,color(idle?.06:.14));if(phase==='retrieve'&&i%3===0){let u=(time*.5+r.p)%1;dot(sx+(ex-sx)*u,sy+(ey-sy)*u,w*.0012,.8);}});
 const nx=w*.59,ny=h*.43;for(let k=0;k<3;k++){ctx.beginPath();ctx.ellipse(nx,ny,w*(.035+k*.014),h*(.025+k*.017),time*(quiet?.03:.15)+k,0,6.283);ctx.strokeStyle=color(idle?.1:done?.5:.25);ctx.stroke();}
 ctx.shadowBlur=done?25:12;ctx.shadowColor=color(.7);dot(nx,ny,w*(done?.004:.0025),.85);ctx.shadowBlur=0;
 // Completion settles into a stable seal; errors never display the success seal.
 if(done){const grow=Math.min(1,age*.7);ctx.strokeStyle=color(.5);ctx.beginPath();ctx.arc(nx,ny,w*.1,0,6.283*grow);ctx.stroke();if(age>1.5){line(nx-w*.015,ny,nx-w*.003,ny+w*.013,color(.9));line(nx-w*.003,ny+w*.013,nx+w*.023,ny-w*.018,color(.9));}}
 if(!quiet&&phase==='prepare'){const scan=(time*.17)%1*w;line(scan,h*.06,scan,h*.8,color(.1));}
 label('NEURAL FIELD / VISUAL EXPRESSION',w*.25,h*.06,'#5f7c82',8);label(quiet?'FIELD / SETTLED':'FIELD / ACTIVE',w*.77,h*.82,'#63877f',8);
 for(let i=0;i<36;i++){const x=w*(.025+i*.027);line(x,h*.84,x,h*(i%4===0?.827:.834),'#355057');}
}
function tick(now){const dt=last?Math.min((now-last)/1000,.06):0;last=now;if(!document.hidden){if(!reduced.matches){time+=dt;draw();}const seconds=terminal()?elapsed:started?(now-started)/1000:0;$('motionTime').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}requestAnimationFrame(tick);}
new ResizeObserver(resize).observe(canvas);reduced.addEventListener('change',draw);ui();requestAnimationFrame(tick);
