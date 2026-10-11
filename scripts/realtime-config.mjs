import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const presets = [
  { id:'qwen-audio-3.1-realtime-plus', name:'Qwen-Audio 3.1 Realtime Plus · 自然语音首选', family:'audio', voice:'longanqian_v3.1' },
  { id:'qwen3.8-omni-flash-realtime', name:'Qwen3.8 Omni Flash Realtime · 多模态扩展', family:'omni', voice:'Tina' },
  { id:'qwen-audio-3.0-realtime-flash', name:'Qwen-Audio 3.0 Realtime Flash · 对照测试', family:'audio', voice:'longanqian' }
];
export const defaults = { model:presets[0].id, region:'cn-beijing', workspaceId:'', voice:'', turnMode:'smart', apiKey:'' };
export function validateConfig(input) {
  const c = Object.fromEntries(Object.keys(defaults).map(k=>[k, String(input[k] ?? defaults[k]).trim()]));
  if(!presets.some(p=>p.id===c.model)) throw new Error('请选择列表中已适配的实时语音模型。');
  if(!['cn-beijing','ap-southeast-1'].includes(c.region)) throw new Error('地域无效。');
  if(c.workspaceId && !/^[a-zA-Z0-9-]{1,100}$/.test(c.workspaceId)) throw new Error('Workspace ID 只能包含字母、数字和短横线。');
  if(c.voice && !/^[a-zA-Z0-9_-]{1,120}$/.test(c.voice)) throw new Error('音色 ID 格式无效。');
  if(!['smart','server'].includes(c.turnMode)) throw new Error('接话方式无效。');
  if(c.apiKey.length>512 || (c.apiKey&&!/^[a-zA-Z0-9_.-]+$/.test(c.apiKey))) throw new Error('API Key 格式无效，请检查输入。');
  return c;
}
export function publicConfig(c) {
  const {apiKey,...rest}=c;
  return {...rest,hasKey:!!apiKey,ready:!!apiKey&&!!c.workspaceId,presets};
}
export function endpoint(c) {
  if(!c.workspaceId || !c.apiKey) throw new Error('请先在连接设置中填写 API Key 和 Workspace ID。');
  return `wss://${c.workspaceId}.${c.region}.maas.aliyuncs.com/api-ws/v1/realtime?model=${encodeURIComponent(c.model)}`;
}
export function sessionConfig(c,instructions) {
  const preset=presets.find(p=>p.id===c.model);
  const labMediaTitles='由实时助手在服务端校验可打开的图片与视频标题。';
  const session={modalities:['text','audio'],instructions,voice:c.voice||preset.voice,
    tools:[
      {type:'function',function:{name:'search_lab_knowledge',description:'在本机实验室知识库中检索未来设计实验室的介绍、研究方向、技术能力、案例、合作与项目信息。用户询问这些事实时必须先调用。',parameters:{type:'object',properties:{query:{type:'string',description:'用户当前问题，保留关键实体与原始用词'}},required:['query']}}},
      {type:'function',function:{name:'open_lab_media',description:`用户询问某个具体项目并希望了解/介绍时打开对应项目图文页；明确要求查看、打开、展示、播放图片或视频时也调用。访客明确提出企业访谈、设计需求、产业问题或合作需求时，使用 kind=interview、title=企业需求访谈 打开访谈页面。标题必须从页面项目、图片或视频目录中选择；访谈入口使用规定标题。切换新素材时网页会停止旧视频。${labMediaTitles}`,parameters:{type:'object',properties:{kind:{type:'string',enum:['direction','project','image','video','interview'],description:'研究方向、项目图文页、图片、视频或企业需求访谈页面'},title:{type:'string',description:'用户关注的项目、研究方向、素材标题，或规定的访谈入口标题'}},required:['kind','title']}}}
    ],tool_choice:'auto',
    input_audio_format:'pcm',output_audio_format:'pcm',
    turn_detection:c.turnMode==='smart'?{type:preset.family==='audio'?'smart_turn':'semantic_vad'}:
      {type:'server_vad',threshold:0.5,silence_duration_ms:800}};
  if(preset.family==='omni') session.input_audio_transcription={model:'qwen3-asr-flash-realtime'};
  return session;
}
export function createConfigStore(root) {
  const dir=path.join(root,'.local'),file=path.join(dir,'realtime.json');
  let queue=Promise.resolve();
  return {
    async read(){try{return validateConfig(JSON.parse(await readFile(file,'utf8')))}catch(e){if(e.code==='ENOENT')return {...defaults};throw new Error('本地配置文件无效，请检查 .local/realtime.json。')}},
    save(input){
      const run=queue.then(async()=>{
        const old=await this.read();
        const c=validateConfig({...old,...input,apiKey:input.clearKey?'':(input.apiKey||old.apiKey)});
        await mkdir(dir,{recursive:true});
        await writeFile(file+'.tmp',JSON.stringify(c,null,2)+'\n',{mode:0o600});
        await rename(file+'.tmp',file);
        return c;
      });
      queue=run.catch(()=>{});return run;
    }
  };
}
