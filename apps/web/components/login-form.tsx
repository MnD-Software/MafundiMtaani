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
              <span aria-hidden="true">G</span> Continue with Google
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
