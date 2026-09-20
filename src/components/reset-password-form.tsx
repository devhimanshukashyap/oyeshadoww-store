"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function ResetPasswordForm({
  token,
}: {
  token: string;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to reset your password."
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset your password."
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-ink-muted">
          Your password has been reset successfully. You can now log in
          with your new password.
        </div>

        <Link
          href="/login"
          className="btn-primary block w-full py-3.5 text-center"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="password" className="label">
          New password
        </label>

        <input
          id="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="label">
          Confirm new password
        </label>

        <input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
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
          "Reset password"
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