"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type LiveLocation = {
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  state: "idle" | "locating" | "live" | "denied" | "unavailable";
  start: () => void;
};

const LocationContext = createContext<LiveLocation>({ area:null, latitude:null, longitude:null, accuracy:null, state:"idle", start:()=>{} });
export const useLiveLocation = () => useContext(LocationContext);

export function LiveLocationProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<Omit<LiveLocation, "start">>({ area:null, latitude:null, longitude:null, accuracy:null, state:"idle" });
  const watch = useRef<number | null>(null);
  const lastLookup = useRef({ latitude:0, longitude:0, at:0 });
  const resolveArea = useCallback(async (latitude:number, longitude:number, accuracy:number) => {
    const moved = Math.hypot(latitude-lastLookup.current.latitude, longitude-lastLookup.current.longitude);
    const shouldLookup = moved > .001 || Date.now()-lastLookup.current.at > 60_000;
    setValue((current) => ({ ...current, latitude, longitude, accuracy, state:"live" }));
    if (!shouldLookup) return;
    lastLookup.current = { latitude, longitude, at:Date.now() };
    try {
      const response = await fetch(`/api/location/reverse?lat=${latitude}&lng=${longitude}`, { cache:"no-store" });
      if (response.ok) {
        const data = await response.json();
        setValue({ area:data.area, latitude, longitude, accuracy, state:"live" });
        localStorage.setItem("mafundi-live-area", data.area);
        window.dispatchEvent(new CustomEvent("mafundi:area", { detail:data.area }));
      }
    } catch { /* Coordinates remain live even when reverse geocoding is unavailable. */ }
  }, []);
  const start = useCallback(() => {
    if (!navigator.geolocation) return setValue((current) => ({ ...current, state:"unavailable" }));
    if (watch.current !== null) return;
    setValue((current) => ({ ...current, state:"locating" }));
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => void resolveArea(coords.latitude, coords.longitude, coords.accuracy),
      (error) => setValue((current) => ({ ...current, state:error.code===1?"denied":"unavailable" })),
      { enableHighAccuracy:true, maximumAge:15_000, timeout:20_000 },
    );
  }, [resolveArea]);
  useEffect(() => {
    const saved = localStorage.getItem("mafundi-live-area");
    if (saved) setValue((current) => ({ ...current, area:saved }));
    navigator.permissions?.query({ name:"geolocation" }).then((permission) => { if (permission.state==="granted") start(); }).catch(() => undefined);
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); };
  }, [start]);
  return <LocationContext.Provider value={{ ...value, start }}>{children}</LocationContext.Provider>;
}
