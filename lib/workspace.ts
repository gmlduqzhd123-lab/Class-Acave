import type {ChatGPTUser} from '@/app/chatgpt-auth';
export const SPACE_ID='classroom';
export type WorkspaceContext={id:string;catalogOwner:string;isAdmin:boolean;userId:string;email:string;title:string};
function denied(message:string,status=403):never{throw Object.assign(new Error(message),{status});}
export async function workspaceFor(db:D1Database,user:ChatGPTUser,config:Cloudflare.Env):Promise<WorkspaceContext>{
  const ownerEmail=config.WORKSPACE_OWNER_EMAIL?.trim().toLowerCase();
  if(!ownerEmail)denied('공용 공간 설정이 준비되지 않았습니다.',503);
  const email=user.email.toLowerCase(),now=new Date().toISOString();
  let space=await db.prepare('SELECT * FROM workspaces WHERE id=?').bind(SPACE_ID).first<{owner_id:string;title:string}>();
  if(!space){
    if(email!==ownerEmail)denied('운영자가 공용 공간을 준비하고 있습니다. 잠시 후 다시 접속해 주세요.',503);
    await db.prepare('INSERT OR IGNORE INTO workspaces (id,owner_id,owner_email,title,created) VALUES (?,?,?,?,?)').bind(SPACE_ID,user.userId,email,'함께 쓰는 수업서랍',now).run();
    space=await db.prepare('SELECT * FROM workspaces WHERE id=?').bind(SPACE_ID).first<{owner_id:string;title:string}>();
  }
  if(!space)denied('공용 공간을 찾을 수 없습니다.',503);
  const isAdmin=email===ownerEmail&&space.owner_id===user.userId;
  if(isAdmin){
    let invited:string[]=[];
    try{const parsed=JSON.parse(config.WORKSPACE_INVITE_EMAILS||'[]');if(Array.isArray(parsed))invited=parsed.filter((e:unknown)=>typeof e==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0,100);}catch{denied('초대 계정 설정을 확인해 주세요.',503);}
    const statements=[db.prepare("INSERT OR IGNORE INTO members (email,user_id,name,role,status,added) VALUES (?,?,?,'owner','active',?)").bind(email,user.userId,user.displayName,now),...invited.map(e=>db.prepare("INSERT OR IGNORE INTO members (email,name,role,status,added) VALUES (?,'','member','active',?)").bind(e.toLowerCase(),now))];
    await db.batch(statements);
  }
  const member=await db.prepare('SELECT user_id,status,role FROM members WHERE email=?').bind(email).first<{user_id:string|null;status:string;role:string}>();
  if(!member||member.status!=='active')denied('초대된 교사만 이용할 수 있는 공간입니다. 운영자에게 접근 권한을 확인해 주세요.');
  if(member.user_id&&member.user_id!==user.userId)denied('로그인 계정의 연결 정보가 일치하지 않습니다. 운영자에게 문의해 주세요.');
  const bound=await db.prepare("UPDATE members SET user_id=?,name=?,last_seen=? WHERE email=? AND status='active' AND (user_id IS NULL OR user_id=?)").bind(user.userId,user.displayName,now,email,user.userId).run();
  if(!bound.meta.changes)denied('이 계정의 접근 권한이 변경되었습니다. 다시 로그인해 주세요.');
  return{id:SPACE_ID,catalogOwner:space.owner_id,isAdmin,userId:user.userId,email,title:space.title};
}
