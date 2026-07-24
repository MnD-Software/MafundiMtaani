"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BellRing, ChevronRight, Clock3, KeyRound, LocateFixed, MapPin, Search, ShieldCheck, Smartphone, Star, WalletCards } from "lucide-react";
import { categories, nairobiEstates, type Artisan } from "@/lib/data";
import { iconMap } from "./icons";
import { NairobiMap } from "./nairobi-map";

export function HomeClient() {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Kilimani");
  const [active, setActive] = useState("All");
  const [searched, setSearched] = useState(false);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [searching, setSearching] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const params = new URLSearchParams({ available: "true" });
      if (query.trim()) params.set("q", query.trim());
      if (area) params.set("area", area);
      if (active !== "All") params.set("trade", active);
      try {
        const response = await fetch(`/api/artisans?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (response.ok) setArtisans(data.map((item: { id:string; name:string; trade:string; area:string; rating:number; completed_jobs:number; verified:boolean; skills:string[] }, index: number) => ({
          id:item.id, name:item.name, initials:item.name.split(" ").map((part) => part[0]).join("").slice(0,2), trade:item.trade, area:item.area,
          rating:item.rating, reviews:0, jobs:item.completed_jobs, eta:"Available now", price:"Request a quote", color:["#174f43","#69512e","#3c4f70","#6b3d51"][index%4], verified:item.verified, skills:item.skills
        })));
      } catch (error) { if ((error as Error).name !== "AbortError") setArtisans([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, area, active]);
  const visible = useMemo(() => artisans, [artisans]);

  return (
    <>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> Nairobi-first verified artisan network</div>
            <h1>Trusted help,<br /><span>right around the corner.</span></h1>
            <p>Book skilled, background-checked artisans in minutes. Clear pricing, real-time updates, and work guaranteed.</p>
            <form className="search-box" onSubmit={(event) => { event.preventDefault(); setSearched(true); document.querySelector("#artisans")?.scrollIntoView({ behavior: "smooth" }); }}>
              <label>
                <span>What do you need?</span>
                <div><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. leaking tap, broken socket" /></div>
              </label>
              <div className="search-divider" />
              <label className="location-field">
                <span>Where?</span>
                <div><MapPin size={19} /><select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Select Nairobi estate">{nairobiEstates.map((estate) => <option key={estate}>{estate}</option>)}</select></div>
              </label>
              <button className="search-submit" aria-label="Search"><Search size={22} /></button>
            </form>
            {searched && <p className="search-note">Showing verified artisans available near {area}.</p>}
            <div className="trust-row">
              <span><ShieldCheck size={18} /> Background checked</span>
              <span><BadgeCheck size={18} /> Work guaranteed</span>
              <span><Star size={17} fill="currentColor" /> Reviews tied to completed jobs</span>
            </div>
          </div>
          <div className="hero-visual solid-hero">
            <div className="hero-monogram"><span>MM</span><small>Nairobi&apos;s trusted work network</small></div>
            <div className="service-orbit orbit-one">Plumbing <strong>486</strong></div>
            <div className="service-orbit orbit-two">Electrical <strong>371</strong></div>
            <div className="service-orbit orbit-three">Carpentry <strong>294</strong></div>
            <div className="availability-card">
              <div className="avatar-stack solid"><span>JM</span><span>MW</span><span>SO</span></div>
              <div><strong>Live availability</strong><span>Shown only when professionals are online</span></div>
              <span className="status-pulse" />
            </div>
            <div className="rating-card"><span className="rating-icon"><Star size={18} fill="currentColor" /></span><div><strong>Verified reviews</strong><span>Only after completed jobs</span></div></div>
          </div>
        </section>

        <section className="section services-section" id="services">
          <div className="section-heading"><div><span className="kicker">Popular services</span><h2>What can we fix for you?</h2></div><Link href="/post-job">Browse all services <ArrowRight size={16} /></Link></div>
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = iconMap[category.icon as keyof typeof iconMap];
              return <button key={category.name} className={`category-card ${active === category.name ? "active" : ""}`} onClick={() => setActive(active === category.name ? "All" : category.name)}>
                <span className="category-icon" style={{ background: category.tone }}><Icon size={24} /></span>
                <strong>{category.name}</strong><span>View verified professionals</span><em className="category-details">Details</em><ChevronRight className="category-arrow" size={18} />
              </button>;
            })}
          </div>
        </section>

        <section className="section artisans-section" id="artisans">
          <div className="section-heading"><div><span className="kicker">Top professionals</span><h2>Recommended near {area}</h2></div><div className="nearby"><LocateFixed size={16} /> Live availability</div></div>
          <div className="artisan-grid">
            {visible.map((artisan) => <Link href={`/artisan/${artisan.id}`} className="artisan-card" key={artisan.id}>
              <div className="artisan-photo artisan-solid" style={{ background: artisan.color }}><span className="artisan-initials">{artisan.initials}</span><div className="artisan-watermark">{artisan.trade}</div>{artisan.featured && <span className="top-badge">Top pro</span>}<span className="eta"><Clock3 size={13} /> {artisan.eta} away</span></div>
              <div className="artisan-body">
                <div className="artisan-title"><div><h3>{artisan.name} {artisan.verified && <BadgeCheck size={17} fill="#147d64" />}</h3><p>{artisan.trade} · {artisan.area}</p></div><span className="artisan-rating"><Star size={14} fill="currentColor" /> {artisan.rating}</span></div>
                <div className="skill-list">{artisan.skills.slice(0, 2).map((skill) => <span key={skill}>{skill}</span>)}</div>
                <div className="artisan-meta"><span><strong>{artisan.jobs}</strong> jobs done</span><span><strong>{artisan.reviews}</strong> reviews</span><strong>{artisan.price}</strong></div>
              </div>
            </Link>)}
            {!visible.length && <div className="empty-state"><h3>{searching ? "Searching verified availability…" : "No available artisan matches yet"}</h3><p>{searching ? "Ranking trade, estate, verification and availability." : "Post the job and verified professionals can respond when they come online."}</p>{!searching && <Link className="button button-dark" href="/post-job">Post this job</Link>}</div>}
          </div>
        </section>

        <section className="section coverage-section">
          <div className="section-heading"><div><span className="kicker">Live marketplace intelligence</span><h2>See where help is available.</h2></div><Link href="/map">Explore all Nairobi estates <ArrowRight size={16} /></Link></div>
          <NairobiMap compact />
        </section>

        <section className="section product-advantages">
          <div className="section-heading"><div><span className="kicker">Built for real life</span><h2>More certainty at every step.</h2></div></div>
          <div className="advantage-grid">
            <article><span><WalletCards /></span><small>01 · FairPay</small><h3>Your money stays protected.</h3><p>Approve milestones as work progresses. The artisan is paid only after you confirm each stage.</p></article>
            <article><span><Smartphone /></span><small>02 · Live job room</small><h3>Everything in one thread.</h3><p>Quotes, arrival status, messages, photos, receipts and support stay attached to the job.</p></article>
            <article><span><KeyRound /></span><small>03 · Trust passport</small><h3>Verification you can inspect.</h3><p>Identity, trade documents, work history and reviews combine into one transparent trust profile.</p></article>
            <article><span><BellRing /></span><small>04 · Neighbourhood pulse</small><h3>Faster help when demand spikes.</h3><p>Artisans see demand forecasts and can go online where their skills are needed most.</p></article>
          </div>
        </section>

        <section className="how-section">
          <div><span className="kicker kicker-light">Simple from start to finish</span><h2>Good work shouldn&apos;t<br />be hard to find.</h2><p>From a quick repair to a full renovation, Mafundi keeps every detail, payment, and update in one place.</p><Link className="button button-light" href="/post-job">Get started <ArrowRight size={17} /></Link></div>
          <ol>
            <li><span>01</span><div><strong>Tell us what you need</strong><p>Share a few details and photos. It takes less than two minutes.</p></div></li>
            <li><span>02</span><div><strong>Get matched instantly</strong><p>Compare trusted pros by rating, price, and live availability.</p></div></li>
            <li><span>03</span><div><strong>Track the job, pay safely</strong><p>Follow progress and release payment only when the work is complete.</p></div></li>
          </ol>
        </section>
      </main>
      <footer><div className="brand footer-brand">Mafundi<span className="brand-dot">.</span></div><p>Trusted work. Stronger neighbourhoods.</p><span>© 2026 Mafundi Mtaani · Nairobi, Kenya</span></footer>
    </>
  );
}
