window.LabMediaStage={
 clear(frame){
  frame.querySelectorAll('video').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
  frame.replaceChildren();
 },
 mount(frame,{src='',image='',title=''}){
  this.clear(frame);let node;
  if(src){node=document.createElement('video');node.controls=false;node.autoplay=true;node.playsInline=true;node.preload='auto';node.src=src;node.setAttribute('aria-label',title);frame.append(node);const attempt=node.play();attempt?.catch(()=>{});}
  else if(image){node=document.createElement('img');node.src=window.OFFLINE_ASSETS?.[image]||image;node.alt=title;frame.append(node);}
  return node||null;
 }
};
