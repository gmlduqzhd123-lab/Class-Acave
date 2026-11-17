import ArchiveApp from './components/archive-app';
import {getRuntime} from '@/lib/runtime';
import {requireChatGPTUser,chatGPTSignOutPath} from './chatgpt-auth';
import {workspaceFor} from '@/lib/workspace';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams,query=new URLSearchParams();
 for(const key of ['view','q','subject','kind']){const value=params[key];if(typeof value==='string')query.set(key,value.slice(0,200));}
 return <AuthenticatedHome returnTo={'/'+(query.size?'?'+query.toString():'')}/>;
}
async function AuthenticatedHome({returnTo}:{returnTo:string}){
 const user=await requireChatGPTUser(returnTo);
 try{
  const env=await getRuntime();
  if(!env.DB)throw new Error('unavailable');
  await workspaceFor(env.DB,user,env);
 }catch(error:unknown){
  const unavailable=!(error instanceof Error&&'status' in error&&error.status===403);
  return <main className="access-gate"><div className="access-card"><span className="access-brand">수업서랍</span><h1>{unavailable?'잠시 후 다시 접속해 주세요.':'초대받은 계정으로 로그인해 주세요.'}</h1><p>{unavailable?'공용 공간을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.':'이 공간은 운영자가 초대한 교사만 사용할 수 있습니다. 초대에 사용된 이메일로 로그인하거나 운영자에게 초대를 요청해 주세요.'}</p><p className="access-account">현재 로그인: {user.email}</p><a className="button primary" target="_top" href={chatGPTSignOutPath(returnTo)}>다른 계정으로 로그인</a><a className="button" href={returnTo}>다시 확인</a></div></main>;
 }
 return <ArchiveApp name={user.fullName||'선생님'}/>;
}
