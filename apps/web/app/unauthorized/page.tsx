import Link from "next/link";
import { ShieldX } from "lucide-react";
export default function UnauthorizedPage() { return <main className="auth-shell"><div className="auth-card centered"><span className="auth-icon"><ShieldX /></span><span className="kicker">Access restricted</span><h1>This workspace is not assigned to your role.</h1><p>Return to the marketplace or sign in with the correct account.</p><Link className="button button-dark" href="/">Return home</Link></div></main>; }
