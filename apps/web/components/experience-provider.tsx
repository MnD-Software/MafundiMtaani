"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Download, Languages, SignalLow } from "lucide-react";

type Experience = {language:"en"|"sw";lowData:boolean;setLanguage:(value:"en"|"sw")=>void;setLowData:(value:boolean)=>void};
const ExperienceContext=createContext<Experience>({language:"en",lowData:false,setLanguage:()=>{},setLowData:()=>{}});
export const useExperience=()=>useContext(ExperienceContext);

export function ExperienceProvider({children}:{children:React.ReactNode}){
  const[language,setLanguage]=useState<"en"|"sw">("en");const[lowData,setLowData]=useState(false);const[installPrompt,setInstallPrompt]=useState<Event|null>(null);
  useEffect(()=>{const stored=localStorage.getItem("mafundi-language");const saver=localStorage.getItem("mafundi-low-data")==="true";if(stored==="sw")setLanguage("sw");setLowData(saver);if("serviceWorker" in navigator)void navigator.serviceWorker.register("/sw.js");const listener=(event:Event)=>{event.preventDefault();setInstallPrompt(event)};window.addEventListener("beforeinstallprompt",listener);return()=>window.removeEventListener("beforeinstallprompt",listener)},[]);
  useEffect(()=>{document.documentElement.lang=language;document.documentElement.dataset.lowData=String(lowData);localStorage.setItem("mafundi-language",language);localStorage.setItem("mafundi-low-data",String(lowData))},[language,lowData]);
  const install=async()=>{if(!installPrompt)return;await (installPrompt as Event&{prompt:()=>Promise<void>}).prompt();setInstallPrompt(null)};
  return <ExperienceContext.Provider value={{language,lowData,setLanguage,setLowData}}>{children}<aside className="experience-controls" aria-label="Experience settings"><button onClick={()=>setLanguage(language==="en"?"sw":"en")}><Languages size={15}/><span>{language==="en"?"Kiswahili":"English"}</span></button><button className={lowData?"active":""} onClick={()=>setLowData(!lowData)}><SignalLow size={15}/><span>{language==="sw"?"Data kidogo":"Low data"}</span></button>{installPrompt&&<button onClick={()=>void install()}><Download size={15}/><span>{language==="sw"?"Sakinisha":"Install"}</span></button>}</aside></ExperienceContext.Provider>
}
