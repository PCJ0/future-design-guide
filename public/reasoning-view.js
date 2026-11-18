// Provider-returned reasoning is plain text: live while working, opt-in after the final answer appears.
let reasoningPanelSequence=0;
export function createReasoningView(container,{scrollElement=null}={}){
  container.replaceChildren();
  const heading=document.createElement('p');heading.className='reasoning-heading thinking-placeholder';heading.setAttribute('role','status');heading.textContent='正在思考中...';
  const toggle=document.createElement('button');toggle.type='button';toggle.className='reasoning-toggle';toggle.hidden=true;
  const note=document.createElement('p');note.className='reasoning-note';note.textContent='以下为模型返回的思考文本，不是最终结论。';note.hidden=true;
  const body=document.createElement('div');body.className='reasoning-body';body.id=`reasoning-panel-${++reasoningPanelSequence}`;body.hidden=true;
  toggle.setAttribute('aria-controls',body.id);toggle.setAttribute('aria-expanded','false');
  const final=document.createElement('section');final.className='answer-final';final.hidden=true;
  const finalHeading=document.createElement('p');finalHeading.className='answer-final-heading';finalHeading.textContent='最终结果';
  const result=document.createElement('div');result.className='answer-final-content';final.append(finalHeading,result);container.append(heading,toggle,note,body,final);
  const calls=new Map();let chars=0,finished=false,mode='working',expanded=true;
  function call(event){const key=String(event.callId||'');if(!key)return null;if(calls.has(key))return calls.get(key);const section=document.createElement('section');section.className='reasoning-round';const label=document.createElement('p');label.className='reasoning-round-label';label.textContent=`${event.kind==='assessment'?'关联评估':'分析'} · ${typeof event.round==='number'?'第'+event.round+'轮':String(event.round||'本轮')}`;const text=document.createElement('div');text.className='reasoning-text';const value=document.createTextNode('');text.append(value);section.append(label,text);body.append(section);const item={section,label,text,value};calls.set(key,item);return item;}
  function status(text){heading.classList.remove('thinking-placeholder');heading.textContent=text;heading.removeAttribute('role');}
  function disclosure(){
    const hasText=chars>0;
    body.hidden=!hasText||!expanded;note.hidden=!hasText||!expanded;
    toggle.hidden=mode==='working'||!hasText;
    toggle.textContent=expanded?'收起思考过程':mode==='failed'?'展开已接收的思考过程':'展开思考过程';
    toggle.setAttribute('aria-expanded',String(hasText&&expanded));
  }
  toggle.onclick=()=>{if(mode==='working'||!chars)return;expanded=!expanded;disclosure();};
  return {
    result,
    event(event){
      if(!['reasoning_start','reasoning_delta','reasoning_end'].includes(event.type))return;
      const row=call(event);if(!row)return;
      if(event.type==='reasoning_delta'&&typeof event.text==='string'&&event.text){
        const follow=mode==='working'&&scrollElement&&scrollElement.scrollHeight-scrollElement.scrollTop-scrollElement.clientHeight<100;
        row.value.appendData(event.text);chars+=event.text.length;disclosure();
        if(follow)scrollElement.scrollTop=scrollElement.scrollHeight;
      }
      if(event.type==='reasoning_end'&&event.failed)row.section.dataset.interrupted='true';
    },
    wait(){
      if(mode!=='working')return;
      status('正在思考中... · 正在准备最终结果');
      if(!chars){note.textContent='本轮服务商未返回思考文本。';note.hidden=false;}
    },
    showResult(){
      if(mode==='working'){mode='result';expanded=false;}
      heading.hidden=true;disclosure();final.hidden=false;
    },
    finish(){finished=true;},
    fail(stopped){
      mode='failed';expanded=false;heading.hidden=false;status(stopped?'分析已停止':'本轮分析未完成');
      if(chars)note.textContent='以下为已接收的部分思考文本，本轮未完成。';
      disclosure();final.hidden=true;
    },
    get receivedChars(){return chars;},get completed(){return finished;}
  };
}
