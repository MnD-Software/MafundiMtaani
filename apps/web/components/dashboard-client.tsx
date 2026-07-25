"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  Check,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  KeyRound,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { creationOptions, serializeCredential } from "@/lib/passkeys";

type Job = {
  id: string;
  reference: string;
  title: string;
  description: string;
  trade: string;
  area: string;
  urgency: string;
  budget_min: number;
  budget_max: number;
  status: string;
  created_at: string;
};
type User = {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
} | null;
type DashboardMetrics = {
  role: string;
  jobs_total: number;
  jobs_by_status: Record<string, number>;
  money_spent: number;
  gross_earnings: number;
  platform_fees: number;
  net_earnings: number;
  funds_held: number;
  transactions: number;
};
const emptyMetrics: DashboardMetrics = {
  role: "",
  jobs_total: 0,
  jobs_by_status: {},
  money_spent: 0,
  gross_earnings: 0,
  platform_fees: 0,
  net_earnings: 0,
  funds_held: 0,
  transactions: 0,
};

export function DashboardClient({
  initialSection = "overview",
}: {
  initialSection?: string;
}) {
  const [section, setSection] = useState(initialSection);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<User>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [notice, setNotice] = useState("");
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };
  const refresh = async () => {
    const [jobsResponse, userResponse, metricsResponse] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/auth/me"),
      fetch("/api/dashboard/metrics"),
    ]);
    if (jobsResponse.ok) setJobs(await jobsResponse.json());
    if (userResponse.ok) setUser((await userResponse.json()).user);
    if (metricsResponse.ok) setMetrics(await metricsResponse.json());
  };
  useEffect(() => {
    void refresh();
  }, []);
  const artisanMode = user?.role === "artisan";
  const nav = [
    ["overview", "Overview", LayoutDashboard],
    ["jobs", artisanMode ? "Job requests" : "My jobs", BriefcaseBusiness],
    ["messages", "Messages", MessageSquare],
    ["notifications", "Notifications", Bell],
    ["earnings", artisanMode ? "Earnings" : "Payments", CircleDollarSign],
    ["care", artisanMode ? "Support" : "Property care", MapPin],
    ["reviews", "Reviews", Star],
    ["safety", "Safety & privacy", ShieldCheck],
    ["security", "Sign-in & security", KeyRound],
  ] as const;
  const completed = jobs.filter((job) => job.status === "completed").length;
  const active = jobs.filter((job) =>
    ["assigned", "in_progress"].includes(job.status),
  ).length;

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" href="/">
          Mafundi Mtaani<span className="brand-dot">.</span>
          <small>{artisanMode ? "PRO" : "CLIENT"}</small>
        </Link>
        <nav>
          <Link href="/"><MapPin/>Explore marketplace</Link>
          {nav.map(([id, label, Icon]) => (
            <button
              onClick={() => setSection(id)}
              className={section === id ? "active" : ""}
              key={id}
            >
              <Icon />
              {label}
              {id === "jobs" && jobs.length > 0 && <span>{jobs.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => setSection("profile")}>
            <UserRound />
            My profile
          </button>
        </div>
      </aside>
      <section className="dashboard-main">
        <header>
          <div>
            <span>Private {artisanMode ? "artisan" : "client"} workspace</span>
            <h1>
              {section === "overview"
                ? `Welcome${user?.name ? `, ${user.name}` : ""}.`
                : nav.find(([id]) => id === section)?.[1] || "Account profile"}
            </h1>
          </div>
          <div className="dash-head-actions">
            <button
              aria-label="Notifications"
              onClick={() => setSection("notifications")}
            >
              <Bell size={19} />
              {jobs.length > 0 && <i />}
            </button>
            <span className="identity-badge account-avatar">
              {user?.avatar_url?<img src={user.avatar_url} alt=""/>:user?.name
                ?.split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2) || "MM"}
            </span>
          </div>
        </header>
        {notice && <div className="action-toast">{notice}</div>}
        {section === "overview" && (
          <>
            <div className="today-strip">
              <div>
                <span className="live-dot" />
                <strong>Marketplace connected</strong>
                <span>Only your authorized data is loaded</span>
              </div>
              <button
                onClick={() => setSection(artisanMode ? "profile" : "jobs")}
              >
                {artisanMode ? "Update service profile" : "View my jobs"}
              </button>
            </div>
            <div className="metric-grid">
              <article>
                <p>{artisanMode ? "Eligible jobs" : "Jobs posted"}</p>
                <strong>{jobs.length}</strong>
                <small>Loaded from the live API</small>
              </article>
              <article>
                <p>Active jobs</p>
                <strong>{active}</strong>
                <small>Assigned or in progress</small>
              </article>
              <article>
                <p>Completed jobs</p>
                <strong>{completed}</strong>
                <small>Verified history</small>
              </article>
              <article>
                <p>{artisanMode ? "Net earnings" : "Money spent"}</p>
                <strong>
                  KSh{" "}
                  {(artisanMode
                    ? metrics.net_earnings
                    : metrics.money_spent
                  ).toLocaleString()}
                </strong>
                <small>Completed transactions only</small>
              </article>
            </div>
            <RoleChart metrics={metrics} />
            <GrowthTools />
            <JobList jobs={jobs} />
          </>
        )}
        {section === "jobs" && <JobList jobs={jobs} />}
        {section === "messages" && (
          <section className="dash-panel-page">
            <span className="kicker">Protected conversations</span>
            <h2>Job rooms</h2>
            {jobs.length ? (
              jobs.map((job) => (
                <Link
                  className="dashboard-room-link"
                  href={`/jobs/${job.id}`}
                  key={job.id}
                >
                  <span>
                    <strong>{job.title}</strong>
                    <small>
                      {job.reference} · {job.area}
                    </small>
                  </span>
                  <MessageSquare size={17} />
                </Link>
              ))
            ) : (
              <EmptyPanel
                title="No conversations yet"
                text="Secure job-room messages appear after a real job is created."
              />
            )}
          </section>
        )}
        {section === "notifications" && <NotificationCenter />}
        {section === "earnings" && (
          <section className="dash-panel-page">
            <span className="kicker">
              {artisanMode ? "Payout intelligence" : "Payment history"}
            </span>
            <h2>
              {artisanMode ? "Earnings & payouts" : "Your marketplace spend"}
            </h2>
            <div className="dashboard-finance-grid">
              <article>
                <span>
                  {artisanMode ? "Gross earnings" : "Completed spend"}
                </span>
                <strong>
                  KSh{" "}
                  {(artisanMode
                    ? metrics.gross_earnings
                    : metrics.money_spent
                  ).toLocaleString()}
                </strong>
              </article>
              <article>
                <span>{artisanMode ? "Platform fees" : "Funds held"}</span>
                <strong>
                  KSh{" "}
                  {(artisanMode
                    ? metrics.platform_fees
                    : metrics.funds_held
                  ).toLocaleString()}
                </strong>
              </article>
              <article>
                <span>{artisanMode ? "Net earnings" : "Transactions"}</span>
                <strong>
                  {artisanMode
                    ? `KSh ${metrics.net_earnings.toLocaleString()}`
                    : metrics.transactions}
                </strong>
              </article>
            </div>
            {!artisanMode && <PaymentMethods />}
            {!metrics.transactions && (
              <EmptyPanel
                title="No transactions yet"
                text="This ledger populates only after a payment provider records a real transaction."
              />
            )}
          </section>
        )}
        {section === "reviews" && (
          <EmptyPanel
            title="No reviews yet"
            text="Only reviews connected to completed jobs are published."
          />
        )}
        {section === "safety" && <SafetyAndPrivacy />}
        {section === "security" && <SecurityCenter />}
        {section === "care" && <CareAndSupport artisanMode={artisanMode}/>}
        {section === "schedule" && <SchedulePanel />}
        {section === "profile" && (
          <ProfileEditor
            artisanMode={artisanMode}
            user={user}
            notify={notify}
          />
        )}
      </section>
    </main>
  );
}

function NotificationCenter() {
  type Alert = { id:string; title:string; body:string; read:boolean; created_at:string };
  type Search = { id:string; name:string; query:string; trade:string; area:string };
  type Preferences = { in_app:boolean; email:boolean; sms:boolean; push:boolean; job_updates:boolean; offers:boolean };
  const [alerts,setAlerts]=useState<Alert[]>([]); const [searches,setSearches]=useState<Search[]>([]);
  const [preferences,setPreferences]=useState<Preferences>({in_app:true,email:true,sms:false,push:false,job_updates:true,offers:false});
  const load=async()=>{const[a,s,p]=await Promise.all([fetch("/api/marketplace/notifications"),fetch("/api/marketplace/saved-searches"),fetch("/api/marketplace/notification-preferences")]);if(a.ok)setAlerts(await a.json());if(s.ok)setSearches(await s.json());if(p.ok)setPreferences(await p.json())};
  useEffect(()=>{void load()},[]);
  const read=async(id:string)=>{await fetch(`/api/marketplace/notifications/${id}`,{method:"PATCH"});void load()};
  const update=async(key:keyof Preferences,value:boolean)=>{const next={...preferences,[key]:value};setPreferences(next);await fetch("/api/marketplace/notification-preferences",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(next)})};
  return <section className="dash-panel-page"><span className="kicker">Your attention centre</span><h2>Notifications</h2>
    <div className="preference-strip">{(["in_app","email","job_updates","offers"] as const).map(key=><label key={key}><input type="checkbox" checked={preferences[key]} onChange={event=>void update(key,event.target.checked)}/>{key.replaceAll("_"," ")}</label>)}</div>
    {alerts.length?alerts.map(item=><button className={`notification-row ${item.read?"":"unread"}`} key={item.id} onClick={()=>void read(item.id)}><span><strong>{item.title}</strong><small>{item.body}</small></span><time>{new Date(item.created_at).toLocaleString()}</time></button>):<EmptyPanel title="You are all caught up" text="Job, payment, safety and support updates appear here."/>}
    <div className="section-heading"><div><span className="kicker">Discovery</span><h2>Saved searches</h2></div></div>
    {searches.length?searches.map(item=><Link className="dashboard-room-link" key={item.id} href={`/?q=${encodeURIComponent(item.query||item.trade)}&area=${encodeURIComponent(item.area)}`}><span><strong>{item.name}</strong><small>{item.query||item.trade||"All services"} · {item.area||"Any area"}</small></span><Search size={16}/></Link>):<EmptyPanel title="No saved searches" text="Save useful combinations from marketplace search."/>}
  </section>
}

