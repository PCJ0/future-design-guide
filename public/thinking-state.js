export const phases={
  idle:['STANDBY / 00','AWAITING YOUR NEXT IDEA','静候灵感，等待唤醒','介绍你的企业，让我们从一个问题开始。',0],
  prepare:['INITIALIZING / 01','CONTEXT & SOURCE PREPARATION','唤醒引擎，汇聚资料','正在准备企业背景、项目与方法题录。',1],
  think:['REASONING / 02','ASSOCIATIONS IN MOTION','连接线索，探索可能','正在等待或接收模型分析，构建关联方向。',2],
  retrieve:['INVESTIGATING / 03','EVIDENCE IN FOCUS','循线检索，核对依据','正在查询项目与方法，核对可参考的资料。',3],
  synth:['SYNTHESIZING / 04','IDEAS TAKING SHAPE','收束灵感，形成答复','正在整理建议与配套内容。',4],
  complete:['COMPLETE / 05','READY FOR YOUR NEXT STEP','本轮完成，灵感已就绪','建议正在上方呈现，欢迎继续补充需求。',5],
  stopped:['PAUSED / —','SESSION INTERRUPTED','本轮已停止','等待你继续，或开始一次新的访谈。',-1],
  error:['INTERRUPTED / —','AWAITING RECOVERY','本轮暂未完成','请查看上方提示或调用详情，再重新尝试。',-1]
};
export function initialState(){return {phase:'idle',round:0,calls:0,chars:0,failed:0,finalizing:false};}
export function reduceEvent(s,e){
  const n={...s};
  if(e.type==='work_started'||e.type==='catalog_progress'||e.type==='catalog_ready')n.phase='prepare';
  if(e.type==='model_wait'){n.round=e.round||n.round;n.phase=n.finalizing?'synth':'think';}
  if(e.type==='thinking_started'||e.type==='thinking_progress'||e.type==='analysis'||e.type==='association')n.phase=n.finalizing?'synth':'think';
  if(e.type==='thinking_progress')n.chars=e.chars||0;
  if(e.type==='tool_start'){n.calls++;n.phase='retrieve';n.finalizing=false;}
  if(e.type==='tool_result'){n.phase='retrieve';if(e.failed)n.failed++;}
  if(e.type==='stage'&&/整理关联依据|整理建议|资料核验已完成/.test(e.text||'')){n.phase='synth';n.finalizing=true;}
  if(e.type==='answer_segments'||e.type==='done'){n.phase='synth';n.finalizing=true;}
  if(e.type==='error')n.phase='error';
  // Main presentation advances monotonically; actual repeated rounds remain in the trace.
  const before=phases[s.phase][4],after=phases[n.phase][4];
  if(before>=0&&after>=0&&after<before)n.phase=s.phase;
  return n;
}
