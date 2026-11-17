import {signGateway} from './data-gateway';
export type Runtime=Cloudflare.Env&{signInvitationPayload?:(payload:string)=>Promise<string>};
export async function gatewayCall(data:unknown):Promise<any>{
 const url=process.env.ARCHIVE_GATEWAY_URL,secret=process.env.ARCHIVE_GATEWAY_SECRET;
 if(!url||!secret)throw new Error('자료 저장소 연결이 준비되지 않았습니다.');
 const body=JSON.stringify(data),timestamp=String(Date.now());
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-archive-time':timestamp,'x-archive-signature':await signGateway(timestamp+'\n'+body,secret)},body,cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('자료 저장소 연결을 확인해 주세요.');
 return response.json();
}
function remoteDatabase():D1Database{
 const statement=(sql:string,params:unknown[]=[])=>({
  bind(...values:unknown[]){return statement(sql,values);},
  all(){return gatewayCall({operation:'database',statements:[{sql,params,method:'all'}]});},
  run(){return gatewayCall({operation:'database',statements:[{sql,params,method:'run'}]});},
  async first(column?:string){const row=await gatewayCall({operation:'database',statements:[{sql,params,method:'first'}]});return column?row?.[column]??null:row;},
  raw(options?:{columnNames?:boolean}){return gatewayCall({operation:'database',statements:[{sql,params,method:'raw'}],columnNames:options?.columnNames});},
  _entry:{sql,params,method:'all'},
 });
 const database={prepare:statement,batch(items:ReturnType<typeof statement>[]){return gatewayCall({operation:'database',batch:true,statements:items.map(item=>item._entry)});},withSession(){return database;}};
 return database as unknown as D1Database;
}
let runtimePromise:Promise<Runtime>|undefined;
export function getRuntime():Promise<Runtime>{
 if(!runtimePromise)runtimePromise=(async()=>{
  if(!process.env.VERCEL&&process.env.ARCHIVE_TEST_TOKEN&&process.env.ARCHIVE_TEST_DB_PATH){
   const {createLocalDatabase}=await import('./sqlite-test-d1');
   return{DB:createLocalDatabase(process.env.ARCHIVE_TEST_DB_PATH),WORKSPACE_OWNER_EMAIL:'seedy@sites.test',WORKSPACE_INVITE_EMAILS:'["colleague@sites.test","second@sites.test"]',APP_MANAGED_INVITES:'enabled'};
  }
  const config=await gatewayCall({operation:'config'});
  return{...config,DB:remoteDatabase(),signInvitationPayload:async(payload:string)=>(await gatewayCall({operation:'sign-mail',payload})).signature};
 })().catch(error=>{runtimePromise=undefined;throw error;});
 return runtimePromise;
}
