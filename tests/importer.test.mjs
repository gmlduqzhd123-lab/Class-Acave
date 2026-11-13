import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {parseNative,parseXlsx,structureRows,safeUrl,googleId,normalize} from '../lib/importer.mjs';
const cell=(col,text,note='',hyperlink='')=>({col,text,note,hyperlink});
test('Korean search normalizes Unicode and whitespace',()=>assert.equal(normalize(' 비와  비율 '),'비와비율'));
test('only HTTP links and canonical Google Sheet hosts are accepted',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('data:text/html,test'),'');
 assert.equal(googleId('https://docs.google.com.attacker.example/spreadsheets/d/12345678901/edit'),'');
 assert.equal(googleId('https://docs.google.com/spreadsheets/d/12345678901/edit'),'12345678901');
});
test('text-only ideas and note-only cells remain resources',async()=>{
 const p=await structureRows([{name:'국어',rows:[{row:20,cells:[cell(3,'책 띠지 만들기')]},{row:21,cells:[cell(3,'','모둠별 활동 규칙')]}]}]);
 assert.equal(p.resources.length,2);assert.match(p.resources[1].notes,/모둠별 활동 규칙/);
});
test('native CellData preserves multiple rich links plus notes',async()=>{
 const p=await parseNative({spreadsheetUrl:'https://docs.google.com/spreadsheets/d/12345678901/edit',sheets:[{properties:{title:'국어'},data:[{startRow:21,rowData:[{values:[{formattedValue:'학생 작품',note:'작품 활용 방법',textFormatRuns:[{format:{link:{uri:'https://example.com/1'}}},{startIndex:3,format:{link:{uri:'https://example.com/2'}}}]}]}]}]}]});
 assert.equal(p.resources[0].links.length,2);assert.match(p.resources[0].notes,/작품 활용 방법/);assert.equal(p.resources[0].row,22);
});
test('moving rows keeps identity independent of source coordinates',async()=>{
 const a=await structureRows([{name:'음악',rows:[{row:20,cells:[cell(2,'발성 연습'),cell(3,'영상','','https://example.com/video')]}]}],{filename:'same.xlsx'});
 const b=await structureRows([{name:'음악',rows:[{row:80,cells:[cell(2,'발성 연습'),cell(3,'영상','','https://example.com/video')]}]}],{filename:'same.xlsx'});
 assert.equal(a.resources[0].id,b.resources[0].id);assert.notEqual(a.resources[0].range,b.resources[0].range);
});
test('same URL in different subjects and repeated occurrences remain distinct',async()=>{
 const rows=[{row:20,cells:[cell(2,'아이디어'),cell(3,'링크','','https://example.com') ]},{row:21,cells:[cell(2,'다른 설명'),cell(3,'링크','','https://example.com')]}];
 const p=await structureRows([{name:'국어',rows},{name:'사회',rows}]);assert.equal(new Set(p.resources.map(r=>r.id)).size,4);
});
test('sports horizontal blocks are extracted independently',async()=>{
 const p=await structureRows([{name:'체육',rows:[{row:18,cells:[cell(1,'3월'),cell(2,'달리기'),cell(4,'피구'),cell(9,'교실놀이'),cell(18,'1차시'),cell(19,'기초체력')]}]}]);assert.equal(p.resources.length,4);assert.ok(p.resources.every(r=>r.review));
});
test('empty files and non-XLSX uploads fail clearly',async()=>{
 await assert.rejects(()=>parseXlsx(new TextEncoder().encode('<html>login</html>')));await assert.rejects(()=>structureRows([]),/탭/);
});
const fixture=process.env.ARCHIVE_FIXTURE;
test('real workbook covers all 16 tabs and retains notes and links',{skip:!fixture||!existsSync(fixture)},async()=>{
 const p=await parseXlsx(readFileSync(fixture),{filename:'source.xlsx',url:'https://docs.google.com/spreadsheets/d/1d-x25464fuAzNHqcNmCVaFOf6uSryBywEdUyxmtf_IA/edit'});
 assert.equal(p.summary.length,16);assert.ok(p.resources.length>1500);assert.ok(p.resources.filter(r=>r.notes).length>=29);assert.ok(p.resources.some(r=>r.subject==='국어'&&r.row===40&&r.notes.includes('시화집')));assert.equal(new Set(p.resources.map(r=>r.id)).size,p.resources.length);
 for(const s of p.summary){assert.ok(s.resources>0);assert.ok(s.rows>=s.skipped);}
 console.log(JSON.stringify({actualResources:p.resources.length,notes:p.resources.filter(r=>r.notes).length,links:p.resources.reduce((n,r)=>n+r.links.length,0)}));
});
