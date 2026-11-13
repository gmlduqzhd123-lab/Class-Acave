'use client';
import {useEffect,useId,useRef} from 'react';
import type {ReactNode} from 'react';
import {X} from 'lucide-react';
export default function Modal({title,children,onClose,wide=false,drawer=false,locked=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean;drawer?:boolean;locked?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),tid=useId();
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={ref} aria-labelledby={tid} className={`modal ${wide?'wide':''} ${drawer?'drawer':''}`} onCancel={e=>{e.preventDefault();if(!locked)onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!locked)onClose();}}><div className="modal-body"><header className="modal-head"><h2 id={tid}>{title}</h2><button aria-label="닫기" className="icon-btn" onClick={onClose} disabled={locked}><X size={20}/></button></header>{children}</div></dialog>;
}
