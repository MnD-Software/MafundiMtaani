"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, UserPlus } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    referral_code: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, account_type: "client" }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.detail || "Account creation failed.");
      setLoading(false);
      return;
    }
    router.replace("/post-job");
    router.refresh();
  };
  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-icon">
          <UserPlus />
        </span>
        <span className="kicker">Client account</span>
        <h1>Find trusted help.</h1>
        <p>
          Create an account to post jobs, compare verified professionals and
          keep work records private.
        </p>
        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label>
          Email
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
          Mobile number
          <input
            required
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
          />
        </label>
        <label>
          Password
          <input
            required
            minLength={10}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
          />
        </label>
        <label>
          Referral code <small>Optional</small>
          <input
            value={form.referral_code}
            onChange={(event) =>
              setForm({ ...form, referral_code: event.target.value.toUpperCase() })
            }
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={loading} className="button button-dark button-wide">
          {loading ? (
            "Creating account…"
          ) : (
            <>
              Create account <ArrowRight size={16} />
            </>
          )}
        </button>
        <p>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
