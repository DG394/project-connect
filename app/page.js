"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

// ============================================================
// AI HELPER
// ============================================================
async function callAI(messages) {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    if (data.error) return `Error: ${data.error}`;
    return data.text;
  } catch (err) {
    return `Error: ${err.message}. Please try again.`;
  }
}

// ============================================================
// UI COMPONENTS
// ============================================================
function Badge({ children, color = "text-accent", bg = "bg-accent-dim" }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color} ${bg} whitespace-nowrap`}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    Active: "text-green bg-green-dim", "Screen Scheduled": "text-accent bg-accent-dim",
    "Outreach Sent": "text-amber bg-amber-dim", "Client Submitted": "text-green bg-green-dim",
    Interested: "text-purple bg-purple-dim", Declined: "text-red bg-red/10",
    Researching: "text-text-muted bg-text-muted/10", Research: "text-text-muted bg-text-muted/10",
    "Outreach Draft": "text-amber bg-amber-dim", "Meeting Set": "text-green bg-green-dim",
    Client: "text-green bg-green-dim", Target: "text-accent bg-accent-dim",
    Prospect: "text-purple bg-purple-dim", None: "text-text-dim bg-text-dim/10",
    Completed: "text-green bg-green-dim", "On Hold": "text-amber bg-amber-dim",
  };
  const cls = map[status] || "text-text-muted bg-text-muted/10";
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>{status}</span>;
}

function Card({ children, className = "", onClick }) {
  return (
    <div onClick={onClick}
      className={`bg-card border border-border rounded-[10px] p-5 transition-all ${onClick ? "cursor-pointer hover:border-border-light hover:-translate-y-0.5" : ""} ${className}`}>
      {children}
    </div>
  );
}

function FormField({ label, required, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
        {label}{required && <span className="text-red ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-xs text-text-dim mt-1">{hint}</div>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-md text-text-primary text-sm outline-none focus:border-accent transition-colors" />
  );
}

function TextAreaField({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-md text-text-primary text-sm outline-none focus:border-accent transition-colors resize-y leading-relaxed" />
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-md text-text-primary text-sm outline-none cursor-pointer appearance-none"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%238891A5' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Btn({ children, onClick, variant = "primary", disabled = false, className = "" }) {
  const base = "px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-accent text-white border-none hover:bg-accent/90",
    secondary: "bg-transparent text-text-muted border border-border-light hover:border-text-muted",
    success: "bg-green text-white border-none hover:bg-green/90",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function LoadingBlock({ label }) {
  return (
    <div className="p-8 rounded-[10px] border border-accent/20 animate-fadeUp" style={{ background: "linear-gradient(135deg, rgba(79,139,245,0.10), rgba(167,139,250,0.08))" }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
        <span className="text-xs font-bold text-accent uppercase tracking-wider">{label}</span>
      </div>
      {[100, 85, 70, 55].map((w, i) => (
        <div key={i} className="h-3 rounded mb-2.5 shimmer-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function SlideOutPanel({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[200] animate-fadeOverlay" />
      <div className="fixed top-0 right-0 w-[480px] h-screen bg-surface border-l border-border z-[201] flex flex-col animate-slideInRight" style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.4)" }}>
        <div className="flex justify-between items-center px-6 py-5 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button onClick={onClose} className="bg-transparent border-none text-text-muted text-xl cursor-pointer px-2 py-1 rounded-md hover:text-text-primary">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

function AddButton({ label, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border-none bg-accent text-white text-xs font-semibold cursor-pointer hover:bg-accent/90 transition-all">
      <span className="text-base leading-none">+</span> {label}
    </button>
  );
}

function SuccessMsg({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeUp">
      <div className="w-14 h-14 rounded-full bg-green-dim border-2 border-green flex items-center justify-center text-2xl mb-4">✓</div>
      <div className="text-base font-semibold text-text-primary mb-1">Record Created</div>
      <div className="text-sm text-text-muted">{message}</div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ section, onNavigate }) {
  const groups = [
    { label: "WORKSPACE", items: [
      { id: "dashboard", icon: "◆", label: "Dashboard" },
      { id: "engagements", icon: "◈", label: "Engagements" },
      { id: "people", icon: "◉", label: "People" },
      { id: "companies", icon: "▣", label: "Companies" },
    ]},
    { label: "SEARCH", items: [
      { id: "launcher", icon: "▶", label: "Search Launcher" },
    ]},
    { label: "INTELLIGENCE", items: [
      { id: "compensation", icon: "◇", label: "Comp Intelligence" },
      { id: "bd", icon: "▷", label: "BD Pipeline" },
    ]},
  ];

  return (
    <div className="w-[220px] h-screen bg-surface border-r border-border flex flex-col fixed left-0 top-0 z-[100]">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white" style={{ background: "linear-gradient(135deg, #4F8BF5, #A78BFA)" }}>P</div>
          <div>
            <div className="text-sm font-bold text-text-primary">Project Connect</div>
            <div className="text-[11px] text-text-muted">Executive Search</div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div className="text-[10px] font-bold text-text-dim tracking-widest px-2 mb-1.5">{g.label}</div>
            {g.items.map((item) => (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2.5 w-full px-2.5 py-2 border-none rounded-md cursor-pointer text-sm text-left transition-all ${section === item.id ? "bg-accent-dim text-accent font-semibold" : "bg-transparent text-text-muted hover:text-text-primary"}`}>
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
      <p className="text-sm text-text-muted mb-6">Here is what is happening across your practice.</p>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Searches", value: counts.engagements, color: "text-accent" },
          { label: "People", value: counts.people, color: "text-green" },
          { label: "Companies", value: counts.companies, color: "text-purple" },
          { label: "BD Targets", value: counts.bd, color: "text-amber" },
        ].map((m) => (
          <Card key={m.label}>
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">{m.label}</div>
            <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h3 className="text-base font-semibold mb-4">Quick Actions</h3>
          {[
            { label: "Launch New Search", desc: "Start a new engagement with AI-generated deliverables", section: "launcher" },
            { label: "Add Person", desc: "Add a candidate, client, or contact to the database", section: "people" },
            { label: "Add Company", desc: "Add a company to your database", section: "companies" },
          ].map((a) => (
            <div key={a.label} onClick={() => onNavigate(a.section)} className="flex items-center justify-between p-3 rounded-md cursor-pointer hover:bg-surface-alt transition-colors border-b border-border last:border-b-0">
              <div>
                <div className="text-sm font-semibold text-text-primary">{a.label}</div>
                <div className="text-xs text-text-muted mt-0.5">{a.desc}</div>
              </div>
              <span className="text-text-dim">→</span>
            </div>
          ))}
        </Card>
        <Card>
          <h3 className="text-base font-semibold mb-4">Recent Activity</h3>
          <div className="text-sm text-text-muted text-center py-8">Activity will appear here as you use Project Connect.</div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// PEOPLE VIEW
// ============================================================
function PeopleView({ people, loading, onAdd }) {
  const [showPanel, setShowPanel] = useState(false);
  const [form, setForm] = useState({ full_name: "", current_title: "", current_company: "", email: "", phone: "", location: "", linkedin_url: "", education: "", certifications: "", pe_exposure: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name || !form.current_title) return;
    setSaving(true);
    const { error } = await supabase.from("people").insert([form]);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onAdd();
      setTimeout(() => { setShowPanel(false); setSaved(false); setForm({ full_name: "", current_title: "", current_company: "", email: "", phone: "", location: "", linkedin_url: "", education: "", certifications: "", pe_exposure: "", notes: "" }); }, 1500);
    }
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">People</h1>
          <p className="text-sm text-text-muted">{people.length} records</p>
        </div>
        <AddButton label="Add Person" onClick={() => setShowPanel(true)} />
      </div>
      <Card>
        {loading ? (
          <div className="text-sm text-text-muted text-center py-8">Loading...</div>
        ) : people.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-8">No people yet. Add your first person to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Name", "Title", "Company", "Education", "PE Exposure", "Last Contact"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 border-b border-border-light text-[11px] font-semibold text-text-dim uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-surface-alt/50 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{p.full_name}</td>
                  <td className="px-3 py-2.5 text-text-muted">{p.current_title}</td>
                  <td className="px-3 py-2.5 text-text-muted">{p.current_company}</td>
                  <td className="px-3 py-2.5 text-text-muted">{p.education || "—"}</td>
                  <td className="px-3 py-2.5 text-text-muted">{p.pe_exposure || "—"}</td>
                  <td className="px-3 py-2.5 text-text-muted">{p.last_contact_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <SlideOutPanel open={showPanel} onClose={() => setShowPanel(false)} title="Add Person">
        {saved ? <SuccessMsg message={`${form.full_name} has been added.`} /> : (
          <>
            <Divider label="Basic Information" />
            <FormField label="Full Name" required><Input value={form.full_name} onChange={(v) => u("full_name", v)} placeholder="e.g., Sarah Chen" /></FormField>
            <FormField label="Current Title" required><Input value={form.current_title} onChange={(v) => u("current_title", v)} placeholder="e.g., VP Finance" /></FormField>
            <FormField label="Current Company"><Input value={form.current_company} onChange={(v) => u("current_company", v)} placeholder="e.g., Crestview Behavioral Health" /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email"><Input value={form.email} onChange={(v) => u("email", v)} placeholder="email@company.com" type="email" /></FormField>
              <FormField label="Phone"><Input value={form.phone} onChange={(v) => u("phone", v)} placeholder="(555) 123-4567" /></FormField>
            </div>
            <FormField label="Location"><Input value={form.location} onChange={(v) => u("location", v)} placeholder="e.g., Nashville, TN" /></FormField>
            <FormField label="LinkedIn URL"><Input value={form.linkedin_url} onChange={(v) => u("linkedin_url", v)} placeholder="linkedin.com/in/..." /></FormField>
            <Divider label="Background" />
            <FormField label="Education"><Input value={form.education} onChange={(v) => u("education", v)} placeholder="e.g., MBA, Vanderbilt Owen" /></FormField>
            <FormField label="Certifications"><Input value={form.certifications} onChange={(v) => u("certifications", v)} placeholder="e.g., CPA, CFA" /></FormField>
            <FormField label="PE Exposure"><Input value={form.pe_exposure} onChange={(v) => u("pe_exposure", v)} placeholder="e.g., KKR, Bain Capital" /></FormField>
            <Divider label="Notes" />
            <FormField label="Notes"><TextAreaField value={form.notes} onChange={(v) => u("notes", v)} placeholder="Any additional context..." rows={3} /></FormField>
            <Btn onClick={handleSave} disabled={!form.full_name || !form.current_title || saving} className="w-full mt-2">
              {saving ? "Saving..." : "Add Person"}
            </Btn>
          </>
        )}
      </SlideOutPanel>
    </div>
  );
}

// ============================================================
// COMPANIES VIEW
// ============================================================
function CompaniesView({ companies, loading, onAdd }) {
  const [showPanel, setShowPanel] = useState(false);
  const [form, setForm] = useState({ name: "", headquarters: "", industry: "", website: "", revenue: "", employees: "", ownership_type: "", pe_investor: "", pe_investor_status: "", bd_status: "None", description: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const { error } = await supabase.from("companies").insert([form]);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onAdd();
      setTimeout(() => { setShowPanel(false); setSaved(false); setForm({ name: "", headquarters: "", industry: "", website: "", revenue: "", employees: "", ownership_type: "", pe_investor: "", pe_investor_status: "", bd_status: "None", description: "", notes: "" }); }, 1500);
    }
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">Companies</h1>
          <p className="text-sm text-text-muted">{companies.length} records</p>
        </div>
        <AddButton label="Add Company" onClick={() => setShowPanel(true)} />
      </div>
      <Card>
        {loading ? (
          <div className="text-sm text-text-muted text-center py-8">Loading...</div>
        ) : companies.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-8">No companies yet. Add your first company to get started.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Company", "HQ", "Industry", "Revenue", "Ownership", "PE Investor", "BD Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 border-b border-border-light text-[11px] font-semibold text-text-dim uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-alt/50 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-text-primary">{c.name}</td>
                  <td className="px-3 py-2.5 text-text-muted">{c.headquarters || "—"}</td>
                  <td className="px-3 py-2.5 text-text-muted">{c.industry || "—"}</td>
                  <td className="px-3 py-2.5 text-text-muted">{c.revenue || "—"}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.ownership_type || "—"} /></td>
                  <td className="px-3 py-2.5 text-text-muted">{c.pe_investor || "—"}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.bd_status || "None"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <SlideOutPanel open={showPanel} onClose={() => setShowPanel(false)} title="Add Company">
        {saved ? <SuccessMsg message={`${form.name} has been added.`} /> : (
          <>
            <Divider label="Company Information" />
            <FormField label="Company Name" required><Input value={form.name} onChange={(v) => u("name", v)} placeholder="e.g., NovaBright Health Services" /></FormField>
            <FormField label="Headquarters"><Input value={form.headquarters} onChange={(v) => u("headquarters", v)} placeholder="e.g., Nashville, TN" /></FormField>
            <FormField label="Industry"><Input value={form.industry} onChange={(v) => u("industry", v)} placeholder="e.g., Behavioral Health" /></FormField>
            <FormField label="Website"><Input value={form.website} onChange={(v) => u("website", v)} placeholder="e.g., company.com" /></FormField>
            <Divider label="Financials" />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Revenue"><Input value={form.revenue} onChange={(v) => u("revenue", v)} placeholder="e.g., $185M" /></FormField>
              <FormField label="Employees"><Input value={form.employees} onChange={(v) => u("employees", v)} placeholder="e.g., 1,200" /></FormField>
            </div>
            <Divider label="Ownership" />
            <FormField label="Ownership Type">
              <SelectField value={form.ownership_type} onChange={(v) => u("ownership_type", v)} options={[
                { value: "", label: "Select..." }, { value: "PE-Backed", label: "PE-Backed" }, { value: "Public", label: "Public" },
                { value: "Private", label: "Private" }, { value: "Family Owned", label: "Family Owned" },
                { value: "VC-Backed", label: "VC-Backed" }, { value: "Nonprofit", label: "Nonprofit" },
              ]} />
            </FormField>
            <FormField label="PE/VC Investor"><Input value={form.pe_investor} onChange={(v) => u("pe_investor", v)} placeholder="e.g., Meridian Capital Partners" /></FormField>
            <FormField label="BD Status">
              <SelectField value={form.bd_status} onChange={(v) => u("bd_status", v)} options={[
                { value: "None", label: "None" }, { value: "Target", label: "Target" },
                { value: "Prospect", label: "Prospect" }, { value: "Client", label: "Client" },
              ]} />
            </FormField>
            <Divider label="Details" />
            <FormField label="Description"><TextAreaField value={form.description} onChange={(v) => u("description", v)} placeholder="Company description..." rows={3} /></FormField>
            <FormField label="Notes"><TextAreaField value={form.notes} onChange={(v) => u("notes", v)} placeholder="Internal notes..." rows={2} /></FormField>
            <Btn onClick={handleSave} disabled={!form.name || saving} className="w-full mt-2">{saving ? "Saving..." : "Add Company"}</Btn>
          </>
        )}
      </SlideOutPanel>
    </div>
  );
}

// ============================================================
// ENGAGEMENTS VIEW
// ============================================================
function EngagementsView({ engagements, loading, onAdd }) {
  const [showPanel, setShowPanel] = useState(false);
  const [form, setForm] = useState({ role_title: "", company_name: "", pe_firm: "", location: "", reporting_to: "", team_size: "", comp_range: "", confidential: false, practice_area: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const u = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.role_title || !form.company_name) return;
    setSaving(true);
    const code = `ENG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const { error } = await supabase.from("engagements").insert([{ ...form, engagement_code: code }]);
    setSaving(false);
    if (!error) {
      setSaved(true);
      onAdd();
      setTimeout(() => { setShowPanel(false); setSaved(false); setForm({ role_title: "", company_name: "", pe_firm: "", location: "", reporting_to: "", team_size: "", comp_range: "", confidential: false, practice_area: "", notes: "" }); }, 1500);
    }
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-2xl font-bold mb-1">Engagements</h1>
          <p className="text-sm text-text-muted">{engagements.length} searches</p>
        </div>
        <AddButton label="New Engagement" onClick={() => setShowPanel(true)} />
      </div>
      <Card>
        {loading ? (
          <div className="text-sm text-text-muted text-center py-8">Loading...</div>
        ) : engagements.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-8">No engagements yet. Create your first search or use the Search Launcher.</div>
        ) : (
          engagements.map((e, i) => (
            <div key={e.id} className={`flex justify-between items-center py-3 ${i > 0 ? "border-t border-border" : ""}`}>
              <div>
                <div className="text-sm font-semibold text-text-primary">{e.role_title}</div>
                <div className="text-xs text-text-muted">{e.company_name}{e.pe_firm ? ` · ${e.pe_firm}` : ""}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={e.status} />
                <span className="text-xs text-text-dim">{e.engagement_code}</span>
              </div>
            </div>
          ))
        )}
      </Card>
      <SlideOutPanel open={showPanel} onClose={() => setShowPanel(false)} title="New Engagement">
        {saved ? <SuccessMsg message={`${form.role_title} at ${form.company_name} created.`} /> : (
          <>
            <Divider label="Role Information" />
            <FormField label="Role Title" required><Input value={form.role_title} onChange={(v) => u("role_title", v)} placeholder="e.g., Chief Financial Officer" /></FormField>
            <FormField label="Company" required><Input value={form.company_name} onChange={(v) => u("company_name", v)} placeholder="e.g., NovaBright Health Services" /></FormField>
            <FormField label="PE/VC Firm"><Input value={form.pe_firm} onChange={(v) => u("pe_firm", v)} placeholder="e.g., Meridian Capital Partners" /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Location"><Input value={form.location} onChange={(v) => u("location", v)} placeholder="e.g., Nashville, TN" /></FormField>
              <FormField label="Practice Area">
                <SelectField value={form.practice_area} onChange={(v) => u("practice_area", v)} options={[
                  { value: "", label: "Select..." }, { value: "Private Equity", label: "Private Equity" },
                  { value: "CEO & Board", label: "CEO & Board" }, { value: "Healthcare", label: "Healthcare" },
                  { value: "Technology", label: "Technology" }, { value: "Financial Services", label: "Financial Services" },
                ]} />
              </FormField>
            </div>
            <Divider label="Scope" />
            <FormField label="Reporting To"><Input value={form.reporting_to} onChange={(v) => u("reporting_to", v)} placeholder="e.g., CEO" /></FormField>
            <FormField label="Team Size"><Input value={form.team_size} onChange={(v) => u("team_size", v)} placeholder="e.g., 18 (6 direct reports)" /></FormField>
            <FormField label="Comp Range"><Input value={form.comp_range} onChange={(v) => u("comp_range", v)} placeholder="e.g., $375K-$425K + 50-60% bonus + equity" /></FormField>
            <FormField label="Notes"><TextAreaField value={form.notes} onChange={(v) => u("notes", v)} placeholder="Any additional context..." rows={3} /></FormField>
            <Btn onClick={handleSave} disabled={!form.role_title || !form.company_name || saving} className="w-full mt-2">{saving ? "Saving..." : "Create Engagement"}</Btn>
          </>
        )}
      </SlideOutPanel>
    </div>
  );
}

// ============================================================
// SEARCH LAUNCHER (with live AI generation)
// ============================================================
function SearchLauncherView({ onRefresh }) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [data, setData] = useState({ inputs: { confidential: "no" } });
  const [generating, setGenerating] = useState(false);

  const steps = ["Inputs", "Scorecard", "Job Description", "Search Strategy", "Recruiting Message", "Target List"];

  const completeStep = (i) => {
    if (!completed.includes(i)) setCompleted((p) => [...p, i]);
    setStep(i + 1);
  };

  const generate = async (stepName, prompt) => {
    setGenerating(true);
    const result = await callAI([{ role: "user", content: prompt }]);
    setGenerating(false);
    return result;
  };

  return (
    <div className="animate-fadeUp">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Search Launcher</h1>
          <p className="text-sm text-text-muted">
            {data.inputs?.companyName ? `${data.inputs.roleName} · ${data.inputs.companyName}` : "Launch a new retained search with AI-generated deliverables"}
          </p>
        </div>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`w-8 h-1 rounded-sm transition-all ${completed.includes(i) ? "bg-green" : step === i ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Step nav */}
        <div className="flex flex-col gap-1 sticky top-5 self-start">
          {steps.map((s, i) => {
            const done = completed.includes(i);
            const active = step === i;
            const locked = i > 0 && !completed.includes(i - 1) && !active;
            return (
              <button key={i} onClick={() => !locked && setStep(i)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md w-full text-left text-sm transition-all ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${active ? "bg-accent-dim border border-accent/40 font-semibold text-text-primary" : "bg-transparent border border-transparent text-text-muted"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-[1.5px] flex-shrink-0 ${done ? "bg-green border-green text-white" : active ? "bg-accent border-accent text-white" : "bg-surface-alt border-border-light text-text-muted"}`}>
                  {done ? "✓" : i + 1}
                </div>
                {s}
              </button>
            );
          })}
        </div>

        {/* Step content */}
        <div>
          {step === 0 && <LauncherInputs data={data} setData={setData} onComplete={() => completeStep(0)} />}
          {step === 1 && <LauncherAIStep data={data} setData={setData} onComplete={() => completeStep(1)} generating={generating} generate={generate} stepKey="scorecard" title="Scorecard" description="The scorecard defines what great looks like. Edit and approve before moving on." promptBuilder={buildScorecardPrompt} />}
          {step === 2 && <LauncherAIStep data={data} setData={setData} onComplete={() => completeStep(2)} generating={generating} generate={generate} stepKey="jd" title="Job Description" description="Built from your approved scorecard. The narrative opening is where we differentiate." promptBuilder={buildJDPrompt} />}
          {step === 3 && <LauncherAIStep data={data} setData={setData} onComplete={() => completeStep(3)} generating={generating} generate={generate} stepKey="strategy" title="Search Strategy" description="Your single source of truth. Everything needed to speak with a candidate." promptBuilder={buildStrategyPrompt} />}
          {step === 4 && <LauncherAIStep data={data} setData={setData} onComplete={() => completeStep(4)} generating={generating} generate={generate} stepKey="message" title="Recruiting Message" description={`Short, authentic, compelling.${data.inputs?.confidential === "yes" ? " (Confidential mode)" : ""}`} promptBuilder={buildMessagePrompt} />}
          {step === 5 && !completed.includes(5) && <LauncherAIStep data={data} setData={setData} onComplete={() => { completeStep(5); saveSearchOutputs(data, onRefresh); }} generating={generating} generate={generate} stepKey="targets" title="Target List" description="Company-level targets. We over-include so you can trim." promptBuilder={buildTargetPrompt} />}
          {step === 5 && completed.includes(5) && <LauncherComplete data={data} />}
        </div>
      </div>
    </div>
  );
}

function LauncherInputs({ data, setData, onComplete }) {
  const d = data.inputs || {};
  const u = (k, v) => setData((p) => ({ ...p, inputs: { ...p.inputs, [k]: v } }));
  const ok = d.roleName && d.companyName && (d.getSmart || d.kickoffNotes);

  return (
    <div className="animate-fadeUp">
      <h2 className="text-lg font-bold mb-1">Search Inputs</h2>
      <p className="text-sm text-text-muted mb-6">Provide the foundation. The more you give, the better every output will be.</p>
      <Divider label="Role & Company" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Role Title" required><Input value={d.roleName || ""} onChange={(v) => u("roleName", v)} placeholder="e.g., Chief Financial Officer" /></FormField>
        <FormField label="Company Name" required><Input value={d.companyName || ""} onChange={(v) => u("companyName", v)} placeholder="e.g., NovaBright Health Services" /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="PE/VC Firm"><Input value={d.peFirm || ""} onChange={(v) => u("peFirm", v)} placeholder="e.g., Meridian Capital Partners" /></FormField>
        <FormField label="Location"><Input value={d.location || ""} onChange={(v) => u("location", v)} placeholder="e.g., Nashville, TN" /></FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Reporting To"><Input value={d.reportingTo || ""} onChange={(v) => u("reportingTo", v)} placeholder="e.g., CEO" /></FormField>
        <FormField label="Team Size"><Input value={d.teamSize || ""} onChange={(v) => u("teamSize", v)} placeholder="e.g., 18" /></FormField>
        <FormField label="Comp Range"><Input value={d.compRange || ""} onChange={(v) => u("compRange", v)} placeholder="e.g., $375K-$425K" /></FormField>
      </div>
      <FormField label="Confidential?">
        <SelectField value={d.confidential || "no"} onChange={(v) => u("confidential", v)} options={[
          { value: "no", label: "No, company may be named" },
          { value: "yes", label: "Yes, confidential search" },
        ]} />
      </FormField>
      <Divider label="Foundation Documents" />
      <FormField label="Get Smart Document" hint="Internal research compiled before the search was won.">
        <TextAreaField value={d.getSmart || ""} onChange={(v) => u("getSmart", v)} placeholder="Paste your Get Smart here..." rows={8} />
      </FormField>
      <FormField label="Client Draft JD" hint="The client's original spec.">
        <TextAreaField value={d.draftJD || ""} onChange={(v) => u("draftJD", v)} placeholder="Paste the client's draft JD..." rows={6} />
      </FormField>
      <FormField label="Kick-Off Notes" required hint="Your notes from the intake call. Most important input.">
        <TextAreaField value={d.kickoffNotes || ""} onChange={(v) => u("kickoffNotes", v)} placeholder="Paste your kick-off notes..." rows={8} />
      </FormField>
      <Divider label="Additional Context" />
      <FormField label="Anything else?">
        <TextAreaField value={d.additionalContext || ""} onChange={(v) => u("additionalContext", v)} placeholder="Industry context, candidate preferences, etc..." rows={4} />
      </FormField>
      <div className="flex justify-end mt-2">
        <Btn onClick={onComplete} disabled={!ok}>Save Inputs & Generate Scorecard →</Btn>
      </div>
    </div>
  );
}

function LauncherAIStep({ data, setData, onComplete, generating, generate, stepKey, title, description, promptBuilder }) {
  const [output, setOutput] = useState(data[`${stepKey}Output`] || "");
  const [edited, setEdited] = useState(data[`${stepKey}Edited`] || "");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const prompt = promptBuilder(data);
    const result = await generate(stepKey, prompt);
    setOutput(result);
    setEdited(result);
    setData((p) => ({ ...p, [`${stepKey}Output`]: result, [`${stepKey}Edited`]: result }));
    setLoading(false);
  };

  useEffect(() => { if (!output) run(); }, []);

  return (
    <div className="animate-fadeUp">
      <h2 className="text-lg font-bold mb-1">{title}</h2>
      <p className="text-sm text-text-muted mb-5">{description}</p>
      {loading ? (
        <LoadingBlock label={`Generating ${title.toLowerCase()}...`} />
      ) : output ? (
        <>
          <div className="px-3.5 py-2.5 bg-accent-dim rounded-md border border-accent/20 mb-4 text-xs text-accent font-medium">
            Edit below. Your changes will carry forward to all downstream outputs.
          </div>
          <TextAreaField value={edited} onChange={(v) => { setEdited(v); setData((p) => ({ ...p, [`${stepKey}Edited`]: v })); }} rows={22} />
          <div className="flex gap-2 mt-3 justify-end">
            <Btn variant="secondary" onClick={run}>Regenerate</Btn>
            <Btn variant="success" onClick={() => { setData((p) => ({ ...p, [`${stepKey}Edited`]: edited })); onComplete(); }}>Approve & Continue →</Btn>
          </div>
        </>
      ) : null}
    </div>
  );
}

function LauncherComplete({ data }) {
  const inp = data.inputs || {};
  return (
    <div className="animate-fadeUp">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-dim border-2 border-green flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
        <h2 className="text-xl font-bold mb-1">Search Launch Complete</h2>
        <p className="text-sm text-text-muted">{inp.roleName} · {inp.companyName}{inp.peFirm ? ` · ${inp.peFirm}` : ""}</p>
      </div>
      <Card>
        {["Scorecard", "Job Description", "Search Strategy", "Recruiting Message", "Target List"].map((label, i) => {
          const keys = ["scorecard", "jd", "strategy", "message", "targets"];
          return (
            <details key={i} className="mb-2">
              <summary className="px-3.5 py-2.5 bg-surface-alt rounded-md border border-border cursor-pointer text-sm font-semibold text-text-primary hover:border-border-light">{label} ✓</summary>
              <div className="px-4 py-4 bg-surface-alt rounded-b-md border border-border border-t-0 text-sm text-text-muted whitespace-pre-wrap leading-relaxed">{data[`${keys[i]}Edited`]}</div>
            </details>
          );
        })}
      </Card>
    </div>
  );
}

// Save all outputs to database
async function saveSearchOutputs(data, onRefresh) {
  const inp = data.inputs || {};
  // Create engagement
  const code = `ENG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const { data: eng } = await supabase.from("engagements").insert([{
    engagement_code: code, role_title: inp.roleName, company_name: inp.companyName,
    pe_firm: inp.peFirm, location: inp.location, reporting_to: inp.reportingTo,
    team_size: inp.teamSize, comp_range: inp.compRange, confidential: inp.confidential === "yes",
    practice_area: "", status: "Active",
  }]).select().single();

  if (eng) {
    await supabase.from("search_outputs").insert([{
      engagement_id: eng.id, inputs: inp, scorecard: data.scorecardEdited,
      job_description: data.jdEdited, search_strategy: data.strategyEdited,
      recruiting_message: data.messageEdited, target_list: data.targetEdited,
      current_step: 5, completed: true,
    }]);
  }
  if (onRefresh) onRefresh();
}

// ============================================================
// PROMPT BUILDERS
// ============================================================
function inputContext(inp) {
  return `Role: ${inp.roleName}\nCompany: ${inp.companyName}\nPE Firm: ${inp.peFirm || "N/A"}\nLocation: ${inp.location || "Not specified"}\nReporting To: ${inp.reportingTo || "Not specified"}\nTeam Size: ${inp.teamSize || "Not specified"}\nComp Range: ${inp.compRange || "Not specified"}\nConfidential: ${inp.confidential === "yes" ? "Yes" : "No"}\n\nGET SMART:\n${inp.getSmart || "(Not provided)"}\n\nCLIENT DRAFT JD:\n${inp.draftJD || "(Not provided)"}\n\nKICK-OFF NOTES:\n${inp.kickoffNotes || "(Not provided)"}\n\nADDITIONAL CONTEXT:\n${inp.additionalContext || "(None)"}`;
}

function buildScorecardPrompt(data) {
  return `Generate a candidate scorecard for this retained executive search.\n\n${inputContext(data.inputs)}\n\nGenerate with exactly two sections:\n1. Experience & Qualifications (7-10 criteria)\n2. Leadership & Cultural Fit (3-4 criteria)\n\nFormat each criterion as:\n**[Category Header]:** [2-3 sentence description]\n\nLead with a role identity criterion. No dashes, no filler, no names.`;
}

function buildJDPrompt(data) {
  return `Generate a Job Description.\n\n${inputContext(data.inputs)}\n\nAPPROVED SCORECARD:\n${data.scorecardEdited}\n\nFollow exact structure: Role Title, Reporting To/Team Size/Location, Company Description, Scope and Responsibilities (narrative opening then bullet responsibilities), Key Selection Criteria (scorecard verbatim). No dashes.`;
}

function buildStrategyPrompt(data) {
  return `Generate a Search Strategy document.\n\n${inputContext(data.inputs)}\n\nAPPROVED SCORECARD:\n${data.scorecardEdited}\n\nAPPROVED JD:\n${data.jdEdited}\n\nSections: Company Overview, Growth Story, Leadership Team Context, Competitive Landscape, Needs and Nice-to-Haves (conversational tone, top 3-5), Compensation & Process, Recruiting Message (placeholder: "[WILL BE INSERTED AFTER STEP 4]"). No dashes.`;
}

function buildMessagePrompt(data) {
  const isConf = data.inputs?.confidential === "yes";
  return `Generate a Recruiting Message.\n\n${inputContext(data.inputs)}\n\nAPPROVED JD:\n${data.jdEdited}\n\n${isConf ? "CONFIDENTIAL: Do NOT name company or PE firm." : "Non-confidential: name them directly."}\n\nFormat:\nSubject: [subject line]\n\n[body: hook paragraph, narrative paragraph, soft close with referral ask]\n\nShort, authentic, no dashes, no overselling.`;
}

function buildTargetPrompt(data) {
  return `Generate a Target List (company-level, not candidates).\n\n${inputContext(data.inputs)}\n\nAPPROVED SCORECARD:\n${data.scorecardEdited?.substring(0, 2000)}\n\nOrganize into: Direct Competitors, Adjacent Industry, PE-Backed Platforms, Large Company Alumni Targets.\n\nFor each: Company Name, HQ, Size, Ownership, Why (1 sentence).\n\nTarget 20-30 companies. Over-include. No dashes.`;
}

// ============================================================
// PLACEHOLDER VIEWS
// ============================================================
function PlaceholderView({ title, desc }) {
  return (
    <div className="animate-fadeUp">
      <h1 className="text-2xl font-bold mb-1">{title}</h1>
      <p className="text-sm text-text-muted mb-6">{desc}</p>
      <Card><div className="text-center py-12 text-text-muted text-sm">Coming soon.</div></Card>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [section, setSection] = useState("dashboard");
  const [people, setPeople] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [bdPipeline, setBd] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, e, b] = await Promise.all([
      supabase.from("people").select("*").order("created_at", { ascending: false }),
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("engagements").select("*").order("created_at", { ascending: false }),
      supabase.from("bd_pipeline").select("*").order("created_at", { ascending: false }),
    ]);
    setPeople(p.data || []);
    setCompanies(c.data || []);
    setEngagements(e.data || []);
    setBd(b.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const counts = { people: people.length, companies: companies.length, engagements: engagements.filter((e) => e.status === "Active").length, bd: bdPipeline.length };

  return (
    <>
      <Sidebar section={section} onNavigate={setSection} />
      <div className="ml-[220px] p-7 min-h-screen">
        {section === "dashboard" && <DashboardView counts={counts} onNavigate={setSection} />}
        {section === "people" && <PeopleView people={people} loading={loading} onAdd={fetchAll} />}
        {section === "companies" && <CompaniesView companies={companies} loading={loading} onAdd={fetchAll} />}
        {section === "engagements" && <EngagementsView engagements={engagements} loading={loading} onAdd={fetchAll} />}
        {section === "launcher" && <SearchLauncherView onRefresh={fetchAll} />}
        {section === "compensation" && <PlaceholderView title="Compensation Intelligence" desc="Natural language querying against your proprietary comp data." />}
        {section === "bd" && <PlaceholderView title="BD Pipeline" desc="AI-surfaced opportunities and business development tracking." />}
      </div>
    </>
  );
}
