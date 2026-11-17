export type MailStatus='pending'|'sending'|'sent'|'failed'|'unknown'|'not_configured';
export type MailResult={status:MailStatus;sentAt:string|null;message:string};
type MailRow={email:string;request_id:string;status:MailStatus;attempts:number;updated:string;sent_at:string|null;error:string|null};
type MailConfig={INVITE_MAIL_URL?:string;INVITE_MAIL_SECRET?:string;signInvitationPayload?:(payload:string)=>Promise<string>};
const messages:Record<MailStatus,string>={pending:'메일 발송을 준비하고 있습니다.',sending:'초대 메일을 발송하고 있습니다.',sent:'초대 메일을 발송했습니다. 받지 못했다면 스팸함도 확인해 주세요.',failed:'메일을 보내지 못했습니다. 잠시 후 다시 보내거나 초대 안내를 복사해 전달해 주세요.',unknown:'발송 결과를 확인하지 못했습니다. 중복 발송을 막기 위해 같은 요청의 결과만 다시 확인합니다.',not_configured:'초대는 등록됐지만 Gmail 연결이 아직 완료되지 않아 메일을 보내지 못했습니다. 초대 안내를 복사해 전달할 수 있습니다.'};
export function mailConfigured(config:MailConfig){return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.INVITE_MAIL_URL||'')&&((config.INVITE_MAIL_SECRET?.length||0)>=32||typeof config.signInvitationPayload==='function');}
function result(row:Pick<MailRow,'status'|'sent_at'>):MailResult{return{status:row.status,sentAt:row.sent_at,message:messages[row.status]};}
export async function sendInvitationMail(db:D1Database,email:string,config:MailConfig,resend=false,transport:typeof fetch=fetch):Promise<MailResult>{
 const now=new Date().toISOString();
 await db.prepare("INSERT OR IGNORE INTO invitation_mail (email,request_id,status,attempts,updated) VALUES (?,?,'pending',0,?)").bind(email,crypto.randomUUID(),now).run();
 let row=await db.prepare('SELECT * FROM invitation_mail WHERE email=?').bind(email).first<MailRow>();
 if(!row)throw new Error('메일 기록을 만들지 못했습니다.');
 if(row.status==='sent'){
  if(!resend)return result(row);
  if(Date.now()-Date.parse(row.updated)<60000)return{...result(row),message:'방금 메일을 보냈습니다. 다시 보내기는 1분 후에 이용해 주세요.'};
  const fresh=crypto.randomUUID();
  await db.prepare("UPDATE invitation_mail SET request_id=?,status='pending',attempts=0,sent_at=NULL,error=NULL WHERE email=? AND request_id=? AND status='sent'").bind(fresh,email,row.request_id).run();
  row=(await db.prepare('SELECT * FROM invitation_mail WHERE email=?').bind(email).first<MailRow>())!;
 }
 if(row.status==='sending'&&Date.now()-Date.parse(row.updated)<60000)return result(row);
 if(!mailConfigured(config)){
  await db.prepare("UPDATE invitation_mail SET status='not_configured',error='configuration_missing',updated=? WHERE email=? AND request_id=? AND status!='sent'").bind(now,email,row.request_id).run();
  return result({status:'not_configured',sent_at:null});
 }
 if(row.attempts>0&&row.status==='failed'&&Date.now()-Date.parse(row.updated)<30000)return{...result(row),message:'메일을 보내지 못했습니다. 30초 후 다시 시도해 주세요.'};
 const claimed=await db.prepare("UPDATE invitation_mail SET status='sending',attempts=attempts+1,updated=?,error=NULL WHERE email=? AND request_id=? AND status=? AND updated=?").bind(now,email,row.request_id,row.status,row.updated).run();
 if(!claimed.meta.changes){const current=await db.prepare('SELECT * FROM invitation_mail WHERE email=?').bind(email).first<MailRow>();return result(current||{status:'sending',sent_at:null});}
 const appUrl=process.env.BETTER_AUTH_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:undefined);
 const payload=JSON.stringify({id:row.request_id,email,timestamp:Date.now(),...(appUrl?{appUrl}: {})});
 const signature=config.signInvitationPayload?await config.signInvitationPayload(payload):await(async()=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.INVITE_MAIL_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,'0')).join('');})();
 let status:MailStatus='unknown',error='response_unknown';
 try{
  const response=await transport(config.INVITE_MAIL_URL!,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature}),redirect:'follow',signal:AbortSignal.timeout(25000)});
  const body=await response.json() as {status?:string;code?:string};
  if(response.ok&&body.status==='sent'){status='sent';error='';}
  else if(response.ok&&body.status==='failed'){status='failed';error=['quota','authorization','configuration','invalid_request'].includes(body.code||'')?body.code!:'provider_rejected';}
  else if(response.ok&&body.status==='unknown'){error='provider_unknown';}
 }catch{error='network_unknown';}
 const finished=new Date().toISOString(),sentAt=status==='sent'?finished:null;
 await db.prepare('UPDATE invitation_mail SET status=?,sent_at=?,updated=?,error=? WHERE email=? AND request_id=? AND status=\'sending\'').bind(status,sentAt,finished,error||null,email,row.request_id).run();
 return result({status,sent_at:sentAt});
}
