"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BellRing, ChevronRight, Clock3, KeyRound, LocateFixed, Mail, MapPin, Phone, Search, ShieldCheck, Smartphone, Star, WalletCards, Wrench } from "lucide-react";
import { categories, nairobiEstates, type Artisan } from "@/lib/data";
import { iconMap } from "./icons";
import { NairobiMap } from "./nairobi-map";
import { useExperience } from "./experience-provider";

export function HomeClient() {
  const {language}=useExperience();const sw=language==="sw";
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("Kilimani");
  const [active, setActive] = useState("All");
  const [searched, setSearched] = useState(false);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchDocked, setSearchDocked] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const element = searchRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setSearchDocked(!entry.isIntersecting), { rootMargin: "-78px 0px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
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
          rating:item.rating, reviews:0, jobs:item.completed_jobs, eta:"Available now", price:"Request a quote", color:["#174f43","#69512e","#3c4f70","#6b3d51"][index%4], verified:item.verified, featured:item.rating>=4.8&&item.completed_jobs>=10, skills:item.skills
        })));
      } catch (error) { if ((error as Error).name !== "AbortError") setArtisans([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, area, active]);
  const visible = useMemo(() => artisans, [artisans]);
  const serviceSuggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return categories.filter((category) => !term || category.name.toLowerCase().includes(term)).slice(0, 4);
  }, [query]);
  const estateSuggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return nairobiEstates.filter((estate) => !term || estate.toLowerCase().includes(term)).slice(0, 5);
  }, [query]);
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearched(true);
    setSearchOpen(true);
  };
  const predictiveResults = (compact = false) => (
    <div className={`predictive-results ${compact ? "compact" : ""}`}>
      <div className="predictive-heading"><strong>Search Mafundi</strong><span>{searching ? "Checking live availability…" : `${artisans.length} live matches`}</span></div>
      {!!serviceSuggestions.length && <div className="predictive-group"><small>Services</small>{serviceSuggestions.map((category) => {
        const Icon = iconMap[category.icon as keyof typeof iconMap];
        return <button type="button" key={category.name} onClick={() => { setActive(category.name); setQuery(category.name); setSearchOpen(true); }}><span className="predictive-icon"><Icon size={17} /></span><span><strong>{category.name}</strong><em>Verified professionals near {area}</em></span><ChevronRight size={16} /></button>;
      })}</div>}
      {!!estateSuggestions.length && <div className="predictive-group predictive-estates"><small>Neighbourhoods</small><div>{estateSuggestions.map((estate) => <button type="button" key={estate} onClick={() => { setArea(estate); setQuery(""); setSearchOpen(true); }}><MapPin size={14} />{estate}</button>)}</div></div>}
      {!!artisans.length && <div className="predictive-group predictive-artisans"><small>Available professionals</small>{artisans.slice(0, 3).map((artisan) => <Link href={`/artisan/${artisan.id}`} key={artisan.id}><span className="predictive-avatar" style={{ background: artisan.color }}>{artisan.initials}</span><span><strong>{artisan.name}</strong><em>{artisan.trade} · {artisan.area}</em></span><span className="predictive-rating"><Star size={12} fill="currentColor" />{artisan.rating}</span></Link>)}</div>}
      {!searching && !serviceSuggestions.length && !estateSuggestions.length && !artisans.length && <div className="predictive-empty"><strong>No exact match yet</strong><span>Post the job and we&apos;ll alert verified artisans nearby.</span><Link href={`/post-job?area=${encodeURIComponent(area)}`}>Post this job</Link></div>}
      <Link className="predictive-cta" href={`/post-job?area=${encodeURIComponent(area)}`}>Describe a custom job <ArrowRight size={15} /></Link>
    </div>
  );

  return (
    <>
      <main>
        <div className={`search-dock ${searchDocked ? "visible" : ""}`}>
          <form onSubmit={submitSearch}>
            <label><Search size={17} /><input value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} placeholder="What needs fixing?" aria-label="Search service" /></label>
            <label><MapPin size={17} /><select value={area} onChange={(event) => setArea(event.target.value)} aria-label="Select estate">{nairobiEstates.map((estate) => <option key={estate}>{estate}</option>)}</select></label>
            <button type="submit"><Search size={18} /><span>Find help</span></button>
            {searchOpen && predictiveResults(true)}
          </form>
        </div>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">{sw?"Mtandao wa mafundi waliothibitishwa Nairobi":"Nairobi’s trusted work network"}</div>
            <h1>{sw?"Kila kazi ya nyumbani,":"Every home job,"}<br /><span>{sw?"imefanywa vizuri.":"handled beautifully."}</span></h1>
            <p>{sw?"Eleza kazi yako, linganisha mafundi waliothibitishwa na usimamie kila hatua mahali pamoja.":"Describe the job once. Compare verified professionals, agree the work, and follow every step from one protected place."}</p>
            <form ref={searchRef} className="search-box" onSubmit={submitSearch}>
              <label>
                <span>{sw?"Unahitaji nini?":"What do you need?"}</span>
                <div><Search size={19} /><input value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }} placeholder="Try “plumber” or “Kilimani”" /></div>
              </label>
              <div className="search-divider" />
              <label className="location-field">
                <span>Where?</span>
                <div><MapPin size={19} /><select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Select Nairobi estate">{nairobiEstates.map((estate) => <option key={estate}>{estate}</option>)}</select></div>
              </label>
              <button className="search-submit" aria-label="Search"><Search size={22} /></button>
              {searchOpen && predictiveResults()}
            </form>
            {searched && <p className="search-note">Live predictive results for {area} are shown above.</p>}
            <div className="trust-row">
              <span><ShieldCheck size={18} /> Background checked</span>
              <span><BadgeCheck size={18} /> Work guaranteed</span>
              <span><Star size={17} fill="currentColor" /> Reviews tied to completed jobs</span>
            </div>
          </div>
          <div className="hero-visual hero-marketplace">
            <div className="hero-market-card">
              <div className="hero-market-head"><span><MapPin size={15}/> {area}, Nairobi</span><small>Live marketplace</small></div>
              <div className="hero-market-title"><span className="hero-tool"><Wrench/></span><div><small>What needs attention?</small><strong>{active === "All" ? "Find the right professional" : active}</strong></div></div>
              <div className="hero-pro-list">
                {artisans.slice(0,3).map((artisan,index)=><Link href={`/artisan/${artisan.id}`} key={artisan.id}><span className="hero-pro-avatar" style={{background:artisan.color}}>{artisan.initials}</span><span><strong>{artisan.name}</strong><small>{artisan.trade} · {artisan.area}</small></span><b><Star size={11} fill="currentColor"/>{artisan.rating||"New"}</b><ChevronRight size={15}/></Link>)}
                {!searching && !artisans.length && <div className="hero-market-empty"><ShieldCheck/><span><strong>No false availability</strong><small>We only show verified professionals when they are genuinely online.</small></span></div>}
                {searching && <div className="hero-market-loading"><span/><span/><span/></div>}
              </div>
              <Link className="hero-market-action" href={`/post-job?area=${encodeURIComponent(area)}`}>Describe your job <ArrowRight size={16}/></Link>
            </div>
            <div className="hero-proof-card"><BadgeCheck size={19}/><span><strong>Verified before visibility</strong><small>Identity, work history and reviews stay connected.</small></span></div>
            <div className="hero-step-card"><span>01</span><div><small>Your next step</small><strong>Compare. Book. Track.</strong></div></div>
          </div>
        </section>

        <section className="section services-section" id="services">
          <div className="section-heading"><div><span className="kicker">Popular services</span><h2>What can we fix for you?</h2></div><Link href="/post-job">Browse all services <ArrowRight size={16} /></Link></div>
          <div className="category-grid">
            {categories.map((category) => {
              const Icon = iconMap[category.icon as keyof typeof iconMap];
              return <button key={category.name} className={`category-card ${active === category.name ? "active" : ""}`} onClick={() => setActive(active === category.name ? "All" : category.name)}>
                <span className="category-icon" style={{ background: category.tone }}><Icon size={24} /></span>
                <strong>{category.name}</strong><span>Verified professionals</span><ChevronRight className="category-arrow" size={18} />
              </button>;
            })}
          </div>
        </section>

        <section className="section artisans-section" id="artisans">
          <div className="section-heading"><div><span className="kicker">Top professionals</span><h2>Recommended near {area}</h2></div><div className="nearby"><LocateFixed size={16} /> Live availability</div></div>
          <div className="artisan-grid">
            {visible.map((artisan) => <Link href={`/artisan/${artisan.id}`} className={`artisan-card${artisan.featured ? " top-professional" : ""}`} key={artisan.id}>
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
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-intro">
            <div className="brand footer-brand">Mafundi Mtaani<span className="brand-dot">.</span></div>
            <p>Trusted work. Stronger neighbourhoods. Book verified artisans across Nairobi with confidence.</p>
            <Link className="button button-dark" href="/post-job">Post a job <ArrowRight size={16} /></Link>
          </div>
          <div className="footer-column"><strong>Marketplace</strong><Link href="/#services">Find a fundi</Link><Link href="/map">Explore the map</Link><Link href="/post-job">Post a job</Link></div>
          <div className="footer-column"><strong>For artisans</strong><Link href="/join">Join Mafundi</Link><Link href="/artisan/login">Artisan sign in</Link></div>
          <div className="footer-column footer-contact"><strong>Talk to us</strong><a href="mailto:info@mafundimtaani.co.ke"><Mail size={15} />info@mafundimtaani.co.ke</a><a href="tel:+254720898678"><Phone size={15} />+254 720 898678</a><span>Nairobi, Kenya</span></div>
        </div>
        <div className="footer-bottom"><span>© 2026 Mafundi Mtaani</span><nav><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link><Link href="/accessibility">Accessibility</Link></nav><span>Built for Nairobi&apos;s neighbourhoods.</span></div>
      </footer>
    </>
  );
}
