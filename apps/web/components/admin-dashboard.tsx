"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  FileCheck2,
  LayoutDashboard,
  MapPinned,
  Search,
  ShieldCheck,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import { NairobiMap } from "./nairobi-map";

type ReviewState = "pending" | "approved" | "rejected";
type Application = {
  id: string;
  reference: string;
  name: string;
  phone: string;
  trade: string;
  area: string;
  years_experience: number;
  documents: string[];
  status: ReviewState;
  submitted_at: string;
};
type Breakdown = { label: string; value: number };
type Metrics = {
  active_artisans: number;
  open_jobs: number;
  pending_applications: number;
  supported_estates: number;
  total_users: number;
  total_jobs: number;
  payments_received: number;
  platform_commission: number;
  artisan_payouts: number;
  funds_held: number;
  jobs_by_status: Record<string, number>;
  users_by_role: Record<string, number>;
  jobs_by_trade: Breakdown[];
  jobs_by_area: Breakdown[];
};
const emptyMetrics: Metrics = {
  active_artisans: 0,
  open_jobs: 0,
  pending_applications: 0,
  supported_estates: 0,
  total_users: 0,
  total_jobs: 0,
  payments_received: 0,
  platform_commission: 0,
  artisan_payouts: 0,
  funds_held: 0,
  jobs_by_status: {},
  users_by_role: {},
  jobs_by_trade: [],
  jobs_by_area: [],
};
const money = (value: number) => `KSh ${Number(value || 0).toLocaleString()}`;

