/* Six themed entries over the original fitted 1672 × 941 artboard. */
(()=>{
 const el=id=>document.getElementById(id),C=window.LAB_CONTENT;
 const icons=[`<path d="M15 11c0-5 7-5 7 0 0 3-4 3-4 6L5 26c-2 2-1 4 2 4h25c3 0 4-2 2-4L21 17"/>`,`<path d="m20 4 15 8v18l-15 8-15-8V12zM5 12l15 8 15-8M20 20v18M14 9l15 8"/>`,`<path d="M4 35h32M8 35V16h9v19m0-1V6h12v29m0-18h6v18M21 11h3m-3 6h3m-3 6h3M11 21h2m-2 6h2"/>`,`<rect x="5" y="7" width="30" height="27" rx="3"/><path d="m7 30 9-10 7 7 6-8 5 9"/><circle cx="26" cy="15" r="3"/>`,`<path d="m16 4 8 0 2 6 5 3 6-1 3 7-5 4-1 5 3 5-6 5-6-3-5 1-4 4-7-3 1-6-3-4-6-2 1-8 6-1 4-4z"/><circle cx="20" cy="22" r="6"/>`,`<path d="m7 17 5-10h17l5 10M5 18h30v15H5zM9 33v4m22-4v4M5 23h30"/><circle cx="11" cy="28" r="2"/><circle cx="29" cy="28" r="2"/>`];
 const categories=[
 {title:'服饰与时尚设计',color:'#ff6448',desc:'传统文化与 AI 技术融合，探索未来时尚设计。',match:/汉服|云衣|服装|服饰|CMF|社媒/},
 {title:'智能产品与文创设计',color:'#087cff',desc:'用 AI 激发产品创新，连接文化与生活。',match:/Product|Chat2Design|海尔|黄金|三星堆|竹编/},
 {title:'智慧城市与视觉感知',color:'#40bb72',desc:'用数据和 AI 感知城市，创造更安全、智慧的社会。',match:/感知|交通|社区|政策|电信|商圈|政工|交警|110|城市/},
 {title:'文化光影与展览',color:'#9f46f6',desc:'用数字艺术与光影技术，讲述文化的当代表达。',match:/光影|苏东坡/},
 {title:'智能装备与工业应用',color:'#ffac19',desc:'以 AI 和智能技术，推动产业与工程应用创新。',match:/iFS|农机|地毯|企业大模型|数智平台/},
 {title:'汽车品牌与出海 / 教育应用',color:'#157cff',desc:'从汽车设计到教育服务，拓展 AI 的行业应用场景。',match:/吉利|钱江|儿童/}
 ];
 for(const c of categories)c.projects=[];
 for(const p of C.projects){const c=categories.find(c=>c.match.test(p.title))||categories[1];c.projects.push(p)}
 let current=-1,detail=null;
 function open(indexOrTitle){
  el('projectOverview').hidden=false;current=-1;
  const n=typeof indexOrTitle==='number'?indexOrTitle:categories.findIndex(c=>c.title===indexOrTitle);
  if(n>=0){category(n);return} renderCategories();
 }
 function renderCategories(){
  window.LabProjectMedia?.closeAll();current=-1;el('projectOverviewGrid').style.removeProperty('--columns');el('projectOverviewGrid').style.removeProperty('--rows');el('allCategories').hidden=true;el('projectOverview').classList.remove('category-open');
  el('projectOverview').querySelector('h1').textContent='实验室项目总览';el('projectOverview').querySelector('header p').textContent='';
  const root=el('projectOverviewGrid');root.replaceChildren();
  categories.forEach((c,i)=>{
   const card=document.createElement('button');card.className='category-card';card.style.setProperty('--accent',c.color);
   card.innerHTML=`<div class="category-heading"><span class="category-icon"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icons[i]}</svg></span><div><h2>${c.title}</h2><p>${c.desc}</p></div><small>${c.projects.length} 个代表项目</small></div><div class="category-collage">${c.projects.slice(0,3).map(p=>`<img src="${window.OFFLINE_ASSETS?.[p.image]||p.image}" alt="${p.title}">`).join('')}</div><ul>${c.projects.slice(0,3).map(p=>`<li>${p.title}</li>`).join('')}</ul><span class="category-arrow" aria-hidden="true">→</span>`;
   card.onclick=()=>category(i);root.append(card);
  });
 }
 function category(i){
  window.LabProjectMedia?.closeAll();current=(i+categories.length)%categories.length;const c=categories[current];
  el('allCategories').hidden=false;el('projectOverview').classList.add('category-open');el('projectOverview').querySelector('h1').textContent=c.title;
  el('projectOverview').querySelector('header p').textContent=c.desc;
  const root=el('projectOverviewGrid');root.replaceChildren();
  const columns=c.projects.length>6?4:3;root.style.setProperty('--columns',columns);root.style.setProperty('--rows',Math.ceil(c.projects.length/columns));
  c.projects.forEach(p=>{const card=document.createElement('button');card.className='project-overview-card';card.innerHTML=`<img src="${window.OFFLINE_ASSETS?.[p.image]||p.image}" alt="${p.title}"><div class="project-overview-copy"><small>${p.caption}</small><h2>${p.title}</h2><p>${p.text}</p></div>`;card.onclick=()=>{window.LabProjectMedia.openProject(p);if(window.RealtimeGuide?.active)window.RealtimeGuide.say(`请介绍项目“${p.title}”。`)};root.append(card)});
  root.scrollTop=0;
 }
 function showClips(){
  window.LabProjectMedia.closeAll();el('projectOverview').hidden=false;el('projectOverview').classList.add('category-open');el('projectOverview').querySelector('h1').textContent='实验室案例影像';el('projectOverview').querySelector('header p').textContent='说出视频名称，打开对应案例影像。';
  const root=el('projectOverviewGrid');root.replaceChildren();root.style.setProperty('--columns',5);root.style.setProperty('--rows',Math.ceil(C.clips.length/5));
  C.clips.forEach(p=>{const card=document.createElement('button');card.className='project-overview-card';card.innerHTML=`<img src="${window.OFFLINE_ASSETS?.[p.poster]||p.poster}" alt="${p.title}"><div class="project-overview-copy"><h2>${p.title}</h2></div>`;card.onclick=()=>window.LabProjectMedia.openImage({title:p.title,caption:p.caption,src:window.OFFLINE_ASSETS?.[p.src]||p.src});root.append(card)});
 }
 function close(){el('projectOverview').hidden=true;}
 function back(){
  if(!el('mediaStage').hidden){window.LabProjectMedia.closeAll();return}
  if(current>=0){renderCategories();return}
  window.GuideDebug.returnChoice();
 }
 function handle(text){
  if(/暂停视频|继续播放|停止视频/.test(text)){const video=el('mediaStageFrame').querySelector('video');if(video){if(/继续/.test(text))video.play()?.catch(()=>{});else if(/停止/.test(text))window.LabProjectMedia.closeAll();else video.pause()}return true}
  if(/结束对话/.test(text)){window.RealtimeGuide?.stop();return true}

  if(/回到选择|返回选择/.test(text)){back();return true}
  if(/案例影像|案例视频|视频总览|视频列表/.test(text)){showClips();return true}
  if(/关闭|返回类别|返回上一页/.test(text)){window.LabProjectMedia.closeAll();return true}
  if(/下一个项目|上一个项目/.test(text)&&!text.includes('类别')){const list=current>=0?categories[current].projects:C.projects;const index=list.indexOf(detail);const next=(index+(text.includes('上一个')?-1:1)+list.length)%list.length;window.LabProjectMedia.openProject(list[next]);return true}
  if(/返回首页|回到首页/.test(text)){window.GuideDebug.reset();return true}
  if(/总览|所有项目|其他项目|项目类别|看项目/.test(text)){if(/下一个/.test(text))category(current+1);else renderCategories();return true}
  const project=C.projects.find(p=>text.includes(p.title)||p.aliases?.some(a=>text.includes(a)));if(project){window.LabProjectMedia.openProject(project);return true}
  const clip=C.clips.find(p=>text.includes(p.title));if(clip){window.LabProjectMedia.openImage({title:clip.title,caption:clip.caption,src:window.OFFLINE_ASSETS?.[clip.src]||clip.src});return true}
  const i=categories.findIndex(c=>c.title.includes(text.replace(/看看|项目|介绍|我想看|的/g,''))||[ /服饰|时尚|服装/,/智能产品|文创/,/智慧城市|视觉感知/,/文化|光影|展览/,/装备|工业/,/汽车|出海|教育/ ][categories.indexOf(c)].test(text));
  if(i>=0){category(i);return true}return false;
 }
 el('allCategories').onclick=renderCategories;
 document.querySelectorAll('.voice-example').forEach(b=>b.onclick=()=>handle(b.dataset.command));
 window.LabProjects={open,close,handle,back,category,categories,showClips,setDetail(p){detail=p},clearDetail(){detail=null}};
 window.addEventListener('lab:open-media',e=>{if(e.detail?.kind==='category')open(e.detail.title)});
})();
