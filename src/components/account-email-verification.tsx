"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type Props = {
    email: string;
    verified: boolean;
};

export function AccountEmailVerification({ email, verified }: Props) {
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [code, setCode] = useState("");
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verifiedState, setVerifiedState] = useState(verified);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function sendCode() {
        setSending(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch("/api/account/verification/email", {
                method: "POST",
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Could not send verification code.");
                return;
            }

            /*
             * The current API intentionally does not return challengeId.
             * This component will be wired to that response in the next step.
             */
            setChallengeId(data.challengeId);
            setMessage("Verification code sent. Check your email.");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSending(false);
        }
    }

    async function verifyCode(e: React.FormEvent) {
        e.preventDefault();

        if (!challengeId) {
            setError("Please request a new verification code.");
            return;
        }

        setVerifying(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch("/api/account/verification/email/verify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    challengeId,
                    code,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Verification failed.");
                return;
            }

            setVerifiedState(true);
            setChallengeId(null);
            setCode("");
            setMessage("Your email has been verified.");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setVerifying(false);
        }
    }

    if (verifiedState) {
        return (
            <div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-ink-muted">Email verification</p>
                        <p className="mt-1 text-sm font-medium text-ink">{email}</p>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-sm text-success">
                        <CheckCircle2 size={15} />
                        Verified
                    </span>
                </div>

                {message && (
                    <p className="mt-2 text-sm text-success" role="status">
                        {message}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm text-ink-muted">Email verification</p>
                    <p className="mt-1 text-sm font-medium text-ink">{email}</p>
                </div>

                {!challengeId && (
                    <button
                        type="button"
                        onClick={sendCode}
                        disabled={sending}
                        className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-xs"
                    >
                        {sending ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <ShieldCheck size={14} />
                        )}
                        Verify email
                    </button>
                )}
            </div>

            {challengeId && (
                <form
                    onSubmit={verifyCode}
                    className="mt-3 space-y-3 rounded-lg border border-border p-4"
                >
                    <div>
                        <label htmlFor="email-verification-code" className="label">
                            Verification code
                        </label>

                        <input
                            id="email-verification-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            required
                            value={code}
                            onChange={(e) =>
                                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            placeholder="123456"
                            className="input tracking-[0.3em]"
                        />

                        <p className="mt-1 text-xs text-ink-faint">
                            Enter the 6-digit code sent to your email.
                        </p>
                    </div>

                    {error && (
                        <p role="alert" className="text-sm text-danger">
                            {error}
                        </p>
                    )}

                    {message && (
                        <p role="status" className="text-sm text-success">
                            {message}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={verifying || code.length !== 6}
                        className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
                    >
                        {verifying && <Loader2 size={14} className="animate-spin" />}
                        Verify code
                    </button>
                </form>
            )}

            {error && !challengeId && (
                <p role="alert" className="mt-2 text-sm text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}