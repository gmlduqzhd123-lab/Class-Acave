import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readdirSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
const prefix=['--import',new URL('./sites-env.mjs',import.meta.url).href,wrangler];
mkdirSync(path.join(root,'.wrangler'),{recursive:true});
const state=mkdtempSync(path.join(root,'.wrangler/api-ci-'));
async function run(args,options={}){
 const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,stdio:options.quiet?['ignore','pipe','pipe']:'inherit',env:options.env||process.env});
 let output='';if(options.quiet){child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});}
 await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{if(code===0)resolve();else reject(new Error(`Command failed (${code})\n${output.slice(-12000)}`));});});
}
for(const file of readdirSync(path.join(root,'drizzle')).filter(file=>/^\d+.*\.sql$/.test(file)).sort()){
 await run([...prefix,'d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to',state,'--file',path.join(root,'drizzle',file)],{quiet:true});
 console.log('Applied local test migration '+file);
}
const port=await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const address=probe.address();probe.close(error=>error?reject(error):resolve(address.port));});});
const base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[...prefix,'dev','--config','dist/server/wrangler.json','--local','--persist-to',state,'--ip','127.0.0.1','--inspector-port','0','--port',String(port),'--log-level','warn','--var','WORKSPACE_OWNER_EMAIL:seedy@sites.test','--var','WORKSPACE_INVITE_EMAILS:["colleague@sites.test","second@sites.test"]','--var','APP_MANAGED_INVITES:enabled','--var','INVITE_MAIL_URL:','--var','INVITE_MAIL_SECRET:'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let serverLog='',closed=false,serverError;
server.stdout.on('data',chunk=>{serverLog=(serverLog+chunk).slice(-16000);});
server.stderr.on('data',chunk=>{serverLog=(serverLog+chunk).slice(-16000);});
server.once('error',error=>{serverError=error;});
server.once('close',()=>{closed=true;});
try{
 const deadline=Date.now()+45000;let ready=false;
 while(Date.now()<deadline){
  if(serverError)throw serverError;if(closed)throw new Error('Local test Worker exited.\n'+serverLog);
  try{const response=await fetch(base+'/api/state',{signal:AbortSignal.timeout(1000)});if(response.status===401){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready)throw new Error('Local test Worker did not become ready.\n'+serverLog);
 await run(['tests/api.integration.mjs'],{env:{...process.env,ARCHIVE_TEST_URL:base}});
}finally{
 if(!closed){
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  else server.kill('SIGTERM');
  const deadline=Date.now()+5000;while(!closed&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
  if(!closed)server.kill('SIGKILL');
 }
}
