import {unzipSync,strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
export const DEFAULT_URL='https://docs.google.com/spreadsheets/d/1d-x25464fuAzNHqcNmCVaFOf6uSryBywEdUyxmtf_IA/edit';
const gids={'국어':0,'도덕':1574700730,'수학':788492386,'과학':1140784739,'실과':832390438,'체육':1377371769,'음악':51013148,'사회':858097464,'미술':1177904948,'영어':11333865,'창체':1064239427,'시간남을때':1726067593,'각종업무':1648245769,'계기교육':1194964674,'프로그램&추천사이트':1192816419,'영화&책추천':1220580492};
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];
const xml=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',parseTagValue:false,trimValues:false,processEntities:true});
const txt=n=>n==null?'':typeof n==='object'?String(n['#text']??''):String(n);
const rich=n=>n?txt(n.t)+arr(n.r).map(r=>txt(r.t)).join(''):'';
export const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function safeUrl(s,base=''){try{const u=new URL(String(s).trim(),base||undefined);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,32);}
export function googleId(url){try{const u=new URL(url);return u.hostname==='docs.google.com'?u.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,120})(?:\/|$)/)?.[1]||'':'';}catch{return '';}}
function resolve(base,target){const parts=(target.startsWith('/')?target.slice(1):base.slice(0,base.lastIndexOf('/')+1)+target).split('/'),out=[];for(const p of parts){if(p==='..')out.pop();else if(p!=='.')out.push(p);}return out.join('/');}
function extract(text,hyperlink,base){
  const out=[];const add=(url,label)=>{if(String(url).startsWith('www.'))url='https://'+url;url=safeUrl(url,base);if(url&&!out.some(x=>x.url===url))out.push({url,label:label?.trim().slice(0,160)||new URL(url).hostname});};
  if(hyperlink)add(hyperlink,text);
  for(const m of String(text).matchAll(/(?:https?:\/\/|www\.)[^\s<>"\u0000-\u001f]+/g))add(m[0].replace(/[),.;，。]+$/g,''),m[0]);
  return out;
}
export async function parseXlsx(input,{filename='자료.xlsx',url='',title=''}={}){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length>8*1024*1024)throw new Error('8MB 이하의 엑셀 파일을 선택해 주세요.');
  let expanded=0;const zip=unzipSync(bytes,{filter:e=>{expanded+=e.originalSize;if(expanded>60*1024*1024)throw new Error('압축 해제 크기가 너무 큽니다. 자료를 나누어 주세요.');return /\.xml$|\.rels$/.test(e.name);}});
  const read=p=>zip[p]?xml.parse(strFromU8(zip[p])):{};
  if(!zip['xl/workbook.xml'])throw new Error('올바른 .xlsx 파일이 아닙니다. 구글 시트를 Microsoft Excel 형식으로 다운로드해 주세요.');
  const book=read('xl/workbook.xml').workbook,rels=arr(read('xl/_rels/workbook.xml.rels').Relationships?.Relationship),strings=arr(read('xl/sharedStrings.xml').sst?.si).map(rich),sheets=arr(book.sheets?.sheet);
  if(sheets.length>40)throw new Error('한 번에 40개 이하의 탭을 가져올 수 있습니다.');
  const parsed=[];let cellsRead=0;
  for(const sheet of sheets){
    if(['hidden','veryHidden'].includes(sheet['@state']))continue;
    const rel=rels.find(r=>r['@Id']===sheet['@r:id']);if(!rel)continue;
    const path=resolve('xl/workbook.xml',rel['@Target']),doc=read(path).worksheet;if(!doc)continue;
    const slash=path.lastIndexOf('/'),sr=arr(read(path.slice(0,slash+1)+'_rels/'+path.slice(slash+1)+'.rels').Relationships?.Relationship),links=new Map(),comments=new Map();
    for(const h of arr(doc.hyperlinks?.hyperlink)){const r=sr.find(r=>r['@Id']===h['@r:id']);if(r)links.set(h['@ref'],r['@Target']);else if(h['@location'])links.set(h['@ref'],'#range='+encodeURIComponent(h['@location']));}
    for(const r of sr.filter(r=>String(r['@Type']).endsWith('/comments'))){for(const note of arr(read(resolve(path,r['@Target'])).comments?.commentList?.comment))comments.set(note['@ref'],rich(note.text));}
    const rows=[];
    for(const row of arr(doc.sheetData?.row)){
      const cells=[];
      for(const c of arr(row.c)){
        if(++cellsRead>250000)throw new Error('셀 수가 너무 많습니다. 자료를 나누어 주세요.');
        const address=c['@r']||'',col=address.match(/^[A-Z]+/)?.[0];if(!col)continue;let n=0;for(const ch of col)n=n*26+ch.charCodeAt(0)-64;
        const text=c['@t']==='s'?strings[Number(txt(c.v))]||'':c['@t']==='inlineStr'?rich(c.is):txt(c.v),note=comments.get(address)||'';
        let hyperlink=links.get(address)||'';const fm=txt(c.f).match(/^HYPERLINK\(\s*"([^"]+)"/i);if(fm)hyperlink=fm[1].replace(/""/g,'"');
        if(text.trim()||note||hyperlink)cells.push({col:n,text,note,hyperlink,address});
      }
      if(cells.length)rows.push({row:Number(row['@r']),cells});
    }
    parsed.push({name:String(sheet['@name']),rows});
  }
  return structureRows(parsed,{filename,url,title});
}
export async function parseNative(data,{filename='자료.json',url='',title=''}={}){
  const root=data.structuredContent||data;if(!Array.isArray(root.sheets))throw new Error('구글 시트 CellData JSON 형식이 아닙니다.');
  const parsed=root.sheets.filter(s=>!s.properties?.hidden).map(s=>({name:s.properties.title,rows:(s.data||[]).flatMap(d=>(d.rowData||[]).map((r,i)=>({row:(d.startRow||0)+i+1,cells:(r.values||[]).map((v,j)=>({col:(d.startColumn||0)+j+1,text:v.formattedValue??v.userEnteredValue?.stringValue??'',note:v.note||'',hyperlink:v.hyperlink||'',richLinks:(v.textFormatRuns||[]).map(x=>x.format?.link?.uri).filter(Boolean)})).filter(c=>c.text||c.note||c.hyperlink||c.richLinks.length)}))).filter(r=>r.cells.length)}));
  return structureRows(parsed,{filename,url:url||root.spreadsheetUrl||'',title:title||root.properties?.title||''});
}
export async function structureRows(sheets,{filename='',url='',title=''}={}){
  const sheetId=googleId(url),sourceId=sheetId||await digest(filename),resources=[],summary=[],warnings=[];if(!sheets.length)throw new Error('가져올 수 있는 탭이 없습니다.');
  for(const sheet of sheets){
    const stat={subject:sheet.name,rows:sheet.rows.length,resources:0,skipped:0,review:0};let previousContext='',bodyStarted=false;const occurrences=new Map();
    for(const row of sheet.rows){
      const full=row.cells.map(c=>c.text).join('\n');
      const common=/모름지기.*연수 자료|^\d+\. (현장에서 통하는|동기유발 및|체육수업 아이디어|생활지도 자료|영어수업 아이디어|국영수 혼자|6학년\(고학년\)|5학년\(고학년\)|학부모를 위한|초등학교 고학년|6학년 수학 1~2학기)|위 영상은|인디스쿨 원글 주소|계속 업데이트 예정/.test(full);
      const meaningful=row.cells.filter(c=>(c.text.trim()&&c.text.trim()!=='##')||c.note||c.hyperlink||c.richLinks?.length);
      const header=meaningful.length>1&&meaningful.every(c=>/^(단원|설명|링크|학기 단원|단원명|비고|관련쪽수|관련 활동|학기|번호)$/.test(c.text.trim()));
      if(common||header||!meaningful.length){stat.skipped++;continue;}
      const cc=row.cells.find(c=>c.col===1&&c.text.trim());if(cc&&cc.text!=='##')previousContext=cc.text.trim();
      const matrix=sheet.name==='체육'&&row.cells.some(c=>c.col>=9)&&row.row<40;
      const groups=matrix?[{from:1,to:3,label:'운동장'},{from:4,to:8,label:'체육관'},{from:9,to:17,label:'교실'},{from:18,to:29,label:'차시 계획'}].map(g=>({...g,cells:row.cells.filter(c=>c.col>=g.from&&c.col<=g.to)})).filter(g=>g.cells.some(c=>c.text.trim())):[{from:1,to:99,label:'',cells:row.cells}];
      for(const g of groups){
        const visible=g.cells.filter(c=>(c.text.trim()&&c.text.trim()!=='##')||c.note||c.hyperlink||c.richLinks?.length);if(!visible.length)continue;
        const texts=visible.map(c=>c.text.trim()),candidates=visible.filter(c=>!/^https?:\/\//.test(c.text.trim())&&!(c.col===1&&visible.length>1)&&!/^\d+(?:\.\d+)?$/.test(c.text.trim()));
        const primary=(candidates.find(c=>['국어','사회','창체','계기교육','영화&책추천','체육','수학'].includes(sheet.name)&&c.col===3)||candidates.find(c=>c.col===2)||candidates[0]||visible[0]).text||visible[0].note||visible[0].hyperlink||'제목 없는 자료';
        let rt=primary.split(/[\n\r]/)[0].trim().slice(0,140);if(g.label)rt=`${g.label} · ${rt}`;
        const base=sheetId?`https://docs.google.com/spreadsheets/d/${sheetId}/edit`:url,range=`'${sheet.name.replace(/'/g,"''")}'!A${row.row}:AC${row.row}`,gid=sheetId==='1d-x25464fuAzNHqcNmCVaFOf6uSryBywEdUyxmtf_IA'?gids[sheet.name]:undefined;
        const sourceUrl=base?base.split('#')[0]+(gid!==undefined?`#gid=${gid}&range=A${row.row}:AC${row.row}`:`#range=${encodeURIComponent(range)}`):'';
        const links=[],notes=g.cells.filter(c=>c.note).map(c=>`${c.address||'열 '+c.col}\n${c.note}`).join('\n\n');
        for(const c of g.cells){const list=extract(c.text,c.hyperlink,base);for(const l of c.richLinks||[])list.push(...extract(c.text,l,base));list.push(...extract(c.note,'',base));for(const l of list)if(!links.some(x=>x.url===l.url))links.push(l);}
        const context=[previousContext,g.label].filter(Boolean).join(' · '),identity=[sheet.name,context,g.label,links[0]?.url||normalize(rt)].join('|'),occurrence=occurrences.get(identity)||0;occurrences.set(identity,occurrence+1);
        const id=await digest(sourceId+'|'+identity+'|'+occurrence),restricted=/외부\s*유출\s*금지|내부\s*열람|재가공.*금지/.test(texts.join(' ')+' '+notes),review=matrix||!candidates.length||(!bodyStarted&&visible.length===1);bodyStarted=true;
        const kind=links.some(l=>/youtu\.be|youtube\.com/.test(l.url))?'영상':links.some(l=>/drive\.google|docs\.google|\.pdf(?:\?|$)/.test(l.url))?'문서':links.length?'사이트':'아이디어';
        resources.push({id,sourceId,title:rt,body:texts.join('\n\n'),notes,subject:sheet.name,context,kind,row:row.row,range,sourceUrl,credit:sheetId==='1d-x25464fuAzNHqcNmCVaFOf6uSryBywEdUyxmtf_IA'?'원본 자료 모음: 모름지기 · 2025학년도':'' ,links,restricted,review,raw:g.cells.map(c=>({col:c.col,text:c.text,note:c.note||''}))});stat.resources++;if(review)stat.review++;
      }
    }
    summary.push(stat);
  }
  if(resources.length>10000)throw new Error('한 번에 10,000개 이하의 자료를 가져올 수 있습니다.');
  warnings.push('원본의 작성 시기와 이용 조건을 확인해 주세요. 외부 자료의 열람 권한은 원본 서비스에서 결정됩니다.');
  if(filename.endsWith('.xlsx')||!filename)warnings.push('엑셀 내보내기는 한 셀의 복수 링크를 모두 담지 못할 수 있습니다. 원본 위치를 함께 보관합니다.');
  return {sourceId,title:title||filename.replace(/\.xlsx$/i,'')||'구글 시트 자료',url:safeUrl(url),resources,summary,warnings};
}
