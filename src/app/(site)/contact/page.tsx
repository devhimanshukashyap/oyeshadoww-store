import type { Metadata } from "next";
import { Mail, Instagram, Youtube, Facebook } from "lucide-react";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const settings = await getSettings();

  const channels = [
    { href: `mailto:${settings.contactEmail}`, label: settings.contactEmail, Icon: Mail },
    { href: settings.instagramUrl, label: "Instagram", Icon: Instagram },
    { href: settings.youtubeUrl, label: "YouTube", Icon: Youtube },
    { href: settings.facebookUrl, label: "Facebook", Icon: Facebook },
  ];

  return (
    <div className="container-page max-w-prose py-14">
      <h1 className="font-display text-3xl font-semibold text-ink">Contact</h1>
      <p className="mt-2 text-ink-muted">
        Questions about an order, a bundle, or anything else — reach out through any of these:
      </p>

      <div className="mt-6 space-y-3">
        {channels.map(({ href, label, Icon }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer noopener"
            className="card flex items-center gap-3 p-4 text-ink hover:border-accent/50"
          >
            <Icon size={18} className="text-accent" />
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
