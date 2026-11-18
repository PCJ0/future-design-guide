// Verified project-library migration only; never send Bearer credentials to arbitrary redirects.
export const LIBRARY_ORIGIN='https://haoshejiguan.com';
export const MCP_URL=LIBRARY_ORIGIN+'/inno/mcp/api';
export const LEGACY_MCP_URL='https://opendesign.cc/inno/mcp/api';
export function normalizeMcpUrl(value=MCP_URL){
  if(value===MCP_URL||value===LEGACY_MCP_URL)return MCP_URL;
  throw Error('项目库地址未获确认；只允许已核验的好设计项目库入口');
}
