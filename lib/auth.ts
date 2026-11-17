import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {magicLink} from 'better-auth/plugins/magic-link';
import {nextCookies} from 'better-auth/next-js';
import {drizzle} from 'drizzle-orm/d1';
import {authSchema} from '@/db/auth-schema';
import {getRuntime} from './runtime';
async function createAuth(){
  const runtime=await getRuntime();if(!runtime.DB)throw new Error('자료 저장소가 준비되지 않았습니다.');
  const database=runtime.DB;
  const baseURL=process.env.BETTER_AUTH_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:undefined);
  if(!baseURL||!process.env.BETTER_AUTH_SECRET)throw new Error('로그인 연결이 준비되지 않았습니다.');
  return betterAuth({
   baseURL,secret:process.env.BETTER_AUTH_SECRET,database:drizzleAdapter(drizzle(database),{provider:'sqlite',schema:authSchema,transaction:false}),
   emailAndPassword:{enabled:false},session:{expiresIn:60*60*24*7},rateLimit:{enabled:true,storage:'database',window:60,max:30},
   databaseHooks:{user:{create:{before:async user=>{const member=await database.prepare("SELECT name FROM members WHERE email=? AND status='active'").bind(user.email.toLowerCase()).first<{name:string}>();if(!member)return false;return{data:{...user,name:member.name||user.email.split('@')[0]}};}}}},
   plugins:[magicLink({storeToken:'hashed',expiresIn:600,rateLimit:{window:60,max:3},sendMagicLink:async({email,url})=>{
    const member=await database.prepare("SELECT email FROM members WHERE email=? AND status='active'").bind(email.toLowerCase()).first();if(!member)return;
    if(!process.env.VERCEL&&process.env.ARCHIVE_TEST_TOKEN&&process.env.ARCHIVE_TEST_MAIL_PATH){const{appendFile}=await import('node:fs/promises');await appendFile(process.env.ARCHIVE_TEST_MAIL_PATH,JSON.stringify({email,url})+'\n');return;}
    if(!runtime.INVITE_MAIL_URL||!runtime.signInvitationPayload)throw new Error('로그인 메일 연결이 준비되지 않았습니다.');
    const payload=JSON.stringify({id:crypto.randomUUID(),email:email.toLowerCase(),timestamp:Date.now(),kind:'login',loginUrl:url,appUrl:baseURL});
    const response=await fetch(runtime.INVITE_MAIL_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature:await runtime.signInvitationPayload(payload)}),signal:AbortSignal.timeout(25000)});
    const result=await response.json() as {status:string};if(!response.ok||result.status!=='sent')throw new Error('로그인 메일을 보내지 못했습니다.');
   }}),nextCookies()],
  });
}
let authPromise:ReturnType<typeof createAuth>|undefined;
export function getAuth(){return authPromise??=(createAuth().catch(error=>{authPromise=undefined;throw error;}));}
