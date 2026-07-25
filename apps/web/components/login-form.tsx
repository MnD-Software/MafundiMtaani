"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import Link from "next/link";

export function LoginForm({portal="client"}:{portal?:"client"|"artisan"|"operations"}) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...form,expected_role:portal}),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.detail || "Sign in failed.");
      setLoading(false);
      return;
    }
    const fallback=portal==="operations"?"/admin":portal==="artisan"?"/artisan/dashboard":"/client/dashboard";
    const requested=params.get("next");
    router.replace(requested?.startsWith("/")?requested:fallback);
    router.refresh();
  };
  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-icon">
          <LockKeyhole />
        </span>
        <span className="kicker">{portal==="operations"?"Operations portal":portal==="artisan"?"Artisan portal":"Client portal"}</span>
        <h1>Welcome back.</h1>
        <p>Sign in to your dedicated {portal} workspace.</p>
        <label>
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={loading} className="button button-dark button-wide">
          {loading ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight size={16} />
            </>
          )}
        </button>
        {portal === "client" && (
          <>
            <div className="auth-divider"><span>or</span></div>
            <a className="button button-outline button-wide google-signin" href="/api/auth/google/start">
              <GoogleMark/> Continue with Google
            </a>
          </>
        )}
        <div className="auth-divider">
          <span>New to Mafundi?</span>
        </div>
        <Link className="button button-outline button-wide" href="/register">
          Create an account
        </Link>
        <p className="auth-artisan-link">
          Are you an artisan?{" "}
          <Link href="/join">Join the professional network</Link>
        </p>
      </form>
    </main>
  );
}

function GoogleMark(){
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.205c0-.64-.057-1.255-.164-1.845H9v3.49h4.844a4.14 4.14 0 0 1-1.797 2.715v2.265h2.91c1.704-1.568 2.683-3.88 2.683-6.625Z"/><path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.17l-2.91-2.265c-.806.54-1.835.86-3.047.86-2.344 0-4.328-1.585-5.037-3.715H.955v2.337A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.963 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.281-1.71V4.953H.955A9 9 0 0 0 0 9c0 1.452.347 2.827.955 4.047l3.008-2.337Z"/><path fill="#EA4335" d="M9 3.575c1.322 0 2.508.455 3.442 1.345l2.581-2.582C13.464.886 11.427 0 9 0A9 9 0 0 0 .955 4.953L3.963 7.29C4.672 5.16 6.656 3.575 9 3.575Z"/></svg>
}
