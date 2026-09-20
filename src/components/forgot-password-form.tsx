"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setSent(false);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to process your request."
        );
      }

      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process your request."
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
          If an account exists with that email, we&apos;ve sent a password
          reset link. Check your inbox and spam folder.
        </div>

        <Link
          href="/login"
          className="btn-primary block w-full py-3.5 text-center"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>

        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="you@example.com"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3.5"
      >
        {loading ? (
          <Loader2 size={16} className="mx-auto animate-spin" />
        ) : (
          "Send reset link"
        )}
      </button>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-ink-muted transition hover:text-ink"
        >
          Back to login
        </Link>
      </div>
    </form>
  );
}