function SecurityCenter() {
  type Passkey = { id: string; label: string; created_at: string; last_used_at: string | null };
  type Session = { id: string; user_agent: string; ip_address: string; created_at: string; last_seen_at: string };
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notice, setNotice] = useState("");
  const load = async () => {
    const [passkeyResponse, sessionResponse] = await Promise.all([fetch("/api/marketplace/auth/passkeys"), fetch("/api/marketplace/auth/sessions")]);
    if (passkeyResponse.ok) setPasskeys(await passkeyResponse.json());
    if (sessionResponse.ok) setSessions(await sessionResponse.json());
  };
  useEffect(() => { void load(); }, []);
  const addPasskey = async () => {
    if (!window.PublicKeyCredential) return setNotice("Passkeys are not supported by this browser.");
    try {
      const response = await fetch("/api/marketplace/auth/passkeys/register/options", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail);
      const credential = await navigator.credentials.create({ publicKey: creationOptions(data.options) }) as PublicKeyCredential | null;
      if (!credential) throw new Error("Passkey setup was cancelled.");
      const complete = await fetch("/api/marketplace/auth/passkeys/register/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge_id: data.challenge_id, credential: serializeCredential(credential), label: navigator.platform || "This device" }) });
      const result = await complete.json();
      if (!complete.ok) throw new Error(result.detail);
      setNotice("Passkey added. You can now sign in using this device."); void load();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Passkey setup failed."); }
  };
  const revoke = async (sessionId: string) => {
    await fetch(`/api/marketplace/auth/sessions/${sessionId}`, { method: "DELETE" });
    setNotice("That session has been signed out."); void load();
  };
  const changePassword = async () => {
    const current_password = window.prompt("Current password");
    const new_password = window.prompt("New password (at least 10 characters)");
    if (!current_password || !new_password) return;
    const response = await fetch("/api/marketplace/auth/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password, new_password }) });
    const data = await response.json();
    if (!response.ok) return setNotice(data.detail || "Password could not be changed.");
    await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login";
  };
  return <section className="dash-panel-page security-center">
    <span className="kicker">Account protection</span><h2>Sign-in & security</h2>{notice && <p className="form-success">{notice}</p>}
    <div className="section-heading"><div><h2>Passkeys</h2><p>Use Face ID, Touch ID, Windows Hello or your device screen lock.</p></div><button onClick={() => void addPasskey()}>Add passkey</button></div>
    {passkeys.length ? passkeys.map((item) => <article className="dashboard-room-link" key={item.id}><span><strong>{item.label}</strong><small>Added {new Date(item.created_at).toLocaleDateString()}{item.last_used_at ? ` · Used ${new Date(item.last_used_at).toLocaleDateString()}` : ""}</small></span><KeyRound size={17}/></article>) : <EmptyPanel title="No passkeys yet" text="Add one for faster phishing-resistant sign-in."/>}
    <div className="section-heading"><div><h2>Active sessions</h2><p>Review devices that currently have access to this account.</p></div><button onClick={() => void changePassword()}>Change password</button></div>
    {sessions.map((item) => <article className="dashboard-room-link" key={item.id}><span><strong>{deviceName(item.user_agent)}</strong><small>{item.ip_address || "Private network"} · Active {new Date(item.last_seen_at).toLocaleString()}</small></span><button onClick={() => void revoke(item.id)}>Sign out</button></article>)}
  </section>;
}

function deviceName(agent: string) {
  if (/iPhone|iPad/.test(agent)) return "Apple mobile device";
  if (/Android/.test(agent)) return "Android device";
  if (/Windows/.test(agent)) return "Windows device";
  if (/Macintosh/.test(agent)) return "Mac";
  return "Web browser";
}

function SafetyAndPrivacy() {
  type Contact = { id: string; name: string; phone: string; relationship: string };
  type Consent = { purpose: string; granted: boolean };
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [notice, setNotice] = useState("");
  const load = async () => {
    const [contactsResponse, consentsResponse] = await Promise.all([
      fetch("/api/marketplace/safety/trusted-contacts"),
      fetch("/api/marketplace/privacy/consents"),
    ]);
    if (contactsResponse.ok) setContacts(await contactsResponse.json());
    if (consentsResponse.ok) setConsents(await consentsResponse.json());
  };
  useEffect(() => { void load(); }, []);
  const addContact = async () => {
    const name = window.prompt("Trusted contact name");
    const phone = window.prompt("Phone number, including country code");
    if (!name || !phone) return;
    const relationship = window.prompt("Relationship (optional)") || "";
    const response = await fetch("/api/marketplace/safety/trusted-contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, relationship }),
    });
    setNotice(response.ok ? "Trusted contact saved." : (await response.json()).detail);
    void load();
  };
  const setConsent = async (purpose: string, granted: boolean) => {
    await fetch("/api/marketplace/privacy/consents", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, granted }),
    });
    void load();
  };
  const download = async () => {
    const response = await fetch("/api/marketplace/privacy/export");
    if (!response.ok) return setNotice("Your export could not be prepared.");
    const blob = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "mafundi-mtaani-account-data.json"; link.click(); URL.revokeObjectURL(url);
  };
  const sos = () => navigator.geolocation?.getCurrentPosition(
    async ({ coords }) => {
      const response = await fetch("/api/marketplace/safety/sos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
      });
      setNotice(response.ok ? "Safety alert recorded with your location." : "Could not record the alert.");
    },
    async () => {
      const response = await fetch("/api/marketplace/safety/sos", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setNotice(response.ok ? "Safety alert recorded without location." : "Could not record the alert.");
    },
  );
  const marketing = consents.find((item) => item.purpose === "marketing")?.granted ?? false;
  return <section className="dash-panel-page">
    <span className="kicker">Control and protection</span><h2>Safety & privacy</h2>
    {notice && <p className="form-success">{notice}</p>}
    <div className="dashboard-finance-grid">
      <article><span>Emergency support</span><strong>SOS check-in</strong><p>Record a time-stamped safety event and location when available.</p><button className="button button-dark" onClick={sos}>Send safety alert</button></article>
      <article><span>Your information</span><strong>Portable by design</strong><p>Download the account, job, contact, and consent data held about you.</p><button className="button" onClick={() => void download()}>Download my data</button></article>
      <article><span>Communication choice</span><strong>Offers & campaigns</strong><p>Service messages remain available; promotional communication is optional.</p><label><input type="checkbox" checked={marketing} onChange={(event) => void setConsent("marketing", event.target.checked)}/> Allow offers</label></article>
    </div>
    <div className="section-heading"><div><span className="kicker">Trusted circle</span><h2>Emergency contacts</h2></div><button onClick={() => void addContact()}>Add contact</button></div>
    {contacts.length ? contacts.map((contact) => <article className="dashboard-room-link" key={contact.id}><span><strong>{contact.name}</strong><small>{contact.relationship || "Trusted contact"} · {contact.phone}</small></span></article>) : <EmptyPanel title="No trusted contacts" text="Add up to five people you trust."/>}
  </section>;
}

