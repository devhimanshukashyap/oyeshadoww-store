import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <div className="container-page max-w-3xl py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          {settings.brandHandle}
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          About
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Ready-to-post AI-generated reels for creators who want great content
          without the production overhead.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">AI-generated</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Short-form content across funny, emotional, animal, and
            story-driven formats.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">Ready to post</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Get your purchased reels directly in your account after payment.
          </p>
        </div>

        <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm font-semibold text-ink">Instant access</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            Download individual reels or grab multiple files together.
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-card border border-border bg-surface p-6 shadow-sm sm:p-7">
        <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
          <p>
            {settings.brandHandle} creates AI-generated short-form reels — from AI
            Snake content to animal, funny, emotional, and story-driven clips —
            built for creators who want ready-to-post content without the
            production overhead.
          </p>

          <p>
            Every bundle sold here goes straight from account to download: buy a
            bundle, and it&apos;s instantly available in your account, with
            individual and batch download options.
          </p>

          <p>
            Follow along on Instagram, YouTube, and Facebook — links are in the
            footer — and reach out via the contact page with any questions.
          </p>
        </div>
      </div>
    </div>
  );
}
