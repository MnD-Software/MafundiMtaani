"use client";

import { useState } from "react";
import { estateClusters } from "@/lib/data";
import { MapPin, Navigation, UsersRound } from "lucide-react";

export function NairobiMap({ compact = false }: { compact?: boolean }) {
  const [selected, setSelected] = useState(estateClusters[0]);
  const [locationState, setLocationState] = useState("Live supply");
  const locate = () => {
    if (!navigator.geolocation) { setLocationState("Location unavailable"); return; }
    setLocationState("Locating…");
    navigator.geolocation.getCurrentPosition(() => { setSelected(estateClusters[1]); setLocationState("Near Kilimani"); }, () => setLocationState("Location permission needed"));
  };
  return <div className={`nairobi-map ${compact ? "compact" : ""}`}>
    <div className="map-canvas" role="img" aria-label="Map showing artisan density across Nairobi">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="map-boundary" d="M12 48 L17 23 34 11 48 17 63 9 83 18 91 38 85 57 94 71 78 88 56 91 45 98 25 89 8 71Z" />
        <path d="M5 54 C28 45 49 57 96 37M29 5 C41 38 43 62 51 100M8 75 C31 72 63 68 94 72M63 9 C61 35 67 58 79 89" />
      </svg>
      <div className="map-water" />
      {estateClusters.map((cluster) => {
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
      <a className="button button-dark button-wide" href={`/post-job?area=${encodeURIComponent(selected.name)}`}>Find help in {selected.name}</a>
    </aside>
  </div>;
}
