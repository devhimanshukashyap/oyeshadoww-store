"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function AdminChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/account/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to change password.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setMessage("Password changed successfully.");
    } catch {
      setError("Unable to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-lg font-medium text-ink">
          Change password
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Use your current password to set a new administrator password.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-xl space-y-4"
        noValidate
      >
        <div>
          <label htmlFor="admin-current-password" className="label">
            Current password
          </label>

          <input
            id="admin-current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="admin-new-password" className="label">
            New password
          </label>

          <input
            id="admin-new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
          />

          <p className="mt-1 text-xs text-ink-muted">
            Minimum 8 characters.
          </p>
        </div>

        <div>
          <label htmlFor="admin-confirm-password" className="label">
            Confirm new password
          </label>

          <input
            id="admin-confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-danger"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="text-sm text-success"
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
          className="btn-primary py-2.5"
        >
          {loading ? (
            <Loader2
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            "Change password"
          )}

          <span className="sr-only">
            {loading ? "Changing password…" : ""}
          </span>
        </button>
      </form>
    </section>
  );
}