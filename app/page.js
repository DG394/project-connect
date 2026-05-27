"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";

/* ============================================================
   AI + API HELPERS
   ============================================================ */
async function callAI(messages) {
  try {
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
    const data = await res.json();
    if (data.error) return "Error: " + data.error;
    return data.text;
  } catch (err) { return "Error: " + err.message; }
}

async function parseResumeAPI(text) {
  const res = await fetch("/api/parse-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeText: text }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.parsed || null;
}

async function enrichCompanyAPI(url) {
  const res = await fetch("/api/enrich-company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.parsed || null;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsText(file);
  });
}

/* ============================================================
   COLUMN DEFINITIONS
   ============================================================ */
const PEOPLE_COLS = [
  { key: "full_name", label: "Name", req: true },
  { key: "current_title", label: "Title" },
  { key: "current_company", label: "Company" },
  { key: "education", label: "Education" },
  { key: "pe_exposure", label: "PE Exposure" },
  { key: "location", label: "Location" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "headline", label: "Headline" },
  { key: "certifications", label: "Certifications" },
];
const COMPANY_COLS = [
  { key: "name", label: "Company", req: true },
  { key: "headquarters", label: "HQ" },
  { key: "industry", label: "Industry" },
  { key: "revenue", label: "Revenue" },
  { key: "ownership_type", label: "Ownership" },
  { key: "pe_investor", label: "PE Investor" },
  { key: "bd_status", label: "BD Status" },
  { key: "employees", label: "Employees" },
  { key: "website", label: "Website" },
];
const ENG_COLS = [
  { key: "role_title", label: "Role", req: true },
  { key: "company_name", label: "Company" },
  { key: "pe_firm", label: "PE Firm" },
  { key: "status", label: "Status" },
  { key: "engagement_code", label: "Code" },
  { key: "launch_date", label: "Launch Date" },
  { key: "location", label: "Location" },
  { key: "comp_range", label: "Comp Range" },
  { key: "practice_area", label: "Practice Area" },
];
const CAND_COLS = [
  { key: "full_name", label: "Name", req: true },
  { key: "current_title", label: "Title" },
  { key: "current_company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "pe_exposure", label: "PE Exposure" },
  { key: "location", label: "Location" },
  { key: "education", label: "Education" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];
const CAND_STATUSES = ["Researching","Outreach Sent","Screen Scheduled","Interested","Client Submitted","Interview","Finalist","Offer","Placed","Declined","Passed"];
const P_DOC_TYPES = [{v:"resume",l:"Resume"},{v:"job_offer",l:"Job Offer"},{v:"non_compete",l:"Non-Compete"},{v:"nda",l:"NDA"},{v:"other",l:"Other"}];
const E_DOC_TYPES = [{v:"job_description",l:"Job Description"},{v:"client_contract",l:"Client Contract"},{v:"org_chart",l:"Org Chart"},{v:"get_smart",l:"Get Smart"},{v:"client_description",l:"Client Description"},{v:"client_report",l:"Client Report"},{v:"other",l:"Other"}];
const C_DOC_TYPES = [{v:"org_chart",l:"Org Chart"},{v:"client_contract",l:"Client Contract"},{v:"client_report",l:"Client Report"},{v:"other",l:"Other"}];

/* ============================================================
   UI PRIMITIVES
   ============================================================ */
function StatusBadge({status}) {
  const m = {Active:"text-green-400 bg-green-400/10",Completed:"text-green-400 bg-green-400/10","On Hold":"text-amber-400 bg-amber-400/10","Screen Scheduled":"text-blue-400 bg-blue-400/10","Outreach Sent":"text-amber-400 bg-amber-400/10","Client Submitted":"text-green-400 bg-green-400/10",Interested:"text-purple-400 bg-purple-400/10",Declined:"text-red-400 bg-red-400/10",Researching:"text-gray-400 bg-gray-400/10",Client:"text-green-400 bg-green-400/10",Target:"text-blue-400 bg-blue-400/10",Prospect:"text-purple-400 bg-purple-400/10",None:"text-gray-500 bg-gray-500/10","PE-Backed":"text-blue-400 bg-blue-400/10",Public:"text-amber-400 bg-amber-400/10",Private:"text-gray-400 bg-gray-400/10",Interview:"text-blue-400 bg-blue-400/10",Finalist:"text-purple-400 bg-purple-400/10",Offer:"text-amber-400 bg-amber-400/10",Placed:"text-green-400 bg-green-400/10",Passed:"text-gray-500 bg-gray-500/10"};
  return <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap " + (m[status] || "text-gray-400 bg-gray-400/10")}>{status}</span>;
}

function Card({children, className, onClick}) {
  return <div onClick={onClick} className={"bg-[#1A1F2B] border border-[#252B3A] rounded-[10px] p-5 " + (onClick ? "cursor-pointer hover:border-[#313848] transition-all " : "") + (className||"")}>{children}</div>;
}

function FormField({label, req, hint, children}) {
  return <div className="mb-4"><label className="block text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-1.5">{label}{req && <span className="text-red-400 ml-0.5">*</span>}</label>{children}{hint && <div className="text-[11px] text-[#555D73] mt-1">{hint}</div>}</div>;
}

function Input({value, onChange, placeholder, type, className}) {
  return <input type={type||"text"} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={"w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none focus:border-[#4F8BF5] transition-colors " + (className||"")} />;
}

function TextArea({value, onChange, placeholder, rows}) {
  return <textarea value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows||4} className="w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none focus:border-[#4F8BF5] transition-colors resize-y leading-relaxed" />;
}

function Sel({value, onChange, options, className}) {
  return <select value={value||""} onChange={e=>onChange(e.target.value)} className={"w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none cursor-pointer " + (className||"")} style={{appearance:"none",backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' fill=\'%238891A5\' viewBox=\'0 0 16 16\'%3E%3Cpath d=\'M8 11L3 6h10z\'/%3E%3C/svg%3E")',backgroundRepeat:"no-repeat",backgroundPosition:"right 12px center"}}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>;
}

function Btn({children, onClick, variant, disabled, className}) {
  const v = {primary:"bg-[#4F8BF5] text-white hover:bg-[#4F8BF5]/90",secondary:"bg-transparent text-[#8891A5] border border-[#313848] hover:border-[#8891A5]",success:"bg-[#34D399] text-white hover:bg-[#34D399]/90",danger:"bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"};
  return <button onClick={onClick} disabled={disabled} className={"px-4 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed " + (v[variant||"primary"]||v.primary) + " " + (className||"")}>{children}</button>;
}

function Divider({label}) {
  return <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-[#252B3A]" />{label&&<span className="text-[10px] font-bold text-[#555D73] uppercase tracking-widest">{label}</span>}{label&&<div className="flex-1 h-px bg-[#252B3A]" />}</div>;
}

function SlidePanel({open, onClose, title, wide, children}) {
  if (!open) return null;
  return <>
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[200]" />
    <div className={"fixed top-0 right-0 h-screen bg-[#12161F] border-l border-[#252B3A] z-[201] flex flex-col " + (wide ? "w-[700px]" : "w-[520px]")} style={{boxShadow:"-8px 0 32px rgba(0,0,0,0.4)"}}>
      <div className="flex justify-between items-center px-6 py-5 border-b border-[#252B3A]"><h2 className="text-lg font-bold text-[#E2E6EF]">{title}</h2><button onClick={onClose} className="bg-transparent border-none text-[#8891A5] text-xl cursor-pointer hover:text-[#E2E6EF]">&times;</button></div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  </>;
}

function AddBtn({label, onClick}) { return <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#4F8BF5] text-white text-xs font-semibold cursor-pointer hover:bg-[#4F8BF5]/90 transition-all"><span className="text-base leading-none">+</span> {label}</button>; }
function BackBtn({onClick, label}) { return <button onClick={onClick} className="inline-flex items-center gap-1 text-sm text-[#8891A5] hover:text-[#E2E6EF] cursor-pointer bg-transparent border-none mb-4 transition-colors">{"\u2190"} {label||"Back"}</button>; }
function EmptyState({text}) { return <div className="text-sm text-[#555D73] text-center py-8">{text}</div>; }
function LoadingDots() { return <div className="flex items-center gap-2 py-8 justify-center"><div className="w-2 h-2 rounded-full bg-[#4F8BF5] animate-pulse" /><span className="text-sm text-[#4F8BF5]">Loading...</span></div>; }
function LoadingBlock({label}) { return <div className="py-8"><div className="flex items-center gap-3 justify-center mb-4"><div className="w-2 h-2 rounded-full bg-[#4F8BF5] animate-pulse" /><span className="text-sm text-[#4F8BF5] font-medium">{label}</span></div><div className="space-y-2.5">{[...Array(6)].map((_,i)=><div key={i} className="shimmer-line h-3 rounded" style={{width:(85-i*8)+"%"}} />)}</div></div>; }
function ErrorMsg({msg, onDismiss}) { if (!msg) return null; return <div className="px-3 py-2 bg-red-500/10 rounded-md border border-red-500/20 mb-4 flex justify-between items-start"><span className="text-xs text-red-400">{msg}</span>{onDismiss && <button onClick={onDismiss} className="text-red-400 ml-2 cursor-pointer bg-transparent border-none text-sm">&times;</button>}</div>; }
function SuccessMsg({msg}) { if (!msg) return null; return <div className="px-3 py-2 bg-[#34D399]/10 rounded-md border border-[#34D399]/20 mb-4 text-xs text-[#34D399] font-medium">{msg}</div>; }
function ProfileSection({title, action, children}) { return <div className="mb-6"><div className="flex justify-between items-center mb-3"><h3 className="text-sm font-semibold text-[#8891A5] uppercase tracking-wider">{title}</h3>{action}</div>{children}</div>; }

/* Search bar */
function SearchBar({value, onChange, placeholder}) {
  return <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555D73] text-sm">&#x2315;</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search..."} className="w-full pl-8 pr-3 py-2 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none focus:border-[#4F8BF5] transition-colors" /></div>;
}

/* Column chooser */
function ColChooser({allCols, visKeys, onChange}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);
  return <div ref={ref} className="relative"><button onClick={()=>setOpen(!open)} className="px-3 py-2 bg-[#181D28] border border-[#252B3A] rounded-md text-xs text-[#8891A5] cursor-pointer hover:border-[#313848]">&#x2699; Columns</button>{open&&<div className="absolute right-0 top-full mt-1 bg-[#1A1F2B] border border-[#313848] rounded-md shadow-lg z-50 w-48 py-1">{allCols.map(c=><label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#E2E6EF] hover:bg-[#252B3A] cursor-pointer"><input type="checkbox" checked={visKeys.includes(c.key)} onChange={()=>{if(c.req)return;onChange(visKeys.includes(c.key)?visKeys.filter(k=>k!==c.key):[...visKeys,c.key])}} disabled={c.req} className="accent-[#4F8BF5]" />{c.label}{c.req?" *":""}</label>)}</div>}</div>;
}

