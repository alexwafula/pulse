import { createElement, Check, Copy, X } from "lucide";
import { t } from "./i18n";
import { setBadge } from "./status-badge";

type Caption = {key:string; text:string; status:"verified"|"template"|"none"; label:string; recorded?:boolean; estimate?:boolean; evidence?:()=>void};

export function createPresentation(refresh:()=>void):{
  active:()=>boolean; enter:(fullscreen?:boolean)=>void; render:(clock:string,caption?:Caption)=>void; copy:(url:string)=>Promise<void>;
} {
  const pitch=document.querySelector<HTMLElement>(".pitch-column")!;
  const toggle=document.querySelector<HTMLButtonElement>("#broadcast-toggle")!;
  const exit=document.querySelector<HTMLButtonElement>("#broadcast-exit")!;
  const dialog=document.querySelector<HTMLDialogElement>("#share-link-dialog")!;
  const input=document.querySelector<HTMLInputElement>("#share-link-value")!;
  const caption=document.querySelector<HTMLElement>("#broadcast-caption")!;
  const text=document.querySelector<HTMLElement>("#broadcast-text")!;
  const badge=document.querySelector<HTMLElement>("#broadcast-status")!;
  const evidence=document.querySelector<HTMLButtonElement>("#broadcast-evidence")!;
  const clock=document.querySelector<HTMLElement>("#broadcast-clock")!;
  let active=false, native=false, captionKey="", previousFocus:HTMLElement|null=null, copyTimer:number|undefined;
  const background=new Map<HTMLElement,boolean>();
  let inspect:(()=>void)|undefined;
  const leave=():void => {
    if (!active) return;
    active=false; delete document.body.dataset.broadcast;
    for(const [element,inert] of background) element.inert=inert;
    background.clear();
    toggle.setAttribute("aria-pressed","false");
    if (document.fullscreenElement===pitch) void document.exitFullscreen().catch(()=>{});
    document.dispatchEvent(new CustomEvent("pulse:presentation",{detail:{active:false}}));
    previousFocus?.focus({preventScroll:true}); refresh();
  };
  const enter=(fullscreen=false):void => {
    if (active) return;
    previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.dispatchEvent(new CustomEvent("pulse:show-live"));
    active=true; document.body.dataset.broadcast="true"; toggle.setAttribute("aria-pressed","true");
    for(let node:HTMLElement=pitch;node.parentElement;node=node.parentElement) {
      for(const sibling of node.parentElement.children) if(sibling!==node && sibling instanceof HTMLElement) {background.set(sibling,sibling.inert);sibling.inert=true;}
      if(node.parentElement===document.body) break;
    }
    document.dispatchEvent(new CustomEvent("pulse:presentation",{detail:{active:true}}));
    exit.focus({preventScroll:true}); refresh();
    if (fullscreen && pitch.requestFullscreen) void pitch.requestFullscreen().then(()=>{
      if(!active && document.fullscreenElement===pitch) void document.exitFullscreen().catch(()=>{});
      else native=true;
    }).catch(()=>{native=false;});
  };
  toggle.addEventListener("click",()=>active?leave():enter(true));
  exit.addEventListener("click",leave);
  document.addEventListener("keydown",event=>{if(event.key==="Escape" && active && !dialog.open){event.preventDefault();leave();}});
  document.addEventListener("fullscreenchange",()=>{
    if(document.fullscreenElement===pitch){native=true;return;}
    if(native){native=false;leave();}
  });
  evidence.addEventListener("click",()=>inspect?.());
  document.querySelector("#share-link-close")!.addEventListener("click",()=>dialog.close());
  document.querySelector("#share-link-copy")!.addEventListener("click",()=>void copy(input.value));
  const announce=(message:string):void => {document.querySelector<HTMLElement>("#share-announcement")!.textContent=t(message);};
  const copy=async(url:string):Promise<void> => {
    input.value=url;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      announce("Evidence link copied");
      const button=document.querySelector<HTMLButtonElement>("#share-button")!;
      button.replaceChildren(createElement(Check)); button.title=t("Evidence link copied");
      clearTimeout(copyTimer);
      copyTimer=window.setTimeout(()=>{button.replaceChildren(createElement(Copy));button.title=t("Copy evidence link");},2000);
      if (dialog.open) dialog.close();
    } catch {
      announce("Clipboard unavailable");
      if (!dialog.open) dialog.showModal();
      input.focus(); input.select();
    }
  };
  exit.replaceChildren(createElement(X));
  return {active:()=>active,enter,copy,render(value,next) {
    if (clock.textContent!==value) clock.textContent=value;
    const key=next?`${next.key}:${next.text}:${next.label}`:"";
    if (key===captionKey) return;
    captionKey=key; caption.hidden=!next; inspect=next?.evidence; evidence.hidden=!inspect;
    if (next) {
      text.textContent=next.text; caption.dataset.cueId=next.key;
      badge.hidden=next.status==="none";
      if(next.status!=="none") setBadge(badge,next.status,next.label,Boolean(next.recorded));
    } else {text.textContent="";delete caption.dataset.cueId;}
    document.querySelector<HTMLElement>("#broadcast-estimate")!.hidden=!next?.estimate;
  }};
}
