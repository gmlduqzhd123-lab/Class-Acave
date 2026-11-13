export type Resource = {
  id:string;sourceId:string;title:string;body:string;notes:string;subject:string;context:string;kind:'영상'|'문서'|'사이트'|'아이디어';row:number;range:string;
  links:{label:string;url:string}[];sourceUrl:string;credit?:string;raw:{col:number;text:string;note:string}[];restricted:boolean;review:boolean;
};
export type Collection={id:string;title:string;description:string;count:number;shared?:number;canEdit?:boolean;ownerName?:string};
export type Source={id:string;title:string;url:string;updated:string;count:number};
export type Summary={subject:string;rows:number;resources:number;skipped:number;review:number};
export type ImportPreview={sourceId:string;title:string;url:string;resources:Resource[];summary:Summary[];warnings:string[]};
export type CollectionItem={resource:Resource;note:string;position:number;missing:boolean};
export type State={sources:Source[];collections:Collection[];sharedCollections:Collection[];subjects:{name:string;count:number}[];total:number;workspace?:{title:string;isAdmin:boolean;teamSize:number}};
export async function api<T=Record<string,any>>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api/${path}`,{method:body===undefined?"GET":"POST",headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal});
  const data=await response.json() as T & {error?:string};if(!response.ok)throw new Error(data.error||"요청을 처리하지 못했습니다. 다시 시도해 주세요.");return data;
}
export function downloadJson(value:unknown,filename:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
