export type GatewayConfig={WORKSPACE_OWNER_EMAIL?:string;WORKSPACE_INVITE_EMAILS?:string;APP_MANAGED_INVITES?:string;INVITE_MAIL_URL?:string};
export async function signGateway(value:string,secret:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function handleDataGateway(request:Request,env:Cloudflare.Env){
 if(request.method!=='POST'||!env.ARCHIVE_GATEWAY_SECRET||!env.DB)return json({error:'Not available'},404);
 const body=await request.text();if(body.length>4000000)return json({error:'Request too large'},413);
 const timestamp=request.headers.get('x-archive-time')||'',signature=request.headers.get('x-archive-signature')||'';
 if(!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>300000||!/^[a-f0-9]{64}$/.test(signature))return json({error:'Unauthorized'},401);
 const expected=await signGateway(timestamp+'\n'+body,env.ARCHIVE_GATEWAY_SECRET);
 let mismatch=expected.length^signature.length;for(let i=0;i<expected.length;i++)mismatch|=expected.charCodeAt(i)^(signature.charCodeAt(i)||0);
 if(mismatch)return json({error:'Unauthorized'},401);
 try{
  const data=JSON.parse(body);
  if(data.operation==='config')return json({WORKSPACE_OWNER_EMAIL:env.WORKSPACE_OWNER_EMAIL,WORKSPACE_INVITE_EMAILS:env.WORKSPACE_INVITE_EMAILS,APP_MANAGED_INVITES:env.APP_MANAGED_INVITES,INVITE_MAIL_URL:env.INVITE_MAIL_URL});
  if(data.operation==='sign-mail'){
   if(typeof data.payload!=='string'||data.payload.length>8000||!env.INVITE_MAIL_SECRET)return json({error:'Mail unavailable'},503);
   return json({signature:await signGateway(data.payload,env.INVITE_MAIL_SECRET)});
  }
  if(data.operation!=='database'||!Array.isArray(data.statements)||data.statements.length<1||data.statements.length>100)return json({error:'Invalid request'},400);
  const statements=data.statements.map((entry:{sql:string;params:unknown[];method:string})=>{
   if(typeof entry.sql!=='string'||entry.sql.length>100000||!Array.isArray(entry.params)||entry.params.length>100||!entry.params.every(p=>p===null||typeof p==='string'||typeof p==='number'))throw Error('Invalid statement');
   return env.DB!.prepare(entry.sql).bind(...entry.params);
  });
  if(data.batch)return json(await env.DB.batch(statements));
  if(statements.length!==1)return json({error:'Invalid request'},400);
  const statement=statements[0],method=data.statements[0].method;
  if(method==='first')return json(await statement.first());
  if(method==='raw')return json(await statement.raw(data.columnNames?{columnNames:true}:undefined));
  if(method==='run')return json(await statement.run());
  if(method==='all')return json(await statement.all());
  return json({error:'Invalid method'},400);
 }catch{return json({error:'Database request failed'},500);}
}
