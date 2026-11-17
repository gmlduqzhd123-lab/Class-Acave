import {DatabaseSync} from 'node:sqlite';
export function createLocalDatabase(filename:string):D1Database{
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
 const make=(sql:string,params:unknown[]=[])=>{
  const rows=(arrays=false)=>{const prepared=sqlite.prepare(sql);prepared.setReturnArrays(arrays);return prepared.all(...params as any[]);};
  const run=()=>{const prepared=sqlite.prepare(sql);if(prepared.columns().length){const results=prepared.all(...params as any[]);return{results,success:true,meta:{changes:/^\s*(?:SELECT|PRAGMA)/i.test(sql)?0:Number((sqlite.prepare('SELECT changes() n').get() as any).n)}};}const result=prepared.run(...params as any[]);return{results:[],success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};};
  return{bind(...values:unknown[]){return make(sql,values);},async all(){return{results:rows(),success:true,meta:{changes:0}};},async first(column?:string){const row=rows()[0] as any;return column?row?.[column]??null:row??null;},async run(){return run();},async raw(options?:{columnNames?:boolean}){const data=rows(true);return options?.columnNames?[sqlite.prepare(sql).columns().map(c=>c.name),...data]:data;},_run:run};
 };
 const database={prepare:make,async batch(items:ReturnType<typeof make>[]){sqlite.exec('BEGIN');try{const result=items.map(item=>item._run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}},async exec(sql:string){sqlite.exec(sql);return{count:1,duration:0};},withSession(){return database;}};
 return database as unknown as D1Database;
}
