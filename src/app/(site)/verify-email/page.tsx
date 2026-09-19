import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/verify-email-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Verify your email",
};

export default function VerifyEmailPage() {
  return (
    <div className="container-page flex min-h-[70vh] max-w-sm flex-col justify-center py-14">
      <Logo
        size={36}
        showWordmark={false}
        iconOnlyLabel="oyeshadoww"
        className="mb-6"
      />

      <h1 className="font-display text-2xl font-semibold text-ink">
        Verify your email
      </h1>

      <p className="mt-1 text-sm text-ink-muted">
        Enter the 6-digit code we sent to your email address.
      </p>

      <VerifyEmailForm />
    </div>
  );
}