/* Context menu */
function CtxMenu({x,y,items,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))onClose()};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[onClose]);
  return <div ref={ref} className="fixed bg-[#1A1F2B] border border-[#313848] rounded-md shadow-xl z-[300] py-1 min-w-[160px]" style={{left:x,top:y}}>{items.map((it,i)=>it.divider?<div key={i} className="h-px bg-[#252B3A] my-1"/>:<button key={i} onClick={()=>{it.onClick();onClose()}} className={"w-full text-left px-3 py-2 text-sm cursor-pointer bg-transparent border-none hover:bg-[#252B3A] transition-colors "+(it.danger?"text-red-400":"text-[#E2E6EF]")}>{it.icon&&<span className="mr-2">{it.icon}</span>}{it.label}</button>)}</div>;
}

/* Auto-suggest input */
function AutoSuggest({value, onChange, onSelect, suggestions, placeholder}) {
  const [open,setOpen]=useState(false);
  const [filtered,setFiltered]=useState([]);
  const ref=useRef(null);
  useEffect(()=>{if(value&&value.length>1){const f=suggestions.filter(s=>s.label.toLowerCase().includes(value.toLowerCase()));setFiltered(f.slice(0,5));setOpen(f.length>0)}else setOpen(false)},[value,suggestions]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);
  return <div ref={ref} className="relative"><Input value={value} onChange={onChange} placeholder={placeholder} />{open&&<div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1F2B] border border-[#313848] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">{filtered.map(s=><div key={s.id} onClick={()=>{onSelect(s);setOpen(false)}} className="px-3 py-2 text-sm text-[#E2E6EF] hover:bg-[#252B3A] cursor-pointer border-b border-[#252B3A] last:border-b-0"><div className="font-medium">{s.label}</div>{s.sub&&<div className="text-[11px] text-[#555D73]">{s.sub}</div>}</div>)}</div>}</div>;
}

/* Editable field */
function EditField({label, value, onSave, type, options}) {
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(value||"");
  useEffect(()=>setVal(value||""),[value]);
  if(editing) return <div className="mb-3"><div className="text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{label}</div>{type==="select"?<Sel value={val} onChange={setVal} options={options}/>:type==="textarea"?<TextArea value={val} onChange={setVal} rows={3}/>:<Input value={val} onChange={setVal}/>}<div className="flex gap-1 mt-1"><button onClick={()=>{onSave(val);setEditing(false)}} className="text-[11px] text-[#34D399] cursor-pointer bg-transparent border-none hover:underline">Save</button><button onClick={()=>{setVal(value||"");setEditing(false)}} className="text-[11px] text-[#555D73] cursor-pointer bg-transparent border-none hover:underline">Cancel</button></div></div>;
  return <div className="mb-3 group cursor-pointer" onClick={()=>setEditing(true)}><div className="text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{label}</div><div className="text-sm text-[#E2E6EF] mt-0.5 flex items-center gap-1">{value||<span className="text-[#555D73] italic">Click to add</span>}<span className="text-[#555D73] opacity-0 group-hover:opacity-100 transition-opacity text-xs">{"\u270E"}</span></div></div>;
}

/* Sortable Table */
function SortTable({data, cols, visKeys, onRowClick, onRowCtx, sortKey, sortDir, onSort, renderCell}) {
  const vc=cols.filter(c=>visKeys.includes(c.key));
  const sorted=useMemo(()=>{if(!sortKey)return data;return[...data].sort((a,b)=>{let av=a[sortKey]||"",bv=b[sortKey]||"";if(typeof av==="string")av=av.toLowerCase();if(typeof bv==="string")bv=bv.toLowerCase();return av<bv?(sortDir==="asc"?-1:1):av>bv?(sortDir==="asc"?1:-1):0})},[data,sortKey,sortDir]);
  return <table className="w-full text-sm"><thead><tr>{vc.map(c=><th key={c.key} onClick={()=>onSort(c.key)} className="text-left px-3 py-2.5 border-b border-[#313848] text-[11px] font-semibold text-[#555D73] uppercase tracking-wider cursor-pointer hover:text-[#8891A5] select-none">{c.label} {sortKey===c.key?(sortDir==="asc"?"\u2191":"\u2193"):""}</th>)}</tr></thead><tbody>{sorted.map((row,i)=><tr key={row.id||i} onClick={()=>onRowClick&&onRowClick(row)} onContextMenu={e=>{e.preventDefault();onRowCtx&&onRowCtx(e,row)}} className="border-b border-[#252B3A] hover:bg-[#181D28] cursor-pointer transition-colors">{vc.map(c=><td key={c.key} className="px-3 py-3">{renderCell?renderCell(row,c.key):c.key==="status"||c.key==="bd_status"||c.key==="ownership_type"?<StatusBadge status={row[c.key]||"\u2014"}/>:c.key==="name"&&row.logo_url?<div className="flex items-center gap-2"><img src={row.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-white" onError={e=>{e.target.style.display="none"}}/><span className="font-semibold text-[#E2E6EF]">{row[c.key]}</span></div>:(c.key==="full_name"||c.key==="name"||c.key==="role_title")?<span className="font-semibold text-[#E2E6EF]">{row[c.key]||"\u2014"}</span>:c.key==="engagement_code"?<span className="font-mono text-xs text-[#555D73]">{row[c.key]||"\u2014"}</span>:<span className="text-[#8891A5]">{row[c.key]||"\u2014"}</span>}</td>)}</tr>)}</tbody></table>;
}

/* Document Manager */
function DocMgr({entityType, entityId, docTypes}) {
  const [docs,setDocs]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [selType,setSelType]=useState(docTypes?.[0]?.v||"other");
  const fr=useRef(null);
  const fetch_=useCallback(async()=>{if(!entityId)return;const col=entityType==="person"?"person_id":entityType==="company"?"company_id":"engagement_id";const{data}=await supabase.from("documents").select("*").eq(col,entityId).order("created_at",{ascending:false});setDocs(data||[])},[entityType,entityId]);
  useEffect(()=>{fetch_()},[fetch_]);
  const upload=async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);const path=entityType+"/"+entityId+"/"+Date.now()+"_"+file.name;const{error:ue}=await supabase.storage.from("documents").upload(path,file);if(!ue){const{data:{publicUrl}}=supabase.storage.from("documents").getPublicUrl(path);const col=entityType==="person"?"person_id":entityType==="company"?"company_id":"engagement_id";await supabase.from("documents").insert([{[col]:entityId,file_name:file.name,file_type:selType,document_type:selType,file_url:publicUrl,file_size:file.size}]);fetch_()}setUploading(false);if(fr.current)fr.current.value=""};
  const typeLabel=t=>{const all=[...P_DOC_TYPES,...E_DOC_TYPES,...C_DOC_TYPES];const f=all.find(d=>d.v===t);return f?f.l:t};
  return <div><div className="flex items-center gap-2 mb-3 flex-wrap"><select value={selType} onChange={e=>setSelType(e.target.value)} className="px-2 py-1.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-xs outline-none cursor-pointer">{(docTypes||P_DOC_TYPES).map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select><input ref={fr} type="file" onChange={upload} className="hidden"/><Btn variant="secondary" onClick={()=>fr.current?.click()} disabled={uploading} className="text-xs py-1.5 px-3">{uploading?"Uploading...":"+ Upload"}</Btn></div>{docs.length===0?<div className="text-xs text-[#555D73] py-3">No documents uploaded yet.</div>:<div className="space-y-1.5">{docs.map(d=><a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2 bg-[#181D28] rounded-md border border-[#252B3A] hover:border-[#313848] transition-colors no-underline"><div className="flex items-center gap-2"><span className="text-[#4F8BF5] text-sm">{"\u25C6"}</span><span className="text-sm text-[#E2E6EF]">{d.file_name}</span><span className="text-[10px] text-[#555D73] bg-[#252B3A] px-1.5 py-0.5 rounded">{typeLabel(d.document_type||d.file_type)}</span></div><span className="text-[11px] text-[#555D73]">{d.file_size?(d.file_size/1024).toFixed(0)+" KB":""}</span></a>)}</div>}</div>;
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar({section, onNav}) {
  const groups=[{label:"WORKSPACE",items:[{id:"dashboard",icon:"\u25C6",label:"Dashboard"},{id:"engagements",icon:"\u25C8",label:"Engagements"},{id:"people",icon:"\u25C9",label:"People"},{id:"companies",icon:"\u25A3",label:"Companies"}]},{label:"SEARCH",items:[{id:"launcher",icon:"\u25B6",label:"Search Launcher"}]},{label:"INTELLIGENCE",items:[{id:"compensation",icon:"\u25C7",label:"Comp Intelligence"},{id:"bd",icon:"\u25B7",label:"BD Pipeline"}]}];
  return <div className="w-[220px] h-screen bg-[#12161F] border-r border-[#252B3A] flex flex-col fixed left-0 top-0 z-[100]"><div className="px-5 py-4 border-b border-[#252B3A]"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white" style={{background:"linear-gradient(135deg, #4F8BF5, #A78BFA)"}}>P</div><div><div className="text-sm font-bold text-[#E2E6EF]">Project Connect</div><div className="text-[11px] text-[#8891A5]">Executive Search</div></div></div></div><div className="flex-1 p-3 overflow-y-auto">{groups.map(g=><div key={g.label} className="mb-5"><div className="text-[10px] font-bold text-[#555D73] tracking-widest px-2 mb-1.5">{g.label}</div>{g.items.map(it=><button key={it.id} onClick={()=>onNav(it.id)} className={"flex items-center gap-2.5 w-full px-2.5 py-2 border-none rounded-md cursor-pointer text-sm text-left transition-all "+(section===it.id?"bg-[#4F8BF5]/10 text-[#4F8BF5] font-semibold":"bg-transparent text-[#8891A5] hover:text-[#E2E6EF]")}><span className="text-sm opacity-70">{it.icon}</span>{it.label}</button>)}</div>)}</div></div>;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({counts, onNav}) {
  return <div><h1 className="text-2xl font-bold mb-1">Good morning</h1><p className="text-sm text-[#8891A5] mb-6">Here is what is happening across your practice.</p><div className="grid grid-cols-4 gap-3 mb-6">{[{l:"Active Searches",v:counts.eng,c:"text-[#4F8BF5]"},{l:"People",v:counts.ppl,c:"text-[#34D399]"},{l:"Companies",v:counts.co,c:"text-[#A78BFA]"},{l:"BD Targets",v:counts.bd,c:"text-[#FBBF24]"}].map(m=><Card key={m.l}><div className="text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-2">{m.l}</div><div className={"text-3xl font-bold "+m.c}>{m.v}</div></Card>)}</div><Card><h3 className="text-base font-semibold mb-4">Quick Actions</h3>{[{l:"Launch New Search",d:"Start a new engagement with AI-generated deliverables",s:"launcher"},{l:"Add Person",d:"Add a candidate, client, or contact",s:"people"},{l:"Add Company",d:"Add a company to your database",s:"companies"}].map(a=><div key={a.l} onClick={()=>onNav(a.s)} className="flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-[#181D28] transition-colors border-b border-[#252B3A] last:border-b-0"><div><div className="text-sm font-semibold text-[#E2E6EF]">{a.l}</div><div className="text-xs text-[#8891A5] mt-0.5">{a.d}</div></div><span className="text-[#555D73]">{"\u2192"}</span></div>)}</Card></div>;
}

/* ============================================================
   PEOPLE
   ============================================================ */
function PeopleView({people, companies, loading, onRefresh, onViewProfile, onNav}) {
  const [showAdd,setShowAdd]=useState(false);
  const [showParse,setShowParse]=useState(false);
  const [parseText,setParseText]=useState("");
  const [parsing,setParsing]=useState(false);
  const [parseErr,setParseErr]=useState("");
  const [form,setForm]=useState({});
  const [workHist,setWorkHist]=useState([]);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [sKey,setSKey]=useState("full_name");
  const [sDir,setSDir]=useState("asc");
  const [cols,setCols]=useState(["full_name","current_title","current_company","education","pe_exposure","location"]);
  const [ctx,setCtx]=useState(null);
  const fRef=useRef(null);
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));
  const coSugg=companies.map(c=>({id:c.id,label:c.name,sub:c.headquarters}));
  const filtered=useMemo(()=>{if(!search)return people;const s=search.toLowerCase();return people.filter(p=>Object.values(p).some(v=>v&&String(v).toLowerCase().includes(s)))},[people,search]);
  const doSort=k=>{if(sKey===k)setSDir(d=>d==="asc"?"desc":"asc");else{setSKey(k);setSDir("asc")}};

  const handleFileParse=async e=>{const file=e.target.files?.[0];if(!file)return;try{const t=await readFileText(file);setParseText(t)}catch{setParseErr("Could not read file. Try pasting the text instead.")}if(fRef.current)fRef.current.value=""};

  const handleParse=async()=>{if(!parseText)return;setParsing(true);setParseErr("");try{const r=await parseResumeAPI(parseText);if(r){const{work_history,...person}=r;setForm(person);setWorkHist(work_history||[]);setShowParse(false);setShowAdd(true)}}catch(err){setParseErr(err.message)}setParsing(false)};

  const handleSave=async()=>{if(!form.full_name)return;setSaving(true);const{work_history:_,id:existingId,...personData}=form;
    if(existingId){await supabase.from("people").update(personData).eq("id",existingId);onRefresh();setShowAdd(false);setForm({});setSaving(false);return}
    const{data:person,error}=await supabase.from("people").insert([personData]).select().single();
    if(!error&&person){
      if(workHist.length>0)await supabase.from("work_history").insert(workHist.map(wh=>({...wh,person_id:person.id})));
      if(form.current_company){
        const match=companies.find(c=>c.name.toLowerCase()===form.current_company.toLowerCase());
        if(match){await supabase.from("person_company_links").insert([{person_id:person.id,company_id:match.id,relationship_type:"current",title_at_company:form.current_title}]).catch(()=>{})}
        else{const{data:newCo}=await supabase.from("companies").insert([{name:form.current_company}]).select().single();if(newCo)await supabase.from("person_company_links").insert([{person_id:person.id,company_id:newCo.id,relationship_type:"current",title_at_company:form.current_title}]).catch(()=>{})}
      }
      if(parseText){const blob=new Blob([parseText],{type:"text/plain"});const path="person/"+person.id+"/"+Date.now()+"_resume.txt";const{error:ue}=await supabase.storage.from("documents").upload(path,blob);if(!ue){const{data:{publicUrl}}=supabase.storage.from("documents").getPublicUrl(path);await supabase.from("documents").insert([{person_id:person.id,file_name:"Resume (parsed)",file_type:"resume",document_type:"resume",file_url:publicUrl,file_size:blob.size}])}}
      onRefresh();setShowAdd(false);setForm({});setWorkHist([]);setParseText("")}
    setSaving(false)};

  const handleDel=async id=>{if(!confirm("Delete this person? This cannot be undone."))return;await supabase.from("people").delete().eq("id",id);onRefresh()};

  return <div><div className="flex justify-between items-start mb-5"><div><h1 className="text-2xl font-bold mb-1">People</h1><p className="text-sm text-[#8891A5]">{people.length} records</p></div><div className="flex gap-2"><Btn variant="secondary" onClick={()=>{setShowParse(true);setParseErr("");setParseText("")}} className="text-xs">Parse Resume</Btn><AddBtn label="Add Person" onClick={()=>{setForm({});setWorkHist([]);setShowAdd(true)}}/></div></div>
    <div className="flex gap-3 mb-3 items-center"><SearchBar value={search} onChange={setSearch} placeholder="Search people..."/><ColChooser allCols={PEOPLE_COLS} visKeys={cols} onChange={setCols}/></div>
    <Card>{loading?<LoadingDots/>:filtered.length===0?<EmptyState text={search?"No people match your search.":"No people yet. Add your first person or parse a resume."}/>:<SortTable data={filtered} cols={PEOPLE_COLS} visKeys={cols} onRowClick={r=>onViewProfile(r.id)} onRowCtx={(e,r)=>setCtx({x:e.clientX,y:e.clientY,row:r})} sortKey={sKey} sortDir={sDir} onSort={doSort}/>}</Card>
    {ctx&&<CtxMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} items={[{label:"Edit",icon:"\u270E",onClick:()=>{setForm(ctx.row);setShowAdd(true)}},{label:"Add to Engagement",icon:"\u25C8",onClick:()=>onNav("engagements")},{divider:true},{label:"Delete",icon:"\u2715",danger:true,onClick:()=>handleDel(ctx.row.id)}]}/>}
    <SlidePanel open={showParse} onClose={()=>setShowParse(false)} title="Parse Resume" wide><p className="text-sm text-[#8891A5] mb-4">Upload a resume file or paste the text below. AI will extract structured data and pre-fill the form.</p><ErrorMsg msg={parseErr} onDismiss={()=>setParseErr("")}/><div className="flex gap-2 mb-4"><input ref={fRef} type="file" accept=".txt,.doc,.docx,.pdf,.rtf" onChange={handleFileParse} className="hidden"/><Btn variant="secondary" onClick={()=>fRef.current?.click()} className="text-xs">Upload Resume File</Btn><span className="text-xs text-[#555D73] self-center">or paste below</span></div><TextArea value={parseText} onChange={setParseText} placeholder="Paste the full resume text here..." rows={16}/><div className="flex justify-end mt-4"><Btn onClick={handleParse} disabled={!parseText||parsing}>{parsing?"Parsing...":"Parse & Pre-fill Form \u2192"}</Btn></div></SlidePanel>
    <SlidePanel open={showAdd} onClose={()=>{setShowAdd(false);setForm({});setWorkHist([])}} title={form.id?"Edit Person":"Add Person"} wide>
      {Object.keys(form).length>0&&form.full_name&&!form.id&&<SuccessMsg msg="Pre-filled from resume parsing. Review and edit before saving."/>}
      <Divider label="Basic Information"/>
      <div className="grid grid-cols-2 gap-3"><FormField label="Full Name" req><Input value={form.full_name} onChange={v=>u("full_name",v)} placeholder="e.g., Sarah Chen"/></FormField><FormField label="Current Title"><Input value={form.current_title} onChange={v=>u("current_title",v)} placeholder="e.g., VP Finance"/></FormField></div>
      <FormField label="Current Company" hint="If not in database, it will be auto-created."><AutoSuggest value={form.current_company||""} onChange={v=>u("current_company",v)} onSelect={s=>u("current_company",s.label)} suggestions={coSugg} placeholder="Start typing..."/></FormField>
      <FormField label="Headline"><Input value={form.headline} onChange={v=>u("headline",v)} placeholder="One-line professional summary"/></FormField>
      <div className="grid grid-cols-2 gap-3"><FormField label="Email"><Input value={form.email} onChange={v=>u("email",v)} placeholder="email@co.com" type="email"/></FormField><FormField label="Phone"><Input value={form.phone} onChange={v=>u("phone",v)} placeholder="(555) 123-4567"/></FormField></div>
      <FormField label="Location"><Input value={form.location} onChange={v=>u("location",v)} placeholder="e.g., Nashville, TN"/></FormField>
      <FormField label="LinkedIn"><Input value={form.linkedin_url} onChange={v=>u("linkedin_url",v)} placeholder="linkedin.com/in/..."/></FormField>
      <Divider label="Background"/>
      <FormField label="Education"><Input value={form.education} onChange={v=>u("education",v)} placeholder="e.g., MBA, Vanderbilt Owen"/></FormField>
      <FormField label="Certifications"><Input value={form.certifications} onChange={v=>u("certifications",v)} placeholder="e.g., CPA, CFA"/></FormField>
      <FormField label="PE Exposure"><Input value={form.pe_exposure} onChange={v=>u("pe_exposure",v)} placeholder="e.g., KKR, Bain Capital"/></FormField>
      <FormField label="Summary"><TextArea value={form.summary} onChange={v=>u("summary",v)} placeholder="2-3 sentence career summary..." rows={3}/></FormField>
      {workHist.length>0&&<><Divider label="Work History (parsed)"/>{workHist.map((wh,i)=><div key={i} className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 border-l-2 border-l-[#4F8BF5]"><div className="text-sm font-semibold text-[#E2E6EF]">{wh.title}</div><div className="text-xs text-[#8891A5]">{wh.company_name} {"\u00B7"} {wh.start_year} {"\u2013"} {wh.end_year||"Present"}</div></div>)}</>}
      <Divider label="Notes"/><FormField label="Notes"><TextArea value={form.notes} onChange={v=>u("notes",v)} placeholder="Any additional context..." rows={3}/></FormField>
      <Btn onClick={handleSave} disabled={!form.full_name||saving} className="w-full mt-2">{saving?"Saving...":form.id?"Save Changes":"Add Person"}</Btn>
    </SlidePanel>
  </div>;
}

/* Person Profile */
function PersonProfile({personId, onBack, companies, onNav}) {
  const [person,setPerson]=useState(null);
  const [hist,setHist]=useState([]);
  const [comp,setComp]=useState([]);
  const [cands,setCands]=useState([]);
  const [loading,setLoading]=useState(true);
  const fetch_=useCallback(async()=>{setLoading(true);const[{data:p},{data:wh},{data:cr},{data:ca}]=await Promise.all([supabase.from("people").select("*").eq("id",personId).single(),supabase.from("work_history").select("*").eq("person_id",personId).order("start_year",{ascending:false}),supabase.from("compensation_records").select("*").eq("person_id",personId).order("recorded_date",{ascending:false}),supabase.from("candidates").select("*, engagements(id,role_title,company_name,status,engagement_code)").eq("person_id",personId)]);setPerson(p);setHist(wh||[]);setComp(cr||[]);setCands(ca||[]);setLoading(false)},[personId]);
  useEffect(()=>{fetch_()},[fetch_]);
  const upd=async(k,v)=>{await supabase.from("people").update({[k]:v}).eq("id",personId);setPerson(p=>({...p,[k]:v}))};
  if(loading)return<LoadingDots/>;if(!person)return<EmptyState text="Person not found."/>;
  return <div><BackBtn onClick={onBack} label="People"/>
    <div className="flex items-start gap-5 mb-6"><div className="w-16 h-16 rounded-full bg-[#4F8BF5]/10 border border-[#4F8BF5]/30 flex items-center justify-center text-xl font-bold text-[#4F8BF5] flex-shrink-0">{person.full_name?.charAt(0)}</div><div className="flex-1"><h1 className="text-2xl font-bold mb-0.5">{person.full_name}</h1><p className="text-sm text-[#8891A5]">{person.current_title}{person.current_company&&<>{" at "}<span onClick={()=>{const co=companies.find(c=>c.name?.toLowerCase()===person.current_company?.toLowerCase());if(co)onNav("companies",co.id)}} className="text-[#4F8BF5] hover:underline cursor-pointer">{person.current_company}</span></>}</p>{person.headline&&<p className="text-sm text-[#4F8BF5] mt-1">{person.headline}</p>}</div></div>
    <div className="grid grid-cols-[1fr_360px] gap-5"><div>
      <Card className="mb-5"><ProfileSection title="Summary"><EditField label="" value={person.summary} onSave={v=>upd("summary",v)} type="textarea"/></ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title="Work History">{hist.length===0?<EmptyState text="No work history recorded."/>:hist.map((wh,i)=><div key={wh.id} className={"px-3 py-3 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 border-l-2 "+(i===0?"border-l-[#4F8BF5]":"border-l-[#313848]")}><div className="text-sm font-semibold text-[#E2E6EF]">{wh.title}</div><div className="text-xs text-[#8891A5]">{wh.company_name}</div><div className="text-[11px] text-[#555D73] mt-0.5">{wh.start_year} {"\u2013"} {wh.end_year||"Present"}</div></div>)}</ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title="Compensation History">{comp.length===0?<EmptyState text="No compensation data recorded."/>:comp.map(c=><div key={c.id} className="flex justify-between items-center px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2"><div><div className="text-sm text-[#E2E6EF]">{c.title} at {c.company_name}</div><div className="text-[11px] text-[#555D73]">Source: {c.source} {"\u00B7"} {c.recorded_date}</div></div><div className="text-right"><div className="text-sm font-semibold text-[#34D399]">{c.base_salary}{c.bonus_target?" + "+c.bonus_target:""}</div>{c.equity&&<div className="text-[11px] text-[#8891A5]">Equity: {c.equity}</div>}</div></div>)}</ProfileSection></Card>
      <Card><ProfileSection title="Documents"><DocMgr entityType="person" entityId={personId} docTypes={P_DOC_TYPES}/></ProfileSection></Card>
    </div><div>
      <Card className="mb-5"><ProfileSection title="Contact Information"><EditField label="Email" value={person.email} onSave={v=>upd("email",v)}/><EditField label="Phone" value={person.phone} onSave={v=>upd("phone",v)}/><EditField label="Location" value={person.location} onSave={v=>upd("location",v)}/><EditField label="LinkedIn" value={person.linkedin_url} onSave={v=>upd("linkedin_url",v)}/></ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title="Background"><EditField label="Education" value={person.education} onSave={v=>upd("education",v)}/><EditField label="Certifications" value={person.certifications} onSave={v=>upd("certifications",v)}/><EditField label="PE Exposure" value={person.pe_exposure} onSave={v=>upd("pe_exposure",v)}/></ProfileSection></Card>
      <Card><ProfileSection title="Engagements">{cands.length===0?<EmptyState text="Not linked to any engagements."/>:cands.map(c=><div key={c.id} onClick={()=>c.engagements&&onNav("engagements",c.engagements.id)} className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 cursor-pointer hover:border-[#313848] transition-colors"><div className="text-sm font-semibold text-[#4F8BF5]">{c.engagements?.role_title}</div><div className="text-xs text-[#8891A5]">{c.engagements?.company_name}</div><div className="flex items-center gap-2 mt-1"><StatusBadge status={c.status}/><span className="text-[11px] text-[#555D73]">{c.engagements?.engagement_code}</span></div></div>)}</ProfileSection></Card>
    </div></div>
  </div>;
}

/* ============================================================
   COMPANIES
   ============================================================ */
function CompaniesView({companies, loading, onRefresh, onViewProfile}) {
  const [showAdd,setShowAdd]=useState(false);const [form,setForm]=useState({});const [enriching,setEnriching]=useState(false);const [enrichUrl,setEnrichUrl]=useState("");const [enrichErr,setEnrichErr]=useState("");const [saving,setSaving]=useState(false);const [search,setSearch]=useState("");const [sKey,setSKey]=useState("name");const [sDir,setSDir]=useState("asc");const [cols,setCols]=useState(["name","headquarters","industry","revenue","ownership_type","pe_investor","bd_status"]);const [ctx,setCtx]=useState(null);
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));
  const filtered=useMemo(()=>{if(!search)return companies;const s=search.toLowerCase();return companies.filter(c=>Object.values(c).some(v=>v&&String(v).toLowerCase().includes(s)))},[companies,search]);
  const doSort=k=>{if(sKey===k)setSDir(d=>d==="asc"?"desc":"asc");else{setSKey(k);setSDir("asc")}};
  const handleEnrich=async()=>{if(!enrichUrl)return;setEnriching(true);setEnrichErr("");try{const r=await enrichCompanyAPI(enrichUrl);if(r)setForm(p=>({...p,...r}))}catch(e){setEnrichErr(e.message)}setEnriching(false)};
  const handleSave=async()=>{if(!form.name)return;setSaving(true);if(form.id)await supabase.from("companies").update(form).eq("id",form.id);else await supabase.from("companies").insert([form]);onRefresh();setShowAdd(false);setForm({});setEnrichUrl("");setSaving(false)};
  const handleDel=async id=>{if(!confirm("Delete this company?"))return;await supabase.from("companies").delete().eq("id",id);onRefresh()};

  return <div><div className="flex justify-between items-start mb-5"><div><h1 className="text-2xl font-bold mb-1">Companies</h1><p className="text-sm text-[#8891A5]">{companies.length} records</p></div><AddBtn label="Add Company" onClick={()=>{setForm({});setEnrichUrl("");setEnrichErr("");setShowAdd(true)}}/></div>
    <div className="flex gap-3 mb-3 items-center"><SearchBar value={search} onChange={setSearch} placeholder="Search companies..."/><ColChooser allCols={COMPANY_COLS} visKeys={cols} onChange={setCols}/></div>
    <Card>{loading?<LoadingDots/>:filtered.length===0?<EmptyState text={search?"No companies match.":"No companies yet."}/>:<SortTable data={filtered} cols={COMPANY_COLS} visKeys={cols} onRowClick={r=>onViewProfile(r.id)} onRowCtx={(e,r)=>setCtx({x:e.clientX,y:e.clientY,row:r})} sortKey={sKey} sortDir={sDir} onSort={doSort}/>}</Card>
    {ctx&&<CtxMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} items={[{label:"Edit",icon:"\u270E",onClick:()=>{setForm(ctx.row);setShowAdd(true)}},{divider:true},{label:"Delete",icon:"\u2715",danger:true,onClick:()=>handleDel(ctx.row.id)}]}/>}
    <SlidePanel open={showAdd} onClose={()=>{setShowAdd(false);setForm({});setEnrichUrl("")}} title={form.id?"Edit Company":"Add Company"} wide>
      {!form.id&&<div className="px-3 py-3 bg-[#4F8BF5]/10 rounded-md border border-[#4F8BF5]/20 mb-5"><div className="text-xs font-semibold text-[#4F8BF5] mb-2">Auto-populate from URL</div><div className="flex gap-2"><Input value={enrichUrl} onChange={setEnrichUrl} placeholder="Paste company website URL..." className="flex-1"/><Btn onClick={handleEnrich} disabled={!enrichUrl||enriching}>{enriching?"Fetching...":"Fetch"}</Btn></div><ErrorMsg msg={enrichErr} onDismiss={()=>setEnrichErr("")}/><div className="text-[11px] text-[#555D73] mt-1.5">Enter a URL and we will pull in company details automatically.</div></div>}
      {form.name&&!enriching&&Object.keys(form).length>1&&!form.id&&<SuccessMsg msg="Company data fetched. Review and edit before saving."/>}
      <Divider label="Company Information"/><FormField label="Company Name" req><Input value={form.name} onChange={v=>u("name",v)} placeholder="e.g., NovaBright Health"/></FormField><FormField label="Headquarters"><Input value={form.headquarters} onChange={v=>u("headquarters",v)} placeholder="e.g., Nashville, TN"/></FormField>
      <div className="grid grid-cols-2 gap-3"><FormField label="Industry"><Input value={form.industry} onChange={v=>u("industry",v)} placeholder="e.g., Behavioral Health"/></FormField><FormField label="Website"><Input value={form.website} onChange={v=>u("website",v)} placeholder="company.com"/></FormField></div>
      <Divider label="Financials"/><div className="grid grid-cols-2 gap-3"><FormField label="Revenue"><Input value={form.revenue} onChange={v=>u("revenue",v)} placeholder="e.g., $185M"/></FormField><FormField label="Employees"><Input value={form.employees} onChange={v=>u("employees",v)} placeholder="e.g., 1,200"/></FormField></div>
      <Divider label="Ownership"/><FormField label="Ownership Type"><Sel value={form.ownership_type} onChange={v=>u("ownership_type",v)} options={[{value:"",label:"Select..."},{value:"PE-Backed",label:"PE-Backed"},{value:"Public",label:"Public"},{value:"Private",label:"Private"},{value:"Family Owned",label:"Family Owned"},{value:"VC-Backed",label:"VC-Backed"},{value:"Nonprofit",label:"Nonprofit"}]}/></FormField>
      <FormField label="PE/VC Investor"><Input value={form.pe_investor} onChange={v=>u("pe_investor",v)} placeholder="e.g., Meridian Capital"/></FormField>
      <FormField label="BD Status"><Sel value={form.bd_status||"None"} onChange={v=>u("bd_status",v)} options={[{value:"None",label:"None"},{value:"Target",label:"Target"},{value:"Prospect",label:"Prospect"},{value:"Client",label:"Client"}]}/></FormField>
      <Divider label="Details"/><FormField label="Description"><TextArea value={form.description} onChange={v=>u("description",v)} placeholder="Company description..." rows={3}/></FormField><FormField label="Logo URL"><Input value={form.logo_url} onChange={v=>u("logo_url",v)} placeholder="URL to company logo"/></FormField>
      <Btn onClick={handleSave} disabled={!form.name||saving} className="w-full mt-2">{saving?"Saving...":form.id?"Save Changes":"Add Company"}</Btn>
    </SlidePanel>
  </div>;
}

/* Company Profile */
function CompanyProfile({companyId, onBack, onNav}) {
  const [co,setCo]=useState(null);const [ppl,setPpl]=useState([]);const [engs,setEngs]=useState([]);const [loading,setLoading]=useState(true);
  const fetch_=useCallback(async()=>{setLoading(true);const{data:c}=await supabase.from("companies").select("*").eq("id",companyId).single();setCo(c);if(c){const[{data:lk},{data:pd},{data:em}]=await Promise.all([supabase.from("person_company_links").select("*,people(id,full_name,current_title)").eq("company_id",companyId),supabase.from("people").select("id,full_name,current_title").eq("current_company",c.name),supabase.from("engagements").select("*").eq("company_name",c.name).order("created_at",{ascending:false})]);const all=[...(lk||[]).map(l=>l.people),...(pd||[])];setPpl(all.filter((p,i,a)=>p&&a.findIndex(x=>x?.id===p?.id)===i));setEngs(em||[])}setLoading(false)},[companyId]);
  useEffect(()=>{fetch_()},[fetch_]);
  const upd=async(k,v)=>{await supabase.from("companies").update({[k]:v}).eq("id",companyId);setCo(p=>({...p,[k]:v}))};
  if(loading)return<LoadingDots/>;if(!co)return<EmptyState text="Company not found."/>;
  return <div><BackBtn onClick={onBack} label="Companies"/>
    <div className="flex items-start gap-5 mb-6">{co.logo_url?<img src={co.logo_url} alt="" className="w-16 h-16 rounded-lg object-contain bg-white p-1 border border-[#252B3A]" onError={e=>{e.target.style.display="none"}}/>:<div className="w-16 h-16 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-xl font-bold text-[#A78BFA] flex-shrink-0">{co.name?.charAt(0)}</div>}<div className="flex-1"><h1 className="text-2xl font-bold mb-0.5">{co.name}</h1><p className="text-sm text-[#8891A5]">{co.headquarters}{co.industry?" \u00B7 "+co.industry:""}</p><div className="flex gap-2 mt-2">{co.ownership_type&&<StatusBadge status={co.ownership_type}/>}{co.bd_status&&co.bd_status!=="None"&&<StatusBadge status={co.bd_status}/>}</div></div></div>
    <div className="grid grid-cols-[1fr_360px] gap-5"><div>
      <Card className="mb-5"><ProfileSection title="About"><EditField label="" value={co.description} onSave={v=>upd("description",v)} type="textarea"/></ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title={"Engagements ("+engs.length+")"}>{engs.length===0?<EmptyState text="No engagements with this company."/>:engs.map(e=><div key={e.id} onClick={()=>onNav("engagements",e.id)} className="flex justify-between items-center px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 cursor-pointer hover:border-[#313848] transition-colors"><div><div className="text-sm font-semibold text-[#4F8BF5]">{e.role_title}</div><div className="text-xs text-[#8891A5]">{e.pe_firm?e.pe_firm+" \u00B7 ":""}{e.engagement_code}</div></div><StatusBadge status={e.status}/></div>)}</ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title={"People ("+ppl.length+")"}>{ppl.length===0?<EmptyState text="No people linked."/>:ppl.map(p=><div key={p.id} onClick={()=>onNav("people",p.id)} className="flex items-center gap-3 px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 cursor-pointer hover:border-[#313848] transition-colors"><div className="w-8 h-8 rounded-full bg-[#4F8BF5]/10 flex items-center justify-center text-xs font-bold text-[#4F8BF5]">{p.full_name?.charAt(0)}</div><div><div className="text-sm font-semibold text-[#E2E6EF]">{p.full_name}</div><div className="text-xs text-[#8891A5]">{p.current_title}</div></div></div>)}</ProfileSection></Card>
      <Card><ProfileSection title="Documents"><DocMgr entityType="company" entityId={companyId} docTypes={C_DOC_TYPES}/></ProfileSection></Card>
    </div><Card className="self-start sticky top-5"><ProfileSection title="Company Details"><EditField label="Revenue" value={co.revenue} onSave={v=>upd("revenue",v)}/><EditField label="Employees" value={co.employees} onSave={v=>upd("employees",v)}/><EditField label="Website" value={co.website} onSave={v=>upd("website",v)}/><EditField label="Ownership" value={co.ownership_type} onSave={v=>upd("ownership_type",v)} type="select" options={[{value:"",label:"Select..."},{value:"PE-Backed",label:"PE-Backed"},{value:"Public",label:"Public"},{value:"Private",label:"Private"},{value:"Family Owned",label:"Family Owned"},{value:"VC-Backed",label:"VC-Backed"},{value:"Nonprofit",label:"Nonprofit"}]}/><EditField label="PE Investor" value={co.pe_investor} onSave={v=>upd("pe_investor",v)}/><EditField label="BD Status" value={co.bd_status} onSave={v=>upd("bd_status",v)} type="select" options={[{value:"None",label:"None"},{value:"Target",label:"Target"},{value:"Prospect",label:"Prospect"},{value:"Client",label:"Client"}]}/></ProfileSection></Card></div>
  </div>;
}

/* ============================================================
   ENGAGEMENTS
   ============================================================ */
function EngView({engagements, companies, loading, onRefresh, onViewProfile}) {
  const [showAdd,setShowAdd]=useState(false);const [form,setForm]=useState({});const [saving,setSaving]=useState(false);const [search,setSearch]=useState("");const [sKey,setSKey]=useState("created_at");const [sDir,setSDir]=useState("desc");const [cols,setCols]=useState(["role_title","company_name","pe_firm","status","engagement_code","launch_date","location"]);const [ctx,setCtx]=useState(null);
  const u=(k,v)=>setForm(p=>({...p,[k]:v}));const coSugg=companies.map(c=>({id:c.id,label:c.name,sub:c.headquarters}));
  const filtered=useMemo(()=>{if(!search)return engagements;const s=search.toLowerCase();return engagements.filter(e=>Object.values(e).some(v=>v&&String(v).toLowerCase().includes(s)))},[engagements,search]);
  const doSort=k=>{if(sKey===k)setSDir(d=>d==="asc"?"desc":"asc");else{setSKey(k);setSDir("asc")}};
  const handleSave=async()=>{if(!form.role_title||!form.company_name)return;setSaving(true);if(form.id)await supabase.from("engagements").update(form).eq("id",form.id);else{const code="ENG-"+new Date().getFullYear()+"-"+String(Math.floor(Math.random()*900)+100);await supabase.from("engagements").insert([{...form,engagement_code:code,status:form.status||"Active"}])}onRefresh();setShowAdd(false);setForm({});setSaving(false)};
  const handleDel=async id=>{if(!confirm("Delete this engagement?"))return;await supabase.from("engagements").delete().eq("id",id);onRefresh()};

  return <div><div className="flex justify-between items-start mb-5"><div><h1 className="text-2xl font-bold mb-1">Engagements</h1><p className="text-sm text-[#8891A5]">{engagements.length} searches</p></div><AddBtn label="New Engagement" onClick={()=>{setForm({});setShowAdd(true)}}/></div>
    <div className="flex gap-3 mb-3 items-center"><SearchBar value={search} onChange={setSearch} placeholder="Search engagements..."/><ColChooser allCols={ENG_COLS} visKeys={cols} onChange={setCols}/></div>
    <Card>{loading?<LoadingDots/>:filtered.length===0?<EmptyState text={search?"No engagements match.":"No engagements yet."}/>:<SortTable data={filtered} cols={ENG_COLS} visKeys={cols} onRowClick={r=>onViewProfile(r.id)} onRowCtx={(e,r)=>setCtx({x:e.clientX,y:e.clientY,row:r})} sortKey={sKey} sortDir={sDir} onSort={doSort}/>}</Card>
    {ctx&&<CtxMenu x={ctx.x} y={ctx.y} onClose={()=>setCtx(null)} items={[{label:"Edit",icon:"\u270E",onClick:()=>{setForm(ctx.row);setShowAdd(true)}},{divider:true},{label:"Delete",icon:"\u2715",danger:true,onClick:()=>handleDel(ctx.row.id)}]}/>}
    <SlidePanel open={showAdd} onClose={()=>{setShowAdd(false);setForm({})}} title={form.id?"Edit Engagement":"New Engagement"}>
      <Divider label="Role Information"/><FormField label="Role Title" req><Input value={form.role_title} onChange={v=>u("role_title",v)} placeholder="e.g., Chief Financial Officer"/></FormField>
      <FormField label="Company" req><AutoSuggest value={form.company_name||""} onChange={v=>u("company_name",v)} onSelect={s=>u("company_name",s.label)} suggestions={coSugg} placeholder="Start typing..."/></FormField>
      <FormField label="PE/VC Firm"><Input value={form.pe_firm} onChange={v=>u("pe_firm",v)} placeholder="e.g., Meridian Capital"/></FormField>
      <div className="grid grid-cols-2 gap-3"><FormField label="Location"><Input value={form.location} onChange={v=>u("location",v)} placeholder="e.g., Nashville, TN"/></FormField><FormField label="Practice Area"><Sel value={form.practice_area} onChange={v=>u("practice_area",v)} options={[{value:"",label:"Select..."},{value:"Private Equity",label:"Private Equity"},{value:"CEO & Board",label:"CEO & Board"},{value:"Healthcare",label:"Healthcare"},{value:"Technology",label:"Technology"},{value:"Financial Services",label:"Financial Services"}]}/></FormField></div>
      {form.id&&<FormField label="Status"><Sel value={form.status} onChange={v=>u("status",v)} options={[{value:"Active",label:"Active"},{value:"On Hold",label:"On Hold"},{value:"Completed",label:"Completed"}]}/></FormField>}
      <Divider label="Scope"/><FormField label="Reporting To"><Input value={form.reporting_to} onChange={v=>u("reporting_to",v)} placeholder="e.g., CEO"/></FormField><FormField label="Team Size"><Input value={form.team_size} onChange={v=>u("team_size",v)} placeholder="e.g., 18"/></FormField><FormField label="Comp Range"><Input value={form.comp_range} onChange={v=>u("comp_range",v)} placeholder="e.g., $375K-$425K"/></FormField><FormField label="Notes"><TextArea value={form.notes} onChange={v=>u("notes",v)} placeholder="Additional context..." rows={3}/></FormField>
      <Btn onClick={handleSave} disabled={!form.role_title||!form.company_name||saving} className="w-full mt-2">{saving?"Saving...":form.id?"Save Changes":"Create Engagement"}</Btn>
    </SlidePanel>
  </div>;
}

/* Engagement Profile */
function EngProfile({engId, onBack, onNav, people}) {
  const [eng,setEng]=useState(null);const [cands,setCands]=useState([]);const [outputs,setOutputs]=useState(null);const [loading,setLoading]=useState(true);const [showAddCand,setShowAddCand]=useState(false);const [candSearch,setCandSearch]=useState("");const [candCols,setCandCols]=useState(["full_name","current_title","current_company","status","pe_exposure","location"]);const [candSort,setCandSort]=useState({key:"status",dir:"asc"});const [notes,setNotes]=useState([]);const [newNote,setNewNote]=useState("");
  const pplSugg=people.map(p=>({id:p.id,label:p.full_name,sub:(p.current_title||"")+" \u00B7 "+(p.current_company||"")}));
  const fetch_=useCallback(async()=>{setLoading(true);const[{data:e},{data:ca},{data:pn}]=await Promise.all([supabase.from("engagements").select("*").eq("id",engId).single(),supabase.from("candidates").select("*,people(id,full_name,current_title,current_company,pe_exposure,location,education,email,phone,headline)").eq("engagement_id",engId).order("created_at",{ascending:false}),supabase.from("progress_notes").select("*").eq("engagement_id",engId).order("created_at",{ascending:false})]);
    let outs=null;try{const{data:o}=await supabase.from("search_outputs").select("*").eq("engagement_id",engId).maybeSingle();outs=o}catch(err){}
    setEng(e);setCands(ca||[]);setOutputs(outs);setNotes(pn||[]);setLoading(false)},[engId]);
  useEffect(()=>{fetch_()},[fetch_]);
  const upd=async(k,v)=>{await supabase.from("engagements").update({[k]:v}).eq("id",engId);setEng(p=>({...p,[k]:v}))};
  const addCand=async pid=>{await supabase.from("candidates").insert([{engagement_id:engId,person_id:pid,status:"Researching"}]);fetch_();setShowAddCand(false);setCandSearch("")};
  const updCandStatus=async(cid,st)=>{await supabase.from("candidates").update({status:st}).eq("id",cid);setCands(p=>p.map(c=>c.id===cid?{...c,status:st}:c))};
  const addNote=async()=>{if(!newNote.trim())return;await supabase.from("progress_notes").insert([{engagement_id:engId,note:newNote}]);setNewNote("");const{data:pn}=await supabase.from("progress_notes").select("*").eq("engagement_id",engId).order("created_at",{ascending:false});setNotes(pn||[])};
  const candData=cands.map(c=>({id:c.id,person_id:c.people?.id,full_name:c.people?.full_name||"Unknown",current_title:c.people?.current_title||"",current_company:c.people?.current_company||"",status:c.status,pe_exposure:c.people?.pe_exposure||"",location:c.people?.location||"",education:c.people?.education||"",email:c.people?.email||"",phone:c.people?.phone||"",headline:c.people?.headline||""}));

  if(loading)return<LoadingDots/>;if(!eng)return<EmptyState text="Engagement not found."/>;
  return <div><BackBtn onClick={onBack} label="Engagements"/>
    <div className="flex items-start justify-between mb-6"><div><h1 className="text-2xl font-bold mb-0.5">{eng.role_title}</h1><p className="text-sm text-[#8891A5]"><span onClick={()=>{const co=eng.company_name;onNav("companies",null,co)}} className="text-[#4F8BF5] hover:underline cursor-pointer">{eng.company_name}</span>{eng.pe_firm?" \u00B7 "+eng.pe_firm:""}</p><div className="flex gap-2 mt-2"><StatusBadge status={eng.status}/><span className="text-xs text-[#555D73] font-mono">{eng.engagement_code}</span></div></div><div className="text-right">{eng.comp_range&&<div className="text-sm text-[#34D399] font-semibold">{eng.comp_range}</div>}{eng.location&&<div className="text-xs text-[#8891A5] mt-1">{eng.location}</div>}</div></div>
    <div className="grid grid-cols-4 gap-3 mb-6">{[{l:"Candidates",v:cands.length,c:"text-[#4F8BF5]"},{l:"Reporting To",v:eng.reporting_to||"\u2014",c:"text-[#E2E6EF]",s:true},{l:"Team Size",v:eng.team_size||"\u2014",c:"text-[#E2E6EF]",s:true},{l:"Launch Date",v:eng.launch_date||"\u2014",c:"text-[#E2E6EF]",s:true}].map(m=><Card key={m.l}><div className="text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-2">{m.l}</div><div className={(m.s?"text-sm":"text-2xl")+" font-bold "+m.c}>{m.v}</div></Card>)}</div>
    <div className="grid grid-cols-[1fr_360px] gap-5"><div>
      <Card className="mb-5"><ProfileSection title={"Candidates ("+cands.length+")"} action={<div className="flex gap-2 items-center"><ColChooser allCols={CAND_COLS} visKeys={candCols} onChange={setCandCols}/><AddBtn label="Add Candidate" onClick={()=>setShowAddCand(true)}/></div>}>{candData.length===0?<EmptyState text="No candidates added yet."/>:<SortTable data={candData} cols={CAND_COLS} visKeys={candCols} sortKey={candSort.key} sortDir={candSort.dir} onSort={k=>{if(candSort.key===k)setCandSort(s=>({...s,dir:s.dir==="asc"?"desc":"asc"}));else setCandSort({key:k,dir:"asc"})}} onRowClick={r=>r.person_id&&onNav("people",r.person_id)} renderCell={(row,key)=>{if(key==="full_name")return<span className="font-semibold text-[#4F8BF5]">{row.full_name}</span>;if(key==="status")return<select value={row.status} onClick={e=>e.stopPropagation()} onChange={e=>updCandStatus(row.id,e.target.value)} className="bg-transparent border border-[#252B3A] rounded px-1.5 py-0.5 text-xs text-[#E2E6EF] cursor-pointer outline-none">{CAND_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>;return<span className="text-[#8891A5]">{row[key]||"\u2014"}</span>}}/></ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title="Progress Notes"><div className="flex gap-2 mb-3"><Input value={newNote} onChange={setNewNote} placeholder="Add a note about this search..." className="flex-1"/><Btn onClick={addNote} disabled={!newNote.trim()} className="text-xs">Add</Btn></div>{notes.length===0?<EmptyState text="No notes yet."/>:notes.map(n=><div key={n.id} className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2"><div className="text-sm text-[#E2E6EF]">{n.note}</div><div className="text-[11px] text-[#555D73] mt-1">{new Date(n.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</div></div>)}</ProfileSection></Card>
      <Card className="mb-5"><ProfileSection title="Documents"><DocMgr entityType="engagement" entityId={engId} docTypes={E_DOC_TYPES}/></ProfileSection></Card>
      {outputs&&<Card><ProfileSection title="Search Launch Outputs">{["Scorecard","Job Description","Search Strategy","Recruiting Message","Target List"].map((label,i)=>{const keys=["scorecard","job_description","search_strategy","recruiting_message","target_list"];const content=outputs[keys[i]];if(!content)return null;return<details key={i} className="mb-2"><summary className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] cursor-pointer text-sm font-semibold text-[#E2E6EF] hover:border-[#313848]">{label} {"\u2713"}</summary><div className="px-4 py-4 bg-[#181D28] rounded-b-md border border-[#252B3A] border-t-0 text-sm text-[#8891A5] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{content}</div></details>})}</ProfileSection></Card>}
    </div>
    <Card className="self-start sticky top-5"><ProfileSection title="Engagement Details"><EditField label="Status" value={eng.status} onSave={v=>upd("status",v)} type="select" options={[{value:"Active",label:"Active"},{value:"On Hold",label:"On Hold"},{value:"Completed",label:"Completed"}]}/><EditField label="Practice Area" value={eng.practice_area} onSave={v=>upd("practice_area",v)} type="select" options={[{value:"",label:"Select..."},{value:"Private Equity",label:"Private Equity"},{value:"CEO & Board",label:"CEO & Board"},{value:"Healthcare",label:"Healthcare"},{value:"Technology",label:"Technology"},{value:"Financial Services",label:"Financial Services"}]}/><EditField label="Reporting To" value={eng.reporting_to} onSave={v=>upd("reporting_to",v)}/><EditField label="Team Size" value={eng.team_size} onSave={v=>upd("team_size",v)}/><EditField label="Comp Range" value={eng.comp_range} onSave={v=>upd("comp_range",v)}/><EditField label="Location" value={eng.location} onSave={v=>upd("location",v)}/><EditField label="Launch Date" value={eng.launch_date} onSave={v=>upd("launch_date",v)}/><EditField label="Notes" value={eng.notes} onSave={v=>upd("notes",v)} type="textarea"/></ProfileSection></Card></div>
    <SlidePanel open={showAddCand} onClose={()=>setShowAddCand(false)} title="Add Candidate to Search"><p className="text-sm text-[#8891A5] mb-4">Search for an existing person to add as a candidate.</p><FormField label="Search People"><AutoSuggest value={candSearch} onChange={setCandSearch} onSelect={s=>addCand(s.id)} suggestions={pplSugg} placeholder="Start typing a name..."/></FormField></SlidePanel>
  </div>;
}

/* ============================================================
   SEARCH LAUNCHER
   ============================================================ */
function inputCtx(inp){return"Role: "+inp.roleName+"\nCompany: "+inp.companyName+"\nPE Firm: "+(inp.peFirm||"N/A")+"\nLocation: "+(inp.location||"N/A")+"\nReporting To: "+(inp.reportingTo||"N/A")+"\nTeam Size: "+(inp.teamSize||"N/A")+"\nComp Range: "+(inp.compRange||"N/A")+"\nConfidential: "+(inp.confidential==="yes"?"Yes":"No")+"\n\nGET SMART:\n"+(inp.getSmart||"(N/A)")+"\n\nCLIENT DRAFT JD:\n"+(inp.draftJD||"(N/A)")+"\n\nKICK-OFF NOTES:\n"+(inp.kickoffNotes||"(N/A)")+"\n\nADDITIONAL:\n"+(inp.additionalContext||"(N/A)")}
function buildScorecard(d){return"Generate a scorecard.\n\n"+inputCtx(d.inputs)+"\n\nTwo sections: Experience & Qualifications (7-10), Leadership & Cultural Fit (3-4). Format: **[Header]:** [2-3 sentences]. Lead with role identity. No dashes, no filler, no names."}
function buildJD(d){return"Generate a Job Description.\n\n"+inputCtx(d.inputs)+"\n\nSCORECARD:\n"+d.scorecardEdited+"\n\nStructure: Title, Reporting/Team/Location, Company Desc, Scope (narrative+bullets), Key Criteria (scorecard verbatim). No dashes."}
function buildStrategy(d){return"Generate a Search Strategy.\n\n"+inputCtx(d.inputs)+"\n\nSCORECARD:\n"+d.scorecardEdited+"\n\nJD:\n"+d.jdEdited+"\n\nSections: Company Overview, Growth Story, Leadership Team, Competitive Landscape, Needs/Nice-to-haves, Comp & Process, Recruiting Message (placeholder). No dashes."}
function buildMsg(d){return"Generate a Recruiting Message.\n\n"+inputCtx(d.inputs)+"\n\nJD:\n"+d.jdEdited+"\n\n"+(d.inputs?.confidential==="yes"?"CONFIDENTIAL: do not name company/PE.":"Non-confidential.")+"\n\nFormat: Subject line, body (hook, narrative, soft close with referral ask). Short, authentic. No dashes."}
function buildTargets(d){return"Generate a Target List (company-level).\n\n"+inputCtx(d.inputs)+"\n\nSCORECARD:\n"+(d.scorecardEdited||"").substring(0,2000)+"\n\nCategories: Direct Competitors, Adjacent Industry, PE-Backed Platforms, Large Company Alumni. Each: Name, HQ, Size, Ownership, Why (1 sentence). 20-30 companies. No dashes."}

function Launcher({onRefresh, companies}) {
  const [step,setStep]=useState(0);const [done,setDone]=useState([]);const [data,setData]=useState({inputs:{confidential:"no"}});
  const steps=["Inputs","Scorecard","Job Description","Search Strategy","Recruiting Message","Target List"];
  const complete=i=>{if(!done.includes(i))setDone(p=>[...p,i]);setStep(i+1)};
  const coSugg=companies.map(c=>({id:c.id,label:c.name,sub:c.headquarters}));

  return <div><div className="flex justify-between items-start mb-6"><div><h1 className="text-2xl font-bold mb-1">Search Launcher</h1><p className="text-sm text-[#8891A5]">{data.inputs?.companyName?data.inputs.roleName+" \u00B7 "+data.inputs.companyName:"Launch a new retained search with AI-generated deliverables"}</p></div><div className="flex gap-1.5">{steps.map((_,i)=><div key={i} className={"w-8 h-1 rounded-sm transition-all "+(done.includes(i)?"bg-[#34D399]":step===i?"bg-[#4F8BF5]":"bg-[#252B3A]")}/>)}</div></div>
    <div className="grid grid-cols-[200px_1fr] gap-6"><div className="flex flex-col gap-1 sticky top-5 self-start">{steps.map((s,i)=>{const d2=done.includes(i);const act=step===i;const lock=i>0&&!done.includes(i-1)&&!act;return<button key={i} onClick={()=>!lock&&setStep(i)} className={"flex items-center gap-2.5 px-3 py-2.5 rounded-md w-full text-left text-sm transition-all "+(lock?"opacity-40 cursor-not-allowed":"cursor-pointer ")+(act?"bg-[#4F8BF5]/10 border border-[#4F8BF5]/40 font-semibold text-[#E2E6EF]":"bg-transparent border border-transparent text-[#8891A5]")}><div className={"w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-[1.5px] flex-shrink-0 "+(d2?"bg-[#34D399] border-[#34D399] text-white":act?"bg-[#4F8BF5] border-[#4F8BF5] text-white":"bg-[#181D28] border-[#313848] text-[#8891A5]")}>{d2?"\u2713":i+1}</div>{s}</button>})}</div>
      <div>
        {step===0&&<LauncherInputs data={data} setData={setData} onComplete={()=>complete(0)} coSugg={coSugg}/>}
        {step>=1&&step<=5&&<LauncherAI data={data} setData={setData} onComplete={()=>{complete(step);if(step===5)saveLaunch(data,onRefresh)}} stepKey={["scorecard","jd","strategy","message","targets"][step-1]} title={steps[step]} builder={[buildScorecard,buildJD,buildStrategy,buildMsg,buildTargets][step-1]}/>}
      </div>
    </div>
  </div>;
}

function LauncherInputs({data, setData, onComplete, coSugg}) {
  const d=data.inputs||{};const u=(k,v)=>setData(p=>({...p,inputs:{...p.inputs,[k]:v}}));
  const [inferErr,setInferErr]=useState("");
  const [inferring,setInferring]=useState(false);
  const fRef1=useRef(null);const fRef2=useRef(null);const fRef3=useRef(null);
  const ok=d.roleName&&d.companyName&&(d.getSmart||d.kickoffNotes);

  const uploadField=async(e,field)=>{const file=e.target.files?.[0];if(!file)return;try{const t=await readFileText(file);u(field,t)}catch{setInferErr("Could not read file.")}};

  const autoInfer=async()=>{if(!d.getSmart&&!d.kickoffNotes&&!d.draftJD)return;setInferring(true);setInferErr("");
    try{const text="Based on these search documents, extract the following fields. Return ONLY valid JSON:\n{\"roleName\":\"\",\"companyName\":\"\",\"peFirm\":\"\",\"location\":\"\",\"reportingTo\":\"\",\"teamSize\":\"\",\"compRange\":\"\",\"confidential\":\"yes or no\"}\n\nGET SMART:\n"+(d.getSmart||"N/A")+"\n\nDRAFT JD:\n"+(d.draftJD||"N/A")+"\n\nKICK-OFF NOTES:\n"+(d.kickoffNotes||"N/A");
      const res=await callAI([{role:"user",content:text}]);const cleaned=res.replace(/```json|```/g,"").trim();const match=cleaned.match(/\{[\s\S]*\}/);
      if(match){const parsed=JSON.parse(match[0]);Object.entries(parsed).forEach(([k,v])=>{if(v&&!d[k])u(k,v)})}}
    catch(err){setInferErr("Could not auto-infer fields: "+err.message)}
    setInferring(false)};

  return <div><h2 className="text-lg font-bold mb-1">Search Inputs</h2><p className="text-sm text-[#8891A5] mb-6">Provide the foundation. The more you give, the better.</p>
    <Divider label="Foundation Documents"/>
    <FormField label="Get Smart" hint="Internal research. Upload or paste."><div className="flex gap-2 mb-2"><input ref={fRef1} type="file" accept=".txt,.doc,.docx,.pdf,.rtf" onChange={e=>uploadField(e,"getSmart")} className="hidden"/><Btn variant="secondary" onClick={()=>fRef1.current?.click()} className="text-xs py-1 px-2">Upload File</Btn>{d.getSmart&&<span className="text-xs text-[#34D399] self-center">{"\u2713"} Loaded</span>}</div><TextArea value={d.getSmart} onChange={v=>u("getSmart",v)} placeholder="Paste your Get Smart..." rows={6}/></FormField>
    <FormField label="Client Draft JD"><div className="flex gap-2 mb-2"><input ref={fRef2} type="file" accept=".txt,.doc,.docx,.pdf,.rtf" onChange={e=>uploadField(e,"draftJD")} className="hidden"/><Btn variant="secondary" onClick={()=>fRef2.current?.click()} className="text-xs py-1 px-2">Upload File</Btn>{d.draftJD&&<span className="text-xs text-[#34D399] self-center">{"\u2713"} Loaded</span>}</div><TextArea value={d.draftJD} onChange={v=>u("draftJD",v)} placeholder="Client's draft JD..." rows={5}/></FormField>
    <FormField label="Kick-Off Notes" req><div className="flex gap-2 mb-2"><input ref={fRef3} type="file" accept=".txt,.doc,.docx,.pdf,.rtf" onChange={e=>uploadField(e,"kickoffNotes")} className="hidden"/><Btn variant="secondary" onClick={()=>fRef3.current?.click()} className="text-xs py-1 px-2">Upload File</Btn>{d.kickoffNotes&&<span className="text-xs text-[#34D399] self-center">{"\u2713"} Loaded</span>}</div><TextArea value={d.kickoffNotes} onChange={v=>u("kickoffNotes",v)} placeholder="Your kick-off notes..." rows={6}/></FormField>
    {(d.getSmart||d.kickoffNotes||d.draftJD)&&!d.roleName&&<div className="mb-4"><Btn variant="secondary" onClick={autoInfer} disabled={inferring} className="text-xs">{inferring?"Inferring fields...":"Auto-fill fields from documents"}</Btn></div>}
    <ErrorMsg msg={inferErr} onDismiss={()=>setInferErr("")}/>
    <Divider label="Role & Company"/>
    <div className="grid grid-cols-2 gap-3"><FormField label="Role Title" req><Input value={d.roleName} onChange={v=>u("roleName",v)} placeholder="e.g., Chief Financial Officer"/></FormField><FormField label="Company Name" req><AutoSuggest value={d.companyName||""} onChange={v=>u("companyName",v)} onSelect={s=>u("companyName",s.label)} suggestions={coSugg} placeholder="e.g., NovaBright"/></FormField></div>
    <div className="grid grid-cols-2 gap-3"><FormField label="PE/VC Firm"><Input value={d.peFirm} onChange={v=>u("peFirm",v)} placeholder="e.g., Meridian Capital"/></FormField><FormField label="Location"><Input value={d.location} onChange={v=>u("location",v)} placeholder="e.g., Nashville, TN"/></FormField></div>
    <div className="grid grid-cols-3 gap-3"><FormField label="Reporting To"><Input value={d.reportingTo} onChange={v=>u("reportingTo",v)} placeholder="e.g., CEO"/></FormField><FormField label="Team Size"><Input value={d.teamSize} onChange={v=>u("teamSize",v)} placeholder="e.g., 18"/></FormField><FormField label="Comp Range"><Input value={d.compRange} onChange={v=>u("compRange",v)} placeholder="e.g., $375K-$425K"/></FormField></div>
    <FormField label="Confidential?"><Sel value={d.confidential||"no"} onChange={v=>u("confidential",v)} options={[{value:"no",label:"No"},{value:"yes",label:"Yes"}]}/></FormField>
    <FormField label="Additional Context"><TextArea value={d.additionalContext} onChange={v=>u("additionalContext",v)} placeholder="Anything else..." rows={3}/></FormField>
    <div className="flex justify-end mt-2"><Btn onClick={onComplete} disabled={!ok}>Save Inputs & Generate Scorecard {"\u2192"}</Btn></div>
  </div>;
}

function LauncherAI({data, setData, onComplete, stepKey, title, builder}) {
  const [output,setOutput]=useState(data[stepKey+"Output"]||"");
  const [edited,setEdited]=useState(data[stepKey+"Edited"]||"");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const run=async()=>{setLoading(true);setError("");const r=await callAI([{role:"user",content:builder(data)}]);if(r.startsWith("Error:"))setError(r);else{setOutput(r);setEdited(r);setData(p=>({...p,[stepKey+"Output"]:r,[stepKey+"Edited"]:r}))}setLoading(false)};
  useEffect(()=>{if(!output)run()},[]);
  return <div><h2 className="text-lg font-bold mb-1">{title}</h2><p className="text-sm text-[#8891A5] mb-5">Review, edit, and approve.</p>
    <ErrorMsg msg={error} onDismiss={()=>setError("")}/>
    {loading?<LoadingBlock label={"Generating "+title.toLowerCase()+"..."}/>:output?<><div className="px-3 py-2 bg-[#4F8BF5]/10 rounded-md border border-[#4F8BF5]/20 mb-4 text-xs text-[#4F8BF5] font-medium">Edit below. Changes carry forward.</div><TextArea value={edited} onChange={v=>{setEdited(v);setData(p=>({...p,[stepKey+"Edited"]:v}))}} rows={22}/><div className="flex gap-2 mt-3 justify-end"><Btn variant="secondary" onClick={run}>Regenerate</Btn><Btn variant="success" onClick={()=>{setData(p=>({...p,[stepKey+"Edited"]:edited}));onComplete()}}>Approve & Continue {"\u2192"}</Btn></div></>:null}
  </div>;
}

async function saveLaunch(data, onRefresh) {
  const inp=data.inputs||{};const code="ENG-"+new Date().getFullYear()+"-"+String(Math.floor(Math.random()*900)+100);
  const{data:eng}=await supabase.from("engagements").insert([{engagement_code:code,role_title:inp.roleName,company_name:inp.companyName,pe_firm:inp.peFirm,location:inp.location,reporting_to:inp.reportingTo,team_size:inp.teamSize,comp_range:inp.compRange,confidential:inp.confidential==="yes",status:"Active"}]).select().single();
  if(eng)await supabase.from("search_outputs").insert([{engagement_id:eng.id,inputs:inp,scorecard:data.scorecardEdited,job_description:data.jdEdited,search_strategy:data.strategyEdited,recruiting_message:data.messageEdited,target_list:data.targetsEdited,current_step:5,completed:true}]);
  if(onRefresh)onRefresh();
}

/* ============================================================
   PLACEHOLDER
   ============================================================ */
function Placeholder({title, desc}) {
  return <div><h1 className="text-2xl font-bold mb-1">{title}</h1><p className="text-sm text-[#8891A5] mb-6">{desc}</p><Card><EmptyState text="Coming soon."/></Card></div>;
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  const [section,setSection]=useState("dashboard");
  const [profileId,setProfileId]=useState(null);
  const [people,setPeople]=useState([]);
  const [companies,setCompanies]=useState([]);
  const [engagements,setEngagements]=useState([]);
  const [bd,setBd]=useState([]);
  const [loading,setLoading]=useState(true);

  const fetchAll=useCallback(async()=>{setLoading(true);const[p,c,e,b]=await Promise.all([supabase.from("people").select("*").order("created_at",{ascending:false}),supabase.from("companies").select("*").order("created_at",{ascending:false}),supabase.from("engagements").select("*").order("created_at",{ascending:false}),supabase.from("bd_pipeline").select("*").order("created_at",{ascending:false})]);setPeople(p.data||[]);setCompanies(c.data||[]);setEngagements(e.data||[]);setBd(b.data||[]);setLoading(false)},[]);
  useEffect(()=>{fetchAll()},[fetchAll]);

  const nav=(s,id,companyNameLookup)=>{
    if(companyNameLookup&&!id){
      const co=companies.find(c=>c.name?.toLowerCase()===companyNameLookup.toLowerCase());
      if(co){setSection(s);setProfileId(co.id);return}
    }
    setSection(s);setProfileId(id||null);
  };
  const counts={ppl:people.length,co:companies.length,eng:engagements.filter(e=>e.status==="Active").length,bd:bd.length};

  const render=()=>{
    if(section==="people"&&profileId)return<PersonProfile personId={profileId} onBack={()=>setProfileId(null)} companies={companies} onNav={nav}/>;
    if(section==="companies"&&profileId)return<CompanyProfile companyId={profileId} onBack={()=>setProfileId(null)} onNav={nav}/>;
    if(section==="engagements"&&profileId)return<EngProfile engId={profileId} onBack={()=>setProfileId(null)} onNav={nav} people={people}/>;
    switch(section){
      case "dashboard":return<Dashboard counts={counts} onNav={nav}/>;
      case "people":return<PeopleView people={people} companies={companies} loading={loading} onRefresh={fetchAll} onViewProfile={id=>setProfileId(id)} onNav={nav}/>;
      case "companies":return<CompaniesView companies={companies} loading={loading} onRefresh={fetchAll} onViewProfile={id=>setProfileId(id)}/>;
      case "engagements":return<EngView engagements={engagements} companies={companies} loading={loading} onRefresh={fetchAll} onViewProfile={id=>setProfileId(id)}/>;
      case "launcher":return<Launcher onRefresh={fetchAll} companies={companies}/>;
      case "compensation":return<Placeholder title="Compensation Intelligence" desc="Natural language querying against your proprietary comp data."/>;
      case "bd":return<Placeholder title="BD Pipeline" desc="AI-surfaced opportunities and business development tracking."/>;
      default:return<Dashboard counts={counts} onNav={nav}/>;
    }
  };

  return <>
    <style dangerouslySetInnerHTML={{__html:`
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#0B0E14;color:#E2E6EF;font-family:'Instrument Sans','DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
      ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#313848;border-radius:3px}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      .animate-pulse{animation:pulse 1.5s infinite}
      .shimmer-line{background:linear-gradient(90deg,#252B3A 25%,#313848 50%,#252B3A 75%);background-size:800px;animation:shimmer 1.5s infinite linear}
    `}}/>
    <Sidebar section={section} onNav={s=>{setSection(s);setProfileId(null)}}/>
    <div className="ml-[220px] p-7 min-h-screen">{render()}</div>
  </>;
}
