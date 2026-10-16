import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml'};
export function startServer({port=8080, root=path.join(base,'dist/backus-ventas-pwa/browser'), state={}}={}) {
 const server=http.createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,'http://localhost'); const name=decodeURIComponent(url.pathname);
   state.requests?.push({path:name,time:Date.now()});
   if(name==='/data/precios.json' && state.priceDelay) await new Promise(r=>setTimeout(r,state.priceDelay));
   const relative=path.normalize(name).replace(/^[/\\]+/,'');
   let file=path.resolve(root,relative);
   if(!file.startsWith(path.resolve(root)+path.sep) && file!==path.resolve(root)){res.writeHead(403).end();return;}
   if(!path.extname(file))file=path.join(root,'index.html');
   const body=await fs.readFile(file);
   res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain'}).end('Recurso no encontrado');}
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {await startServer({port:Number(process.env.PORT??8080)});console.log('PWA de producción: http://localhost:'+(process.env.PORT??8080));}