function CareAndSupport({artisanMode}:{artisanMode:boolean}){
  type PropertyItem={id:string;name:string;area:string;property_type:string};
  type Ticket={id:string;reference:string;subject:string;priority:string;status:string;sla_due_at:string};
  const[properties,setProperties]=useState<PropertyItem[]>([]);const[tickets,setTickets]=useState<Ticket[]>([]);const[earnings,setEarnings]=useState<{total:number;pending:number}|null>(null);const[notice,setNotice]=useState("");
  const load=()=>void Promise.all([artisanMode?Promise.resolve(null):fetch("/api/marketplace/properties"),fetch("/api/marketplace/support-tickets"),artisanMode?fetch("/api/marketplace/artisan/earnings"):Promise.resolve(null)]).then(async([a,b,c])=>{if(a&&a.ok)setProperties(await a.json());if(b.ok)setTickets(await b.json());if(c&&c.ok)setEarnings(await c.json())});
  useEffect(load,[artisanMode]);
  const addProperty=async()=>{const name=window.prompt("Property name");const area=window.prompt("Nairobi estate","Kilimani");if(!name||!area)return;const response=await fetch("/api/marketplace/properties",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,area,property_type:"home",address:"",notes:""})});setNotice(response.ok?"Property added.":(await response.json()).detail);load()};
  const ticket=async()=>{const subject=window.prompt("What do you need help with?");const details=window.prompt("Describe the issue");if(!subject||!details)return;const response=await fetch("/api/marketplace/support-tickets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,details,priority:"normal"})});setNotice(response.ok?"Support ticket opened.":(await response.json()).detail);load()};
  return <section className="dash-panel-page"><span className="kicker">{artisanMode?"Earnings assistance":"Homes & support"}</span><h2>{artisanMode?"Support and bonus ledger":"Property care made simple"}</h2>{notice&&<p className="form-success">{notice}</p>}{artisanMode&&<div className="dashboard-finance-grid"><article><span>Paid tips & bonuses</span><strong>KSh {(earnings?.total||0).toLocaleString()}</strong></article><article><span>Pending</span><strong>KSh {(earnings?.pending||0).toLocaleString()}</strong></article></div>}{!artisanMode&&<><button className="button button-dark" onClick={()=>void addProperty()}>Add a property</button><div className="growth-grid">{properties.map(item=><article key={item.id}><small>{item.property_type}</small><strong>{item.name}</strong><p>{item.area}</p></article>)}</div></>}<div className="section-heading"><div><span className="kicker">Service desk</span><h2>Your support tickets</h2></div><button onClick={()=>void ticket()}>Open ticket</button></div>{tickets.length?tickets.map(item=><article className="dashboard-room-link" key={item.id}><span><strong>{item.subject}</strong><small>{item.reference} · {item.priority} · SLA {new Date(item.sla_due_at).toLocaleString()}</small></span><b>{item.status}</b></article>):<EmptyPanel title="No support tickets" text="Help requests and their SLA status appear here."/>}</section>
}

function SchedulePanel() {
  const initial = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    start_time: "08:00",
    end_time: "17:00",
    active: weekday < 6,
  }));
  const [rows, setRows] = useState(initial);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void fetch("/api/marketplace/availability")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (data.length)
          setRows(
            initial.map(
              (row) =>
                data.find(
                  (item: { weekday: number }) => item.weekday === row.weekday,
                ) || row,
            ),
          );
      });
  }, []);
  const update = (weekday: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) =>
      current.map((row) =>
        row.weekday === weekday ? { ...row, ...patch } : row,
      ),
    );
  const save = async () => {
    const response = await fetch("/api/marketplace/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });
    setNotice(
      response.ok ? "Availability saved." : "Could not save availability.",
    );
  };
  return (
    <section className="dash-panel-page schedule-panel">
      <span className="kicker">Work controls</span>
      <h2>Availability schedule</h2>
      <p>Control when you can receive matched jobs.</p>
      {rows.map((row) => (
        <div key={row.weekday}>
          <strong>
            {
              [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ][row.weekday]
            }
          </strong>
          <button
            className={row.active ? "active" : ""}
            onClick={() => update(row.weekday, { active: !row.active })}
          >
            {row.active ? "Online" : "Offline"}
          </button>
          <input
            disabled={!row.active}
            type="time"
            value={row.start_time}
            onChange={(event) =>
              update(row.weekday, { start_time: event.target.value })
            }
          />
          <input
            disabled={!row.active}
            type="time"
            value={row.end_time}
            onChange={(event) =>
              update(row.weekday, { end_time: event.target.value })
            }
          />
        </div>
      ))}
      <button onClick={() => void save()} className="button button-dark">
        Save weekly schedule
      </button>
      {notice && <small>{notice}</small>}
    </section>
  );
}

