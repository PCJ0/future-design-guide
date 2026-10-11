/* Cloud conversation adapter. Credentials are stored by the loopback server only. */
(() => {
  const shell=document.createElement('div');shell.id='realtimeRoot';
  shell.innerHTML=`<div class="realtime-launch"><button id="rtOpen">和小 D 实时对话</button><button id="rtSettings" aria-label="实时对话连接设置">连接设置</button></div>
  <section id="rtPanel" hidden aria-label="小 D 实时对话">
    <header><div><span class="rt-eyebrow">与小 D 聊聊</span><h2>实时语音对话</h2></div><button id="rtClose" aria-label="关闭并结束实时对话">×</button></header>
    <p id="rtStatus" role="status">先完成连接设置，再开始对话。</p>
    <label for="rtMode">这次想聊什么</label><select id="rtMode"><option value="general">实验室介绍与自由问答</option><option value="needs">聊聊我的产业问题</option></select>
    <div class="rt-actions"><button id="rtStart">开始对话</button><button id="rtStop" disabled>结束对话</button><button id="rtMute" disabled>关闭麦克风</button><button id="rtInterrupt" disabled>打断小 D</button></div>
    <p class="rt-note">连接后麦克风音频会持续发送到所选模型服务。小 D 会一直听你说话；你可随时打断、换主题、静音或结束，也可以让它打开图片和视频。</p>
    <div id="rtTranscript" role="log" aria-label="本次对话记录"><p class="rt-empty">对话文字会显示在这里。</p></div>
    <form id="rtTextForm"><label class="rt-sr" for="rtText">文字补充</label><input id="rtText" maxlength="2000" placeholder="也可以打字补充…" disabled><button id="rtSend" disabled>发送</button></form>
    <footer><button id="rtExport">导出文字记录</button><button id="rtClear">清空记录</button><small>记录仅在本页保留；刷新前可导出。每次连接最多 2 小时。</small></footer>
  </section>
  <dialog id="rtConfig"><form id="rtConfigForm"><h2>实时对话连接设置</h2><p>选择已适配的百炼模型。Key 只保存到这台电脑，不会嵌入网页。</p>
    <label for="rtModel">模型</label><select id="rtModel" required></select>
    <label for="rtRegion">账号地域</label><select id="rtRegion"><option value="cn-beijing">中国内地 · 北京</option><option value="ap-southeast-1">新加坡</option></select>
    <label for="rtWorkspace">Workspace ID</label><input id="rtWorkspace" autocomplete="off" maxlength="100" placeholder="百炼控制台中的业务空间 ID">
    <label for="rtKey">API Key</label><input id="rtKey" type="password" autocomplete="new-password" maxlength="512" placeholder="首次填写；留空保留已保存的 Key">
    <label for="rtVoice">音色 ID（可留空）</label><input id="rtVoice" autocomplete="off" maxlength="120" placeholder="使用所选模型的默认音色">
    <label for="rtTurn">接话方式</label><select id="rtTurn"><option value="smart">智能判断说完 · 推荐</option><option value="server">停顿约 0.8 秒后接话</option></select>
    <p id="rtConfigStatus" role="status"></p><div class="rt-actions"><button id="rtSave" type="submit">保存设置</button><button id="rtForget" type="button">移除已保存 Key</button><button id="rtConfigClose" type="button">关闭</button></div>
    <p class="rt-note">地域、业务空间和 Key 必须匹配，账号需已开通模型并有可用额度。保存只校验本地配置；点击“开始对话”才连接服务。</p>
  </form></dialog>`;
  document.body.append(shell);
  const el=id=>document.getElementById(id);
  let config=null,active=false,ready=false,ws=null,context=null,stream=null,micNode=null,micSource=null,silentGain=null;
  let sources=new Set(),nextTime=0,response=null,generating=false,suppressed=new Set(),muted=false,epoch=0,timeout=null,pendingPcmByte=null,micBackpressureNotice=false;
  let rows=new Map(),records=[],currentKey=null,initialPrompt='';
  function status(text){el('rtStatus').textContent=text;}
  function controls(){
    el('rtStart').disabled=active||!config?.ready;el('rtStop').disabled=!active;
    el('rtMute').disabled=!ready;el('rtInterrupt').disabled=!ready;
    el('rtMode').disabled=active;el('rtSettings').disabled=active;
    el('rtText').disabled=!ready;el('rtSend').disabled=!ready;
    el('rtMute').textContent=muted?'开启麦克风':'关闭麦克风';
  }
  async function refreshConfig(){
    if(window.OFFLINE_ASSETS||location.protocol==='file:'){
      status('离线文件仅支持演示。请双击“启动实时助手.bat”后使用实时对话。');return;
    }
    try{const r=await fetch('/api/realtime/config');if(!r.ok)throw Error();config=await r.json();controls();
      if(!active)status(config.ready?'设置已就绪，尚未连接。点击开始后可以直接说话。':'尚未配置：请在“连接设置”中填写 Key 和 Workspace ID。');
    }catch{status('本地后端未就绪。请重新启动“启动实时助手.bat”。');}
  }
  function open(mode='general',{autostart=false,prompt=''}={}){
    if(active&&!autostart&&!prompt)document.body.classList.toggle('exhibition-admin');el('rtPanel').hidden=false;if(!active)el('rtMode').value=mode;
    if(active&&prompt){if(ready)say(prompt);else initialPrompt=prompt;return;}
    if(prompt)initialPrompt=prompt;
    if(!autostart){refreshConfig();return;}
    if(config?.ready){start();return;}
    refreshConfig().then(()=>{
      if(config?.ready){start();return;}
      if(config)settings();
    });
  }
  async function settings(){
    await refreshConfig();if(!config){open();return;}
    el('rtModel').replaceChildren(...config.presets.map(p=>new Option(p.name,p.id)));
    for(const [id,key]of [['rtModel','model'],['rtRegion','region'],['rtWorkspace','workspaceId'],['rtVoice','voice'],['rtTurn','turnMode']])el(id).value=config[key];
    el('rtKey').value='';el('rtConfigStatus').textContent=config.hasKey?'已保存 Key；不会回显密钥。':'尚未保存 Key。';
    el('rtConfig').showModal();
  }
  async function save(clearKey=false){
    el('rtSave').disabled=true;
    try{
      const body={model:el('rtModel').value,region:el('rtRegion').value,workspaceId:el('rtWorkspace').value,voice:el('rtVoice').value,turnMode:el('rtTurn').value,apiKey:el('rtKey').value,clearKey};
      const r=await fetch('/api/realtime/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const data=await r.json();if(!r.ok)throw Error(data.error);
      config=data;el('rtKey').value='';controls();el('rtConfigStatus').textContent=clearKey?'Key 已移除。':config.ready?'已保存，可以关闭设置并开始对话。':'已保存；还需要 Key 和 Workspace ID。';
      if(!active)status(config.ready?'设置已就绪，点击开始对话。':'请补全连接设置。');
    }catch(e){el('rtConfigStatus').textContent=e.message||'保存失败，请检查本地服务。';}
    finally{el('rtSave').disabled=false;}
  }
  function record(role,key,text,{append=false,interrupted=false,channel=''}={}){
    if(!text&&!interrupted)return;
    let row=rows.get(key);
    if(!row){
      el('rtTranscript').querySelector('.rt-empty')?.remove();
      const article=document.createElement('article'),label=document.createElement('b'),p=document.createElement('p');
      label.textContent=role==='user'?'你':'小 D';article.className=role;article.append(label,p);el('rtTranscript').append(article);
      row={role,text:'',time:new Date().toISOString(),p,article,interrupted:false};rows.set(key,row);records.push(row);
      if(records.length>200){const old=records.shift();old.article.remove();for(const [k,v]of rows)if(v===old)rows.delete(k);}
    }
    if(channel==='text'&&row.channel==='audio')return;
    if(channel==='audio'&&row.channel==='text')row.text='';
    if(channel)row.channel=channel;
    row.text=(append?row.text+text:text||row.text).slice(0,20000);row.interrupted ||= interrupted;
    row.p.textContent=row.text+(row.interrupted?'（已打断，部分内容可能未播出）':'');
    if(role==='assistant'&&row.text)window.LabGuideBubble?.set(row.text);
    window.GuideRealtimeBridge?.transcript?.(role,row.text);
    el('rtTranscript').scrollTop=el('rtTranscript').scrollHeight;
  }
  function stopPlayback(clearPending=true){for(const source of sources){source.onended=null;try{source.stop()}catch{}source.disconnect();}sources.clear();nextTime=context?.currentTime||0;if(clearPending)pendingPcmByte=null;}
  function interrupt(notify=true){
    if(generating||sources.size){
      if(response)suppressed.add(response);
      if(currentKey)record('assistant',currentKey,'',{interrupted:true});
    }
    generating=false;
    stopPlayback();if(notify)send({type:'bridge.interrupt'});
    status(muted?'麦克风已关闭，可以打字。':'我在听，请继续。');
  }
  function send(event){if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(event));return true;}return false;}
  function play(base64){
    if(!context||typeof base64!=='string'||!base64)return;
    const chunk=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    let bytes=chunk;
    if(pendingPcmByte!==null){bytes=new Uint8Array(chunk.length+1);bytes[0]=pendingPcmByte;bytes.set(chunk,1);pendingPcmByte=null;}
    if(bytes.length%2){pendingPcmByte=bytes[bytes.length-1];bytes=bytes.subarray(0,bytes.length-1);}
    if(!bytes.length)return;
    if(nextTime-context.currentTime>25){stopPlayback(false);status('音频播放积压，已跳过迟到片段；语音连接仍保持。');}
    const buffer=context.createBuffer(1,bytes.length/2,24000),samples=buffer.getChannelData(0),view=new DataView(bytes.buffer);
    for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
    const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
    const start=Math.max(context.currentTime+0.025,nextTime);source.start(start);nextTime=start+buffer.duration;sources.add(source);
    source.onended=()=>{sources.delete(source);source.disconnect();if(!sources.size&&ready)status(muted?'麦克风已关闭，可以打字。':'我在听，可以接着说。');};
  }
  function onEvent(e){
    if(e.type==='bridge.error'){stop(e.message);return;}
    if(e.type==='bridge.notice'){status(e.message);return;}
    if(e.type==='bridge.media'){window.dispatchEvent(new CustomEvent('lab:open-media',{detail:{kind:e.kind,title:e.title}}));status(e.kind==='interview'?'已进入企业需求访谈':e.kind==='project'?`已打开项目总览：${e.title}`:`已打开${e.kind==='video'?'视频':'图片'}：${e.title}`);return;}
    if(e.type==='bridge.ready'){ready=true;clearTimeout(timeout);controls();status('已连接 · 我在听，说话时可以打断小 D。');if(initialPrompt){const text=initialPrompt;initialPrompt='';send({type:'bridge.text',text});record('user',crypto.randomUUID(),text);}return;}
    if(e.type==='response.created'){response=e.response?.id||crypto.randomUUID();generating=true;currentKey=response;status('小 D 正在回应…');return;}
    if(e.type==='input_audio_buffer.speech_started'){interrupt(false);status('正在听你说…');return;}
    if(e.type==='input_audio_buffer.speech_stopped'){status('小 D 正在理解…');return;}
    if(e.type==='conversation.item.input_audio_transcription.completed'){record('user',e.item_id||crypto.randomUUID(),e.transcript);return;}
    if(e.type==='conversation.item.input_audio_transcription.failed'){status('这一句未能生成字幕，对话可继续。');return;}
    const id=e.response_id||e.response?.id||response;
    if(suppressed.has(id))return;
    if(e.type==='response.audio.delta'){try{play(e.delta);}catch(error){console.error('实时音频片段处理失败',error);status('这一段音频处理失败，对话连接仍保持。');}return;}
    if(['response.audio_transcript.delta','response.text.delta'].includes(e.type))record('assistant',id,e.delta,{append:true,channel:e.type.includes('audio_')?'audio':'text'});
    if(['response.audio_transcript.done','response.text.done'].includes(e.type))record('assistant',id,e.transcript||e.text,{channel:e.type.includes('audio_')?'audio':'text'});
    if(e.type==='response.done'){generating=false;pendingPcmByte=null;if(!sources.size)status(muted?'麦克风已关闭，可以打字。':'我在听，可以接着说。');}
  }
  async function start(){
    if(active||!config?.ready)return;
    const mine=++epoch;active=true;ready=false;muted=false;generating=false;micBackpressureNotice=false;suppressed.clear();response=null;currentKey=null;controls();status('正在请求麦克风并建立连接…');
    window.GuideRealtimeBridge?.begin(el('rtMode').value);
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Error('当前浏览器无法使用麦克风，请用 Chrome 或 Edge 打开本机地址。');
      const audio=new AudioContext();context=audio;await audio.resume();if(mine!==epoch)return;
      const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(mine!==epoch){media.getTracks().forEach(t=>t.stop());return;}stream=media;
      await audio.audioWorklet.addModule('/pcm-worklet.js');if(mine!==epoch)return;
      micSource=audio.createMediaStreamSource(media);micNode=new AudioWorkletNode(audio,'guide-pcm');silentGain=audio.createGain();silentGain.gain.value=0;
      micSource.connect(micNode);micNode.connect(silentGain);silentGain.connect(audio.destination);
      micNode.port.onmessage=({data})=>{
        if(!ready||mine!==epoch)return;
        if(ws.bufferedAmount>128000){if(!micBackpressureNotice){status('网络暂时繁忙，已短暂停送麦克风音频；实时连接仍保持。');micBackpressureNotice=true;}return;}
        if(micBackpressureNotice){micBackpressureNotice=false;status('连接已恢复，我在听。');}
        const bytes=new Uint8Array(data);if(muted)bytes.fill(0);
        let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
        send({type:'input_audio_buffer.append',audio:btoa(binary)});
      };
      const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/realtime`);ws=socket;
      timeout=setTimeout(()=>{if(mine===epoch)stop('连接超时，请检查 Key、地域、权限和网络。');},25000);
      socket.onopen=()=>{if(mine===epoch)send({type:'bridge.start',mode:el('rtMode').value});};
      socket.onmessage=event=>{if(mine!==epoch)return;try{onEvent(JSON.parse(event.data));}catch(error){console.error('实时消息处理失败',error);status('收到一条无法处理的实时消息，对话连接仍保持。');}};
      socket.onerror=()=>{if(mine===epoch)stop('连接失败，请检查本地服务和网络。');};
      socket.onclose=event=>{if(mine===epoch)stop(`实时连接意外关闭（代码 ${event.code}${event.reason?`：${event.reason.slice(0,100)}`:''}），麦克风已关闭。`);};
      for(const track of media.getTracks())track.onended=()=>{if(mine===epoch)stop('麦克风已断开，请重新选择设备并开始对话。');};
    }catch(e){if(mine===epoch)stop(e.name==='NotAllowedError'?'麦克风权限未开启。允许后可重新开始。':e.message||'启动失败，请检查麦克风和网络。');}
  }
  function stop(message='对话已结束，麦克风已关闭。'){
    const wasActive=active;++epoch;active=false;ready=false;generating=false;clearTimeout(timeout);stopPlayback();
    if(ws){ws.onclose=null;ws.onerror=null;ws.onmessage=null;ws.onopen=null;ws.close();ws=null;}
    if(micNode){micNode.port.onmessage=null;micNode.disconnect();micNode=null;}micSource?.disconnect();silentGain?.disconnect();micSource=null;silentGain=null;
    stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});stream=null;
    if(context){context.close().catch(()=>{});context=null;}
    if(wasActive)window.GuideRealtimeBridge?.end();controls();status(message);
  }
  el('rtOpen').onclick=()=>open();el('rtSettings').onclick=settings;el('rtStart').onclick=start;el('rtStop').onclick=()=>stop();
  el('rtClose').onclick=()=>{stop();el('rtPanel').hidden=true;};
  el('rtMute').onclick=()=>{muted=!muted;stream?.getAudioTracks().forEach(t=>{t.enabled=!muted&&!document.hidden;});controls();status(muted?'麦克风已关闭，可以打字。':'麦克风已开启，我在听。');};
  el('rtInterrupt').onclick=()=>interrupt();
  el('rtConfigForm').onsubmit=e=>{e.preventDefault();save();};el('rtForget').onclick=()=>save(true);
  const closeSettings=()=>{el('rtKey').value='';el('rtConfig').close();};el('rtConfigClose').onclick=closeSettings;el('rtConfig').addEventListener('cancel',()=>{el('rtKey').value='';});
  el('rtTextForm').onsubmit=e=>{e.preventDefault();const text=el('rtText').value.trim();if(!ready||!text)return;interrupt();send({type:'bridge.text',text});record('user',crypto.randomUUID(),text);el('rtText').value='';};
  el('rtClear').onclick=()=>{if(active){status('请先结束对话，再清空文字记录。');return;}rows.clear();records=[];el('rtTranscript').replaceChildren();};
  el('rtExport').onclick=()=>{
    const text=records.map(r=>`${r.role==='user'?'你':'小 D'}：${r.text}${r.interrupted?'（已打断，部分内容可能未播出）':''}`).join('\n\n');
    if(!text){status('还没有可导出的文字记录。');return;}
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='小D对话记录.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  addEventListener('pagehide',()=>stop());document.addEventListener('visibilitychange',()=>{if(!active)return;stream?.getAudioTracks().forEach(t=>{t.enabled=!muted&&!document.hidden;});if(document.hidden)status('页面进入后台，麦克风暂时静音；实时连接保持。');else status(muted?'麦克风已关闭，可以打字。':'页面已恢复，实时连接正常，我在听。');});
  function say(text){if(!ready){open('general',{autostart:true,prompt:text});return;}if(generating||sources.size)interrupt();send({type:'bridge.text',text});record('user',crypto.randomUUID(),text);}
  window.RealtimeGuide={open,say,interrupt:()=>interrupt(),stop,get configured(){return !!config?.ready},get active(){return active},get speaking(){return sources.size>0}};
  refreshConfig();
})();
