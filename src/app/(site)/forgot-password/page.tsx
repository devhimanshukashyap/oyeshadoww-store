import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-page max-w-md py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Forgot your password?
        </h1>

        <p className="mt-2 text-sm text-ink-muted">
          Enter your email address and we&apos;ll send you a link to reset
          your password.
        </p>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}