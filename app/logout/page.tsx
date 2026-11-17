'use client';
import {authClient} from '@/lib/auth-client';
export default function Logout(){return <main className="access-gate"><div className="access-card"><span className="access-brand">수업서랍</span><h1>다른 계정으로 로그인</h1><button className="button primary" onClick={async()=>{await authClient.signOut();location.assign('/login'+location.search);}}>로그아웃하고 계정 변경</button></div></main>;}
