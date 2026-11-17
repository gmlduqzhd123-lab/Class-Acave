import LoginForm from './login-form';
import {safeRelativeReturnPath} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const params=await searchParams;return <LoginForm returnTo={safeRelativeReturnPath(typeof params.return_to==='string'?params.return_to:'/')} error={Boolean(params.error)}/>;}
