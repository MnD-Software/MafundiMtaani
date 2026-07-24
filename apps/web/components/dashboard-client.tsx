"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BriefcaseBusiness, Check, CircleDollarSign, Clock3, LayoutDashboard, MapPin, MessageSquare, Star, UserRound } from "lucide-react";

type Job = { id:string; reference:string; title:string; description:string; trade:string; area:string; urgency:string; budget_min:number; budget_max:number; status:string; created_at:string };
type User = { name:string; role:string } | null;

export function DashboardClient() {
  const [section, setSection] = useState("overview");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<User>(null);
  const [notice, setNotice] = useState("");
  const notify = (message:string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  const refresh = async () => {
    const [jobsResponse, userResponse] = await Promise.all([fetch("/api/jobs"), fetch("/api/auth/me")]);
    if (jobsResponse.ok) setJobs(await jobsResponse.json());
    if (userResponse.ok) setUser((await userResponse.json()).user);
  };
  useEffect(() => { void refresh(); }, []);
  const nav = [["overview","Overview",LayoutDashboard],["jobs","Job requests",BriefcaseBusiness],["messages","Messages",MessageSquare],["earnings","Earnings",CircleDollarSign],["reviews","Reviews",Star]] as const;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const active = jobs.filter((job) => ["assigned","in_progress"].includes(job.status)).length;

  return <main className="dashboard-shell">
    <aside className="dashboard-sidebar"><Link className="brand dashboard-brand" href="/">Mafundi<span className="brand-dot">.</span><small>PRO</small></Link><nav>{nav.map(([id,label,Icon]) => <button onClick={() => setSection(id)} className={section === id ? "active" : ""} key={id}><Icon/>{label}{id === "jobs" && jobs.length > 0 && <span>{jobs.length}</span>}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => setSection("profile")}><UserRound/>My profile</button></div></aside>
    <section className="dashboard-main"><header><div><span>Role-protected artisan workspace</span><h1>{section === "overview" ? `Welcome${user?.name ? `, ${user.name}` : ""}.` : nav.find(([id]) => id === section)?.[1] || "Professional profile"}</h1></div><div className="dash-head-actions"><button aria-label="Notifications" onClick={() => notify(jobs.length ? `${jobs.length} eligible jobs loaded.` : "No new job alerts.")}><Bell size={19}/>{jobs.length > 0 && <i/>}</button><span className="identity-badge">{user?.name?.split(" ").map((part) => part[0]).join("").slice(0,2) || "AR"}</span></div></header>{notice && <div className="action-toast">{notice}</div>}
      {section === "overview" && <><div className="today-strip"><div><span className="live-dot"/><strong>Marketplace connected</strong><span>Only authorized artisan data is loaded</span></div><button onClick={() => setSection("profile")}>Update service profile</button></div><div className="metric-grid"><article><p>Eligible jobs</p><strong>{jobs.length}</strong><small>Loaded from the live API</small></article><article><p>Active jobs</p><strong>{active}</strong><small>Assigned or in progress</small></article><article><p>Completed jobs</p><strong>{completed}</strong><small>Verified history</small></article><article><p>Available balance</p><strong>KSh 0</strong><small>No seeded financial data</small></article></div><JobList jobs={jobs}/></>}
      {section === "jobs" && <JobList jobs={jobs}/>}
      {section === "messages" && <EmptyPanel title="No conversations yet" text="Secure job-room messages appear after you respond to a real job."/>}
      {section === "earnings" && <EmptyPanel title="No earnings yet" text="Completed payment and payout records will appear here."/>}
      {section === "reviews" && <EmptyPanel title="No reviews yet" text="Only reviews connected to completed jobs are published."/>}
      {section === "profile" && <section className="dash-panel-page profile-editor"><span className="kicker">Trust passport</span><h2>Professional profile</h2><label>Professional headline<input placeholder="Describe your specialty"/></label><label>About your work<textarea rows={5} placeholder="Tell clients how you work."/></label><label>Service areas<input placeholder="Select service estates"/></label><button onClick={() => notify("Profile changes are ready for API persistence.")} className="button button-dark">Save profile</button></section>}
    </section>
  </main>;
}

function JobList({ jobs }:{ jobs:Job[] }) {
  const [selected, setSelected] = useState("");
  return <section className="dash-panel-page"><span className="kicker">Live marketplace</span><h2>Eligible jobs</h2>{jobs.length ? jobs.map((job) => <article className="job-card" key={job.id}><div className="job-top"><div><span className="job-trade">{job.trade}</span><h3>{job.title}</h3></div><strong>{job.budget_max ? `Up to KSh ${job.budget_max.toLocaleString()}` : "Quote requested"}</strong></div><p><MapPin size={15}/>{job.area} · <Clock3 size={15}/>{job.urgency}</p>{selected === job.id && <p className="job-description">{job.description}</p>}<div className="job-card-actions"><span>{job.reference}</span><button onClick={() => setSelected(selected === job.id ? "" : job.id)}><Check size={15}/>{selected === job.id ? "Close details" : "Review job"}</button></div></article>) : <EmptyPanel title="No eligible jobs" text="Jobs matching your trade and coverage will appear here without demo records."/>}</section>;
}

function EmptyPanel({ title,text }:{ title:string;text:string }) {
  return <section className="dash-panel-page empty-operations"><span className="kicker">Live data only</span><h2>{title}</h2><p>{text}</p></section>;
}
