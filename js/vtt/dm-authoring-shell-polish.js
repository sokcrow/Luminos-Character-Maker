const STYLE_ID='vtt-dm-authoring-polish-style',HEADER_ID='vtt-dm-authoring-header';

function injectStyles(doc){
  if(!doc||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
.vtt-edit-sidebar{width:228px!important;gap:8px!important;padding:10px!important;background:rgba(7,9,11,.975)!important;border-color:#76652f!important;scrollbar-width:thin;scrollbar-color:#59636c #0a0d0f}
#${HEADER_ID}{position:sticky;top:-10px;z-index:5;margin:-2px -2px 2px;padding:9px 8px 10px;background:linear-gradient(180deg,#121619 0%,#0a0d0f 100%);border-bottom:1px solid #76652f;box-shadow:0 5px 10px rgba(0,0,0,.28)}#${HEADER_ID} strong{display:block;color:#e6c861;font:700 11px/1 monospace;letter-spacing:.16em}#${HEADER_ID} small{display:block;margin-top:4px;color:#7f8a92;font:8px/1 monospace;letter-spacing:.14em}
.vtt-edit-sidebar .vtt-toolbar,.vtt-edit-sidebar .vtt-light-toolbar{border:1px solid #343c42!important;background:#0c1013!important;padding:8px!important;box-shadow:0 2px 0 rgba(0,0,0,.35)}.vtt-edit-sidebar .vtt-toolbar-title{color:#d7b151!important;font-size:9px!important;letter-spacing:.14em!important;padding:2px 1px 7px!important}.vtt-edit-sidebar .brutalist-button{min-height:36px;border-color:#485159!important;background:#11161a!important;color:#e2e7ea!important;transition:border-color .12s ease,background .12s ease,color .12s ease,transform .12s ease}.vtt-edit-sidebar .brutalist-button:hover:not(:disabled){border-color:#8e7a39!important;background:#171c1f!important}.vtt-edit-sidebar .brutalist-button.is-active,.vtt-edit-sidebar .brutalist-button[aria-pressed="true"]{border-color:#d7b151!important;background:#27210f!important;color:#f2dc8d!important}.vtt-edit-sidebar button:focus-visible,.vtt-edit-sidebar input:focus-visible,.vtt-edit-sidebar select:focus-visible{outline:2px solid #e6c861!important;outline-offset:2px}.vtt-edit-sidebar button:disabled{opacity:.38!important;cursor:not-allowed!important}.vtt-edit-sidebar input,.vtt-edit-sidebar select{background:#080b0d!important;border:1px solid #465058!important;color:#edf1f3!important;padding:7px!important;box-sizing:border-box}.vtt-edit-sidebar .vtt-toolbar-field{gap:4px!important}.vtt-edit-sidebar .vtt-toolbar-field>label,.vtt-edit-sidebar label{letter-spacing:.04em}.vtt-panel,.vtt-light-panel{right:254px!important}.vtt-vertical-panel{right:584px!important}
@media(max-width:900px){.vtt-edit-sidebar{width:176px!important}.vtt-panel,.vtt-light-panel{right:200px!important}.vtt-vertical-panel{right:200px!important}}
`;doc.head.appendChild(style);
}

function ensureHeader(doc){
  const sidebar=doc?.getElementById?.('vtt-edit-sidebar');if(!sidebar)return null;
  let header=doc.getElementById(HEADER_ID);if(!header){header=doc.createElement('header');header.id=HEADER_ID;header.innerHTML='<strong>DM MAP TOOLS</strong><small>AUTHORING MODE</small>';}
  if(sidebar.firstElementChild!==header)sidebar.prepend(header);return header;
}

export function install({root=window}={}){
  const doc=root?.document;if(!doc)return()=>{};injectStyles(doc);ensureHeader(doc);
  const timer=root.setInterval?.(()=>ensureHeader(doc),500);return()=>{if(timer!=null)root.clearInterval?.(timer);doc.getElementById(HEADER_ID)?.remove();doc.getElementById(STYLE_ID)?.remove();};
}
