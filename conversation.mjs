export function preserveConversation(messages){
  return messages.filter(m=>m.role==='user'||m.role==='assistant'&&!m.tool_calls).map(m=>({role:m.role,content:m.content}));
}
