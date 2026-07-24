"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BriefcaseBusiness, Check, CircleDollarSign, Clock3, LayoutDashboard, MapPin, MessageSquare, Star, UserRound } from "lucide-react";

type Job = { id:string; reference:string; title:string; description:string; trade:string; area:string; urgency:string; budget_min:number; budget_max:number; status:string; created_at:string };
type User = { name:string; role:string } | null;
type DashboardMetrics = { role:string; jobs_total:number; jobs_by_status:Record<string,number>; money_spent:number; gross_earnings:number; platform_fees:number; net_earnings:number; funds_held:number; transactions:number };
const emptyMetrics: DashboardMetrics = { role:"",jobs_total:0,jobs_by_status:{},money_spent:0,gross_earnings:0,platform_fees:0,net_earnings:0,funds_held:0,transactions:0 };

export function DashboardClient() {
  const [section, setSection] = useState("overview");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<User>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [notice, setNotice] = useState("");
  const notify = (message:string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  const refresh = async () => {
    const [jobsResponse, userResponse, metricsResponse] = await Promise.all([fetch("/api/jobs"), fetch("/api/auth/me"), fetch("/api/dashboard/metrics")]);
    if (jobsResponse.ok) setJobs(await jobsResponse.json());
    if (userResponse.ok) setUser((await userResponse.json()).user);
    if (metricsResponse.ok) setMetrics(await metricsResponse.json());
  };
  useEffect(() => { void refresh(); }, []);
  const artisanMode = user?.role === "artisan";
  const nav = [["overview","Overview",LayoutDashboard],["jobs",artisanMode ? "Job requests" : "My jobs",BriefcaseBusiness],["messages","Messages",MessageSquare],["earnings",artisanMode ? "Earnings" : "Payments",CircleDollarSign],["reviews","Reviews",Star]] as const;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const active = jobs.filter((job) => ["assigned","in_progress"].includes(job.status)).length;

  return <main className="dashboard-shell">
    <aside className="dashboard-sidebar"><Link className="brand dashboard-brand" href="/">Mafundi<span className="brand-dot">.</span><small>{artisanMode ? "PRO" : "CLIENT"}</small></Link><nav>{nav.map(([id,label,Icon]) => <button onClick={() => setSection(id)} className={section === id ? "active" : ""} key={id}><Icon/>{label}{id === "jobs" && jobs.length > 0 && <span>{jobs.length}</span>}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => setSection("profile")}><UserRound/>My profile</button></div></aside>
    <section className="dashboard-main"><header><div><span>Private {artisanMode ? "artisan" : "client"} workspace</span><h1>{section === "overview" ? `Welcome${user?.name ? `, ${user.name}` : ""}.` : nav.find(([id]) => id === section)?.[1] || "Account profile"}</h1></div><div className="dash-head-actions"><button aria-label="Notifications" onClick={() => notify(jobs.length ? `${jobs.length} authorized jobs loaded.` : "No new job alerts.")}><Bell size={19}/>{jobs.length > 0 && <i/>}</button><span className="identity-badge">{user?.name?.split(" ").map((part) => part[0]).join("").slice(0,2) || "MM"}</span></div></header>{notice && <div className="action-toast">{notice}</div>}
      {section === "overview" && <><div className="today-strip"><div><span className="live-dot"/><strong>Marketplace connected</strong><span>Only your authorized data is loaded</span></div><button onClick={() => setSection(artisanMode ? "profile" : "jobs")}>{artisanMode ? "Update service profile" : "View my jobs"}</button></div><div className="metric-grid"><article><p>{artisanMode ? "Eligible jobs" : "Jobs posted"}</p><strong>{jobs.length}</strong><small>Loaded from the live API</small></article><article><p>Active jobs</p><strong>{active}</strong><small>Assigned or in progress</small></article><article><p>Completed jobs</p><strong>{completed}</strong><small>Verified history</small></article><article><p>{artisanMode ? "Net earnings" : "Money spent"}</p><strong>KSh {(artisanMode ? metrics.net_earnings : metrics.money_spent).toLocaleString()}</strong><small>Completed transactions only</small></article></div><RoleChart metrics={metrics}/><JobList jobs={jobs}/></>}
      {section === "jobs" && <JobList jobs={jobs}/>}
      {section === "messages" && <EmptyPanel title="No conversations yet" text="Secure job-room messages appear after you respond to a real job."/>}
      {section === "earnings" && <section className="dash-panel-page"><span className="kicker">{artisanMode ? "Payout intelligence" : "Payment history"}</span><h2>{artisanMode ? "Earnings & payouts" : "Your marketplace spend"}</h2><div className="dashboard-finance-grid"><article><span>{artisanMode ? "Gross earnings" : "Completed spend"}</span><strong>KSh {(artisanMode ? metrics.gross_earnings : metrics.money_spent).toLocaleString()}</strong></article><article><span>{artisanMode ? "Platform fees" : "Funds held"}</span><strong>KSh {(artisanMode ? metrics.platform_fees : metrics.funds_held).toLocaleString()}</strong></article><article><span>{artisanMode ? "Net earnings" : "Transactions"}</span><strong>{artisanMode ? `KSh ${metrics.net_earnings.toLocaleString()}` : metrics.transactions}</strong></article></div>{!metrics.transactions && <EmptyPanel title="No transactions yet" text="This ledger populates only after a payment provider records a real transaction."/>}</section>}
      {section === "reviews" && <EmptyPanel title="No reviews yet" text="Only reviews connected to completed jobs are published."/>}
      {section === "profile" && <section className="dash-panel-page profile-editor"><span className="kicker">Trust passport</span><h2>Professional profile</h2><label>Professional headline<input placeholder="Describe your specialty"/></label><label>About your work<textarea rows={5} placeholder="Tell clients how you work."/></label><label>Service areas<input placeholder="Select service estates"/></label><button onClick={() => notify("Profile changes are ready for API persistence.")} className="button button-dark">Save profile</button></section>}
    </section>
  </main>;
}

function RoleChart({ metrics }:{ metrics:DashboardMetrics }) {
  const rows = Object.entries(metrics.jobs_by_status).filter(([,value]) => value > 0);
  const max = Math.max(...rows.map(([,value]) => value),1);
  return <section className="dash-panel-page role-chart"><span className="kicker">Activity intelligence</span><h2>Your job lifecycle</h2>{rows.length ? rows.map(([label,value]) => <div className="bar-row" key={label}><span>{label.replaceAll("_"," ")}</span><div><i style={{width:`${(value/max)*100}%`}}/></div><strong>{value}</strong></div>) : <div className="chart-empty"><strong>No activity yet</strong><span>Your chart will grow from real jobs.</span></div>}</section>;
}

function JobList({ jobs }:{ jobs:Job[] }) {
  const [selected, setSelected] = useState("");
  return <section className="dash-panel-page"><span className="kicker">Live marketplace</span><h2>Eligible jobs</h2>{jobs.length ? jobs.map((job) => <article className="job-card" key={job.id}><div className="job-top"><div><span className="job-trade">{job.trade}</span><h3>{job.title}</h3></div><strong>{job.budget_max ? `Up to KSh ${job.budget_max.toLocaleString()}` : "Quote requested"}</strong></div><p><MapPin size={15}/>{job.area} · <Clock3 size={15}/>{job.urgency}</p>{selected === job.id && <p className="job-description">{job.description}</p>}<div className="job-card-actions"><span>{job.reference}</span><button onClick={() => setSelected(selected === job.id ? "" : job.id)}><Check size={15}/>{selected === job.id ? "Close details" : "Review job"}</button></div></article>) : <EmptyPanel title="No eligible jobs" text="Jobs matching your trade and coverage will appear here without demo records."/>}</section>;
}

function EmptyPanel({ title,text }:{ title:string;text:string }) {
  return <section className="dash-panel-page empty-operations"><span className="kicker">Live data only</span><h2>{title}</h2><p>{text}</p></section>;
}