function RoleChart({ metrics }: { metrics: DashboardMetrics }) {
  const rows = Object.entries(metrics.jobs_by_status).filter(
    ([, value]) => value > 0,
  );
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <section className="dash-panel-page role-chart">
      <span className="kicker">Activity intelligence</span>
      <h2>Your job lifecycle</h2>
      {rows.length ? (
        rows.map(([label, value]) => (
          <div className="bar-row" key={label}>
            <span>{label.replaceAll("_", " ")}</span>
            <div>
              <i style={{ width: `${(value / max) * 100}%` }} />
            </div>
            <strong>{value}</strong>
          </div>
        ))
      ) : (
        <div className="chart-empty">
          <strong>No activity yet</strong>
          <span>Your chart will grow from real jobs.</span>
        </div>
      )}
    </section>
  );
}

function JobList({ jobs }: { jobs: Job[] }) {
  const [selected, setSelected] = useState("");
  return (
    <section className="dash-panel-page">
      <span className="kicker">Live marketplace</span>
      <h2>Eligible jobs</h2>
      {jobs.length ? (
        jobs.map((job) => (
          <article className="job-card" key={job.id}>
            <div className="job-top">
              <div>
                <span className="job-trade">{job.trade}</span>
                <h3>{job.title}</h3>
              </div>
              <strong>
                {job.budget_max
                  ? `Up to KSh ${job.budget_max.toLocaleString()}`
                  : "Quote requested"}
              </strong>
            </div>
            <p>
              <MapPin size={15} />
              {job.area} · <Clock3 size={15} />
              {job.urgency}
            </p>
            {selected === job.id && (
              <p className="job-description">{job.description}</p>
            )}
            <div className="job-card-actions">
              <span>{job.reference}</span>
              <div>
                <button
                  onClick={() => setSelected(selected === job.id ? "" : job.id)}
                >
                  <Check size={15} />
                  {selected === job.id ? "Close" : "Details"}
                </button>
                <Link href={`/jobs/${job.id}`}>Open job room</Link>
              </div>
            </div>
          </article>
        ))
      ) : (
        <EmptyPanel
          title="No eligible jobs"
          text="Jobs matching your trade and coverage will appear here without demo records."
        />
      )}
    </section>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="dash-panel-page empty-operations">
      <span className="kicker">Live data only</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function GrowthTools() {
  const [phone,setPhone]=useState("");
  const [paymentNotice,setPaymentNotice]=useState("");
  const [referral, setReferral] = useState<{
    code: string;
    completed_referrals: number;
    rewards_earned: number;
  } | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    monthly_amount: number;
  } | null>(null);
  const [invoices, setInvoices] = useState<
    { id: string; number: string; total: number; issued_at: string }[]
  >([]);
  const load = () =>
    void Promise.all([
      fetch("/api/marketplace/referrals/me"),
      fetch("/api/marketplace/subscriptions/me"),
      fetch("/api/marketplace/invoices"),
    ]).then(async ([a, b, c]) => {
      if (a.ok) setReferral(await a.json());
      if (b.ok) setSubscription(await b.json());
      if (c.ok) setInvoices(await c.json());
    });
  useEffect(load, []);
  const choose = async (plan: string) => {
    await fetch("/api/marketplace/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    load();
  };
  const payPlan=async()=>{
    setPaymentNotice("");
    const response=await fetch("/api/marketplace/subscriptions/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});
    const payload=await response.json();setPaymentNotice(response.ok?payload.message:payload.detail||"Payment could not start.");
  };
  return (
    <section className="dash-panel-page growth-tools">
      <div>
        <span className="kicker">Growth & records</span>
        <h2>Benefits, plan and invoices</h2>
      </div>
      <div className="growth-grid">
        <article>
          <small>Referral code</small>
          <strong>{referral?.code || "Loading…"}</strong>
          <p>
            {referral?.completed_referrals || 0} completed · KSh{" "}
            {(referral?.rewards_earned || 0).toLocaleString()} earned
          </p>
        </article>
        <article>
          <small>Current plan</small>
          <strong>{subscription?.plan || "free"}</strong>
          <p>
            {subscription?.status || "active"} · KSh{" "}
            {(subscription?.monthly_amount || 0).toLocaleString()}/month
          </p>
          <div>
            <button onClick={() => void choose("free")}>Free</button>
            <button onClick={() => void choose("pro")}>Pro</button>
            <button onClick={() => void choose("business")}>Business</button>
          </div>
          {subscription?.status==="pending"&&<div className="plan-checkout"><input value={phone} onChange={event=>setPhone(event.target.value)} placeholder="2547XXXXXXXX"/><button onClick={()=>void payPlan()}>Pay with M-Pesa</button></div>}
          {paymentNotice&&<p>{paymentNotice}</p>}
        </article>
        <article>
          <small>Tax invoices</small>
          <strong>{invoices.length}</strong>
          <p>
            {invoices.length
              ? `Latest: ${invoices[0].number}`
              : "Generated from real payments only"}
          </p>
          {invoices.slice(0, 3).map((invoice) => (
            <a
              key={invoice.id}
              href={`/api/marketplace/invoices/${invoice.id}/pdf`}
            >
              Download {invoice.number}
            </a>
          ))}
        </article>
      </div>
    </section>
  );
}

function ProfileEditor({
  artisanMode,
  user,
  notify,
}: {
  artisanMode: boolean;
  user: User;
  notify: (message: string) => void;
}) {
  const [profile, setProfile] = useState({
    bio: "",
    skills: "",
    area: "Kilimani",
    available: false,
  });
  const [loading, setLoading] = useState(artisanMode);
  useEffect(() => {
    if (!artisanMode) return;
    void fetch("/api/marketplace/artisans/me")
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setProfile({
            bio: data.bio || "",
            skills: (data.skills || []).join(", "),
            area: data.area,
            available: data.available,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [artisanMode]);
  const save = async () => {
    if (!artisanMode) {
      notify("Client account details are managed securely through support.");
      return;
    }
    const response = await fetch("/api/marketplace/artisans/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio: profile.bio,
        skills: profile.skills
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        area: profile.area,
        available: profile.available,
      }),
    });
    notify(
      response.ok
        ? "Professional profile saved."
        : "Profile could not be saved.",
    );
  };
  return (
    <section className="dash-panel-page profile-editor">
      <span className="kicker">
        {artisanMode ? "Trust passport" : "Private account"}
      </span>
      <h2>{artisanMode ? "Professional profile" : "Account profile"}</h2>
      {artisanMode ? (
        <>
          {loading && <p>Loading profile…</p>}
          <label>
            About your work
            <textarea
              rows={5}
              value={profile.bio}
              onChange={(event) =>
                setProfile({ ...profile, bio: event.target.value })
              }
              placeholder="Tell clients how you work."
            />
          </label>
          <label>
            Skills, separated by commas
            <input
              value={profile.skills}
              onChange={(event) =>
                setProfile({ ...profile, skills: event.target.value })
              }
              placeholder="Pipe repair, installations"
            />
          </label>
          <label>
            Primary service area
            <input
              value={profile.area}
              onChange={(event) =>
                setProfile({ ...profile, area: event.target.value })
              }
            />
          </label>
          <label className="availability-toggle">
            <input
              type="checkbox"
              checked={profile.available}
              onChange={(event) =>
                setProfile({ ...profile, available: event.target.checked })
              }
            />
            Accepting new jobs
          </label>
        </>
      ) : (
        <>
          <label>
            Name
            <input value={user?.name || ""} readOnly />
          </label>
          <label>
            Email
            <input value={user?.email || ""} readOnly />
          </label>
          <label>
            Phone
            <input value={user?.phone || ""} readOnly />
          </label>
        </>
      )}
      <button onClick={() => void save()} className="button button-dark">
        Save profile
      </button>
      {artisanMode && <PortfolioManager />}
    </section>
  );
}

function PortfolioManager(){
  type Item={id:string;title:string;description:string;file_url:string};
  const[items,setItems]=useState<Item[]>([]);const[artisanId,setArtisanId]=useState("");const[notice,setNotice]=useState("");
  const load=async()=>{const profile=await fetch("/api/marketplace/artisans/me");if(!profile.ok)return;const artisan=await profile.json();setArtisanId(artisan.id);const response=await fetch(`/api/marketplace/artisans/${artisan.id}/portfolio`);if(response.ok)setItems(await response.json())};
  useEffect(()=>{void load()},[]);
  const add=async(file:File)=>{const title=window.prompt("Portfolio project title");if(!title)return;const description=window.prompt("Briefly describe the work")||"";const payload=new FormData();payload.set("file",file);payload.set("category","portfolio");const upload=await fetch("/api/marketplace/uploads",{method:"POST",body:payload});const data=await upload.json();if(!upload.ok)return setNotice(data.detail||"Upload failed.");const fileId=data.id;const response=await fetch("/api/marketplace/artisans/me/portfolio",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,file_url:`/api/public-files/${fileId}`})});setNotice(response.ok?"Portfolio project published.":"Project could not be published.");void load()};
  return <div className="portfolio-manager"><div className="section-heading"><div><span className="kicker">Proof of craft</span><h2>Portfolio</h2></div><label className="button button-outline">Add project<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void add(file)}}/></label></div>{notice&&<p className="form-success">{notice}</p>}<div className="portfolio-grid">{items.map(item=><article key={item.id}>{item.file_url&&<img src={item.file_url} alt=""/>}<strong>{item.title}</strong><p>{item.description}</p></article>)}</div>{!items.length&&artisanId&&<p>No portfolio projects yet.</p>}</div>
}

