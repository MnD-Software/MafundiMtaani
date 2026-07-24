"use client";

import { useEffect, useState } from "react";
import { estateClusters } from "@/lib/data";
import { ExternalLink, MapPin, Navigation, UsersRound } from "lucide-react";

export function NairobiMap({ compact = false }: { compact?: boolean }) {
  const [clusters, setClusters] = useState(estateClusters);
  const [selected, setSelected] = useState(estateClusters[0]);
  const [locationState, setLocationState] = useState("Live supply");
  useEffect(() => {
    void fetch("/api/artisans?available=true").then((response) => response.json()).then((artisans: Array<{ area: string }>) => {
      if (!Array.isArray(artisans)) return;
      const next = estateClusters.map((cluster) => ({
        ...cluster,
        artisans: artisans.filter((artisan) => artisan.area === cluster.name || artisan.area.startsWith(`${cluster.name} `)).length,
      }));
      setClusters(next);
      setSelected((current) => next.find((cluster) => cluster.name === current.name) || next[0]);
    }).catch(() => undefined);
  }, []);
  const locate = () => {
    if (!navigator.geolocation) { setLocationState("Location unavailable"); return; }
    setLocationState("Locating…");
    navigator.geolocation.getCurrentPosition(() => { setSelected(clusters[1]); setLocationState("Near Kilimani"); }, () => setLocationState("Location permission needed"));
  };
  return <div className={`nairobi-map ${compact ? "compact" : ""}`}>
    <div className="map-canvas" role="img" aria-label="Map showing artisan density across Nairobi">
      <iframe title="Google map of Nairobi" src="https://www.google.com/maps?q=Nairobi%2C%20Kenya&z=11&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <div className="map-tint" />
      {clusters.map((cluster) => {
        const size = Math.max(34, Math.min(62, 28 + cluster.artisans / 12));
        return <button key={cluster.name} className={`map-cluster ${selected.name === cluster.name ? "selected" : ""}`} style={{ left: `${cluster.x}%`, top: `${cluster.y}%`, width: size, height: size }} onClick={() => setSelected(cluster)} aria-label={`${cluster.name}: ${cluster.artisans} artisans`}>
          <strong>{cluster.artisans}</strong><span>{cluster.name}</span>
        </button>;
      })}
      <div className="map-controls"><button onClick={locate} aria-label="Use my location"><Navigation size={17} /></button><span>{locationState}</span></div>
    </div>
    <aside className="map-insight">
      <span className="kicker">Selected area</span>
      <h3>{selected.name}</h3>
      <div><span><UsersRound size={17} /> Verified artisans</span><strong>{selected.artisans}</strong></div>
      <div><span><MapPin size={17} /> Current demand</span><strong>{selected.demand}</strong></div>
      <div className="supply-meter"><span style={{ width: `${Math.min(100, selected.artisans / 3.3)}%` }} /></div>
      <p>Live supply and demand appear as verified artisans and client jobs enter the marketplace.</p>
      <a className="map-google-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name}, Nairobi`)}`} target="_blank" rel="noreferrer">Open {selected.name} in Google Maps <ExternalLink size={14} /></a>
      <a className="button button-dark button-wide" href={`/post-job?area=${encodeURIComponent(selected.name)}`}>Find help in {selected.name}</a>
    </aside>
  </div>;
}