export function AdminDashboard({
  initialSection = "overview",
}: {
  initialSection?: string;
}) {
  const [section, setSection] = useState(initialSection);
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [selectedId, setSelectedId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const selected = applications.find((item) => item.id === selectedId);
  const filtered = useMemo(
    () =>
      applications.filter((item) =>
        `${item.name} ${item.trade} ${item.area}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [applications, query],
  );

  const refresh = async () => {
    const [applicationsResponse, metricsResponse] = await Promise.all([
      fetch("/api/admin/applications"),
      fetch("/api/admin/metrics"),
    ]);
    if (applicationsResponse.ok) {
      const items: Application[] = await applicationsResponse.json();
      setApplications(items);
      setSelectedId((current) => current || items[0]?.id || "");
    }
    if (metricsResponse.ok) setMetrics(await metricsResponse.json());
  };
  useEffect(() => {
    void refresh();
  }, []);
  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const review = async (state: ReviewState) => {
    if (!selected) return;
    setReviewing(true);
    setError("");
    const response = await fetch(`/api/admin/applications/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: state, review_note: "" }),
    });
    if (!response.ok)
      setError(
        (await response.json()).detail || "Decision could not be saved.",
      );
    else {
      notify(`Application ${state}.`);
      await refresh();
    }
    setReviewing(false);
  };

  const nav = [
    ["overview", "Command centre", LayoutDashboard],
    ["artisans", "Artisan approvals", UserCheck],
    ["jobs", "Jobs & disputes", BriefcaseBusiness],
    ["people", "Clients & teams", UsersRound],
    ["coverage", "Coverage map", MapPinned],
    ["finance", "Revenue & payouts", CircleDollarSign],
    ["campaigns", "Campaigns", CalendarDays],
    ["risk", "Trust & fraud", ShieldCheck],
  ] as const;

  return (
    <main className="ops-shell">
      <aside className="ops-sidebar">
        <Link className="brand ops-brand" href="/">
          Mafundi<span className="brand-dot">.</span>
          <small>OPS</small>
        </Link>
        <p>Workspace</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              className={section === id ? "active" : ""}
              onClick={() => setSection(id)}
              key={id}
            >
              <Icon size={18} />
              {label}
              {id === "artisans" && metrics.pending_applications > 0 && (
                <span>{metrics.pending_applications}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="ops-user">
          <span className="identity-badge small">AD</span>
          <div>
            <strong>Authenticated admin</strong>
            <small>Role-protected workspace</small>
          </div>
        </div>
      </aside>
      <section className="ops-main">
        <header className="ops-header">
          <div>
            <span className="kicker">Nairobi marketplace</span>
            <h1>{nav.find(([id]) => id === section)?.[1]}</h1>
          </div>
          <div>
            <button
              aria-label="Search applications"
              onClick={() => setSection("artisans")}
              className="icon-button"
            >
              <Search size={18} />
            </button>
            <button
              aria-label="Operations alerts"
              onClick={() =>
                notify(
                  `${metrics.pending_applications} applications need review.`,
                )
              }
              className="icon-button notification"
            >
              <Bell size={18} />
              {metrics.pending_applications > 0 && <i />}
            </button>
            <span className="system-healthy">
              <i />
              API protected
            </span>
          </div>
        </header>
        {notice && (
          <div className="action-toast ops-toast" role="status">
            {notice}
          </div>
        )}

        {section === "overview" && (
          <>
            <div className="ops-alert">
              <div>
                <ShieldCheck />
                <span>
                  <strong>
                    {metrics.pending_applications} applications need a decision
                  </strong>
                  <small>
                    Every figure below is loaded from the protected operations
                    API.
                  </small>
                </span>
              </div>
              <button onClick={() => setSection("artisans")}>
                Review queue <ChevronRight size={16} />
              </button>
            </div>
            <div className="ops-metrics">
              <Metric
                label="Payments received"
                value={money(metrics.payments_received)}
                note="Completed transactions"
              />
              <Metric
                label="Platform commission"
                value={money(metrics.platform_commission)}
                note="Recorded marketplace fees"
              />
              <Metric
                label="Artisan payouts"
                value={money(metrics.artisan_payouts)}
                note="Net value due"
              />
              <Metric
                label="Funds held"
                value={money(metrics.funds_held)}
                note="Protected in active jobs"
              />
            </div>
            <div className="ops-grid">
              <AnalyticsCard
                title="Job funnel"
                eyebrow={`${metrics.total_jobs} total jobs`}
                data={Object.entries(metrics.jobs_by_status).map(
                  ([label, value]) => ({
                    label: label.replaceAll("_", " "),
                    value,
                  }),
                )}
              />
              <AnalyticsCard
                title="Demand by trade"
                eyebrow="Live job requests"
                data={metrics.jobs_by_trade}
              />
            </div>
            <div className="ops-grid lower">
              <AnalyticsCard
                title="Marketplace accounts"
                eyebrow={`${metrics.total_users} registered users`}
                data={Object.entries(metrics.users_by_role).map(
                  ([label, value]) => ({ label, value }),
                )}
              />
              <AnalyticsCard
                title="Demand hotspots"
                eyebrow={`${metrics.supported_estates} supported areas`}
                data={metrics.jobs_by_area}
              />
            </div>
          </>
        )}

        {section === "artisans" && (
          <div className="review-layout">
            <section className="review-list">
              <div className="review-toolbar">
                <div>
                  <span className="kicker">Trust operations</span>
                  <h2>Verification queue</h2>
                </div>
                <label>
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search applications"
                  />
                </label>
              </div>
              {filtered.length ? (
                filtered.map((item) => (
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className={`review-row ${selectedId === item.id ? "selected" : ""}`}
                    key={item.id}
                  >
                    <span className="identity-badge">
                      {item.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.trade} · {item.area}
                      </small>
                    </div>
                    <span className={`status-chip ${item.status}`}>
                      {item.status}
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <EmptyOperations
                  title="No applications"
                  text="New artisan applications will appear here automatically."
                  compact
                />
              )}
            </section>
            {selected ? (
              <aside className="review-detail">
                <div className="application-head">
                  <span className="identity-badge large">
                    {selected.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <span className="kicker">{selected.reference}</span>
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.trade} · {selected.area}
                    </p>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Mobile</dt>
                    <dd>{selected.phone}</dd>
                  </div>
                  <div>
                    <dt>Experience</dt>
                    <dd>{selected.years_experience} years</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{selected.documents.length} files</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      {new Date(selected.submitted_at).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
                <h3>Submitted evidence</h3>
                <div className="document-grid">
                  {selected.documents.map((document) => (
                    <button
                      onClick={() =>
                        notify(`${document} opened in secure review.`)
                      }
                      key={document}
                    >
                      <FileCheck2 />
                      <span>
                        <strong>{document.replaceAll("_", " ")}</strong>
                        <small>Protected file</small>
                      </span>
                      <Check />
                    </button>
                  ))}
                </div>
                {error && <p className="form-error">{error}</p>}
                <div className="review-actions">
                  <button
                    disabled={reviewing}
                    onClick={() => void review("rejected")}
                    className="button reject"
                  >
                    <X size={16} />
                    Decline
                  </button>
                  <button
                    disabled={reviewing}
                    onClick={() => void review("approved")}
                    className="button approve"
                  >
                    <BadgeCheck size={16} />
                    Approve artisan
                  </button>
                </div>
              </aside>
            ) : (
              <aside className="review-detail">
                <EmptyOperations
                  title="Select an application"
                  text="Applicant identity and evidence will appear here."
                  compact
                />
              </aside>
            )}
          </div>
        )}

        {section === "coverage" && (
          <section className="analytics-card coverage-admin">
            <div className="card-heading">
              <div>
                <span className="kicker">Coverage configuration</span>
                <h2>Nairobi service map</h2>
              </div>
            </div>
            <NairobiMap />
          </section>
        )}
        {section === "jobs" && (
          <section className="ops-data-page">
            <div className="ops-metrics">
              <Metric
                label="All jobs"
                value={metrics.total_jobs}
                note="Lifetime requests"
              />
              <Metric
                label="Open jobs"
                value={metrics.open_jobs}
                note="Awaiting a match"
              />
              <Metric
                label="In progress"
                value={metrics.jobs_by_status.in_progress || 0}
                note="Work underway"
              />
              <Metric
                label="Completed"
                value={metrics.jobs_by_status.completed || 0}
                note="Closed successfully"
              />
            </div>
            <div className="ops-grid">
              <AnalyticsCard
                title="Job lifecycle"
                eyebrow="Operational funnel"
                data={Object.entries(metrics.jobs_by_status).map(
                  ([label, value]) => ({
                    label: label.replaceAll("_", " "),
                    value,
                  }),
                )}
              />
              <AnalyticsCard
                title="Service demand"
                eyebrow="Requests by trade"
                data={metrics.jobs_by_trade}
              />
            </div>
          </section>
        )}
        {section === "people" && (
          <section className="ops-data-page">
            <div className="ops-metrics">
              <Metric
                label="Registered users"
                value={metrics.total_users}
                note="All role-protected accounts"
              />
              <Metric
                label="Verified artisans"
                value={metrics.active_artisans}
                note="Approved supply"
              />
              <Metric
                label="Pending reviews"
                value={metrics.pending_applications}
                note="Trust queue"
              />
              <Metric
                label="Coverage"
                value={metrics.supported_estates}
                note="Nairobi service areas"
              />
            </div>
            <AnalyticsCard
              title="Accounts by role"
              eyebrow="Marketplace composition"
              data={Object.entries(metrics.users_by_role).map(
                ([label, value]) => ({ label, value }),
              )}
            />
          </section>
        )}
        {section === "finance" && (
          <section className="ops-data-page">
            <div className="finance-hero">
              <div>
                <span>Gross marketplace volume</span>
                <strong>{money(metrics.payments_received)}</strong>
                <small>Completed transactions only</small>
              </div>
              <CircleDollarSign size={34} />
            </div>
            <div className="ops-metrics">
              <Metric
                label="Commission earned"
                value={money(metrics.platform_commission)}
                note="Platform revenue"
              />
              <Metric
                label="Artisan payouts"
                value={money(metrics.artisan_payouts)}
                note="Net artisan earnings"
              />
              <Metric
                label="Funds protected"
                value={money(metrics.funds_held)}
                note="Held until completion"
              />
              <Metric
                label="Take rate"
                value={
                  metrics.payments_received
                    ? `${((metrics.platform_commission / metrics.payments_received) * 100).toFixed(1)}%`
                    : "0%"
                }
                note="Commission / GMV"
              />
            </div>
            <EmptyOperations
              title="Transaction ledger ready"
              text={
                metrics.payments_received
                  ? "Finance totals are calculated from completed payment ledger entries."
                  : "No payment provider has recorded a completed transaction yet; no financial figures are seeded."
              }
            />
          </section>
        )}
        {section === "campaigns" && <CampaignCentre notify={notify} />}
        {section === "risk" && <RiskCentre />}
      </section>
    </main>
  );
}

function CampaignCentre({ notify }: { notify: (message: string) => void }) {
  type Campaign = {
    id: string;
    name: string;
    headline: string;
    theme: string;
    offer_code: string;
    starts_at: string;
    ends_at: string;
    active: boolean;
  };
  const [items, setItems] = useState<Campaign[]>([]);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    headline: "",
    message: "",
    theme: "launch",
    offer_code: "",
    starts_at: "",
    ends_at: "",
  });
  const load = () =>
    void fetch("/api/marketplace/admin/campaigns").then(async (response) => {
      if (response.ok) setItems(await response.json());
    });
  useEffect(load, []);
  const create = async () => {
    const response = await fetch("/api/marketplace/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
      }),
    });
    if (response.ok) {
      notify("Campaign scheduled.");
      setForm({
        slug: "",
        name: "",
        headline: "",
        message: "",
        theme: "launch",
        offer_code: "",
        starts_at: "",
        ends_at: "",
      });
      load();
    } else
      notify(
        (await response.json()).detail || "Campaign could not be created.",
      );
  };
  const toggle = async (item: Campaign) => {
    await fetch(`/api/marketplace/admin/campaigns/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    load();
  };
  return (
    <section className="ops-data-page">
      <div className="ops-grid">
        <section className="analytics-card campaign-editor">
          <span className="kicker">Seasonal automation</span>
          <h2>Schedule a campaign</h2>
          {(
            [
              "slug",
              "name",
              "headline",
              "message",
              "offer_code",
              "starts_at",
              "ends_at",
            ] as const
          ).map((field) => (
            <input
              key={field}
              type={field.endsWith("_at") ? "datetime-local" : "text"}
              value={form[field]}
              placeholder={field.replaceAll("_", " ")}
              onChange={(event) =>
                setForm({ ...form, [field]: event.target.value })
              }
            />
          ))}
          <select
            value={form.theme}
            onChange={(event) =>
              setForm({ ...form, theme: event.target.value })
            }
          >
            <option value="launch">Launch</option>
            <option value="celebration">Celebration</option>
            <option value="christmas">Christmas</option>
            <option value="kenya">Kenya</option>
            <option value="valentine">Valentine</option>
          </select>
          <button className="button button-dark" onClick={() => void create()}>
            Schedule campaign
          </button>
        </section>
        <section className="analytics-card compliance-list">
          <span className="kicker">Campaign calendar</span>
          <h2>Configured campaigns</h2>
          {items.length ? (
            items.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.headline} ·{" "}
                    {new Date(item.starts_at).toLocaleDateString()}
                  </span>
                </div>
                <button onClick={() => void toggle(item)}>
                  {item.active ? "Pause" : "Activate"}
                </button>
              </article>
            ))
          ) : (
            <p>No manually scheduled campaigns.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function EmptyOperations({
  title,
  text,
  compact = false,
}: {
  title: string;
  text: string;
  compact?: boolean;
}) {
  return (
    <section
      className={`analytics-card empty-operations ${compact ? "compact" : ""}`}
    >
      <span className="kicker">Live data only</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function AnalyticsCard({
  title,
  eyebrow,
  data,
}: {
  title: string;
  eyebrow: string;
  data: Breakdown[];
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="analytics-card live-chart">
      <div className="card-heading">
        <div>
          <span className="kicker">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {data.length ? (
        <div className="bar-chart">
          {data.map((item) => (
            <div className="bar-row" key={item.label}>
              <span>{item.label}</span>
              <div>
                <i style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart-empty">
          <strong>No activity yet</strong>
          <span>The chart will populate from real marketplace events.</span>
        </div>
      )}
    </section>
  );
}

function RiskCentre() {
  const [risks, setRisks] = useState<
    {
      id: string;
      signal_type: string;
      severity: string;
      score: number;
      status: string;
    }[]
  >([]);
  const [documents, setDocuments] = useState<
    {
      id: string;
      document_type: string;
      status: string;
      provider: string;
      confidence: number;
    }[]
  >([]);
  const [recon, setRecon] = useState<{
    invoice_count: number;
    un_invoiced: number;
    payments: { status: string; count: number; amount: number }[];
  } | null>(null);
  useEffect(() => {
    void Promise.all([
      fetch("/api/marketplace/admin/risk-signals"),
      fetch("/api/marketplace/admin/document-verifications"),
      fetch("/api/marketplace/admin/reconciliation"),
    ]).then(async ([a, b, c]) => {
      if (a.ok) setRisks(await a.json());
      if (b.ok) setDocuments(await b.json());
      if (c.ok) setRecon(await c.json());
    });
  }, []);
  return (
    <section className="ops-data-page">
      <div className="ops-metrics">
        <Metric
          label="Open risk signals"
          value={risks.filter((item) => item.status === "open").length}
          note="Rule-based detection"
        />
        <Metric
          label="Pending documents"
          value={documents.filter((item) => item.status === "pending").length}
          note="Verification queue"
        />
        <Metric
          label="Invoices"
          value={recon?.invoice_count || 0}
          note="Payment-backed records"
        />
        <Metric
          label="Un-invoiced"
          value={recon?.un_invoiced || 0}
          note="Needs reconciliation"
        />
      </div>
      <button className="button button-dark" onClick={()=>void fetch("/api/marketplace/admin/reconciliation/run",{method:"POST"}).then(()=>fetch("/api/marketplace/admin/reconciliation")).then(async response=>{if(response.ok)setRecon(await response.json())})}>Run reconciliation</button>
      <div className="ops-grid">
        <section className="analytics-card compliance-list">
          <span className="kicker">Fraud controls</span>
          <h2>Risk signals</h2>
          {risks.length ? (
            risks.map((item) => (
              <article key={item.id}>
                <strong>{item.signal_type.replaceAll("_", " ")}</strong>
                <span>
                  {item.severity} · score {item.score}
                </span>
              </article>
            ))
          ) : (
            <p>No risk signals.</p>
          )}
        </section>
        <section className="analytics-card compliance-list">
          <span className="kicker">Identity controls</span>
          <h2>Document verification</h2>
          {documents.length ? (
            documents.map((item) => (
              <article key={item.id}>
                <strong>{item.document_type.replaceAll("_", " ")}</strong>
                <span>
                  {item.status} · {item.provider}
                </span>
              </article>
            ))
          ) : (
            <p>No document records.</p>
          )}
        </section>
      </div>
    </section>
  );
}
