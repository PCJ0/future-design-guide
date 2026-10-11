'use strict';
const $=id=>document.getElementById(id), C=window.LAB_CONTENT;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
const mix=(a,b,p)=>a+(b-a)*p;
const smooth=(a,b,k,dt)=>mix(a,b,1-Math.exp(-k*dt));
const S={phase:'idle',clock:0,phaseAt:0,chapter:0,stepAt:0,ready:false,paused:false,interrupted:false,awaiting:false,settingsOpen:false,jobs:[],tourIndex:0,world:820,camera:0,legFrom:820,legTo:820,legAt:0,legDuration:5000,legCameraFrom:0,legCameraTo:0,arrived:false,answers:[],interviewStep:0,pending:null,waitUntil:0,returnSource:'gallery',returnPose:null};
let rig=null,seatRig=null,lastFrame=0,pose={x:835,foot:736,scale:.82,facing:0,walk:0,point:0},lastPhase='idle';
const voice=GuideVoice(handleVoice,voiceState);
function assetUrl(src){return window.OFFLINE_ASSETS?.[src]||src}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Object.assign(new Error(src),{assetSrc:src}));im.src=assetUrl(src)})}
function status(text){$('status').textContent=text}
function fit(){const scale=Math.min(innerWidth/1672,innerHeight/941);const stage=$('stage');stage.style.width=`${innerWidth/scale}px`;stage.style.height=`${innerHeight/scale}px`;stage.style.transform=`scale(${scale})`}
addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);fit();
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{status('请使用浏览器菜单开启全屏。')}requestAnimationFrame(fit)}
$('fullscreen').onclick=fullscreen;document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ 退出全屏':'⛶ 全屏';fit()});
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)){e.preventDefault();fullscreen()}if(e.key==='Escape'&&S.awaiting)resumeFlow();if(e.key.toLowerCase()==='s'&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName))$('rtSettings')?.click()});
function later(ms,fn,key='flow'){S.jobs.push({at:S.clock+ms,fn,key})}
function drop(key){S.jobs=S.jobs.filter(j=>j.key!==key)}
function go(phase){lastPhase=S.phase;S.phase=phase;S.phaseAt=S.clock;S.jobs=[];document.body.dataset.phase=phase;syncUI()}
function syncUI(){
 $('choices').hidden=S.phase!=='choice';$('welcomePrompt').hidden=S.phase!=='idle';
 $('introVisuals').hidden=!['intro','arriving'].includes(S.phase);
 
 $('conversation').hidden=!['interview','summary'].includes(S.phase);
 
 $('next').hidden=S.phase!=='tour';$('pause').hidden=S.phase!=='tour';
 $('skip').hidden=S.phase!=='intro';$('back').hidden=!['tour','qa','interview','summary'].includes(S.phase);
 $('ask').hidden=['idle','entering','arriving','lab-enter','lounge-enter','returning'].includes(S.phase);
 $('pause').textContent=S.paused?'继续介绍':'暂停介绍';
}
function speak(text,done,kind='guide'){window.LabGuideBubble?.set(text);voice.say(text,done,kind)}
function startOverview(){if(!S.ready){status('小 D 正在准备，请稍等。');return}clearInterruption();voice.cancel();S.paused=false;S.chapter=0;go('intro');status('');introStep(0)}
function introStep(i){if(S.phase!=='intro')return;if(i>=C.intro.length){arrive();return}S.chapter=i;S.stepAt=S.clock;later(i===0?0:750,()=>speak(C.intro[i].text,()=>later(1000,()=>introStep(i+1))));$('leftVisual').classList.toggle('active',i===1||i===3);$('rightVisual').classList.toggle('active',i===2||i===3)}
function arrive(){if(S.phase!=='intro')return;voice.cancel();go('arriving');later(4200,()=>showChoice())}
function showChoice(text=C.guide){clearInterruption();go('choice');S.paused=false;status('');speak(text)}
function explore(){if(!S.ready||S.phase==='lab-enter')return;voice.cancel();clearInterruption();S.paused=false;S.labEntryFrom={...pose,x:pose.x+($('stage').offsetWidth-1672)/2};window.LabProjects.close();go('lab-enter');later(3200,()=>window.LabProjects.open());later(4600,()=>go('projects'));const prompt='请开始实验室项目导览。简短介绍六类项目，并邀请访客选择感兴趣的类别；访客提出具体项目时，先检索实验室资料，再打开对应项目图文页并用语音介绍。';if(window.RealtimeGuide?.active)window.RealtimeGuide.say(prompt);else window.RealtimeGuide?.open('general',{autostart:true,prompt});}
function tourStop(i){
 if(S.phase!=='tour')return;if(i>=C.stops.length){finishTour();return}
 voice.cancel();S.jobs=[];S.arrived=false;S.tourIndex=i;S.legFrom=S.world;S.legTo=C.stops[i].position;S.legAt=S.clock;
 S.legCameraFrom=S.camera;S.legCameraTo=Math.max(0,Math.min(3128,C.stops[i].hall*1600-36));
 S.legDuration=Math.abs(S.legTo-S.world)<2?0:Math.max(650,Math.min(7200,Math.abs(S.legTo-S.world)*5.5));
 $('next').textContent=i===C.stops.length-1?'结束介绍':'继续介绍';
 later(S.legDuration+650,()=>{S.arrived=true;setFocus(i);later(500,()=>speak(C.stops[i].text,()=>later(1400,()=>tourStop(i+1))))});
}
function setFocus(index){document.querySelectorAll('.bay').forEach((el,i)=>el.classList.toggle('active',i===Math.floor(index/3)));document.querySelectorAll('.topic-card,.gallery-topic').forEach(el=>el.classList.toggle('active',+el.dataset.index===index))}
function showDirection(title){const hall=C.halls.findIndex(x=>x.title===title);if(hall<0)return;const index=hall*3;S.jobs=[];S.tourIndex=index;S.world=hall*1600+300;S.camera=hall*1600;S.legFrom=S.world;S.legTo=S.world;S.legAt=S.clock;S.legDuration=0;S.legCameraFrom=S.camera;S.legCameraTo=S.camera;S.arrived=true;S.interrupted=false;S.awaiting=false;go('tour');setFocus(index)}
function finishTour(){voice.cancel();go('qa');speak('三个研究方向就介绍到这里。你对哪项技术或案例更感兴趣？可以直接问我，也可以回到选择界面继续聊。',()=>later(16000,()=>returnChoice(),'return'))}
function clearInterruption(){S.interrupted=false;S.awaiting=false;S.pending=null;S.waitUntil=0;}
function reset(){window.LabProjects?.close();window.LabProjectMedia?.closeAll();voice.cancel();clearInterruption();S.paused=false;S.settingsOpen=false;$('voiceSettings').close();go('idle');status('');S.answers=[]}
function returnChoice(){window.LabProjects?.close();window.LabProjectMedia?.closeAll();if(S.phase==='idle'||S.phase==='choice'){if(!S.realtime)showChoice();return}voice.cancel();clearInterruption();S.paused=false;if(S.realtime){go('choice');return}S.returnSource=['interview','summary','lounge-enter'].includes(S.phase)?'lounge':S.phase==='intro'?'overview':'gallery';S.returnPose={...pose};go('returning');later(3600,()=>showChoice('我们回到这里了。你还想了解研究方向，还是聊聊一个具体问题？'))}
function pause(){if(window.RealtimeGuide?.active){window.RealtimeGuide.interrupt();return}if(S.phase!=='tour')return;if(S.paused){S.paused=false;voice.resume(S.pauseSpeech);S.pauseSpeech=null}else{S.pauseSpeech=voice.capture();S.paused=true}syncUI()}
function ask(){if(!S.ready)return;voice.arm();if(S.awaiting)return;S.pending=voice.capture();S.awaiting=true;S.waitUntil=0;syncUI();speak('我在听，你想了解什么？',()=>{S.waitUntil=performance.now()+18000},'answer')}
function resumeFlow(){voice.cancel();const saved=S.pending;clearInterruption();syncUI();if(saved)voice.resume(saved);else if(['qa','summary'].includes(S.phase)){drop('return');later(11000,()=>returnChoice(),'return')}}
function answer(question){
 drop('return');if(!S.interrupted&&!S.awaiting)S.pending=voice.capture();else voice.cancel();S.interrupted=true;S.awaiting=false;S.waitUntil=0;
 const match=C.faq.find(x=>x.pattern.test(question));const text=match?.answer||'现有实验室资料还不能支持这个问题的可靠回答。你可以问我研究方向、技术能力、案例或相关项目材料。';
 syncUI();
 speak(text,()=>{const saved=S.pending;clearInterruption();syncUI();if(saved)voice.resume(saved);else if(['qa','summary'].includes(S.phase))later(11000,()=>returnChoice(),'return')},'answer');
}
function prepareInterview(){S.realtimeNeeds=true;$('conversationTitle').textContent='聊聊你的企业需求。';$('conversationPrompt').textContent=S.interviewOutput||'小 D 会结合实验室资料，逐步了解问题、使用场景、目标与约束，再给出初步意见。';$('recommendation').hidden=true;$('conversationState').textContent=window.RealtimeGuide?.active?'我在听，可以直接说。':'等待语音连接…';go('interview')}
function openNeeds({assistantInitiated=false}={}){clearInterruption();voice.cancel();S.paused=false;S.answers=[];S.interviewStep=0;S.interviewOutput='';S.realtimeNeeds=true;window.LabProjects?.close();window.LabProjectMedia?.closeAll();go('lounge-enter');later(6800,prepareInterview);if(window.RealtimeGuide?.active){if(!assistantInitiated)window.RealtimeGuide.say('我们开始一次企业需求访谈。请根据访客的需求逐步提问，并结合本地实验室资料给出初步意见。');return}window.RealtimeGuide?.open('needs',{autostart:true,prompt:'我们开始一次企业需求访谈。请用自然、温和的普通话开始，先简短说明会逐步了解问题，再一次只问一个问题。了解现状、目标、使用场景、已有数据或设备、约束与衡量标准后，检索相关实验室资料，最后给出有依据的初步意见和待核实事项。'});}
function interviewStep(index){S.interviewStep=index;if(index>=C.interview.length){summarize();return}const item=C.interview[index];$('conversationTitle').textContent=item.title;$('conversationPrompt').textContent=item.prompt;$('recommendation').hidden=true;speak(item.prompt,()=>{$('conversationState').textContent='我在听，慢慢说就好。'},'interview')}
function summarize(){voice.cancel();go('summary');const all=S.answers.join(' '),education=/学生|孩子|青少年|学校|教育|课程/.test(all),product=/产品|家电|厨房|电器|设备|阀|机械|制造|生产/.test(all),cost=/成本|价格|预算|效率/.test(all),experience=/体验|清洁|噪音|舒适|好用|外观|使用/.test(all);
 const direction=education?'创造实践与学习体验':product?'产品设计与制造改进':'设计需求与创新方向';
 const priority=cost?'优先比较成本、工艺和实施条件':experience?'优先观察使用场景与体验问题':'先明确使用者、目标与约束';
 const cards=[['先理解问题',`${priority}。把目标转成能够观察和验证的指标。`],['连接实验室资源',education?'从创造实践厅入手，围绕草图、模型与材料安排合适的探索活动。':'从好设计成果中找认知线索，再结合 AI 创新赋能方向整理技术、材料和工艺问题。'],['用小样验证方向',education?'通过低风险模型制作记录观察、尝试与改进，形成可以继续学习的成果。':'先做草图、结构模型或打印样件，检查关键体验和制造约束，再决定下一步投入。']];
 $('conversationTitle').textContent='把想法，变成下一步。';$('conversationPrompt').textContent=`建议方向：${direction}。下面是基于本次访谈和展馆内容的初步建议。`;
 const root=$('recommendation');root.replaceChildren(...cards.map(([title,text])=>{const a=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=text;a.append(h,p);return a}));root.hidden=false;
 const summary=`结合刚才聊到的内容，我建议从${direction}开始。${cards.map(x=>x[1]).join('')}这些是初步方向，具体方案还需要结合真实条件验证。你还有想补充的吗？`;
 speak(summary,()=>{later(17000,()=>returnChoice(),'return');$('conversationState').textContent='你可以继续补充，或说“回到选择”。'},'interview');
}
function handleVoice(raw){
 const text=raw.trim();if(!text)return;const t=text.replace(/小\s*[dD迪帝弟]|晓迪/g,'').trim();
 if((S.phase==='projects'||!$('mediaStage').hidden)&&window.LabProjects.handle(t))return;
 if(/回到待机|重新开始/.test(t)){reset();return}
 if(/回到选择|返回选择/.test(t)){returnChoice();return}
 if(/没有了|没问题了|不用了|结束访谈|结束对话/.test(t)){if(S.phase==='interview'&&S.answers.length){clearInterruption();summarize()}else returnChoice();return}
 if(/暂停|等一下|停一下/.test(t)&&!/[?？]/.test(t)){if(S.phase==='tour'&&!S.paused)pause();else ask();return}
 if(/继续|接着讲|往前|下一站|下一个/.test(t)&&t.length<16){if(S.awaiting||S.interrupted){resumeFlow();return}if(S.paused){pause();return}if(S.phase==='tour'){tourStop(S.tourIndex+1);return}}
 if(/设计需求|聊聊需求|产业问题|合作方向|我有.*需求|访谈/.test(t)&&!['interview','summary'].includes(S.phase)){openNeeds();return}
 if(S.phase==='idle'&&/参观|开始|看看|你好|介绍|实验室/.test(t)){startOverview();return}
 if(S.phase==='choice'&&/实验室|探索|展览|参观|研究|方向|技术|案例|了解|看看|走/.test(t)){explore();return}
 if(S.phase==='choice'&&/需求|聊聊|产业问题|合作/.test(t)){openNeeds();return}
 if(S.phase==='summary'&&!/请问|我想问|什么是|为什么|[?？]/.test(t)){clearInterruption();if(/总结|建议|方案/.test(t)){summarize();return}S.answers.push(t);summarize();return}
 if(S.phase==='interview'&&!/请问|我想问|什么是|为什么|你们.*[?？]/.test(t)){
  voice.cancel();clearInterruption();syncUI();if(/总结|给.*建议|就这些/.test(t)){summarize();return}S.answers.push(t);interviewStep(S.interviewStep+1);return;
 }
 if(!t){ask();return}answer(t);
}
function voiceState(kind,message){document.body.classList.toggle('listening',kind==='listening');document.body.classList.toggle('cloud-listening',kind==='cloud');$('voiceState').querySelector('span').textContent=message;status('')}
// The generated atlas has unequal row heights. Keep every viewport inside its cell.
function detailCrop(row,col){
 const x=[3,421,840][col],y=[3,405,792][row],w=[412,412,411][col],h=[395,380,459][row];
 return `background-size:${1254/w*100}% ${1254/h*100}%;background-position:${x/(1254-w)*100}% ${y/(1254-h)*100}%;background-repeat:no-repeat`;
}
function buildGallery(){
 const root=$('galleryWorld');C.halls.forEach((hall,h)=>{const bay=document.createElement('section');bay.className='bay';bay.style.left=`${h*1600}px`;bay.innerHTML=`<div class="bay-backdrop" style="background-image:url('${hall.image}')"></div><div class="bay-glow"></div><header class="hall-sign glass"><span class="hall-number">0${h+1}</span><div><p>${hall.subtitle}</p><h2>${hall.title}</h2><div class="hall-topics">${hall.topics.map((x,k)=>`<span class="gallery-topic" data-index="${h*3+k}">${x}</span>`).join('')}</div></div></header>`;
  hall.topics.forEach((_,k)=>{const i=h*3+k,card=document.createElement('article');card.className='topic-card';card.dataset.index=i;card.style.left=`${[166,626,1086][k]}px`;card.innerHTML=`<div class="topic-art"><img src="${C.stops[i].image}" alt="${C.details[i][0]}"></div><div class="topic-plinth"></div><div class="topic-label">${C.details[i][0]}<small>${C.details[i][1]}</small></div>`;bay.append(card)});root.append(bay)
 });setFocus(0);
}
function buildLabMedia(){
 const gallery=$('labGallery'),clips=$('labClips'),videos=new Map();
 const projectVideoTitles=new Map([
  ['Product AI 智能设计系统',['AIGC 产品营销视频生成']],
  ['中国电信全球舆情态势分析',['中国电信全球舆情分析演示']],
  ['智慧商圈客流与开店评估',['智慧商圈进出门店识别','智慧商圈门店客流分析']],
  ['服装 AIGC 生成与营销',['服装设计生成演示一','服装设计生成演示二','社媒种草视频生成演示一','社媒种草视频生成演示二','社媒种草视频生成演示三']],
  ['AIGC 社媒短视频与种草视频生成',['社媒种草视频生成演示一','社媒种草视频生成演示二','社媒种草视频生成演示三']],
  ['儿童读写障碍评估与干预应用',['儿童读写障碍干预研究成果视频一','儿童读写障碍干预研究成果视频二','儿童读写障碍干预研究成果视频三','儿童读写障碍干预研究成果视频四']]
 ]);
 const closeStage=()=>{window.LabProjects?.clearDetail();window.LabMediaStage.clear($('mediaStageFrame'));$('mediaStage').hidden=true};
 const openStage=({title,caption='',image='',src='',text='',layout='media',project=null})=>{
  closeStage();const frame=$('mediaStageFrame');$('mediaStageTitle').textContent=title;$('mediaStageCaption').textContent=caption;$('mediaStageText').textContent=text||'';window.LabMediaStage.mount(frame,{src,image,title});window.LabProjects?.setDetail(project);
  $('mediaStage').dataset.layout=src?'video':layout;$('mediaStage').hidden=false;document.body.classList.add('media-stage-open');
  const note=$('mediaStageVideoLinks');note.replaceChildren();const titles=project?projectVideoTitles.get(project.title)||[]:[];note.hidden=!titles.length;
  if(titles.length){const strong=document.createElement('strong'),hint=document.createElement('span');strong.textContent=`本项目有 ${titles.length} 段视频展示`;hint.textContent=`可以直接对小 D 说“播放${titles[0]}”${titles.length>1?'，也可以说出角落提示中的其他视频名称':''}`;note.append(strong,hint)}
 };
 const openProject=project=>openStage({title:project.title,caption:project.caption,image:assetUrl(project.image),text:project.text,layout:'project',project});
 const closeAll=()=>{closeStage();document.body.classList.remove('media-stage-open')};
 const openProjects=title=>{closeAll();go('projects');window.LabProjects.open(title)};
 window.LabProjectMedia={openProject,openProjects,closeAll,openImage:openStage};
 $('closeProjectOverview').onclick=()=>{voice.cancel();window.LabProjects.close();showChoice()};
 $('projectReturnChoice').onclick=()=>window.LabProjects.back();$('projectReturnHome').onclick=()=>window.GuideDebug.reset();
 const showImage=item=>openStage({title:item.title,caption:item.caption,image:item.image,text:item.description||''});
 C.gallery.forEach(item=>{const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=assetUrl(item.image);img.alt=item.title;caption.innerHTML=`<strong>${item.title}</strong><small>${item.caption}</small>`;figure.append(img,caption);figure.tabIndex=0;figure.setAttribute('role','button');figure.setAttribute('aria-label',`全屏打开：${item.title}`);figure.onclick=()=>showImage(item);figure.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showImage(item)}};gallery.append(figure)});
 C.clips.forEach(item=>{const article=document.createElement('article'),frame=document.createElement('div'),poster=document.createElement('img'),play=document.createElement('button'),heading=document.createElement('h4'),caption=document.createElement('p');frame.className='clip-frame';poster.src=assetUrl(item.poster);poster.alt='';play.type='button';play.className='clip-play';play.textContent='全屏播放案例视频';play.onclick=()=>openStage({title:item.title,caption:item.caption,src:assetUrl(item.src)});frame.append(poster,play);heading.textContent=item.title;caption.textContent=item.caption;article.append(frame,heading,caption);videos.set(item.title,item);clips.append(article)});
 $('labMediaButton').onclick=()=>{go('projects');window.LabProjects.showClips()};$('closeLabMedia').onclick=()=>$('labMediaDialog').close();$('closeLabImage').onclick=()=>$('labImageDialog').close();
 $('labMediaDialog').addEventListener('click',e=>{if(e.target===$('labMediaDialog'))$('labMediaDialog').close()});$('labImageDialog').addEventListener('click',e=>{if(e.target===$('labImageDialog'))$('labImageDialog').close()});
 $('closeMediaStage').onclick=closeAll;$('mediaStage').addEventListener('click',e=>{if(e.target===$('mediaStage'))closeAll()});window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mediaStage').hidden)closeAll()});
 window.addEventListener('lab:open-media',event=>{const {kind,title}=event.detail||{};if(kind==='interview'){if(!S.realtimeNeeds)openNeeds({assistantInitiated:true});return}if(kind==='direction'){const i=C.halls.findIndex(x=>x.title===title);if(i>=0)openStage({title,caption:'未来设计实验室 · 研究方向',image:assetUrl(C.halls[i].image),text:C.profile.directions[i],layout:'project'});return}if(kind==='project'&&['返回首页','返回选择','关闭详情','下一个项目','上一个项目','案例影像','下一个项目类别','暂停视频','继续播放','停止视频','结束对话'].includes(title)){window.LabProjects.handle(title);return}if(kind==='project'){const p=C.projects.find(x=>x.title===title);if(p)openProject(p);else openProjects(title);return}if(kind==='image'){const item=C.gallery.find(x=>x.title===title);if(item)showImage(item);return}if(kind==='video'){const item=videos.get(title);if(item)openStage({title:item.title,caption:item.caption,src:assetUrl(item.src)});}});
}
function setupVoices(){const select=$('voiceSelect'),previous=voice.selected;select.replaceChildren();const auto=new Option('自动选择柔和中文声音','');select.add(auto);voice.refresh().forEach(v=>select.add(new Option(v.name,v.voiceURI)));select.value=previous}
function beginWelcome(){go('choice');window.RealtimeGuide?.open('general',{autostart:true,prompt:'你好，我是小 D，欢迎来到未来设计实验室。我可以用语音介绍实验室方向和项目，也可以和你一起梳理企业设计需求。你想先了解什么？'});}
$('start').onclick=beginWelcome;$('explore').onclick=explore;$('needs').onclick=()=>openNeeds();$('skip').onclick=arrive;$('reset').onclick=reset;$('back').onclick=returnChoice;$('pause').onclick=pause;$('next').onclick=()=>{if(window.RealtimeGuide?.active){const i=Math.min(C.stops.length-1,S.tourIndex+1);S.tourIndex=i;setFocus(i);window.RealtimeGuide.say(`请继续介绍“${C.stops[i].title}”。`);return}S.paused=false;S.pauseSpeech=null;clearInterruption();syncUI();tourStop(S.tourIndex+1)};$('ask').onclick=()=>window.RealtimeGuide?.active?window.RealtimeGuide.open():window.RealtimeGuide?.open(S.phase==='interview'||S.phase==='summary'?'needs':'general',{autostart:true});
$('settings').onclick=()=>$('rtSettings').click();
function closeSettings(){voice.cancel();$('voiceSettings').close();S.settingsOpen=false;voice.resume(S.settingsSpeech);S.settingsSpeech=null}
$('closeSettings').onclick=closeSettings;$('voiceSettings').addEventListener('cancel',e=>{e.preventDefault();closeSettings()});$('voiceSelect').onchange=e=>voice.select(e.target.value);$('sampleVoice').onclick=()=>speak('你好，我是小 D。接下来，让我陪你一起发现设计的美好。',null,'sample');$('sound').onclick=()=>{voice.muted=!voice.muted;$('sound').textContent=voice.muted?'声音关':'声音开'};addEventListener('guidevoiceschanged',setupVoices);
function scene(id,opacity,x=0,scale=1){const el=$(id);el.style.opacity=clamp(opacity);el.style.transform=`translateX(${x}px) scale(${scale})`}
function render(dt){
 const p=S.phase,elapsed=S.clock-S.phaseAt;let target={x:835,foot:736,scale:.82,facing:0,walk:0,point:0},mode='auto',robotOpacity=1,seatOpacity=0;
 let idle=0,choice=0,overview=0,gallery=0,lounge=0,cx=0,gx=0,glow=0;
 if(p==='idle')idle=1;
 if(p==='choice')choice=1;
 if(p==='lab-enter'){const motion=GuideMotion.labEntry(elapsed,S.labEntryFrom);choice=1-motion.scene;overview=motion.scene;glow=Math.sin(motion.scene*Math.PI)*.18;target=motion.pose;}
 $('projectOverview').style.opacity=p==='lab-enter'?ease((elapsed-3200)/1400):1;
 if(p==='projects'){overview=1;target={x:163,foot:650,scale:.70,facing:0,walk:0,point:0};}
 if(p==='intro'){
  const inP=ease(elapsed/2200);idle=1-inP;overview=inP;
  if(S.chapter===0){target={x:835,foot:mix(736,758,ease(elapsed/3800)),scale:mix(.82,.68,ease(elapsed/3800)),facing:ease((elapsed-500)/1000),walk:elapsed>1700?.78:0,point:0}}
  else {target={x:835,foot:758,scale:.68,facing:0,walk:0,point:S.chapter===1?-1:S.chapter===2?1:0}}
  $('introVisuals').style.opacity=S.chapter===0?0:1;
 }
 if(p==='arriving'){const t=ease(elapsed/4200);overview=1-t;choice=t;glow=Math.sin(t*Math.PI)*.25;target={x:mix(835,835,t),foot:mix(758,736,t),scale:mix(.68,.82,t),facing:elapsed<2400?1:1-ease((elapsed-2400)/1400),walk:elapsed<2400?.72:0,point:0};$('introVisuals').style.opacity=1-ease(elapsed/1200)}
 if(p==='entering'){const t=ease(elapsed/5200);choice=1-t;gallery=t;glow=Math.sin(t*Math.PI)*.18;target={x:mix(835,590,t),foot:mix(736,860,t),scale:mix(.82,.64,t),walk:elapsed<4250?.8:0,facing:elapsed<3400?1:1-ease((elapsed-3400)/1200),point:0}}
 if(p==='tour'||p==='qa'){
  gallery=1;const leg=ease((S.clock-S.legAt)/Math.max(1,S.legDuration));if(p==='tour')S.world=mix(S.legFrom,S.legTo,leg);
  S.camera=mix(S.legCameraFrom,S.legCameraTo,leg);
  const distance=Math.abs(S.legTo-S.legFrom),raw=clamp((S.clock-S.legAt)/Math.max(1,S.legDuration));
  const moving=p==='tour'&&distance>2&&leg<.995;
  const stride=moving?Math.min(.85,6*raw*(1-raw)*distance/S.legDuration*8):0;
  target={x:Math.max(230,Math.min(360,S.world-S.camera)),foot:860,scale:.58,walk:stride,facing:0,point:!S.arrived||p==='qa'?0:Math.sign(C.stops[S.tourIndex].focus-S.world)};mode=moving?'side':'auto';
 }
 if(p==='lounge-enter'){
  const t=ease(elapsed/4000);choice=1-t;lounge=t;glow=Math.sin(t*Math.PI)*.18;
  const walkT=ease(elapsed/4000);target={x:mix(835,555,walkT),foot:mix(736,816,walkT),scale:mix(.82,1.31,walkT),facing:elapsed<2800?1:1-ease((elapsed-2800)/1000),walk:elapsed<3100?.8:0,point:0};
  robotOpacity=1-ease((elapsed-3650)/500);seatOpacity=ease((elapsed-3650)/500);
 }
 if(p==='interview'||p==='summary'){lounge=1;seatOpacity=1;robotOpacity=0}
 if(p==='returning'){
  const t=ease(elapsed/3600);choice=t;if(S.returnSource==='lounge'){lounge=1-t;seatOpacity=1-ease(t/.55);robotOpacity=ease((t-.4)/.6)}else if(S.returnSource==='overview')overview=1-t;else{gallery=1-t;gx=t*650}
  glow=Math.sin(t*Math.PI)*.32;target={x:mix(S.returnPose.x,835,t),foot:mix(S.returnPose.foot,736,t),scale:mix(S.returnPose.scale,.82,t),facing:elapsed<2100?1:1-ease((elapsed-2100)/1200),walk:elapsed<2100?.7:0,point:0};
 }
 const held=S.realtime||S.paused||S.interrupted||S.awaiting||S.settingsOpen;
 if(held){target.walk=0;target.facing=0;target.point=0}
 for(const key of ['x','foot','scale','facing','walk','point'])pose[key]=smooth(pose[key],target[key],key==='facing'?7:5,dt);
 scene('idleScene',idle);scene('choiceScene',choice,cx);scene('overviewScene',overview,0,reduced?1:1+Math.min(.055,elapsed*.0000015));scene('galleryScene',gallery,gx);scene('loungeScene',lounge);
 $('galleryScene').querySelectorAll('.hall-sign,.topic-card,.gallery-brand').forEach(el=>el.style.visibility=p==='entering'&&elapsed<3700?'hidden':'');
 $('galleryWorld').style.transform=`translateX(${-S.camera}px)`;
 const centerOffset=['projects','lab-enter'].includes(S.phase)?0:($('stage').offsetWidth-1672)/2;
 $('robotAnchor').style.left=`${pose.x-260+centerOffset}px`;$('robotAnchor').style.top=`${pose.foot-470}px`;$('robotAnchor').style.transform=`scale(${pose.scale})`;$('robotAnchor').style.opacity=robotOpacity;
 $('walkingShadow').style.left=`${pose.x-85*pose.scale+centerOffset}px`;$('walkingShadow').style.top=`${pose.foot-8}px`;$('walkingShadow').style.width=`${170*pose.scale}px`;$('walkingShadow').style.opacity=robotOpacity*.6;
 $('seatedAnchor').hidden=seatOpacity<.001;$('seatedAnchor').style.opacity=seatOpacity;$('loungeForeground').style.opacity=lounge;
 $('transitionGlow').style.opacity=glow;$('transitionGlow').style.transform=`translateX(${Math.sin(elapsed*.0003)*150}px)`;
 const speaking=voice.speaking||window.RealtimeGuide?.speaking;
 rig?.draw(performance.now()/1000,pose.walk,speaking?1:0,reduced,pose.facing,pose.point,mode);
 seatRig?.draw(performance.now()/1000,0,speaking?1:0,reduced,0,0,p==='lounge-enter'?'seated-sit':speaking?'seated-talk':'seated-listen',p==='lounge-enter'?clamp((elapsed-3950)/2600):1);
 $('conversationState').textContent=voice.speaking?'小 D 正在回应…':voice.listening?'我在听，慢慢说就好。':'可以直接说出你的想法';
}
function tick(now){requestAnimationFrame(tick);const dt=Math.max(0,Math.min(.06,(now-lastFrame)/1000||.016));lastFrame=now;voice.tick(dt*1000);
 const realtimeTransition=S.realtime&&['lab-enter','lounge-enter'].includes(S.phase);
 if((!S.realtime||realtimeTransition)&&!S.paused&&!S.interrupted&&!S.awaiting&&!S.settingsOpen){S.clock+=dt*1000;const due=S.jobs.filter(j=>j.at<=S.clock);S.jobs=S.jobs.filter(j=>j.at>S.clock);for(const j of due)j.fn()}
 if(!S.realtime&&S.awaiting&&S.waitUntil&&performance.now()>S.waitUntil)resumeFlow();render(dt);
}
window.GuideRealtimeBridge={
 begin(mode){
  if(S.realtime)return;
  S.realtime=true;document.body.classList.add('exhibition-speaking');voice.suspend();S.realtimeSpeech=null;S.realtimeNeeds=mode==='needs';
  window.LabGuideBubble?.set('我在听，可以直接说。');
  if(S.realtimeNeeds){S.realtimeSpeech=null;clearInterruption();S.paused=false;if(S.phase!=='lounge-enter')prepareInterview();}
  syncUI();voiceState('cloud','AI 已连接 · 可直接说话或打断小 D');
 },
 end(){
  if(!S.realtime)return;S.realtime=false;document.body.classList.remove('exhibition-speaking','exhibition-admin');voice.unsuspend();S.realtimeNeeds=false;S.realtimeSpeech=null;
  syncUI();
  voiceState('idle','实时 AI 已结束');
 },
 transcript(role,text){
  if(!S.realtimeNeeds||!text)return;
  S.interviewOutput=(role==='user'?'你刚才说：':'小 D 的意见：')+text.slice(-720);
  $('conversationPrompt').textContent=S.interviewOutput;
  $('conversationState').textContent=role==='user'?'我听到了，继续说或等小 D 回应。':'你可以继续补充，或请小 D 总结建议。';
 }
};
window.LabGuideBubble={set(text){if(!text)return;const clean=String(text).trim();$('guideBubble').textContent=clean;if($('projectBubble')){const bubble=$('projectBubble');bubble.textContent=clean;bubble.scrollTop=bubble.scrollHeight;}$('welcomeBubble').textContent=clean;}};
buildGallery();buildLabMedia();syncUI();
Promise.all(['assets/guide-atlas-v4.png','assets/guide-left-v4.png','assets/seated-v6.png','assets/motion-v6.png','assets/sit-separated-v8.png'].map(loadImage)).then(([a,l,s,m,n])=>{rig=createGuideRig($('robot'),a,l,null,m);seatRig=createGuideRig($('seatedRobot'),a,l,s,m,n);S.ready=true;if(new URLSearchParams(location.search).get("view")==="projects"){go("projects");window.LabProjects.open()}}).catch(error=>{console.error('实验室向导动画素材初始化失败：',error);status(error.assetSrc?`动画图片加载失败：${error.assetSrc}。请确认部署包中包含此文件后刷新。`:`动画初始化失败：${error.message||'未知错误'}。请刷新后重试。`)});
requestAnimationFrame(tick);
window.GuideDebug={state:()=>({phase:S.phase,chapter:S.chapter,tourIndex:S.tourIndex,world:S.world,camera:S.camera,paused:S.paused,interrupted:S.interrupted,awaiting:S.awaiting,arrived:S.arrived,ready:S.ready,clock:S.clock,voiceKind:voice.current?.kind,answers:S.answers.length,walk:pose.walk}),send:handleVoice,start:startOverview,explore,interview:openNeeds,step(ms){S.clock+=ms},finishSpeech:()=>voice.finish(),mute:()=>{voice.muted=true},tourStop,returnChoice,reset};
