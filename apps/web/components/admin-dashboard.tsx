"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bell, BriefcaseBusiness, Check, ChevronRight, CircleDollarSign, FileCheck2, LayoutDashboard, MapPinned, Search, ShieldCheck, UserCheck, UsersRound, X } from "lucide-react";
import { NairobiMap } from "./nairobi-map";

type ReviewState = "pending" | "approved" | "rejected";
type Application = { id:string; reference:string; name:string; phone:string; trade:string; area:string; years_experience:number; documents:string[]; status:ReviewState; submitted_at:string };
type Metrics = { active_artisans:number; open_jobs:number; pending_applications:number; supported_estates:number };

export function AdminDashboard() {
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ active_artisans:0, open_jobs:0, pending_applications:0, supported_estates:0 });
  const [selectedId, setSelectedId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = applications.find((item) => item.id === selectedId);
  const filtered = useMemo(() => applications.filter((item) => `${item.name} ${item.trade} ${item.area}`.toLowerCase().includes(query.toLowerCase())), [applications, query]);

  const refresh = async () => {
    const [applicationsResponse, metricsResponse] = await Promise.all([fetch("/api/admin/applications"), fetch("/api/admin/metrics")]);
    if (applicationsResponse.ok) {
      const items: Application[] = await applicationsResponse.json();
      setApplications(items); setSelectedId((current) => current || items[0]?.id || "");
    }
    if (metricsResponse.ok) setMetrics(await metricsResponse.json());
  };
  useEffect(() => { void refresh(); }, []);
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const review = async (state: ReviewState) => {
    if (!selected) return;
    setReviewing(true); setError("");
    const response = await fetch(`/api/admin/applications/${selected.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ status:state, review_note:"" }) });
    if (!response.ok) setError((await response.json()).detail || "Decision could not be saved.");
    else { notify(`Application ${state}.`); await refresh(); }
    setReviewing(false);
  };

  const nav = [
    ["overview","Command centre",LayoutDashboard],["artisans","Artisan approvals",UserCheck],["jobs","Jobs & disputes",BriefcaseBusiness],
    ["people","Clients & teams",UsersRound],["coverage","Coverage map",MapPinned],["finance","Revenue & payouts",CircleDollarSign],
  ] as const;

  return <main className="ops-shell">
    <aside className="ops-sidebar"><Link className="brand ops-brand" href="/">Mafundi<span className="brand-dot">.</span><small>OPS</small></Link><p>Workspace</p><nav>{nav.map(([id,label,Icon]) => <button className={section === id ? "active" : ""} onClick={() => setSection(id)} key={id}><Icon size={18}/>{label}{id === "artisans" && metrics.pending_applications > 0 && <span>{metrics.pending_applications}</span>}</button>)}</nav><div className="ops-user"><span className="identity-badge small">AD</span><div><strong>Authenticated admin</strong><small>Role-protected workspace</small></div></div></aside>
    <section className="ops-main">
      <header className="ops-header"><div><span className="kicker">Nairobi marketplace</span><h1>{nav.find(([id]) => id === section)?.[1]}</h1></div><div><button aria-label="Search applications" onClick={() => setSection("artisans")} className="icon-button"><Search size={18}/></button><button aria-label="Operations alerts" onClick={() => notify(`${metrics.pending_applications} applications need review.`)} className="icon-button notification"><Bell size={18}/>{metrics.pending_applications > 0 && <i/>}</button><span className="system-healthy"><i/>API protected</span></div></header>
      {notice && <div className="action-toast ops-toast" role="status">{notice}</div>}

      {section === "overview" && <><div className="ops-alert"><div><ShieldCheck/><span><strong>{metrics.pending_applications} applications need a decision</strong><small>Data is loaded from the live operations API.</small></span></div><button onClick={() => setSection("artisans")}>Review queue <ChevronRight size={16}/></button></div><div className="ops-metrics"><article><span>Active artisans</span><strong>{metrics.active_artisans}</strong><small>Verified accounts</small></article><article><span>Open jobs</span><strong>{metrics.open_jobs}</strong><small>Across Nairobi</small></article><article><span>Pending applications</span><strong>{metrics.pending_applications}</strong><small>Awaiting a decision</small></article><article><span>Supported estates</span><strong>{metrics.supported_estates}</strong><small>Configured coverage</small></article></div><EmptyOperations title="Analytics unlock with production activity" text="Charts and trends intentionally remain empty until real jobs, payments and reviews exist." /></>}

      {section === "artisans" && <div className="review-layout"><section className="review-list"><div className="review-toolbar"><div><span className="kicker">Trust operations</span><h2>Verification queue</h2></div><label><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search applications"/></label></div>{filtered.length ? filtered.map((item) => <button onClick={() => setSelectedId(item.id)} className={`review-row ${selectedId === item.id ? "selected" : ""}`} key={item.id}><span className="identity-badge">{item.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span><div><strong>{item.name}</strong><small>{item.trade} · {item.area}</small></div><span className={`status-chip ${item.status}`}>{item.status}</span><ChevronRight size={16}/></button>) : <EmptyOperations title="No applications" text="New artisan applications will appear here automatically." compact/>}</section>
        {selected ? <aside className="review-detail"><div className="application-head"><span className="identity-badge large">{selected.name.split(" ").map((part) => part[0]).join("").slice(0,2)}</span><div><span className="kicker">{selected.reference}</span><h2>{selected.name}</h2><p>{selected.trade} · {selected.area}</p></div></div><dl><div><dt>Mobile</dt><dd>{selected.phone}</dd></div><div><dt>Experience</dt><dd>{selected.years_experience} years</dd></div><div><dt>Evidence</dt><dd>{selected.documents.length} files</dd></div><div><dt>Submitted</dt><dd>{new Date(selected.submitted_at).toLocaleDateString()}</dd></div></dl><h3>Submitted evidence</h3><div className="document-grid">{selected.documents.map((document) => <button onClick={() => notify(`${document} opened in secure review.`)} key={document}><FileCheck2/><span><strong>{document.replaceAll("_"," ")}</strong><small>Protected file</small></span><Check/></button>)}</div>{error && <p className="form-error">{error}</p>}<div className="review-actions"><button disabled={reviewing} onClick={() => void review("rejected")} className="button reject"><X size={16}/>Decline</button><button disabled={reviewing} onClick={() => void review("approved")} className="button approve"><BadgeCheck size={16}/>Approve artisan</button></div></aside> : <aside className="review-detail"><EmptyOperations title="Select an application" text="Applicant identity and evidence will appear here." compact/></aside>}
      </div>}

      {section === "coverage" && <section className="analytics-card coverage-admin"><div className="card-heading"><div><span className="kicker">Coverage configuration</span><h2>Nairobi service map</h2></div></div><NairobiMap/></section>}
      {section === "jobs" && <EmptyOperations title="No operational jobs yet" text="Live jobs and disputes will appear after clients begin posting." />}
      {section === "people" && <EmptyOperations title="No marketplace accounts yet" text="Registered clients, artisans and estate teams will appear here." />}
      {section === "finance" && <EmptyOperations title="No financial activity yet" text="Payouts, platform fees and reserves will appear after payment integration records transactions." />}
    </section>
  </main>;
}

function EmptyOperations({ title, text, compact = false }: { title:string; text:string; compact?:boolean }) {
  return <section className={`analytics-card empty-operations ${compact ? "compact" : ""}`}><span className="kicker">Live data only</span><h2>{title}</h2><p>{text}</p></section>;
}
