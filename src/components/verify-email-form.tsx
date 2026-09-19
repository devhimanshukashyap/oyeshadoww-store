"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function VerifyEmailForm() {
  const router = useRouter();

  const [challengeId, setChallengeId] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedChallengeId = sessionStorage.getItem(
      "emailVerificationChallengeId"
    );
    const storedEmail = sessionStorage.getItem(
      "emailVerificationAddress"
    );

    if (storedChallengeId) {
      setChallengeId(storedChallengeId);
    }

    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!challengeId) {
      setError(
        "Verification session not found. Please register again."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(
        "/api/account/verification/email/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeId,
            code,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not verify your email.");
        return;
      }

      sessionStorage.removeItem("emailVerificationChallengeId");
      sessionStorage.removeItem("emailVerificationAddress");

      const callbackUrl =
        sessionStorage.getItem("emailVerificationCallbackUrl") ||
        "/purchases";

      sessionStorage.removeItem("emailVerificationCallbackUrl");

      setMessage("Email verified successfully!");

      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(
        "/api/account/verification/email",
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not send another code.");
        return;
      }

      setChallengeId(data.challengeId);

      sessionStorage.setItem(
        "emailVerificationChallengeId",
        data.challengeId
      );

      setMessage("A new verification code has been sent.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {email && (
        <p className="text-sm text-ink-muted">
          We sent a verification code to{" "}
          <span className="font-medium text-ink">{email}</span>
        </p>
      )}

      <div>
        <label htmlFor="verification-code" className="label">
          Verification code
        </label>

        <input
          id="verification-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value.replace(/\D/g, "").slice(0, 6)
            )
          }
          className="input text-center text-lg tracking-[0.35em]"
          placeholder="000000"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="text-sm text-green-600">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="btn-primary flex w-full items-center justify-center gap-2 py-3.5"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          "Verify email"
        )}
      </button>

      <button
        type="button"
        onClick={resendCode}
        disabled={resending}
        className="w-full text-sm text-accent hover:underline"
      >
        {resending ? "Sending..." : "Send a new code"}
      </button>
    </form>
  );
}