/* Browser-only speech. No model, API key, external SDK, or fabricated AI response. */
window.GuideVoice = function(onInput, onState) {
  const synth=window.speechSynthesis;
  let current=null,token=0,recognition=null,enabled=false,running=false,blocked=false,retry=null,selected='',muted=false,voices=[],suspended=false;
  const normalize=t=>t.toLowerCase().replace(/[\s，。！？、,.!?“”‘’]/g,'');
  function refresh(){voices=(synth?.getVoices()||[]).filter(v=>/^zh|cmn/i.test(v.lang));return voices}
  function best(){return voices.find(v=>v.voiceURI===selected)||voices.find(v=>/xiaoxiao|晓晓|xiaoyi|晓伊/i.test(v.name))||voices.find(v=>/ting.?ting|婷婷/i.test(v.name)&&/premium|enhanced|高质量/i.test(v.name))||voices.find(v=>/ting.?ting|婷婷|mei.?jia|美嘉|siri/i.test(v.name))||voices.find(v=>v.lang==='zh-CN')||voices[0]}
  refresh();if(synth)synth.addEventListener('voiceschanged',()=>{refresh();window.dispatchEvent(new Event('guidevoiceschanged'))});
  function cancel(){token++;synth?.cancel();current=null}
  function say(text,done,kind='guide'){
    cancel();const id=token,c=current={text,done,kind,elapsed:0,duration:Math.max(2200,text.length*195),index:0,native:false,failed:false};
    if(muted||!synth)return;
    const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.voice=best()||null;u.rate=.99;u.pitch=1.09;u.volume=.94;
    u.onstart=()=>{if(token===id&&current===c){c.native=true;window.dispatchEvent(new CustomEvent('guidespeechstart',{detail:{kind}}))}};
    u.onboundary=e=>{if(current===c)c.index=Math.max(c.index,e.charIndex)};
    u.onend=()=>{if(current===c&&id===token)finish()};
    u.onerror=e=>{if(current===c&&!/canceled|interrupted/.test(e.error)){c.failed=true;c.native=false}};
    synth.speak(u);
  }
  function finish(){const c=current;if(!c)return;current=null;token++;synth?.cancel();c.done?.()}
  function tick(dt){if(!current)return;current.elapsed+=dt;const c=current;if((muted||!synth||c.failed)&&c.elapsed>=c.duration)finish();else if(c.elapsed>c.duration*2+8000)finish()}
  function capture(){if(!current)return null;const c=current;let index=c.index||Math.floor(Math.min(.9,c.elapsed/c.duration)*c.text.length);while(index>0&&!/[，。！？；]/.test(c.text[index-1]))index--;const saved={text:c.text.slice(index),done:c.done,kind:c.kind};cancel();return saved}
  function resume(saved){if(saved)say(saved.text,saved.done,saved.kind)}
  function startRecognition(){
    clearTimeout(retry);if(suspended||!enabled||running||blocked||document.hidden)return;
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){onState('unsupported','此浏览器暂不支持语音识别，请用 Chrome 打开本地预览');return}
    if(!recognition){recognition=new SR();recognition.lang='zh-CN';recognition.continuous=true;recognition.interimResults=false;
      recognition.onstart=()=>{running=true;onState('listening','正在聆听 · 说“小 D”随时提问')};
      recognition.onresult=e=>{if(suspended)return;for(let i=e.resultIndex;i<e.results.length;i++){if(!e.results[i].isFinal)continue;const text=e.results[i][0].transcript.trim();if(!text)continue;
        const clean=normalize(text),spoken=normalize(current?.text||'');
        if(spoken&&clean.length>3&&(spoken.includes(clean)||clean.includes(spoken)))continue;
        if(current?.native&&!/小\s*[dD迪帝弟]|晓迪|请问|我想问|等一下|暂停|停止/.test(text))continue;
        onInput(text);
      }};
      recognition.onerror=e=>{if(e.error==='no-speech'||e.error==='aborted')return;if(e.error==='not-allowed'||e.error==='service-not-allowed'){blocked=true;enabled=false;onState('blocked','请在浏览器中允许麦克风，再点击开启语音')}else{onState('error','语音识别暂不可用，正在重试')}};
      recognition.onend=()=>{running=false;if(enabled&&!blocked&&!suspended)retry=setTimeout(startRecognition,900)};
    }
    try{recognition.start()}catch{retry=setTimeout(startRecognition,1200)}
  }
  function arm(){if(suspended)return;enabled=true;blocked=false;onState('starting','正在开启语音…');startRecognition()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){recognition?.abort();running=false}else if(enabled)startRecognition()});
  addEventListener('pagehide',()=>{enabled=false;clearTimeout(retry);recognition?.abort();cancel()});
  return {say,cancel,tick,capture,resume,finish,arm,refresh,suspend(){suspended=true;enabled=false;clearTimeout(retry);recognition?.abort();running=false;return capture()},unsuspend(){suspended=false;},get voices(){return voices},get current(){return current},get speaking(){return !!current},get listening(){return running},get muted(){return muted},set muted(v){muted=!!v;const saved=capture();resume(saved)},select(id){selected=id},get selected(){return selected},autoArm(){navigator.permissions?.query({name:'microphone'}).then(p=>{if(p.state==='granted')arm()}).catch(()=>{})}};
};
