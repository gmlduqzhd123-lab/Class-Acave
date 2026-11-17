import {readFileSync,readdirSync} from 'node:fs';
import {createHash,createHmac} from 'node:crypto';
if(process.env.VERCEL_ENV!=='production'){console.log('Production data migration skipped.');process.exit(0);}
const endpoint=process.env.ARCHIVE_GATEWAY_URL,secret=process.env.ARCHIVE_GATEWAY_SECRET;
if(!endpoint||!secret)throw new Error('Production database environment is missing.');
async function query(statements,batch=false){const body=JSON.stringify({operation:'database',statements:statements.map(s=>({params:[],method:'all',...s})),batch}),time=String(Date.now());const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','x-archive-time':time,'x-archive-signature':createHmac('sha256',secret).update(time+'\n'+body).digest('hex')},body,signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('Production database migration request failed: '+response.status);return response.json();}
await query([{sql:'CREATE TABLE IF NOT EXISTS archive_schema_migrations (tag TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)'}]);
const applied=(await query([{sql:'SELECT tag,hash FROM archive_schema_migrations'}])).results;
const tables=(await query([{sql:"SELECT name FROM sqlite_master WHERE type='table'"}])).results.map(t=>t.name);
for(const name of ['sources','resources','collections','items','imports','workspaces','members','invitation_mail'])if(!tables.includes(name))throw new Error('Existing archive baseline is incomplete: '+name);
for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
 const sql=readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex'),previous=applied.find(m=>m.tag===file);
 if(previous){if(previous.hash!==hash)throw new Error('An applied migration was changed: '+file);continue;}
 const statements=sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 const legacy=Number(file.slice(0,4))<3;
 if(!legacy&&statements.some(s=>!/^CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX)\b/i.test(s)))throw new Error('Review non-additive migrations before production: '+file);
 await query([...(legacy?[]:statements.map(sql=>({sql}))),{sql:'INSERT INTO archive_schema_migrations (tag,hash,applied_at) VALUES (?,?,?)',params:[file,hash,Date.now()]}],true);
 console.log((legacy?'Recorded existing migration ':'Applied additive migration ')+file);
}
