"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle2 } from "lucide-react";

export function AccountEmailForm({ currentEmail }: { currentEmail: string }) {
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not update your email.");
      return;
    }

    await update({ email: data.email });
    setSaved(data.email);
    setOpen(false);
    setNewEmail("");
    setCurrentPassword("");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">Email</p>
          <p className="text-sm font-medium text-ink">{saved ?? currentEmail}</p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-ghost px-3 py-1.5 text-xs">
            Change
          </button>
        )}
      </div>

      {saved && !open && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 size={14} /> Email updated
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-border p-4">
          <div>
            <label htmlFor="new-email" className="label">New email</label>
            <input
              id="new-email"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="current-password-email" className="label">Current password</label>
            <input
              id="current-password-email"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
            />
            <p className="mt-1 text-xs text-ink-faint">For your security, confirm your password to change your email.</p>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Update email"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="btn-ghost px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
