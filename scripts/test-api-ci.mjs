import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readdirSync,readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
mkdirSync(path.join(root,'.sites-runtime'),{recursive:true});
const state=mkdtempSync(path.join(root,'.sites-runtime/api-ci-')),databasePath=path.join(state,'test.sqlite'),mailPath=path.join(state,'mail.jsonl');
const sqlite=new DatabaseSync(databasePath);
for(const file of readdirSync(path.join(root,'migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort())sqlite.exec(readFileSync(path.join(root,'migrations',file),'utf8'));
sqlite.close();
const port=await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(0,'127.0.0.1',()=>{const address=probe.address();probe.close(error=>error?reject(error):resolve(address.port));});});
const base=`http://127.0.0.1:${port}`,env={...process.env,ARCHIVE_TEST_URL:base,ARCHIVE_TEST_TOKEN:crypto.randomUUID(),ARCHIVE_TEST_DB_PATH:databasePath,ARCHIVE_TEST_MAIL_PATH:mailPath,BETTER_AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID(),BETTER_AUTH_URL:base};
delete env.VERCEL;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],env});
let serverLog='',closed=false,serverError;
server.stdout.on('data',c=>{serverLog=(serverLog+c).slice(-20000);});server.stderr.on('data',c=>{serverLog=(serverLog+c).slice(-20000);});server.once('error',e=>{serverError=e;});server.once('close',()=>{closed=true;});
try{
 const deadline=Date.now()+45000;let ready=false;
 while(Date.now()<deadline){if(serverError)throw serverError;if(closed)throw new Error('Local Next server exited.\n'+serverLog);try{const r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(1000)});if(r.status===401){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw new Error('Local server did not become ready.\n'+serverLog);
 for(const test of ['tests/api.integration.mjs','tests/auth.integration.mjs'])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[test],{cwd:root,windowsHide:true,stdio:'inherit',env});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error(test+' failed.\n'+serverLog)));});
}finally{if(!closed){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');}}
