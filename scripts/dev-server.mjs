import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachRealtime } from './realtime-server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.env.PORT || 5173);
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8' };
const server = http.createServer(async (req,res)=>{
  try{
    const url = new URL(req.url,'http://localhost');
    if(await realtime.handleHttp(req,res,url))return;
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const pathname = decodeURIComponent(url.pathname);
    const parts = pathname.split('/');
    if(parts.some(p=>p.startsWith('.') || p.includes('\\'))){res.writeHead(403);res.end('Forbidden');return;}
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
    const meta = await stat(file);
    if(!meta.isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Content-Length':meta.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD' ? undefined : await readFile(file));
  }catch(error){res.writeHead(error.code==='ENOENT'?404:400);res.end('Not found');}
});
const realtime = attachRealtime(server,{root:path.resolve(root,'..')});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port is busy. Close the other server or set PORT to a different number.':error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Guide is ready: http://localhost:${port}\nEdit files in dist, then refresh the browser. Press Ctrl+C to stop.`));
