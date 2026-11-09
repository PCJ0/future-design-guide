import {readFile,writeFile} from 'node:fs/promises';
import {deepseek} from './services.mjs';
const c=JSON.parse(await readFile(new URL('./.local/config.json',import.meta.url),'utf8'));
let stats,content='';
for await(const d of deepseek(c,[{role:'system',content:'这是思考模式核验。请认真分析后用简短中文答复。不要编造项目依据。'},{role:'user',content:'面对家庭宠物使用的垃圾桶，如何把防误触、气味控制、可清洁性与不伤害宠物之间的冲突抽象成可迁移的创新问题？给出两个方向及各自的失败条件，不超过300字。'}],undefined,AbortSignal.timeout(120000),{onTelemetry:s=>stats=s}))content+=d.content||'';
await writeFile(new URL('./.local/thinking-audit.json',import.meta.url),JSON.stringify({stats,content},null,2));
console.log(JSON.stringify(stats,null,2));console.log('ANSWER',content);