function PaymentMethods() {
  const [methods, setMethods] = useState<
    {
      id: string;
      method_type: string;
      label: string;
      last_four: string;
      is_default: boolean;
    }[]
  >([]);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const load = () =>
    void fetch("/api/marketplace/payment-methods").then(async (response) => {
      if (response.ok) setMethods(await response.json());
    });
  useEffect(load, []);
  const add = async () => {
    const digits = phone.replace(/\D/g, "");
    const response = await fetch("/api/marketplace/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method_type: "mpesa",
        provider: "safaricom",
        label: `M-Pesa · ${digits.slice(-4)}`,
        last_four: digits.slice(-4),
        is_default: !methods.length,
      }),
    });
    setNotice(
      response.ok
        ? "M-Pesa method saved."
        : "Payment method could not be saved.",
    );
    if (response.ok) {
      setPhone("");
      load();
    }
  };
  return (
    <div className="payment-methods">
      <div className="card-heading">
        <div>
          <span className="kicker">Uber-style wallet</span>
          <h2>Payment methods</h2>
        </div>
      </div>
      {methods.map((item) => (
        <article key={item.id}>
          <span className="payment-symbol">M</span>
          <div>
            <strong>{item.label}</strong>
            <small>
              {item.is_default ? "Default payment method" : item.method_type}
            </small>
          </div>
        </article>
      ))}
      <div className="payment-add">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="M-Pesa phone number"
        />
        <button
          disabled={phone.replace(/\D/g, "").length < 10}
          onClick={() => void add()}
        >
          Add M-Pesa
        </button>
      </div>
      {notice && <small>{notice}</small>}
      <p>
        Card details are accepted only through a configured tokenization
        provider and are never stored by Mafundi.
      </p>
    </div>
  );
}
