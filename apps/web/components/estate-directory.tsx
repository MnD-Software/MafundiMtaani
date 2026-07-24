"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { nairobiEstates } from "@/lib/data";

export function EstateDirectory() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const matches = useMemo(
    () => nairobiEstates.filter((estate) => estate.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  );
  const visible = query || expanded ? matches : matches.slice(0, 32);

  return (
    <section className="estate-directory" id="estate-directory">
      <div className="estate-directory-heading">
        <span className="kicker">Service coverage</span>
        <h2>Every Nairobi neighbourhood, searchable.</h2>
        <p>{nairobiEstates.length} estates and metropolitan service areas ready for job requests.</p>
      </div>
      <div>
        <label className="estate-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an estate or neighbourhood" />
          <span>{matches.length} areas</span>
        </label>
        <div className="estate-cloud">
          {visible.map((estate) => <a key={estate} href={`/post-job?area=${encodeURIComponent(estate)}`}>{estate}</a>)}
        </div>
        {!query && matches.length > 32 && <button className="estate-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer areas" : `Show all ${matches.length} areas`} <ChevronDown className={expanded ? "rotated" : ""} size={16} />
        </button>}
        {!matches.length && <div className="estate-empty">No matching estate yet. Try a nearby neighbourhood.</div>}
      </div>
    </section>
  );
}
