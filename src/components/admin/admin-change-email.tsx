"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Step = "details" | "otp";

export function AdminChangeEmail({
  currentEmail,
}: {
  currentEmail: string;
}) {
  const [step, setStep] = useState<Step>("details");

  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setError(null);

    const normalizedEmail = newEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (normalizedEmail === currentEmail.toLowerCase()) {
      setError("That's already your current email address.");
      return;
    }

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/account/email/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            newEmail: normalizedEmail,
            currentPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to start email change.");
        return;
      }

      setNewEmail(data.email);
      setChallengeId(data.challengeId);
      setStep("otp");
      setMessage(`Verification code sent to ${data.email}.`);
    } catch {
      setError("Unable to start email change. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setError(null);

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/admin/account/email/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeId,
            code: otp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to verify email.");
        return;
      }

      setMessage(
        "Admin email changed successfully. Please sign in again with your new email."
      );

      setNewEmail("");
      setCurrentPassword("");
      setOtp("");
      setChallengeId("");
    } catch {
      setError("Unable to verify email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("details");
    setOtp("");
    setChallengeId("");
    setMessage(null);
    setError(null);
  }

  if (step === "otp") {
    return (
      <section className="card space-y-5">
        <div>
          <h2 className="text-lg font-medium text-ink">
            Verify new email
          </h2>

          <p className="mt-1 text-sm text-ink-muted">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-ink">
              {newEmail}
            </span>
            .
          </p>
        </div>

        <form
          onSubmit={handleVerify}
          className="max-w-xl space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="admin-email-otp"
              className="label"
            >
              Verification code
            </label>

            <input
              id="admin-email-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              pattern="[0-9]{6}"
              autoFocus
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6)
                )
              }
              className="input text-center tracking-[0.4em]"
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

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="btn-primary py-2.5"
            >
              {loading ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                "Verify email"
              )}

              <span className="sr-only">
                {loading ? "Verifying…" : ""}
              </span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleBack}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              Back
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-lg font-medium text-ink">
          Change email
        </h2>

        <p className="mt-1 text-sm text-ink-muted">
          Changing your admin email requires your current
          password and verification of the new email address.
        </p>
      </div>

      <form
        onSubmit={handleRequest}
        className="max-w-xl space-y-4"
        noValidate
      >
        <div>
          <label
            htmlFor="admin-new-email"
            className="label"
          >
            New email
          </label>

          <input
            id="admin-new-email"
            type="email"
            required
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label
            htmlFor="admin-email-current-password"
            className="label"
          >
            Current password
          </label>

          <input
            id="admin-email-current-password"
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) =>
              setCurrentPassword(e.target.value)
            }
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
            !newEmail ||
            !currentPassword
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
            "Send verification code"
          )}

          <span className="sr-only">
            {loading ? "Sending verification code…" : ""}
          </span>
        </button>
      </form>
    </section>
  );
}