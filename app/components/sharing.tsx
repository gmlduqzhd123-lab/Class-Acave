'use client';
import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {Users,UserPlus,Folder,ArrowUpRight,Copy,LockKeyhole,Check,LoaderCircle,Mail} from 'lucide-react';
import type {MailResult} from '@/lib/invitation-mail';
import Modal from './modal';
import {api} from '@/lib/archive';
import type {Collection} from '@/lib/archive';

export function SharedCollections({collections,onOpen}:{collections:Collection[];onOpen:(id:string)=>void}){
 if(!collections.length)return <div className="empty-state"><Users size={43}/><h2>동료의 수업 아이디어를 함께 모아요.</h2><p>내 자료 모음에서 ‘공유 설정’을 켜면<br/>초대된 동료에게 읽기 전용으로 공유됩니다.</p></div>;
 return <div className="collection-grid">{collections.map((c,i)=><button key={c.id} className={`collection-card folder-tone-${i%3}`} onClick={()=>onOpen(c.id)}><div className="folder-graphic"><Folder size={43} strokeWidth={1.3}/><span className="sharing-badge"><Users size={12}/>{c.canEdit?'내가 공유함':'읽기 전용'}</span></div><h2>{c.title}</h2><p>{c.description||'동료 교사가 공유한 수업 자료 모음'}</p><footer><span>{c.ownerName||'동료 교사'} · {c.count}개 자료</span><ArrowUpRight size={17}/></footer></button>)}</div>;
}

export function ShareDialog({collection,onClose,onSaved}:{collection:Collection;onClose:()=>void;onSaved:()=>Promise<void>}){
 const [shared,setShared]=useState(Boolean(collection.shared)),[description,setDescription]=useState(collection.description),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[saved,setSaved]=useState(Boolean(collection.shared));
 async function save(){setBusy(true);setMessage('');try{await api('collections/'+collection.id,{action:'share',shared,description});setSaved(shared);await onSaved();setMessage(shared?'초대된 동료에게 공유했어요.':'이제 나만 볼 수 있어요.');}catch(e:any){setMessage(e.message);}finally{setBusy(false);}}
 async function copy(){try{await navigator.clipboard.writeText(location.origin+'/?'+new URLSearchParams({view:'collection:'+collection.id}));setMessage('공유 주소를 복사했어요. 초대된 교사만 열 수 있습니다.');}catch{setMessage('주소를 복사하지 못했습니다. 공유 주소를 직접 복사해 주세요.');}}
 return <Modal title="모음 공유 설정" onClose={onClose} locked={busy}><div className="share-options"><label className={!shared?'chosen':''}><input type="radio" name="sharing" checked={!shared} onChange={()=>setShared(false)}/><LockKeyhole size={20}/><span>나만 보기<small>내 모음과 개인 메모를 비공개로 보관해요.</small></span></label><label className={shared?'chosen':''}><input type="radio" name="sharing" checked={shared} onChange={()=>setShared(true)}/><Users size={20}/><span>초대된 동료와 공유<small>자료와 순서를 읽기 전용으로 함께 봐요.</small></span></label></div><label className="field-label">동료에게 전할 말<textarea className="share-description" rows={3} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="수업 대상, 활용 순서, 준비할 점을 적어보세요."/></label><div className="notice">개인 준비 메모는 공유되지 않습니다. 동료는 모음을 복사해 따로 편집할 수 있으며, 공유를 해제해도 이미 복사한 모음은 동료의 자료함에 남습니다.</div><button className="button primary full" onClick={save} disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>}공유 설정 저장</button>{saved?<div className="share-link-area"><input aria-label="모음 공유 주소" readOnly value={typeof location==='undefined'?'':location.origin+'/?'+new URLSearchParams({view:'collection:'+collection.id})}/><button className="button" onClick={copy}><Copy size={15}/>주소 복사</button></div>:null}{message?<p className="sharing-message" role="status">{message}</p>:null}</Modal>;
}

