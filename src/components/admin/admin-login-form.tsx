"use client";

import { useState } from "react";
import { signIn, signOut, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      setLoading(false);
      // Generic on purpose — never reveal whether the email exists or
      // which field was wrong. The real check happens server-side in
      // src/lib/auth.ts; this UI only ever shows one safe message.
      setError("Incorrect email or password.");
      return;
    }

    // The credentials were valid, but that only proves this is a real
    // account — not that it's an admin. Confirm the role from the
    // server-issued session (never trust a role echoed back by the
    // client) before treating this as an admin sign-in.
    const session = await getSession();
    if (session?.user?.role !== "ADMIN") {
      await signOut({ redirect: false });
      setLoading(false);
      setError("This account doesn't have admin access.");
      return;
    }

    // Even after this client-side check, the server (middleware + every
    // /api/admin/* route) still independently verifies role === ADMIN on
    // every request. This redirect is only for UX.
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          aria-invalid={!!error}
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          aria-invalid={!!error}
        />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full py-3">
        {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : "Sign in"}
        <span className="sr-only">{loading ? "Signing in…" : ""}</span>
      </button>
    </form>
  );
}
