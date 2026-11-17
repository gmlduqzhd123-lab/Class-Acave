import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getAuth} from '@/lib/auth';
import {getRuntime} from '@/lib/runtime';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
 const h=await headers();
 // Only the isolated local harness accepts synthetic identities.
 if(!process.env.VERCEL&&process.env.ARCHIVE_TEST_TOKEN&&h.get('x-archive-test-token')===process.env.ARCHIVE_TEST_TOKEN){
  const userId=h.get('oai-authenticated-user-id'),email=h.get('oai-authenticated-user-email');if(!userId||!email)return null;
  const name=h.get('oai-authenticated-user-full-name');return{userId,email,displayName:name||email,fullName:name};
 }
 const session=await(await getAuth()).api.getSession({headers:h});
 if(!session?.user.emailVerified)return null;
 const email=session.user.email.toLowerCase(),{DB}=await getRuntime();
 const member=await DB!.prepare("SELECT user_id,name FROM members WHERE email=? AND status='active'").bind(email).first<{user_id:string|null;name:string}>();
 if(!member)return null;
 if(!member.user_id)await DB!.prepare("UPDATE members SET user_id=? WHERE email=? AND status='active' AND user_id IS NULL").bind(session.user.id,email).run();
 const bound=await DB!.prepare("SELECT user_id,name FROM members WHERE email=? AND status='active'").bind(email).first<{user_id:string;name:string}>();
 if(!bound?.user_id)return null;
 const fullName=bound.name||session.user.name||null;
 return{userId:bound.user_id,email,displayName:fullName||email,fullName};
}
export async function requireChatGPTUser(returnTo:string){const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
export function chatGPTSignInPath(returnTo:string){return '/login?return_to='+encodeURIComponent(safeRelativeReturnPath(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/logout?return_to='+encodeURIComponent(safeRelativeReturnPath(returnTo));}
export function safeRelativeReturnPath(value:string){try{const url=new URL(value,'https://app.local');if(!value.startsWith('/')||value.startsWith('//')||url.origin!=='https://app.local'||/^\/(?:login|logout|api\/auth)(?:\/|$)/.test(url.pathname))return '/';return url.pathname+url.search+url.hash;}catch{return '/';}}