type Member={email:string;name:string;role:string;status:string;last_seen:string|null;mail_status:MailResult['status']|null;mail_sent_at:string|null};
type Invitation={email:string;result:'invited'|'already_invited'|'restored';mail?:MailResult};
type TeamResponse={members:Member[];invitationEnabled:boolean;invitation?:Invitation;emailEnabled:boolean;mail?:MailResult};
const mailLabels:Record<MailResult['status'],string>={pending:'메일 준비 중',sending:'메일 발송 중',sent:'초대 메일 발송 완료',failed:'메일 발송 실패',unknown:'발송 결과 확인 필요',not_configured:'메일 연결 필요'};
export function TeamPanel({isAdmin}:{isAdmin:boolean}){
 const [members,setMembers]=useState<Member[]>([]),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const [email,setEmail]=useState(''),[enabled,setEnabled]=useState(false),[invitation,setInvitation]=useState<Invitation|null>(null);
 const [emailEnabled,setEmailEnabled]=useState(false);
 useEffect(()=>{if(!isAdmin)return;let live=true;api<TeamResponse>('team').then(r=>{if(live){setMembers(r.members);setEnabled(r.invitationEnabled);setEmailEnabled(r.emailEnabled);}}).catch(e=>{if(live)setMessage(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[isAdmin]);
 async function invite(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!enabled)return;setBusy('invite');setMessage('');setInvitation(null);
  try{const r=await api<TeamResponse>('team',{email,action:'invite'});setMembers(r.members);setInvitation(r.invitation||null);setEmail('');setEmailEnabled(r.emailEnabled);setMessage((r.invitation?.result==='already_invited'?'이미 초대된 이메일입니다. ':r.invitation?.result==='restored'?'다시 초대했어요. 기존 기록은 유지됩니다. ':'초대를 등록했어요. ')+(r.invitation?.mail?.message||''));}catch(e:unknown){setMessage(e instanceof Error?e.message:'초대를 등록하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy('');}
 }
 async function resend(member:Member){setBusy(member.email);setMessage('');try{const r=await api<TeamResponse>('team',{email:member.email,action:'resend'});setMembers(r.members);setMessage(r.mail?.message||'발송 상태를 확인했습니다.');if(invitation?.email===member.email&&r.mail)setInvitation({...invitation,mail:r.mail});}catch(e:unknown){setMessage(e instanceof Error?e.message:'메일 발송 상태를 확인하지 못했습니다.');}finally{setBusy('');}}
 async function status(member:Member){setBusy(member.email);setMessage('');try{const r=await api<TeamResponse>('team',{email:member.email,action:member.status==='active'?'revoke':'restore'});setMembers(r.members);if(invitation?.email===member.email)setInvitation(null);setMessage(member.status==='active'?'이 공간의 사용을 중지했어요.':'이 공간을 다시 사용할 수 있어요.');}catch(e:unknown){setMessage(e instanceof Error?e.message:'사용 상태를 변경하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy('');}}
 async function copy(withMessage=false){try{const url=location.origin+'/?view=shared';await navigator.clipboard.writeText(withMessage&&invitation?`수업서랍에 초대했어요.\n${invitation.email} 계정으로 ChatGPT 로그인해 주세요.\n공용 자료를 검색하고 동료의 수업 자료 모음을 함께 볼 수 있어요.\n${url}`:url);setMessage(withMessage?'초대 안내를 복사했어요. 동료에게 전달해 주세요.':'접속 주소를 복사했어요. 초대받은 계정으로 로그인해야 합니다.');}catch{setMessage('복사하지 못했습니다. 아래 접속 주소를 직접 복사해 주세요.');}}
 if(!isAdmin)return <div className="notice">동료의 접근 계정은 운영자가 관리합니다.</div>;
 return <>
  <div className="source-intro"><Users size={25}/><div><strong>초대받은 계정으로 함께 쓰는 공간</strong><p>공용 자료는 함께 보고, 개인 모음은 공유를 켜기 전까지 비공개로 유지됩니다.</p></div></div>
  <section className="invite-card" aria-labelledby="invite-heading">
   <div className="invite-heading"><span><UserPlus size={22}/></span><div><h2 id="invite-heading">동료 교사 초대</h2><p>동료가 ChatGPT 로그인에 사용하는 이메일을 입력해 주세요.</p></div></div>
   <form onSubmit={invite}>
    <label className="field-label" htmlFor="invite-email">동료 교사 이메일</label>
    <div className="invite-form-row"><input id="invite-email" name="email" type="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} disabled={loading||Boolean(busy)||!enabled} onChange={e=>setEmail(e.target.value)} placeholder="teacher@example.com" aria-describedby="invite-help"/><button className="button primary" type="submit" disabled={loading||Boolean(busy)||!enabled||!email.trim()}>{busy==='invite'?<LoaderCircle size={16} className="spin"/>:<UserPlus size={16}/>}초대 등록</button></div>
    <p id="invite-help" className="invite-help">{emailEnabled?'초대를 등록하면 안내 메일을 자동으로 보냅니다. 이미 보낸 이메일은 중복 발송하지 않으며, 아래 목록에서 다시 보낼 수 있어요.':'초대 등록은 이용할 수 있습니다. Gmail 연결을 준비하는 동안에는 초대 안내를 복사해 전달해 주세요.'}</p>
   </form>
   {!loading&&!enabled?<div className="notice">앱 내 초대를 활성화할 준비를 하고 있습니다. 기존 동료의 사용 중지·재개는 아래에서 이용할 수 있어요.</div>:null}
   {invitation?<div className="invite-result"><Check size={19}/><div><strong>{invitation.email}</strong><p>{invitation.result==='already_invited'?'이미 초대된 계정이에요.':'초대 등록이 완료됐어요.'} 이 이메일로 로그인하면 함께 사용할 수 있습니다.</p>{invitation.mail?<p className="invite-mail-status"><Mail size={14}/>{mailLabels[invitation.mail.status]}</p>:null}<label className="sr-only" htmlFor="invite-link">초대 접속 주소</label><input id="invite-link" readOnly value={typeof location==='undefined'?'':location.origin+'/?view=shared'}/><div className="invite-result-actions"><button className="button" onClick={()=>copy(true)}><Copy size={14}/>초대 안내 복사</button><button className="text-btn" onClick={()=>copy()}>주소만 복사</button></div></div></div>:null}
   {message?<p className="sharing-message" role="status">{message}</p>:null}
  </section>
  <div className="team-toolbar"><h2>함께 쓰는 교사 <span>{members.length}</span></h2><button className="button" onClick={()=>copy()}><Copy size={15}/>접속 주소 복사</button></div>
  {loading?<div className="loading"><LoaderCircle className="spin"/>동료 목록을 확인하고 있어요.</div>:<div className="team-list">{members.map(member=><article className="team-member" key={member.email}><span className="avatar">{(member.name||member.email).slice(0,1)}</span><div className="team-member-name"><strong>{member.name||'초대된 교사'}</strong><p>{member.email}</p>{member.role!=='owner'?<small className="member-mail">{member.mail_status?mailLabels[member.mail_status]:'초대 메일 발송 전'}{member.mail_sent_at?' · '+new Date(member.mail_sent_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}</small>:null}</div><span className={`member-state ${member.status==='active'?'':'stopped'}`}>{member.role==='owner'?'운영자':member.status!=='active'?'사용 중지':member.last_seen?'사용 중':'첫 로그인 전'}</span>{member.role!=='owner'?<div className="member-actions">{member.status==='active'?<button className="button" disabled={Boolean(busy)||!emailEnabled} onClick={()=>resend(member)}><Mail size={13}/>{member.mail_status==='unknown'?'발송 결과 확인':member.mail_status==='sent'?'메일 다시 보내기':'초대 메일 보내기'}</button>:null}<button className="text-btn" disabled={Boolean(busy)} onClick={()=>status(member)}>{busy===member.email?'처리 중…':member.status==='active'?'사용 중지':'사용 재개'}</button></div>:null}</article>)}</div>}
  <p className="source-footnote">접속 주소만으로 가입되지는 않습니다. 초대한 이메일 계정으로 로그인해야 하며, 사용 중지된 계정은 자료와 공유 모음을 열 수 없습니다.</p>
 </>;
}
