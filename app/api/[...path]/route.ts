import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {normalize,googleId} from '@/lib/importer.mjs';
export const dynamic='force-dynamic';
const str=z.string().max(60000),id=z.string().min(1).max(150);
const web=z.string().max(2000).refine(v=>!v||/^https?:\/\//i.test(v));
const resource=z.object({id,sourceId:id,title:z.string().min(1).max(200),body:str,notes:str,subject:z.string().min(1).max(120),context:z.string().max(500),kind:z.enum(['영상','문서','사이트','아이디어']),row:z.number().int().min(1),range:z.string().max(300),links:z.array(z.object({label:z.string().max(200),url:web})).max(100),sourceUrl:web,credit:z.string().max(500).default(''),raw:z.array(z.object({col:z.number().int().min(1).max(1000),text:str,note:str})).max(100),restricted:z.boolean(),review:z.boolean()});
const active=' FROM resources r JOIN sources s ON s.owner=r.owner AND s.id=r.source AND s.active_run=r.run WHERE r.owner=?';
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export async function GET(request:Request){return handle(request);}
export async function POST(request:Request){return handle(request);}
async function handle(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)return json({error:'로그인 후 이용해 주세요.'},401);
  if(!env.DB)return json({error:'자료 저장소가 준비되지 않았습니다.'},503);
  const db=env.DB,owner=user.userId,url=new URL(request.url),path=decodeURIComponent(url.pathname.slice(5));
  const q=(sql:string,...args:(string|number|null)[])=>db.prepare(sql).bind(...args);
  const all=async(sql:string,...args:(string|number|null)[])=>(await q(sql,...args).all()).results as any[];
  const first=async(sql:string,...args:(string|number|null)[])=>q(sql,...args).first() as Promise<any>;
  let b:any={};
  if(request.method==='POST'){
    const text=await request.text();if(text.length>2500000)return json({error:'한 번에 전송하는 자료가 너무 큽니다.'},413);
    if(request.headers.get('Origin')!==url.origin)return json({error:'같은 사이트에서 다시 시도해 주세요.'},403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON 요청이 필요합니다.'},415);
    b=JSON.parse(text);
  }
  if(path==='state'&&request.method==='GET'){
    const [sources,collections,subjects,total]=await Promise.all([
      all('SELECT s.id,s.title,s.url,s.updated,(SELECT count(*) FROM resources r WHERE r.owner=s.owner AND r.run=s.active_run) count FROM sources s WHERE s.owner=? AND s.active_run IS NOT NULL ORDER BY updated DESC',owner),
      all('SELECT c.id,c.title,c.description,(SELECT count(*) FROM items i WHERE i.owner=c.owner AND i.collection=c.id) count FROM collections c WHERE c.owner=? ORDER BY c.created DESC',owner),
      all('SELECT r.subject name,count(*) count'+active+' GROUP BY r.subject ORDER BY count DESC',owner),
      first('SELECT count(*) n'+active,owner)
    ]);return json({sources,collections,subjects,total:total.n});
  }
  if(path==='resources'&&request.method==='GET'){
    const args:(string|number)[]=[owner];let where=active;
    const tokens=String(url.searchParams.get('q')||'').slice(0,150).split(/\s+/).map(normalize).filter(Boolean).slice(0,8);
    for(const token of tokens){where+=' AND instr(r.search,?)>0';args.push(token);}
    for(const [key,col] of [['subject','subject'],['kind','kind']] as const){const v=url.searchParams.get(key);if(v){where+=` AND r.${col}=?`;args.push(v.slice(0,120));}}
    const page=Math.max(0,Math.min(500,Number(url.searchParams.get('page'))||0));
    const [rows,count]=await Promise.all([all('SELECT r.data'+where+' ORDER BY r.subject,r.title LIMIT 24 OFFSET ?',...args,page*24),first('SELECT count(*) n'+where,...args)]);
    return json({resources:rows.map(r=>JSON.parse(r.data)),total:count.n,page});
  }
  if(path==='google'&&request.method==='POST'){
    const target=googleId(z.string().max(2000).parse(b.url));if(!target)fail('올바른 구글 스프레드시트 주소를 입력해 주세요.');
    const result=await fetch(`https://docs.google.com/spreadsheets/d/${target}/export?format=xlsx`,{signal:AbortSignal.timeout(30000),redirect:'follow'});
    if(!result.ok)fail('주소로 자료를 읽을 수 없습니다. 엑셀 파일로 다운로드한 뒤 업로드해 주세요.',422);
    if(Number(result.headers.get('content-length')||0)>8388608)fail('8MB 이하의 시트만 가져올 수 있습니다.',413);
    const reader=result.body?.getReader();if(!reader)fail('빈 파일입니다.');let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8388608){await reader.cancel();fail('파일 크기가 8MB를 초과합니다.',413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(bytes[0]!==80||bytes[1]!==75)fail('시트가 공개되어 있지 않거나 엑셀로 내보낼 수 없습니다. 파일 업로드를 이용해 주세요.',422);
    return new Response(bytes,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Cache-Control':'private, no-store'}});
  }
  if(path==='import/start'&&request.method==='POST'){
    const v=z.object({sourceId:id,title:z.string().min(1).max(250),url:web,expected:z.number().int().min(1).max(10000),summary:z.array(z.object({subject:z.string().max(120),rows:z.number(),resources:z.number(),skipped:z.number(),review:z.number()})).max(40)}).parse(b);
    const current=await first('SELECT active_run FROM sources WHERE owner=? AND id=?',owner,v.sourceId),run=crypto.randomUUID(),now=new Date().toISOString();
    await db.batch([
      q('INSERT OR IGNORE INTO sources (id,owner,title,url,active_run,updated) VALUES (?,?,?,?,NULL,?)',v.sourceId,owner,v.title,v.url,now),
      q('INSERT INTO imports (id,owner,source,base_run,expected,status,summary,created) VALUES (?,?,?,?,?,?,?,?)',run,owner,v.sourceId,current?.active_run||null,v.expected,'uploading',JSON.stringify(v),now)
    ]);return json({run});
  }
  if(path.startsWith('import/')&&request.method==='POST'){
    const run=id.parse(b.run),job=await first('SELECT * FROM imports WHERE id=? AND owner=?',run,owner);if(!job)fail('가져오기 작업을 찾을 수 없습니다.',404);
    if(job.status==='completed'&&path==='import/finish')return json({ok:true});
    if(job.status!=='uploading')fail('종료된 가져오기 작업입니다.',409);
    if(path==='import/chunk'){
      const records=z.array(resource).min(1).max(40).parse(b.resources);if(records.some(r=>r.sourceId!==job.source))fail('자료의 출처가 일치하지 않습니다.');
      await db.batch(records.map(r=>q('INSERT OR REPLACE INTO resources (run,id,owner,source,subject,kind,title,search,data) VALUES (?,?,?,?,?,?,?,?,?)',run,r.id,owner,job.source,r.subject,r.kind,r.title,normalize([r.title,r.body,r.notes,r.context,r.subject,...r.links.map(l=>l.label)].join(' ')),JSON.stringify(r))));return json({ok:true});
    }
    if(path==='import/finish'){
      const count=await first('SELECT count(*) n FROM resources WHERE owner=? AND run=?',owner,run);if(count.n!==job.expected)fail('자료 전송이 끝나지 않았습니다. 다시 가져와 주세요.',409);
      const info=JSON.parse(job.summary),now=new Date().toISOString();
      const results=await db.batch([
        q('UPDATE sources SET active_run=?,title=?,url=?,updated=? WHERE owner=? AND id=? AND active_run IS ?',run,info.title,info.url,now,owner,job.source,job.base_run),
        q("UPDATE imports SET status='completed' WHERE id=? AND owner=? AND EXISTS (SELECT 1 FROM sources WHERE owner=? AND id=? AND active_run=?)",run,owner,owner,job.source,run)
      ]);
      if(!results[0].meta.changes)fail('다른 가져오기가 먼저 반영되었습니다. 최신 자료를 확인한 뒤 다시 가져와 주세요.',409);
      return json({ok:true,count:count.n});
    }
  }
  if(path==='collections'&&request.method==='POST'){
    const v=z.object({title:z.string().trim().min(1).max(80),description:z.string().max(1000).default(''),resourceId:id.optional()}).parse(b),cid=crypto.randomUUID();
    const operations=[q('INSERT INTO collections (id,owner,title,description,created) VALUES (?,?,?,?,?)',cid,owner,v.title,v.description,new Date().toISOString())];
    if(v.resourceId){const r=await first('SELECT r.data'+active+' AND r.id=? LIMIT 1',owner,v.resourceId);if(!r)fail('현재 자료를 찾을 수 없습니다.',404);operations.push(q('INSERT INTO items (collection,resource,owner,snapshot,note,position) VALUES (?,?,?,?,?,0)',cid,v.resourceId,owner,r.data,''));}
    await db.batch(operations);return json({id:cid});
  }
  if(path.startsWith('collections/')){
    const cid=id.parse(path.split('/')[1]),collection=await first('SELECT * FROM collections WHERE id=? AND owner=?',cid,owner);if(!collection)fail('자료 모음을 찾을 수 없습니다.',404);
    if(request.method==='GET'){
      const rows=await all('SELECT i.*,r.data latest FROM items i LEFT JOIN resources r ON r.owner=i.owner AND r.id=i.resource AND r.run=(SELECT s.active_run FROM sources s WHERE s.owner=i.owner AND s.id=json_extract(i.snapshot,\'$.sourceId\')) WHERE i.collection=? AND i.owner=? ORDER BY i.position,i.resource',cid,owner);
      return json({collection:{id:cid,title:collection.title,description:collection.description},items:rows.map(r=>({resource:JSON.parse(r.latest||r.snapshot),note:r.note,position:r.position,missing:!r.latest}))});
    }
    if(b.action==='add'){
      const rid=id.parse(b.resourceId),r=await first('SELECT r.data'+active+' AND r.id=? LIMIT 1',owner,rid);if(!r)fail('현재 자료를 찾을 수 없습니다.',404);
      await q('INSERT OR IGNORE INTO items (collection,resource,owner,snapshot,note,position) VALUES (?,?,?,?,?,(SELECT coalesce(max(position),-1)+1 FROM items WHERE collection=? AND owner=?))',cid,rid,owner,r.data,'',cid,owner).run();
    }else if(b.action==='remove')await q('DELETE FROM items WHERE collection=? AND owner=? AND resource=?',cid,owner,id.parse(b.resourceId)).run();
    else if(b.action==='note')await q('UPDATE items SET note=? WHERE collection=? AND owner=? AND resource=?',z.string().max(20000).parse(b.note),cid,owner,id.parse(b.resourceId)).run();
    else if(b.action==='rename')await q('UPDATE collections SET title=? WHERE id=? AND owner=?',z.string().trim().min(1).max(80).parse(b.title),cid,owner).run();
    else if(b.action==='delete')await db.batch([q('DELETE FROM items WHERE collection=? AND owner=?',cid,owner),q('DELETE FROM collections WHERE id=? AND owner=?',cid,owner)]);
    else if(b.action==='reorder'){
      const order=z.array(id).max(1000).parse(b.order),existing=await all('SELECT resource FROM items WHERE collection=? AND owner=?',cid,owner);
      if(order.length!==existing.length||new Set(order).size!==order.length||existing.some(r=>!order.includes(r.resource)))fail('모음이 변경되었습니다. 새로고침 후 다시 정렬해 주세요.',409);
      for(let start=0;start<order.length;start+=40)await db.batch(order.slice(start,start+40).map((rid,i)=>q('UPDATE items SET position=? WHERE collection=? AND owner=? AND resource=?',start+i,cid,owner,rid)));
    }else fail('지원하지 않는 동작입니다.');return json({ok:true});
  }
  return json({error:'요청한 기능을 찾을 수 없습니다.'},404);
 }catch(error:any){
  if(error instanceof z.ZodError)return json({error:'입력한 자료 형식이나 길이를 확인해 주세요.'},400);
  if(error instanceof SyntaxError)return json({error:'파일 또는 요청 형식을 확인해 주세요.'},400);
  return json({error:error.status?error.message:'처리 중 오류가 발생했습니다. 기존 자료는 유지됩니다. 잠시 후 다시 시도해 주세요.'},error.status||500);
 }
}
