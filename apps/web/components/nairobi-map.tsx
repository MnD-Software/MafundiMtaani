"use client";

import { useEffect, useState } from "react";
import { estateClusters } from "@/lib/data";
import { ExternalLink, MapPin, Navigation, UsersRound } from "lucide-react";
import { useLiveLocation } from "./live-location-provider";

export function NairobiMap({ compact = false }: { compact?: boolean }) {
  const [clusters, setClusters] = useState(estateClusters);
  const [selected, setSelected] = useState(estateClusters[0]);
  const live = useLiveLocation();
  useEffect(() => {
    void fetch("/api/artisans?available=true").then((response) => response.json()).then((artisans: Array<{ area: string }>) => {
      if (!Array.isArray(artisans)) return;
      const next = estateClusters.map((cluster) => ({ ...cluster, artisans: artisans.filter((artisan) => artisan.area === cluster.name || artisan.area.startsWith(`${cluster.name} `)).length }));
      setClusters(next); setSelected((current) => next.find((cluster) => cluster.name === current.name) || next[0]);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!live.area) return;
    const match = clusters.find((cluster) => cluster.name.toLowerCase() === live.area?.toLowerCase());
    setSelected(match || { name:live.area, x:50, y:50, artisans:0, demand:"Live location" });
  }, [live.area, clusters]);
  const locationLabel = live.state==="live" ? `Live · ${live.area || "resolving area"}` : live.state==="locating" ? "Finding your area…" : live.state==="denied" ? "Enable location to follow you" : "Use my live location";
  const mapQuery = live.latitude !== null && live.longitude !== null ? `${live.latitude},${live.longitude}` : "Nairobi, Kenya";
  return <div className={`nairobi-map ${compact ? "compact" : ""}`}>
    <div className="map-canvas" role="img" aria-label={`Map showing artisan density near ${selected.name}`}>
      <iframe key={mapQuery} title={`Google map centred on ${selected.name}`} src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${live.state==="live"?15:11}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      <div className="map-tint" />
      {clusters.map((cluster) => {
        const size = Math.max(34, Math.min(62, 28 + cluster.artisans / 12));
        return <button key={cluster.name} className={`map-cluster ${selected.name === cluster.name ? "selected" : ""}`} style={{ left: `${cluster.x}%`, top: `${cluster.y}%`, width: size, height: size }} onClick={() => setSelected(cluster)} aria-label={`${cluster.name}: ${cluster.artisans} artisans`}>
          <strong>{cluster.artisans}</strong><span>{cluster.name}</span>
        </button>;
      })}
      {live.state==="live" && <div className="live-location-pin" style={{left:"50%",top:"50%"}}><span/><b>You are near {live.area || "this area"}</b></div>}
      <div className="map-controls"><button onClick={live.start} aria-label="Use and follow my live location"><Navigation size={17} /></button><span>{locationLabel}</span></div>
    </div>
    <aside className="map-insight">
      <span className="kicker">{live.state==="live" ? "Your live area" : "Selected area"}</span>
      <h3>{selected.name}</h3>
      <div><span><UsersRound size={17} /> Verified artisans</span><strong>{selected.artisans}</strong></div>
      <div><span><MapPin size={17} /> Current demand</span><strong>{selected.demand}</strong></div>
      <div className="supply-meter"><span style={{ width: `${Math.min(100, selected.artisans / 3.3)}%` }} /></div>
      <p>{live.state==="live" ? `Following your device location${live.accuracy ? ` within about ${Math.round(live.accuracy)} metres` : ""}.` : "Choose an area or enable live location. Supply appears only when verified artisans are available."}</p>
      <a className="map-google-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(live.state==="live"?mapQuery:`${selected.name}, Nairobi`)}`} target="_blank" rel="noreferrer">Open {selected.name} in Google Maps <ExternalLink size={14} /></a>
      <a className="button button-dark button-wide" href={`/post-job?area=${encodeURIComponent(selected.name)}`}>Find help in {selected.name}</a>
    </aside>
  </div>;
}
