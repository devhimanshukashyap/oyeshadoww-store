import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const settings = await getSettings();
  return (
    <div className="container-page max-w-prose py-14">
      <h1 className="font-display text-3xl font-semibold text-ink">Privacy Policy</h1>
      <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{settings.privacyText}</p>
    </div>
  );
}
