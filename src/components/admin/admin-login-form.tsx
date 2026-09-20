"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Step = "credentials" | "otp";

export function AdminLoginForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [challengeId, setChallengeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Incorrect email or password.");
        return;
      }

      setChallengeId(data.challengeId);
      setStep("otp");
    } catch {
      setError("Unable to start admin login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const verifyResponse = await fetch("/api/admin/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId,
          code: otp,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        setError(verifyData.error || "Invalid verification code.");
        return;
      }

      const signInResponse = await signIn("credentials", {
        email,
        password,
        adminChallengeId: challengeId,
        redirect: false,
      });

      if (signInResponse?.error) {
        setError("Admin verification could not be completed. Please try again.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to complete admin login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <form
        onSubmit={handleOtpSubmit}
        className="mt-4 space-y-4"
        noValidate
      >
        <div>
          <label htmlFor="otp" className="label">
            Verification code
          </label>

          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            pattern="[0-9]{6}"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="input text-center tracking-[0.4em]"
            aria-invalid={!!error}
            autoFocus
          />

          <p className="mt-2 text-xs text-muted-foreground">
            Enter the 6-digit code sent to {email}.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-1.5 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="btn-primary w-full py-3"
        >
          {loading ? (
            <Loader2
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            "Verify & Sign in"
          )}

          <span className="sr-only">
            {loading ? "Verifying…" : ""}
          </span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setStep("credentials");
            setOtp("");
            setChallengeId("");
            setError(null);
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to login
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleCredentialsSubmit}
      className="mt-4 space-y-4"
      noValidate
    >
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
          aria-invalid={!!error}
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>

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
        <p
          role="alert"
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-3"
      >
        {loading ? (
          <Loader2
            size={16}
            className="animate-spin"
            aria-hidden="true"
          />
        ) : (
          "Continue"
        )}

        <span className="sr-only">
          {loading ? "Checking credentials…" : ""}
        </span>
      </button>
    </form>
  );
}