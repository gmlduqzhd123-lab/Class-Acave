import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,randomUUID} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const compiled=ts.transpileModule(readFileSync(new URL('../lib/invitation-mail.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {sendInvitationMail,mailConfigured}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const secret='test-only-mail-secret-'.repeat(3),url='https://script.google.com/macros/s/local-test/exec',config={INVITE_MAIL_SECRET:secret,INVITE_MAIL_URL:url};
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../drizzle/0002_high_inhumans.sql',import.meta.url),'utf8'));
 const db={prepare(sql){let params=[];return{bind(...args){params=args;return this;},async run(){const r=sqlite.prepare(sql).run(...params);return{meta:{changes:r.changes}};},async first(){return sqlite.prepare(sql).get(...params)||null;}};}};
 return {db,sqlite};
}
function bridge({quota=100,sendError=false}={}){
 const properties=new Map([['MAIL_SECRET',secret]]),sent=[];let locked=false;
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},Utilities:{Charset:{UTF_8:'utf8'},computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()]},MailApp:{getRemainingDailyQuota:()=>quota,sendEmail:mail=>{sent.push(mail);if(sendError)throw Error('uncertain');}},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})},console};
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../integrations/google-mail/Code.gs',import.meta.url),'utf8'),context);
 const invoke=envelope=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).text);
 const sign=data=>{const payload=JSON.stringify(data);return{payload,signature:createHmac('sha256',secret).update(payload).digest('hex')};};
 return{sent,invoke,sign,transport:async(_url,options)=>Response.json(invoke(JSON.parse(options.body)))};
}
const target=()=>({id:randomUUID(),email:'teacher@example.com',timestamp:Date.now()});
test('login mail uses signed app origin and rejects a foreign token destination',()=>{
 const b=bridge(),appUrl='https://archive.example.com',data={...target(),kind:'login',appUrl,loginUrl:appUrl+'/api/auth/magic-link/verify?token=local-test&callbackURL=%2F'};
 assert.equal(b.invoke(b.sign(data)).status,'sent');assert.match(b.sent[0].subject,/로그인 링크/);assert.ok(b.sent[0].body.includes(data.loginUrl));
 assert.equal(b.invoke(b.sign({...data,id:randomUUID(),loginUrl:'https://evil.example/api/auth/magic-link/verify?token=x'})).code,'invalid_request');assert.equal(b.sent.length,1);
 const invite={...target(),appUrl};assert.equal(b.invoke(b.sign(invite)).status,'sent');assert.ok(b.sent[1].body.includes(appUrl+'/?view=shared'));
});
test('bridge rejects unsigned tampered expired and multiple-recipient requests without sending',()=>{
 const b=bridge(),data=target();assert.equal(b.invoke({payload:JSON.stringify(data),signature:'0'.repeat(64)}).status,'failed');
 const changed=b.sign(data);changed.payload=JSON.stringify({...data,email:'attacker@example.com'});assert.equal(b.invoke(changed).code,'authorization');
 assert.equal(b.invoke(b.sign({...data,timestamp:0})).code,'invalid_request');
 assert.equal(b.invoke(b.sign({...data,email:'first@example.com,second@example.com'})).code,'invalid_request');assert.equal(b.sent.length,0);
});
test('bridge sends only fixed invitation template and deduplicates a repeated signed request',()=>{
 const b=bridge(),data=target(),envelope=b.sign(data);assert.equal(b.invoke(envelope).status,'sent');assert.equal(b.invoke(envelope).status,'sent');assert.equal(b.sent.length,1);
 assert.equal(b.sent[0].to,data.email);assert.match(b.sent[0].htmlBody,/수업서랍 열기/);assert.match(b.sent[0].body,/view=shared/);
 assert.equal(b.invoke(b.sign({...data,email:'another@example.com'})).status,'failed');assert.equal(b.sent.length,1);
});
test('bridge reports quota failure and never repeats an uncertain Gmail send',()=>{
 const quota=bridge({quota:0});assert.equal(quota.invoke(quota.sign(target())).code,'quota');assert.equal(quota.sent.length,0);
 const uncertain=bridge({sendError:true}),signed=uncertain.sign(target());assert.equal(uncertain.invoke(signed).status,'unknown');assert.equal(uncertain.invoke(signed).status,'unknown');assert.equal(uncertain.sent.length,1);
});
test('unconfigured provider preserves invitation state without claiming sent',async()=>{
 const {db,sqlite}=database();const r=await sendInvitationMail(db,'teacher@example.com',{},false,()=>assert.fail('must not call mail'));
 assert.equal(r.status,'not_configured');assert.equal(sqlite.prepare('SELECT attempts FROM invitation_mail').get().attempts,0);assert.equal(mailConfigured({...config,INVITE_MAIL_URL:'https://evil.example/exec'}),false);sqlite.close();
});
test('worker and bridge sign and send one message across concurrent and repeated invitation requests',async()=>{
 const {db,sqlite}=database(),b=bridge();const results=await Promise.all([sendInvitationMail(db,'teacher@example.com',config,false,b.transport),sendInvitationMail(db,'teacher@example.com',config,false,b.transport)]);
 assert.ok(results.some(r=>r.status==='sent'));assert.equal(b.sent.length,1);assert.equal((await sendInvitationMail(db,'teacher@example.com',config,false,b.transport)).status,'sent');assert.equal(b.sent.length,1);
 assert.equal((await sendInvitationMail(db,'teacher@example.com',config,true,b.transport)).status,'sent');assert.equal(b.sent.length,1,'cooldown blocks immediate resend');
 sqlite.prepare("UPDATE invitation_mail SET updated='2000-01-01T00:00:00.000Z'").run();await sendInvitationMail(db,'teacher@example.com',config,true,b.transport);assert.equal(b.sent.length,2,'explicit resend after cooldown sends a new invitation');sqlite.close();
});
test('response lost after Gmail accepted is resolved with the same delivery ID and no duplicate',async()=>{
 const {db,sqlite}=database(),b=bridge();let first=true;
 const transport=async(...args)=>{const response=await b.transport(...args);if(first){first=false;throw Error('connection lost');}return response;};
 assert.equal((await sendInvitationMail(db,'teacher@example.com',config,false,transport)).status,'unknown');assert.equal(b.sent.length,1);
 assert.equal((await sendInvitationMail(db,'teacher@example.com',config,true,transport)).status,'sent');assert.equal(b.sent.length,1);sqlite.close();
});
test('uncertain Gmail exception remains unknown and cannot be replayed into another message',async()=>{
 const {db,sqlite}=database(),b=bridge({sendError:true});assert.equal((await sendInvitationMail(db,'teacher@example.com',config,false,b.transport)).status,'unknown');
 assert.equal((await sendInvitationMail(db,'teacher@example.com',config,true,b.transport)).status,'unknown');assert.equal(b.sent.length,1);sqlite.close();
});
