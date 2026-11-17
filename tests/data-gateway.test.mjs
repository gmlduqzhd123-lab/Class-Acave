import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../lib/data-gateway.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {handleDataGateway,signGateway}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const secret='gateway-test-only-'.repeat(4),mailSecret='mail-test-only-'.repeat(4);
function environment(){const calls=[];return{calls,env:{ARCHIVE_GATEWAY_SECRET:secret,WORKSPACE_OWNER_EMAIL:'owner@example.com',INVITE_MAIL_SECRET:mailSecret,DB:{prepare(sql){const item={sql};calls.push(item);return{bind(...params){item.params=params;return this;},async first(){return{value:1};},async all(){return{results:[{value:1}],success:true};},async run(){return{meta:{changes:1},success:true};},async raw(){return[[1]];}};},async batch(items){return items.map(()=>({results:[{value:1}],success:true}));}}}};}
async function request(payload,time=String(Date.now())){const body=JSON.stringify(payload);return new Request('https://example.com/_archive/data',{method:'POST',body,headers:{'x-archive-time':time,'x-archive-signature':await signGateway(time+'\n'+body,secret)}});}
test('unsigned forged stale and tampered requests never reach D1',async()=>{
 const {calls,env}=environment();
 assert.equal((await handleDataGateway(new Request('https://example.com/_archive/data',{method:'POST',body:'{}'}),env)).status,401);
 assert.equal((await handleDataGateway(await request({operation:'config'},'1000000000000'),env)).status,401);
 const original=await request({operation:'config'});assert.equal((await handleDataGateway(new Request(original,{body:'{"operation":"database"}'}),env)).status,401);
 assert.equal(calls.length,0);
});
test('configuration response never exports the signing secrets',async()=>{
 const {env}=environment();const response=await handleDataGateway(await request({operation:'config'}),env);assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('owner@example.com'));assert.ok(!text.includes(secret)&&!text.includes(mailSecret));
});
test('authenticated database calls retain bound values and D1 result shape',async()=>{
 const {env,calls}=environment();const response=await handleDataGateway(await request({operation:'database',statements:[{sql:'SELECT ? value',params:['quoted \' value'],method:'all'}]}),env);assert.equal(response.status,200);assert.deepEqual((await response.json()).results,[{value:1}]);assert.deepEqual(calls[0].params,["quoted ' value"]);
});
test('authenticated mail signing signs only the supplied payload without exporting the key',async()=>{
 const {env}=environment();const response=await handleDataGateway(await request({operation:'sign-mail',payload:'test'}),env);assert.equal((await response.json()).signature,await signGateway('test',mailSecret));
});
test('invalid operations and excessive statement batches are rejected',async()=>{
 const {env,calls}=environment();assert.equal((await handleDataGateway(await request({operation:'invalid'}),env)).status,400);assert.equal((await handleDataGateway(await request({operation:'database',statements:Array(101).fill({sql:'SELECT 1',params:[],method:'all'})}),env)).status,400);assert.equal(calls.length,0);
});
