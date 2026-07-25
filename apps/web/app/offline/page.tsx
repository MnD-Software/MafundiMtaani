import Link from "next/link";
import { WifiOff } from "lucide-react";
export default function OfflinePage(){return <main className="auth-shell"><section className="auth-card centered"><span className="auth-icon"><WifiOff/></span><span className="kicker">Offline mode</span><h1>You&apos;re temporarily offline.</h1><p>Your saved job draft remains on this device. Reconnect to search live availability, send messages or make payments.</p><Link className="button button-dark button-wide" href="/">Try the marketplace again</Link></section></main>}
