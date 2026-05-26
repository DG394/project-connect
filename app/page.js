"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

// ============================================================
// AI HELPER
// ============================================================
async function callAI(messages) {
  try {
    const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
    const data = await res.json();
    return data.error ? `Error: ${data.error}` : data.text;
  } catch (err) { return `Error: ${err.message}`; }
}

async function parseResume(text) {
  const res = await fetch("/api/parse-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeText: text }) });
  const data = await res.json();
  return data.parsed || null;
}

async function enrichCompany(url) {
  const res = await fetch("/api/enrich-company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  const data = await res.json();
  return data.parsed || null;
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
function StatusBadge({ status }) {
  const map = {
    Active: "text-green-400 bg-green-400/10", Completed: "text-green-400 bg-green-400/10",
    "On Hold": "text-amber-400 bg-amber-400/10", "Screen Scheduled": "text-blue-400 bg-blue-400/10",
    "Outreach Sent": "text-amber-400 bg-amber-400/10", "Client Submitted": "text-green-400 bg-green-400/10",
    Interested: "text-purple-400 bg-purple-400/10", Declined: "text-red-400 bg-red-400/10",
    Researching: "text-gray-400 bg-gray-400/10", Client: "text-green-400 bg-green-400/10",
    Target: "text-blue-400 bg-blue-400/10", Prospect: "text-purple-400 bg-purple-400/10",
    None: "text-gray-500 bg-gray-500/10", "PE-Backed": "text-blue-400 bg-blue-400/10",
    Public: "text-amber-400 bg-amber-400/10", Private: "text-gray-400 bg-gray-400/10",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${map[status] || "text-gray-400 bg-gray-400/10"}`}>{status}</span>;
}

function Card({ children, className = "", onClick }) {
  return <div onClick={onClick} className={`bg-[#1A1F2B] border border-[#252B3A] rounded-[10px] p-5 ${onClick ? "cursor-pointer hover:border-[#313848] transition-all" : ""} ${className}`}>{children}</div>;
}

function FormField({ label, required, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-[11px] text-[#555D73] mt-1">{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", className = "" }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none focus:border-[#4F8BF5] transition-colors ${className}`} />;
}

function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none focus:border-[#4F8BF5] transition-colors resize-y leading-relaxed" />;
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 bg-[#181D28] border border-[#252B3A] rounded-md text-[#E2E6EF] text-sm outline-none cursor-pointer" style={{ appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%238891A5' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false, className = "" }) {
  const v = { primary: "bg-[#4F8BF5] text-white hover:bg-[#4F8BF5]/90", secondary: "bg-transparent text-[#8891A5] border border-[#313848] hover:border-[#8891A5]", success: "bg-[#34D399] text-white hover:bg-[#34D399]/90", danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" };
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${v[variant]} ${className}`}>{children}</button>;
}

function Divider({ label }) {
  return <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-[#252B3A]" /><span className="text-[10px] font-bold text-[#555D73] uppercase tracking-widest">{label}</span><div className="flex-1 h-px bg-[#252B3A]" /></div>;
}

function SlidePanel({ open, onClose, title, wide, children }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[200]" style={{ animation: "fadeOverlay 0.2s ease" }} />
      <div className={`fixed top-0 right-0 ${wide ? "w-[640px]" : "w-[480px]"} h-screen bg-[#12161F] border-l border-[#252B3A] z-[201] flex flex-col`} style={{ animation: "slideInRight 0.3s ease", boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#252B3A]">
          <h2 className="text-lg font-bold text-[#E2E6EF]">{title}</h2>
          <button onClick={onClose} className="bg-transparent border-none text-[#8891A5] text-xl cursor-pointer hover:text-[#E2E6EF]">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

function AddBtn({ label, onClick }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#4F8BF5] text-white text-xs font-semibold cursor-pointer hover:bg-[#4F8BF5]/90 transition-all"><span className="text-base leading-none">+</span> {label}</button>;
}

function BackBtn({ onClick, label = "Back" }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 text-sm text-[#8891A5] hover:text-[#E2E6EF] cursor-pointer bg-transparent border-none mb-4 transition-colors">← {label}</button>;
}

function EmptyState({ text }) {
  return <div className="text-sm text-[#555D73] text-center py-8">{text}</div>;
}

function LoadingBlock({ label }) {
  return (
    <div className="py-8">
      <div className="flex items-center gap-3 justify-center mb-4"><div className="w-2 h-2 rounded-full bg-[#4F8BF5]" style={{ animation: "pulse 1.5s infinite" }} /><span className="text-sm text-[#4F8BF5] font-medium">{label}</span></div>
      <div className="space-y-2.5">{[...Array(6)].map((_, i) => <div key={i} className="shimmer-line h-3 rounded" style={{ width: `${85 - i * 8}%` }} />)}</div>
    </div>
  );
}

function LoadingDots() {
  return <div className="flex items-center gap-2 py-8 justify-center"><div className="w-2 h-2 rounded-full bg-[#4F8BF5]" style={{ animation: "pulse 1.5s infinite" }} /><span className="text-sm text-[#4F8BF5]">Loading...</span></div>;
}

function ProfileSection({ title, action, children }) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-[#8891A5] uppercase tracking-wider">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Auto-suggest input for linking records
function AutoSuggestInput({ value, onChange, onSelect, suggestions, placeholder }) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (value && value.length > 1) {
      const f = suggestions.filter(s => s.label.toLowerCase().includes(value.toLowerCase()));
      setFiltered(f.slice(0, 5));
      setOpen(f.length > 0);
    } else { setOpen(false); }
  }, [value, suggestions]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Input value={value} onChange={onChange} placeholder={placeholder} />
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1F2B] border border-[#313848] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <div key={s.id} onClick={() => { onSelect(s); setOpen(false); }} className="px-3 py-2 text-sm text-[#E2E6EF] hover:bg-[#252B3A] cursor-pointer border-b border-[#252B3A] last:border-b-0">
              <div className="font-medium">{s.label}</div>
              {s.sub && <div className="text-[11px] text-[#555D73]">{s.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Document uploader + list
function DocumentManager({ entityType, entityId }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const fetchDocs = useCallback(async () => {
    if (!entityId) return;
    const col = entityType === "person" ? "person_id" : entityType === "company" ? "company_id" : "engagement_id";
    const { data } = await supabase.from("documents").select("*").eq(col, entityId).order("created_at", { ascending: false });
    setDocs(data || []);
  }, [entityType, entityId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${entityType}/${entityId}/${Date.now()}_${file.name}`;
    const { data: upload, error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
    if (!uploadErr) {
      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
      const col = entityType === "person" ? "person_id" : entityType === "company" ? "company_id" : "engagement_id";
      await supabase.from("documents").insert([{ [col]: entityId, file_name: file.name, file_type: "other", file_url: publicUrl, file_size: file.size }]);
      fetchDocs();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
        <Btn variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs py-1.5 px-3">
          {uploading ? "Uploading..." : "+ Upload Document"}
        </Btn>
      </div>
      {docs.length === 0 ? (
        <div className="text-xs text-[#555D73] py-3">No documents uploaded yet.</div>
      ) : (
        <div className="space-y-1.5">
          {docs.map(d => (
            <a key={d.id} href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2 bg-[#181D28] rounded-md border border-[#252B3A] hover:border-[#313848] transition-colors no-underline">
              <div className="flex items-center gap-2">
                <span className="text-[#4F8BF5] text-sm">◆</span>
                <span className="text-sm text-[#E2E6EF]">{d.file_name}</span>
              </div>
              <span className="text-[11px] text-[#555D73]">{d.file_size ? `${(d.file_size / 1024).toFixed(0)} KB` : ""}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ section, onNavigate }) {
  const groups = [
    { label: "WORKSPACE", items: [{ id: "dashboard", icon: "◆", label: "Dashboard" }, { id: "engagements", icon: "◈", label: "Engagements" }, { id: "people", icon: "◉", label: "People" }, { id: "companies", icon: "▣", label: "Companies" }] },
    { label: "SEARCH", items: [{ id: "launcher", icon: "▶", label: "Search Launcher" }] },
    { label: "INTELLIGENCE", items: [{ id: "compensation", icon: "◇", label: "Comp Intelligence" }, { id: "bd", icon: "▷", label: "BD Pipeline" }] },
  ];
  return (
    <div className="w-[220px] h-screen bg-[#12161F] border-r border-[#252B3A] flex flex-col fixed left-0 top-0 z-[100]">
      <div className="px-5 py-4 border-b border-[#252B3A]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg, #4F8BF5, #A78BFA)" }}>P</div>
          <div><div className="text-sm font-bold text-[#E2E6EF]">Project Connect</div><div className="text-[11px] text-[#8891A5]">Executive Search</div></div>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        {groups.map(g => (
          <div key={g.label} className="mb-5">
            <div className="text-[10px] font-bold text-[#555D73] tracking-widest px-2 mb-1.5">{g.label}</div>
            {g.items.map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={`flex items-center gap-2.5 w-full px-2.5 py-2 border-none rounded-md cursor-pointer text-sm text-left transition-all ${section === item.id ? "bg-[#4F8BF5]/10 text-[#4F8BF5] font-semibold" : "bg-transparent text-[#8891A5] hover:text-[#E2E6EF]"}`}>
                <span className="text-sm opacity-70">{item.icon}</span>{item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function DashboardView({ counts, onNavigate }) {
  return (
    <div className="animate-fadeUp">
      <h1 className="text-2xl font-bold mb-1">Good morning</h1>
      <p className="text-sm text-[#8891A5] mb-6">Here is what is happening across your practice.</p>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[{ label: "Active Searches", value: counts.engagements, color: "text-[#4F8BF5]" }, { label: "People", value: counts.people, color: "text-[#34D399]" }, { label: "Companies", value: counts.companies, color: "text-[#A78BFA]" }, { label: "BD Targets", value: counts.bd, color: "text-[#FBBF24]" }].map(m => (
          <Card key={m.label}><div className="text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-2">{m.label}</div><div className={`text-3xl font-bold ${m.color}`}>{m.value}</div></Card>
        ))}
      </div>
      <Card>
        <h3 className="text-base font-semibold mb-4">Quick Actions</h3>
        {[{ label: "Launch New Search", desc: "Start a new engagement with AI-generated deliverables", section: "launcher" }, { label: "Add Person", desc: "Add a candidate, client, or contact", section: "people" }, { label: "Add Company", desc: "Add a company to your database", section: "companies" }].map(a => (
          <div key={a.label} onClick={() => onNavigate(a.section)} className="flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-[#181D28] transition-colors border-b border-[#252B3A] last:border-b-0">
            <div><div className="text-sm font-semibold text-[#E2E6EF]">{a.label}</div><div className="text-xs text-[#8891A5] mt-0.5">{a.desc}</div></div>
            <span className="text-[#555D73]">→</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ============================================================
// PEOPLE VIEW + PROFILE
// ============================================================
function PeopleView({ people, companies, loading, onRefresh, onViewProfile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showParse, setShowParse] = useState(false);
  const [parseText, setParseText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [form, setForm] = useState({});
  const [workHistory, setWorkHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const companySuggestions = companies.map(c => ({ id: c.id, label: c.name, sub: c.headquarters }));

  const handleParse = async () => {
    if (!parseText) return;
    setParsing(true);
    const result = await parseResume(parseText);
    if (result) {
      const { work_history, ...person } = result;
      setForm(person);
      setWorkHistory(work_history || []);
    }
    setParsing(false);
    setShowParse(false);
  };

  const handleSave = async () => {
    if (!form.full_name) return;
    setSaving(true);
    const { work_history: _, ...personData } = form;
    const { data: person, error } = await supabase.from("people").insert([personData]).select().single();
    if (!error && person) {
      // Save work history
      if (workHistory.length > 0) {
        await supabase.from("work_history").insert(workHistory.map(wh => ({ ...wh, person_id: person.id })));
      }
      // Auto-link to company if exists
      if (form.current_company) {
        const match = companies.find(c => c.name.toLowerCase() === form.current_company.toLowerCase());
        if (match) {
          await supabase.from("person_company_links").insert([{ person_id: person.id, company_id: match.id, relationship_type: "current", title_at_company: form.current_title }]).catch(() => {});
        }
      }
      onRefresh();
      setShowAdd(false);
      setForm({});
      setWorkHistory([]);
    }
    setSaving(false);
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div><h1 className="text-2xl font-bold mb-1">People</h1><p className="text-sm text-[#8891A5]">{people.length} records</p></div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => setShowParse(true)} className="text-xs">Parse Resume</Btn>
          <AddBtn label="Add Person" onClick={() => setShowAdd(true)} />
        </div>
      </div>
      <Card>
        {loading ? <LoadingDots /> : people.length === 0 ? <EmptyState text="No people yet. Add your first person or parse a resume." /> : (
          <table className="w-full text-sm">
            <thead><tr>{["Name", "Title", "Company", "Education", "PE Exposure"].map(h => <th key={h} className="text-left px-3 py-2.5 border-b border-[#313848] text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id} onClick={() => onViewProfile(p.id)} className="border-b border-[#252B3A] hover:bg-[#181D28] cursor-pointer transition-colors">
                  <td className="px-3 py-3 font-semibold text-[#E2E6EF]">{p.full_name}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{p.current_title || "—"}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{p.current_company || "—"}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{p.education || "—"}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{p.pe_exposure || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Parse Resume Panel */}
      <SlidePanel open={showParse} onClose={() => setShowParse(false)} title="Parse Resume" wide>
        <p className="text-sm text-[#8891A5] mb-4">Paste a resume below. AI will extract structured data and pre-fill the add person form.</p>
        <TextArea value={parseText} onChange={setParseText} placeholder="Paste the full resume text here..." rows={16} />
        <div className="flex justify-end mt-4">
          <Btn onClick={handleParse} disabled={!parseText || parsing}>{parsing ? "Parsing..." : "Parse & Pre-fill Form →"}</Btn>
        </div>
      </SlidePanel>

      {/* Add Person Panel */}
      <SlidePanel open={showAdd || (Object.keys(form).length > 0 && !showParse)} onClose={() => { setShowAdd(false); setForm({}); setWorkHistory([]); }} title="Add Person" wide>
        {Object.keys(form).length > 0 && form.full_name && (
          <div className="px-3 py-2 bg-[#34D399]/10 rounded-md border border-[#34D399]/20 mb-4 text-xs text-[#34D399] font-medium">Pre-filled from resume parsing. Review and edit before saving.</div>
        )}
        <Divider label="Basic Information" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Full Name" required><Input value={form.full_name || ""} onChange={v => u("full_name", v)} placeholder="e.g., Sarah Chen" /></FormField>
          <FormField label="Current Title"><Input value={form.current_title || ""} onChange={v => u("current_title", v)} placeholder="e.g., VP Finance" /></FormField>
        </div>
        <FormField label="Current Company">
          <AutoSuggestInput value={form.current_company || ""} onChange={v => u("current_company", v)} onSelect={s => u("current_company", s.label)} suggestions={companySuggestions} placeholder="Start typing to search existing companies..." />
        </FormField>
        <FormField label="Headline"><Input value={form.headline || ""} onChange={v => u("headline", v)} placeholder="One-line professional summary" /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Email"><Input value={form.email || ""} onChange={v => u("email", v)} placeholder="email@company.com" type="email" /></FormField>
          <FormField label="Phone"><Input value={form.phone || ""} onChange={v => u("phone", v)} placeholder="(555) 123-4567" /></FormField>
        </div>
        <FormField label="Location"><Input value={form.location || ""} onChange={v => u("location", v)} placeholder="e.g., Nashville, TN" /></FormField>
        <FormField label="LinkedIn"><Input value={form.linkedin_url || ""} onChange={v => u("linkedin_url", v)} placeholder="linkedin.com/in/..." /></FormField>
        <Divider label="Background" />
        <FormField label="Education"><Input value={form.education || ""} onChange={v => u("education", v)} placeholder="e.g., MBA, Vanderbilt Owen" /></FormField>
        <FormField label="Certifications"><Input value={form.certifications || ""} onChange={v => u("certifications", v)} placeholder="e.g., CPA, CFA" /></FormField>
        <FormField label="PE Exposure"><Input value={form.pe_exposure || ""} onChange={v => u("pe_exposure", v)} placeholder="e.g., KKR, Bain Capital" /></FormField>
        <FormField label="Summary"><TextArea value={form.summary || ""} onChange={v => u("summary", v)} placeholder="2-3 sentence career summary..." rows={3} /></FormField>
        {workHistory.length > 0 && (
          <>
            <Divider label="Work History (parsed)" />
            {workHistory.map((wh, i) => (
              <div key={i} className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 border-l-2 border-l-[#4F8BF5]">
                <div className="text-sm font-semibold text-[#E2E6EF]">{wh.title}</div>
                <div className="text-xs text-[#8891A5]">{wh.company_name} · {wh.start_year} – {wh.end_year || "Present"}</div>
              </div>
            ))}
          </>
        )}
        <Divider label="Notes" />
        <FormField label="Notes"><TextArea value={form.notes || ""} onChange={v => u("notes", v)} placeholder="Any additional context..." rows={3} /></FormField>
        <Btn onClick={handleSave} disabled={!form.full_name || saving} className="w-full mt-2">{saving ? "Saving..." : "Add Person"}</Btn>
      </SlidePanel>
    </div>
  );
}

// PERSON PROFILE
function PersonProfile({ personId, onBack, companies }) {
  const [person, setPerson] = useState(null);
  const [history, setHistory] = useState([]);
  const [comp, setComp] = useState([]);
  const [candidacies, setCandidacies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: wh }, { data: cr }, { data: cands }] = await Promise.all([
        supabase.from("people").select("*").eq("id", personId).single(),
        supabase.from("work_history").select("*").eq("person_id", personId).order("start_year", { ascending: false }),
        supabase.from("compensation_records").select("*").eq("person_id", personId).order("recorded_date", { ascending: false }),
        supabase.from("candidates").select("*, engagements(role_title, company_name, status, engagement_code)").eq("person_id", personId),
      ]);
      setPerson(p);
      setHistory(wh || []);
      setComp(cr || []);
      setCandidacies(cands || []);
      setLoading(false);
    })();
  }, [personId]);

  if (loading) return <LoadingDots />;
  if (!person) return <EmptyState text="Person not found." />;

  return (
    <div className="animate-fadeUp">
      <BackBtn onClick={onBack} label="People" />
      <div className="flex items-start gap-5 mb-6">
        <div className="w-16 h-16 rounded-full bg-[#4F8BF5]/10 border border-[#4F8BF5]/30 flex items-center justify-center text-xl font-bold text-[#4F8BF5] flex-shrink-0">{person.full_name?.charAt(0)}</div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-0.5">{person.full_name}</h1>
          <p className="text-sm text-[#8891A5]">{person.current_title}{person.current_company ? ` at ${person.current_company}` : ""}</p>
          {person.headline && <p className="text-sm text-[#4F8BF5] mt-1">{person.headline}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            {person.education && <StatusBadge status={person.education} />}
            {person.certifications && <StatusBadge status={person.certifications} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div>
          {person.summary && <Card className="mb-5"><ProfileSection title="Summary"><p className="text-sm text-[#8891A5] leading-relaxed">{person.summary}</p></ProfileSection></Card>}

          <Card className="mb-5">
            <ProfileSection title="Work History">
              {history.length === 0 ? <EmptyState text="No work history recorded." /> : history.map((wh, i) => (
                <div key={wh.id} className={`px-3 py-3 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 ${i === 0 ? "border-l-2 border-l-[#4F8BF5]" : "border-l-2 border-l-[#313848]"}`}>
                  <div className="text-sm font-semibold text-[#E2E6EF]">{wh.title}</div>
                  <div className="text-xs text-[#8891A5]">{wh.company_name}</div>
                  <div className="text-[11px] text-[#555D73] mt-0.5">{wh.start_year} – {wh.end_year || "Present"}</div>
                </div>
              ))}
            </ProfileSection>
          </Card>

          <Card className="mb-5">
            <ProfileSection title="Compensation History">
              {comp.length === 0 ? <EmptyState text="No compensation data recorded." /> : comp.map(c => (
                <div key={c.id} className="flex justify-between items-center px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2">
                  <div>
                    <div className="text-sm text-[#E2E6EF]">{c.title} at {c.company_name}</div>
                    <div className="text-[11px] text-[#555D73]">Source: {c.source} · {c.recorded_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[#34D399]">{c.base_salary}{c.bonus_target ? ` + ${c.bonus_target}` : ""}</div>
                    {c.equity && <div className="text-[11px] text-[#8891A5]">Equity: {c.equity}</div>}
                  </div>
                </div>
              ))}
            </ProfileSection>
          </Card>

          <Card>
            <ProfileSection title="Documents">
              <DocumentManager entityType="person" entityId={personId} />
            </ProfileSection>
          </Card>
        </div>

        <div>
          <Card className="mb-5">
            <ProfileSection title="Contact Information">
              {[{ label: "Email", value: person.email }, { label: "Phone", value: person.phone }, { label: "Location", value: person.location }, { label: "LinkedIn", value: person.linkedin_url }].map(f => f.value ? (
                <div key={f.label} className="mb-3"><div className="text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{f.label}</div><div className="text-sm text-[#E2E6EF] mt-0.5">{f.value}</div></div>
              ) : null)}
            </ProfileSection>
          </Card>

          {person.pe_exposure && (
            <Card className="mb-5">
              <ProfileSection title="PE Exposure"><p className="text-sm text-[#E2E6EF]">{person.pe_exposure}</p></ProfileSection>
            </Card>
          )}

          <Card>
            <ProfileSection title="Engagements">
              {candidacies.length === 0 ? <EmptyState text="Not linked to any engagements." /> : candidacies.map(c => (
                <div key={c.id} className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2">
                  <div className="text-sm font-semibold text-[#E2E6EF]">{c.engagements?.role_title}</div>
                  <div className="text-xs text-[#8891A5]">{c.engagements?.company_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={c.status} />
                    <span className="text-[11px] text-[#555D73]">{c.engagements?.engagement_code}</span>
                  </div>
                </div>
              ))}
            </ProfileSection>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPANIES VIEW + PROFILE
// ============================================================
function CompaniesView({ companies, loading, onRefresh, onViewProfile }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [enriching, setEnriching] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleEnrich = async () => {
    if (!enrichUrl) return;
    setEnriching(true);
    const result = await enrichCompany(enrichUrl);
    if (result) setForm(prev => ({ ...prev, ...result }));
    setEnriching(false);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const { error } = await supabase.from("companies").insert([form]);
    if (!error) { onRefresh(); setShowAdd(false); setForm({}); setEnrichUrl(""); }
    setSaving(false);
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div><h1 className="text-2xl font-bold mb-1">Companies</h1><p className="text-sm text-[#8891A5]">{companies.length} records</p></div>
        <AddBtn label="Add Company" onClick={() => setShowAdd(true)} />
      </div>
      <Card>
        {loading ? <LoadingDots /> : companies.length === 0 ? <EmptyState text="No companies yet." /> : (
          <table className="w-full text-sm">
            <thead><tr>{["Company", "HQ", "Industry", "Revenue", "Ownership", "PE Investor", "BD Status"].map(h => <th key={h} className="text-left px-3 py-2.5 border-b border-[#313848] text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id} onClick={() => onViewProfile(c.id)} className="border-b border-[#252B3A] hover:bg-[#181D28] cursor-pointer transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {c.logo_url ? <img src={c.logo_url} alt="" className="w-6 h-6 rounded object-contain bg-white" /> : <div className="w-6 h-6 rounded bg-[#252B3A] flex items-center justify-center text-[10px] text-[#555D73] font-bold">{c.name?.charAt(0)}</div>}
                      <span className="font-semibold text-[#E2E6EF]">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#8891A5]">{c.headquarters || "—"}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{c.industry || "—"}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{c.revenue || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.ownership_type || "—"} /></td>
                  <td className="px-3 py-3 text-[#8891A5]">{c.pe_investor || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={c.bd_status || "None"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SlidePanel open={showAdd} onClose={() => { setShowAdd(false); setForm({}); setEnrichUrl(""); }} title="Add Company" wide>
        <div className="px-3 py-3 bg-[#4F8BF5]/10 rounded-md border border-[#4F8BF5]/20 mb-5">
          <div className="text-xs font-semibold text-[#4F8BF5] mb-2">Auto-populate from URL</div>
          <div className="flex gap-2">
            <Input value={enrichUrl} onChange={setEnrichUrl} placeholder="Paste company website URL..." className="flex-1" />
            <Btn onClick={handleEnrich} disabled={!enrichUrl || enriching}>{enriching ? "Fetching..." : "Fetch"}</Btn>
          </div>
          <div className="text-[11px] text-[#555D73] mt-1.5">Enter a URL and we will pull in company details automatically. You can still edit everything.</div>
        </div>
        {form.name && enriching === false && Object.keys(form).length > 1 && (
          <div className="px-3 py-2 bg-[#34D399]/10 rounded-md border border-[#34D399]/20 mb-4 text-xs text-[#34D399] font-medium">Company data fetched. Review and edit before saving.</div>
        )}
        <Divider label="Company Information" />
        <FormField label="Company Name" required><Input value={form.name || ""} onChange={v => u("name", v)} placeholder="e.g., NovaBright Health Services" /></FormField>
        <FormField label="Headquarters"><Input value={form.headquarters || ""} onChange={v => u("headquarters", v)} placeholder="e.g., Nashville, TN" /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Industry"><Input value={form.industry || ""} onChange={v => u("industry", v)} placeholder="e.g., Behavioral Health" /></FormField>
          <FormField label="Website"><Input value={form.website || ""} onChange={v => u("website", v)} placeholder="company.com" /></FormField>
        </div>
        <Divider label="Financials" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Revenue"><Input value={form.revenue || ""} onChange={v => u("revenue", v)} placeholder="e.g., $185M" /></FormField>
          <FormField label="Employees"><Input value={form.employees || ""} onChange={v => u("employees", v)} placeholder="e.g., 1,200" /></FormField>
        </div>
        <Divider label="Ownership" />
        <FormField label="Ownership Type">
          <Select value={form.ownership_type || ""} onChange={v => u("ownership_type", v)} options={[{ value: "", label: "Select..." }, { value: "PE-Backed", label: "PE-Backed" }, { value: "Public", label: "Public" }, { value: "Private", label: "Private" }, { value: "Family Owned", label: "Family Owned" }, { value: "VC-Backed", label: "VC-Backed" }, { value: "Nonprofit", label: "Nonprofit" }]} />
        </FormField>
        <FormField label="PE/VC Investor"><Input value={form.pe_investor || ""} onChange={v => u("pe_investor", v)} placeholder="e.g., Meridian Capital Partners" /></FormField>
        <FormField label="BD Status">
          <Select value={form.bd_status || "None"} onChange={v => u("bd_status", v)} options={[{ value: "None", label: "None" }, { value: "Target", label: "Target" }, { value: "Prospect", label: "Prospect" }, { value: "Client", label: "Client" }]} />
        </FormField>
        <Divider label="Details" />
        <FormField label="Description"><TextArea value={form.description || ""} onChange={v => u("description", v)} placeholder="Company description..." rows={3} /></FormField>
        <FormField label="Logo URL"><Input value={form.logo_url || ""} onChange={v => u("logo_url", v)} placeholder="URL to company logo" /></FormField>
        <Btn onClick={handleSave} disabled={!form.name || saving} className="w-full mt-2">{saving ? "Saving..." : "Add Company"}</Btn>
      </SlidePanel>
    </div>
  );
}

// COMPANY PROFILE
function CompanyProfile({ companyId, onBack, onViewPerson }) {
  const [company, setCompany] = useState(null);
  const [linkedPeople, setLinkedPeople] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: links }, { data: engs }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).single(),
        supabase.from("person_company_links").select("*, people(id, full_name, current_title)").eq("company_id", companyId),
        supabase.from("engagements").select("*").eq("company_name", "").order("created_at", { ascending: false }),
      ]);
      setCompany(c);
      setLinkedPeople(links || []);
      // Also find people by current_company text match
      if (c) {
        const { data: peopleDirect } = await supabase.from("people").select("id, full_name, current_title").eq("current_company", c.name);
        const { data: engsMatch } = await supabase.from("engagements").select("*").eq("company_name", c.name).order("created_at", { ascending: false });
        // Merge linked people and direct matches
        const allPeople = [...(links || []).map(l => l.people), ...(peopleDirect || [])];
        const unique = allPeople.filter((p, i, arr) => p && arr.findIndex(x => x?.id === p?.id) === i);
        setLinkedPeople(unique);
        setEngagements(engsMatch || []);
      }
      setLoading(false);
    })();
  }, [companyId]);

  if (loading) return <LoadingDots />;
  if (!company) return <EmptyState text="Company not found." />;

  return (
    <div className="animate-fadeUp">
      <BackBtn onClick={onBack} label="Companies" />
      <div className="flex items-start gap-5 mb-6">
        {company.logo_url ? <img src={company.logo_url} alt="" className="w-16 h-16 rounded-lg object-contain bg-white p-1 border border-[#252B3A]" /> : <div className="w-16 h-16 rounded-lg bg-[#A78BFA]/10 border border-[#A78BFA]/30 flex items-center justify-center text-xl font-bold text-[#A78BFA] flex-shrink-0">{company.name?.charAt(0)}</div>}
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-0.5">{company.name}</h1>
          <p className="text-sm text-[#8891A5]">{company.headquarters}{company.industry ? ` · ${company.industry}` : ""}</p>
          <div className="flex gap-2 mt-2">
            {company.ownership_type && <StatusBadge status={company.ownership_type} />}
            {company.bd_status && company.bd_status !== "None" && <StatusBadge status={company.bd_status} />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div>
          {company.description && <Card className="mb-5"><ProfileSection title="About"><p className="text-sm text-[#8891A5] leading-relaxed">{company.description}</p></ProfileSection></Card>}

          <Card className="mb-5">
            <ProfileSection title={`Engagements (${engagements.length})`}>
              {engagements.length === 0 ? <EmptyState text="No engagements with this company." /> : engagements.map(e => (
                <div key={e.id} className="flex justify-between items-center px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2">
                  <div>
                    <div className="text-sm font-semibold text-[#E2E6EF]">{e.role_title}</div>
                    <div className="text-xs text-[#8891A5]">{e.pe_firm ? `${e.pe_firm} · ` : ""}{e.engagement_code}</div>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </ProfileSection>
          </Card>

          <Card className="mb-5">
            <ProfileSection title={`People (${linkedPeople.length})`}>
              {linkedPeople.length === 0 ? <EmptyState text="No people linked to this company." /> : linkedPeople.map(p => (
                <div key={p.id} onClick={() => onViewPerson(p.id)} className="flex items-center gap-3 px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] mb-2 cursor-pointer hover:border-[#313848] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#4F8BF5]/10 flex items-center justify-center text-xs font-bold text-[#4F8BF5]">{p.full_name?.charAt(0)}</div>
                  <div>
                    <div className="text-sm font-semibold text-[#E2E6EF]">{p.full_name}</div>
                    <div className="text-xs text-[#8891A5]">{p.current_title}</div>
                  </div>
                </div>
              ))}
            </ProfileSection>
          </Card>

          <Card>
            <ProfileSection title="Documents">
              <DocumentManager entityType="company" entityId={companyId} />
            </ProfileSection>
          </Card>
        </div>

        <div>
          <Card className="mb-5">
            <ProfileSection title="Company Details">
              {[{ label: "Revenue", value: company.revenue }, { label: "Employees", value: company.employees }, { label: "Website", value: company.website }, { label: "Ownership", value: company.ownership_type }, { label: "PE Investor", value: company.pe_investor }, { label: "Investor Status", value: company.pe_investor_status }].map(f => f.value ? (
                <div key={f.label} className="mb-3"><div className="text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{f.label}</div><div className="text-sm text-[#E2E6EF] mt-0.5">{f.value}</div></div>
              ) : null)}
            </ProfileSection>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ENGAGEMENTS VIEW + PROFILE
// ============================================================
function EngagementsView({ engagements, loading, onRefresh, onViewProfile, companies }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const companySuggestions = companies.map(c => ({ id: c.id, label: c.name, sub: c.headquarters }));

  const handleSave = async () => {
    if (!form.role_title || !form.company_name) return;
    setSaving(true);
    const code = `ENG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const { error } = await supabase.from("engagements").insert([{ ...form, engagement_code: code, status: "Active" }]);
    if (!error) { onRefresh(); setShowAdd(false); setForm({}); }
    setSaving(false);
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div><h1 className="text-2xl font-bold mb-1">Engagements</h1><p className="text-sm text-[#8891A5]">{engagements.length} searches</p></div>
        <AddBtn label="New Engagement" onClick={() => setShowAdd(true)} />
      </div>
      <Card>
        {loading ? <LoadingDots /> : engagements.length === 0 ? <EmptyState text="No engagements yet." /> : (
          <table className="w-full text-sm">
            <thead><tr>{["Role", "Company", "PE Firm", "Status", "Code", "Launch Date"].map(h => <th key={h} className="text-left px-3 py-2.5 border-b border-[#313848] text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {engagements.map(e => (
                <tr key={e.id} onClick={() => onViewProfile(e.id)} className="border-b border-[#252B3A] hover:bg-[#181D28] cursor-pointer transition-colors">
                  <td className="px-3 py-3 font-semibold text-[#E2E6EF]">{e.role_title}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{e.company_name}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{e.pe_firm || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={e.status} /></td>
                  <td className="px-3 py-3 text-[#555D73] font-mono text-xs">{e.engagement_code}</td>
                  <td className="px-3 py-3 text-[#8891A5]">{e.launch_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SlidePanel open={showAdd} onClose={() => { setShowAdd(false); setForm({}); }} title="New Engagement">
        <Divider label="Role Information" />
        <FormField label="Role Title" required><Input value={form.role_title || ""} onChange={v => u("role_title", v)} placeholder="e.g., Chief Financial Officer" /></FormField>
        <FormField label="Company" required>
          <AutoSuggestInput value={form.company_name || ""} onChange={v => u("company_name", v)} onSelect={s => u("company_name", s.label)} suggestions={companySuggestions} placeholder="Start typing to search..." />
        </FormField>
        <FormField label="PE/VC Firm"><Input value={form.pe_firm || ""} onChange={v => u("pe_firm", v)} placeholder="e.g., Meridian Capital Partners" /></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Location"><Input value={form.location || ""} onChange={v => u("location", v)} placeholder="e.g., Nashville, TN" /></FormField>
          <FormField label="Practice Area">
            <Select value={form.practice_area || ""} onChange={v => u("practice_area", v)} options={[{ value: "", label: "Select..." }, { value: "Private Equity", label: "Private Equity" }, { value: "CEO & Board", label: "CEO & Board" }, { value: "Healthcare", label: "Healthcare" }, { value: "Technology", label: "Technology" }, { value: "Financial Services", label: "Financial Services" }]} />
          </FormField>
        </div>
        <Divider label="Scope" />
        <FormField label="Reporting To"><Input value={form.reporting_to || ""} onChange={v => u("reporting_to", v)} placeholder="e.g., CEO" /></FormField>
        <FormField label="Team Size"><Input value={form.team_size || ""} onChange={v => u("team_size", v)} placeholder="e.g., 18 (6 direct reports)" /></FormField>
        <FormField label="Comp Range"><Input value={form.comp_range || ""} onChange={v => u("comp_range", v)} placeholder="e.g., $375K-$425K + bonus + equity" /></FormField>
        <FormField label="Notes"><TextArea value={form.notes || ""} onChange={v => u("notes", v)} placeholder="Additional context..." rows={3} /></FormField>
        <Btn onClick={handleSave} disabled={!form.role_title || !form.company_name || saving} className="w-full mt-2">{saving ? "Saving..." : "Create Engagement"}</Btn>
      </SlidePanel>
    </div>
  );
}

// ENGAGEMENT PROFILE
function EngagementProfile({ engagementId, onBack, onViewPerson, people }) {
  const [engagement, setEngagement] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [outputs, setOutputs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");

  const peopleSuggestions = people.map(p => ({ id: p.id, label: p.full_name, sub: `${p.current_title || ""} · ${p.current_company || ""}` }));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: eng }, { data: cands }, { data: outs }] = await Promise.all([
        supabase.from("engagements").select("*").eq("id", engagementId).single(),
        supabase.from("candidates").select("*, people(id, full_name, current_title, current_company)").eq("engagement_id", engagementId).order("created_at", { ascending: false }),
        supabase.from("search_outputs").select("*").eq("engagement_id", engagementId).single(),
      ]);
      setEngagement(eng);
      setCandidates(cands || []);
      setOutputs(outs);
      setLoading(false);
    })();
  }, [engagementId]);

  const addCandidate = async (personId) => {
    await supabase.from("candidates").insert([{ engagement_id: engagementId, person_id: personId, status: "Researching" }]);
    const { data: cands } = await supabase.from("candidates").select("*, people(id, full_name, current_title, current_company)").eq("engagement_id", engagementId).order("created_at", { ascending: false });
    setCandidates(cands || []);
    setShowAddCandidate(false);
    setCandidateSearch("");
  };

  if (loading) return <LoadingDots />;
  if (!engagement) return <EmptyState text="Engagement not found." />;

  return (
    <div className="animate-fadeUp">
      <BackBtn onClick={onBack} label="Engagements" />
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">{engagement.role_title}</h1>
          <p className="text-sm text-[#8891A5]">{engagement.company_name}{engagement.pe_firm ? ` · ${engagement.pe_firm}` : ""}</p>
          <div className="flex gap-2 mt-2">
            <StatusBadge status={engagement.status} />
            <span className="text-xs text-[#555D73] font-mono">{engagement.engagement_code}</span>
          </div>
        </div>
        <div className="text-right">
          {engagement.comp_range && <div className="text-sm text-[#34D399] font-semibold">{engagement.comp_range}</div>}
          {engagement.location && <div className="text-xs text-[#8891A5] mt-1">{engagement.location}</div>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[{ label: "Candidates", value: candidates.length, color: "text-[#4F8BF5]" }, { label: "Reporting To", value: engagement.reporting_to || "—", color: "text-[#E2E6EF]", small: true }, { label: "Team Size", value: engagement.team_size || "—", color: "text-[#E2E6EF]", small: true }, { label: "Launch Date", value: engagement.launch_date || "—", color: "text-[#E2E6EF]", small: true }].map(m => (
          <Card key={m.label}><div className="text-[11px] font-semibold text-[#8891A5] uppercase tracking-wider mb-2">{m.label}</div><div className={`${m.small ? "text-sm" : "text-2xl"} font-bold ${m.color}`}>{m.value}</div></Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div>
          <Card className="mb-5">
            <ProfileSection title={`Candidates (${candidates.length})`} action={<AddBtn label="Add Candidate" onClick={() => setShowAddCandidate(true)} />}>
              {candidates.length === 0 ? <EmptyState text="No candidates added yet." /> : (
                <table className="w-full text-sm">
                  <thead><tr>{["Name", "Title", "Company", "Status"].map(h => <th key={h} className="text-left px-3 py-2 border-b border-[#313848] text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{h}</th>)}</tr></thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c.id} onClick={() => c.people && onViewPerson(c.people.id)} className="border-b border-[#252B3A] hover:bg-[#181D28] cursor-pointer transition-colors">
                        <td className="px-3 py-2.5 font-semibold text-[#E2E6EF]">{c.people?.full_name || "Unknown"}</td>
                        <td className="px-3 py-2.5 text-[#8891A5]">{c.people?.current_title || "—"}</td>
                        <td className="px-3 py-2.5 text-[#8891A5]">{c.people?.current_company || "—"}</td>
                        <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ProfileSection>
          </Card>

          <Card className="mb-5">
            <ProfileSection title="Documents">
              <DocumentManager entityType="engagement" entityId={engagementId} />
            </ProfileSection>
          </Card>

          {outputs && (
            <Card>
              <ProfileSection title="Search Launch Outputs">
                {["Scorecard", "Job Description", "Search Strategy", "Recruiting Message", "Target List"].map((label, i) => {
                  const keys = ["scorecard", "job_description", "search_strategy", "recruiting_message", "target_list"];
                  const content = outputs[keys[i]];
                  if (!content) return null;
                  return (
                    <details key={i} className="mb-2">
                      <summary className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] cursor-pointer text-sm font-semibold text-[#E2E6EF] hover:border-[#313848]">{label} ✓</summary>
                      <div className="px-4 py-4 bg-[#181D28] rounded-b-md border border-[#252B3A] border-t-0 text-sm text-[#8891A5] whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{content}</div>
                    </details>
                  );
                })}
              </ProfileSection>
            </Card>
          )}
        </div>

        <Card className="self-start sticky top-5">
          <ProfileSection title="Engagement Details">
            {[{ label: "Practice Area", value: engagement.practice_area }, { label: "Reporting To", value: engagement.reporting_to }, { label: "Team Size", value: engagement.team_size }, { label: "Comp Range", value: engagement.comp_range }, { label: "Location", value: engagement.location }, { label: "Confidential", value: engagement.confidential ? "Yes" : "No" }, { label: "Notes", value: engagement.notes }].map(f => f.value ? (
              <div key={f.label} className="mb-3"><div className="text-[11px] font-semibold text-[#555D73] uppercase tracking-wider">{f.label}</div><div className="text-sm text-[#E2E6EF] mt-0.5">{f.value}</div></div>
            ) : null)}
          </ProfileSection>
        </Card>
      </div>

      {/* Add Candidate Mini-Panel */}
      <SlidePanel open={showAddCandidate} onClose={() => setShowAddCandidate(false)} title="Add Candidate to Search">
        <p className="text-sm text-[#8891A5] mb-4">Search for an existing person in the database to add as a candidate.</p>
        <FormField label="Search People">
          <AutoSuggestInput value={candidateSearch} onChange={setCandidateSearch} onSelect={(s) => addCandidate(s.id)} suggestions={peopleSuggestions} placeholder="Start typing a name..." />
        </FormField>
        <div className="text-xs text-[#555D73] mt-2">Select a person from the dropdown to add them as a candidate to this engagement.</div>
      </SlidePanel>
    </div>
  );
}

// ============================================================
// SEARCH LAUNCHER (carried over from v1)
// ============================================================
function SearchLauncherView({ onRefresh }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [data, setData] = useState({ inputs: { confidential: "no" } });
  const steps = ["Inputs", "Scorecard", "Job Description", "Search Strategy", "Recruiting Message", "Target List"];
  const completeStep = (i) => { if (!completed.includes(i)) setCompleted(p => [...p, i]); setStep(i + 1); };

  const generate = async (prompt) => {
    return await callAI([{ role: "user", content: prompt }]);
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-6">
        <div><h1 className="text-2xl font-bold mb-1">Search Launcher</h1><p className="text-sm text-[#8891A5]">{data.inputs?.companyName ? `${data.inputs.roleName} · ${data.inputs.companyName}` : "Launch a new retained search with AI-generated deliverables"}</p></div>
        <div className="flex gap-1.5">{steps.map((_, i) => <div key={i} className={`w-8 h-1 rounded-sm transition-all ${completed.includes(i) ? "bg-[#34D399]" : step === i ? "bg-[#4F8BF5]" : "bg-[#252B3A]"}`} />)}</div>
      </div>
      <div className="grid grid-cols-[200px_1fr] gap-6">
        <div className="flex flex-col gap-1 sticky top-5 self-start">
          {steps.map((s, i) => {
            const done = completed.includes(i); const active = step === i; const locked = i > 0 && !completed.includes(i - 1) && !active;
            return (
              <button key={i} onClick={() => !locked && setStep(i)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md w-full text-left text-sm transition-all ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${active ? "bg-[#4F8BF5]/10 border border-[#4F8BF5]/40 font-semibold text-[#E2E6EF]" : "bg-transparent border border-transparent text-[#8891A5]"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-[1.5px] flex-shrink-0 ${done ? "bg-[#34D399] border-[#34D399] text-white" : active ? "bg-[#4F8BF5] border-[#4F8BF5] text-white" : "bg-[#181D28] border-[#313848] text-[#8891A5]"}`}>{done ? "✓" : i + 1}</div>{s}
              </button>
            );
          })}
        </div>
        <div>
          {step === 0 && <LauncherInputs data={data} setData={setData} onComplete={() => completeStep(0)} />}
          {step >= 1 && step <= 4 && <LauncherAIStep data={data} setData={setData} onComplete={() => completeStep(step)} generate={generate} stepKey={["scorecard","jd","strategy","message","targets"][step-1]} title={steps[step]} promptBuilder={[buildScorecardPrompt,buildJDPrompt,buildStrategyPrompt,buildMessagePrompt,buildTargetPrompt][step-1]} />}
          {step === 5 && !completed.includes(5) && <LauncherAIStep data={data} setData={setData} onComplete={() => { completeStep(5); saveOutputs(data, onRefresh); }} generate={generate} stepKey="targets" title="Target List" promptBuilder={buildTargetPrompt} />}
          {step === 5 && completed.includes(5) && <LauncherComplete data={data} />}
        </div>
      </div>
    </div>
  );
}

function LauncherInputs({ data, setData, onComplete }) {
  const d = data.inputs || {}; const u = (k, v) => setData(p => ({ ...p, inputs: { ...p.inputs, [k]: v } }));
  const ok = d.roleName && d.companyName && (d.getSmart || d.kickoffNotes);
  return (
    <div>
      <h2 className="text-lg font-bold mb-1">Search Inputs</h2><p className="text-sm text-[#8891A5] mb-6">Provide the foundation. The more you give, the better.</p>
      <Divider label="Role & Company" />
      <div className="grid grid-cols-2 gap-3"><FormField label="Role Title" required><Input value={d.roleName||""} onChange={v=>u("roleName",v)} placeholder="e.g., Chief Financial Officer"/></FormField><FormField label="Company Name" required><Input value={d.companyName||""} onChange={v=>u("companyName",v)} placeholder="e.g., NovaBright Health Services"/></FormField></div>
      <div className="grid grid-cols-2 gap-3"><FormField label="PE/VC Firm"><Input value={d.peFirm||""} onChange={v=>u("peFirm",v)} placeholder="e.g., Meridian Capital Partners"/></FormField><FormField label="Location"><Input value={d.location||""} onChange={v=>u("location",v)} placeholder="e.g., Nashville, TN"/></FormField></div>
      <div className="grid grid-cols-3 gap-3"><FormField label="Reporting To"><Input value={d.reportingTo||""} onChange={v=>u("reportingTo",v)} placeholder="e.g., CEO"/></FormField><FormField label="Team Size"><Input value={d.teamSize||""} onChange={v=>u("teamSize",v)} placeholder="e.g., 18"/></FormField><FormField label="Comp Range"><Input value={d.compRange||""} onChange={v=>u("compRange",v)} placeholder="e.g., $375K-$425K"/></FormField></div>
      <FormField label="Confidential?"><Select value={d.confidential||"no"} onChange={v=>u("confidential",v)} options={[{value:"no",label:"No"},{value:"yes",label:"Yes"}]}/></FormField>
      <Divider label="Foundation Documents" />
      <FormField label="Get Smart" hint="Internal research."><TextArea value={d.getSmart||""} onChange={v=>u("getSmart",v)} placeholder="Paste your Get Smart..." rows={8}/></FormField>
      <FormField label="Client Draft JD"><TextArea value={d.draftJD||""} onChange={v=>u("draftJD",v)} placeholder="Client's draft JD..." rows={6}/></FormField>
      <FormField label="Kick-Off Notes" required><TextArea value={d.kickoffNotes||""} onChange={v=>u("kickoffNotes",v)} placeholder="Your kick-off notes..." rows={8}/></FormField>
      <FormField label="Additional Context"><TextArea value={d.additionalContext||""} onChange={v=>u("additionalContext",v)} placeholder="Anything else..." rows={4}/></FormField>
      <div className="flex justify-end mt-2"><Btn onClick={onComplete} disabled={!ok}>Save Inputs & Generate Scorecard →</Btn></div>
    </div>
  );
}

function LauncherAIStep({ data, setData, onComplete, generate, stepKey, title, promptBuilder }) {
  const [output, setOutput] = useState(data[`${stepKey}Output`]||"");
  const [edited, setEdited] = useState(data[`${stepKey}Edited`]||"");
  const [loading, setLoading] = useState(false);
  const run = async () => { setLoading(true); const r = await generate(promptBuilder(data)); setOutput(r); setEdited(r); setData(p=>({...p,[`${stepKey}Output`]:r,[`${stepKey}Edited`]:r})); setLoading(false); };
  useEffect(() => { if (!output) run(); }, []);
  return (
    <div>
      <h2 className="text-lg font-bold mb-1">{title}</h2><p className="text-sm text-[#8891A5] mb-5">Review, edit, and approve.</p>
      {loading ? <LoadingBlock label={`Generating ${title.toLowerCase()}...`}/> : output ? (
        <>
          <div className="px-3 py-2 bg-[#4F8BF5]/10 rounded-md border border-[#4F8BF5]/20 mb-4 text-xs text-[#4F8BF5] font-medium">Edit below. Changes carry forward.</div>
          <TextArea value={edited} onChange={v=>{setEdited(v);setData(p=>({...p,[`${stepKey}Edited`]:v}));}} rows={22}/>
          <div className="flex gap-2 mt-3 justify-end"><Btn variant="secondary" onClick={run}>Regenerate</Btn><Btn variant="success" onClick={()=>{setData(p=>({...p,[`${stepKey}Edited`]:edited}));onComplete();}}>Approve & Continue →</Btn></div>
        </>
      ) : null}
    </div>
  );
}

function LauncherComplete({ data }) {
  const inp = data.inputs||{};
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-[#34D399]/10 border-2 border-[#34D399] flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
      <h2 className="text-xl font-bold mb-1">Search Launch Complete</h2>
      <p className="text-sm text-[#8891A5] mb-6">{inp.roleName} · {inp.companyName}</p>
      <Card className="text-left">
        {["Scorecard","Job Description","Search Strategy","Recruiting Message","Target List"].map((label,i)=>{
          const keys=["scorecard","jd","strategy","message","targets"];
          return <details key={i} className="mb-2"><summary className="px-3 py-2.5 bg-[#181D28] rounded-md border border-[#252B3A] cursor-pointer text-sm font-semibold text-[#E2E6EF]">{label} ✓</summary><div className="px-4 py-4 bg-[#181D28] rounded-b-md border border-[#252B3A] border-t-0 text-sm text-[#8891A5] whitespace-pre-wrap leading-relaxed">{data[`${keys[i]}Edited`]}</div></details>;
        })}
      </Card>
    </div>
  );
}

async function saveOutputs(data, onRefresh) {
  const inp = data.inputs||{};
  const code = `ENG-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`;
  const { data: eng } = await supabase.from("engagements").insert([{ engagement_code:code, role_title:inp.roleName, company_name:inp.companyName, pe_firm:inp.peFirm, location:inp.location, reporting_to:inp.reportingTo, team_size:inp.teamSize, comp_range:inp.compRange, confidential:inp.confidential==="yes", status:"Active" }]).select().single();
  if (eng) { await supabase.from("search_outputs").insert([{ engagement_id:eng.id, inputs:inp, scorecard:data.scorecardEdited, job_description:data.jdEdited, search_strategy:data.strategyEdited, recruiting_message:data.messageEdited, target_list:data.targetEdited, current_step:5, completed:true }]); }
  if (onRefresh) onRefresh();
}

function inputCtx(inp) { return `Role: ${inp.roleName}\nCompany: ${inp.companyName}\nPE Firm: ${inp.peFirm||"N/A"}\nLocation: ${inp.location||"N/A"}\nReporting To: ${inp.reportingTo||"N/A"}\nTeam Size: ${inp.teamSize||"N/A"}\nComp Range: ${inp.compRange||"N/A"}\nConfidential: ${inp.confidential==="yes"?"Yes":"No"}\n\nGET SMART:\n${inp.getSmart||"(N/A)"}\n\nCLIENT DRAFT JD:\n${inp.draftJD||"(N/A)"}\n\nKICK-OFF NOTES:\n${inp.kickoffNotes||"(N/A)"}\n\nADDITIONAL:\n${inp.additionalContext||"(N/A)"}`; }
function buildScorecardPrompt(d) { return `Generate a scorecard.\n\n${inputCtx(d.inputs)}\n\nTwo sections: Experience & Qualifications (7-10), Leadership & Cultural Fit (3-4). Format: **[Header]:** [2-3 sentences]. Lead with role identity. No dashes, no filler, no names.`; }
function buildJDPrompt(d) { return `Generate a Job Description.\n\n${inputCtx(d.inputs)}\n\nSCORECARD:\n${d.scorecardEdited}\n\nStructure: Title, Reporting/Team/Location, Company Desc, Scope (narrative+bullets), Key Criteria (scorecard verbatim). No dashes.`; }
function buildStrategyPrompt(d) { return `Generate a Search Strategy.\n\n${inputCtx(d.inputs)}\n\nSCORECARD:\n${d.scorecardEdited}\n\nJD:\n${d.jdEdited}\n\nSections: Company Overview, Growth Story, Leadership Team, Competitive Landscape, Needs/Nice-to-haves, Comp & Process, Recruiting Message (placeholder). No dashes.`; }
function buildMessagePrompt(d) { return `Generate a Recruiting Message.\n\n${inputCtx(d.inputs)}\n\nJD:\n${d.jdEdited}\n\n${d.inputs?.confidential==="yes"?"CONFIDENTIAL: do not name company/PE.":"Non-confidential."}\n\nFormat: Subject line, body (hook, narrative, soft close with referral ask). Short, authentic. No dashes.`; }
function buildTargetPrompt(d) { return `Generate a Target List (company-level).\n\n${inputCtx(d.inputs)}\n\nSCORECARD:\n${d.scorecardEdited?.substring(0,2000)}\n\nCategories: Direct Competitors, Adjacent Industry, PE-Backed Platforms, Large Company Alumni. Each: Name, HQ, Size, Ownership, Why (1 sentence). 20-30 companies. No dashes.`; }

// ============================================================
// PLACEHOLDER
// ============================================================
function PlaceholderView({ title, desc }) {
  return <div className="animate-fadeUp"><h1 className="text-2xl font-bold mb-1">{title}</h1><p className="text-sm text-[#8891A5] mb-6">{desc}</p><Card><EmptyState text="Coming soon."/></Card></div>;
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [section, setSection] = useState("dashboard");
  const [profileId, setProfileId] = useState(null);
  const [people, setPeople] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [bd, setBd] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, e, b] = await Promise.all([
      supabase.from("people").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("engagements").select("*").order("created_at", { ascending: false }),
      supabase.from("bd_pipeline").select("*").order("created_at", { ascending: false }),
    ]);
    setPeople(p.data || []); setCompanies(c.data || []); setEngagements(e.data || []); setBd(b.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const navigate = (s) => { setSection(s); setProfileId(null); };
  const counts = { people: people.length, companies: companies.length, engagements: engagements.filter(e => e.status === "Active").length, bd: bd.length };

  const renderContent = () => {
    // Profile views
    if (section === "people" && profileId) return <PersonProfile personId={profileId} onBack={() => setProfileId(null)} companies={companies} />;
    if (section === "companies" && profileId) return <CompanyProfile companyId={profileId} onBack={() => setProfileId(null)} onViewPerson={(id) => { setSection("people"); setProfileId(id); }} />;
    if (section === "engagements" && profileId) return <EngagementProfile engagementId={profileId} onBack={() => setProfileId(null)} onViewPerson={(id) => { setSection("people"); setProfileId(id); }} people={people} />;

    // List views
    switch (section) {
      case "dashboard": return <DashboardView counts={counts} onNavigate={navigate} />;
      case "people": return <PeopleView people={people} companies={companies} loading={loading} onRefresh={fetchAll} onViewProfile={(id) => setProfileId(id)} />;
      case "companies": return <CompaniesView companies={companies} loading={loading} onRefresh={fetchAll} onViewProfile={(id) => setProfileId(id)} />;
      case "engagements": return <EngagementsView engagements={engagements} loading={loading} onRefresh={fetchAll} onViewProfile={(id) => setProfileId(id)} companies={companies} />;
      case "launcher": return <SearchLauncherView onRefresh={fetchAll} />;
      case "compensation": return <PlaceholderView title="Compensation Intelligence" desc="Natural language querying against your proprietary comp data." />;
      case "bd": return <PlaceholderView title="BD Pipeline" desc="AI-surfaced opportunities and business development tracking." />;
      default: return <DashboardView counts={counts} onNavigate={navigate} />;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#0B0E14;color:#E2E6EF;font-family:'Instrument Sans','DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#313848;border-radius:3px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(420px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeOverlay{from{opacity:0}to{opacity:1}}
        .animate-fadeUp{animation:fadeUp 0.4s ease}
        .shimmer-line{background:linear-gradient(90deg,#252B3A 25%,#313848 50%,#252B3A 75%);background-size:800px;animation:shimmer 1.5s infinite linear}
      `}</style>
      <Sidebar section={section} onNavigate={navigate} />
      <div className="ml-[220px] p-7 min-h-screen">{renderContent()}</div>
    </>
  );
}
