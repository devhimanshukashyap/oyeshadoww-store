import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  return (
    <div className="container-page flex min-h-[70vh] max-w-sm flex-col justify-center py-14">
      <Logo size={36} showWordmark={false} iconOnlyLabel="oyeshadoww" className="mb-6" />
      <h1 className="font-display text-2xl font-semibold text-ink">Log in</h1>
      <p className="mt-1 text-sm text-ink-muted">Access your purchases and downloads.</p>
      <LoginForm callbackUrl={searchParams.callbackUrl} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href={`/register${searchParams.callbackUrl ? `?callbackUrl=${encodeURIComponent(searchParams.callbackUrl)}` : ""}`} className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
