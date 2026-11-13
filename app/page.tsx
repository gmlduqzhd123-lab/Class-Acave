import ArchiveApp from './components/archive-app';
import {requireChatGPTUser} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireChatGPTUser('/');return <ArchiveApp name={user.fullName||'선생님'}/>;}
