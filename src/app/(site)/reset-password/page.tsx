import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  return (
    <div className="container-page max-w-md py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Reset your password
        </h1>

        <p className="mt-2 text-sm text-ink-muted">
          Choose a new password for your account.
        </p>

        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}