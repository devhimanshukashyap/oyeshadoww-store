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
    <div className="container-page max-w-3xl py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Get in touch
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Contact
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Questions about an order, a bundle, or anything else? Reach out through
          whichever channel works best for you.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {channels.map(({ href, label, Icon }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noreferrer noopener"
            className="group rounded-card border border-border bg-surface p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon size={18} />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {label === settings.contactEmail
                    ? "Send us an email"
                    : `Visit our ${label} page`}
                </p>
              </div>

              <span
                aria-hidden="true"
                className="ml-auto shrink-0 text-lg text-ink-faint transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent"
              >
                →
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
