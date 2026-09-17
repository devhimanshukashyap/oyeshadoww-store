import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  return (
    <div className="container-page flex min-h-[70vh] max-w-sm flex-col justify-center py-14">
      <Logo size={36} showWordmark={false} iconOnlyLabel="oyeshadoww" className="mb-6" />
      <h1 className="font-display text-2xl font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-muted">Takes less than a minute.</p>
      <RegisterForm callbackUrl={searchParams.callbackUrl} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href={`/login${searchParams.callbackUrl ? `?callbackUrl=${encodeURIComponent(searchParams.callbackUrl)}` : ""}`} className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
