import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { ExperienceProvider } from "@/components/experience-provider";
import { SeasonalCampaign } from "@/components/seasonal-campaign";
import { LiveLocationProvider } from "@/components/live-location-provider";
import "./globals.css";
import "./premium.css";
import "./interactions.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Mafundi Mtaani — Trusted help, right around the corner",
  description: "Book verified Nairobi artisans with transparent pricing and live job progress.",
  manifest:"/manifest.webmanifest",
  appleWebApp:{capable:true,title:"Mafundi"},
};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#ffffff",colorScheme:"light"};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={manrope.variable}><a className="skip-link" href="#main-content">Skip to main content</a><ExperienceProvider><LiveLocationProvider>
        <AppHeader />
        <SeasonalCampaign />
        <div id="main-content">{children}</div>
        <MobileNav />
      </LiveLocationProvider></ExperienceProvider></body>
    </html>
  );
}
