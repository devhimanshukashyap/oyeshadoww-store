import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <div className="container-page max-w-prose py-14">
      <p className="text-eyebrow">{settings.brandHandle}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">About</h1>
      <div className="prose-invert mt-6 space-y-4 text-ink-muted">
        <p>
          {settings.brandHandle} creates AI-generated short-form reels — from AI Snake content to
          animal, funny, emotional, and story-driven clips — built for creators who want ready-to-post
          content without the production overhead.
        </p>
        <p>
          Every bundle sold here goes straight from account to download: buy a bundle, and it&apos;s
          instantly available in your account, with individual and batch download options.
        </p>
        <p>
          Follow along on Instagram, YouTube, and Facebook — links are in the footer — and reach out
          via the contact page with any questions.
        </p>
      </div>
    </div>
  );
}
