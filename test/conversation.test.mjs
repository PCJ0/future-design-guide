import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveConversation} from '../conversation.mjs';
test('失败轮保留用户已确认的品类和场景，排除不完整工具链',()=>{
  const messages=[{role:'system',content:'system'},{role:'user',content:'我要做垃圾桶'},{role:'assistant',content:'',reasoning_content:'private',tool_calls:[{}]},{role:'tool',content:'tool result'},{role:'user',content:'有宠物家庭使用'}];
  const saved=preserveConversation(messages);assert.deepEqual(saved,[{role:'user',content:'我要做垃圾桶'},{role:'user',content:'有宠物家庭使用'}]);assert.ok(!JSON.stringify(saved).includes('private'));
});
