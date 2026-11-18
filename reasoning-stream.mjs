// Relay the provider's returned reasoning text; no reconstruction from status or tool events.
import {randomUUID} from 'node:crypto';
export function createReasoningStream(send,{round,kind='analysis',callId=randomUUID(),interval=60}={}){
  let buffer='',timer=null,started=false,ended=false;
  const meta={callId,round,kind};
  function flush(){if(timer){clearTimeout(timer);timer=null;}if(!buffer)return;const text=buffer;buffer='';send('reasoning_delta',{...meta,text});}
  return {append(text){if(ended||typeof text!=='string'||!text)return;if(!started){started=true;send('reasoning_start',meta);}buffer+=text;if(!timer){timer=setTimeout(flush,interval);timer.unref?.();}},finish({failed=false}={}){if(ended)return;ended=true;flush();if(started)send('reasoning_end',{...meta,failed});}};
}
