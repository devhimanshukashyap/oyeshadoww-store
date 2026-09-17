import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Logo } from "@/components/logo";
import { Instagram, Youtube, Facebook, Mail } from "lucide-react";

export async function Footer() {
  const settings = await getSettings();

  const social = [
    { href: settings.instagramUrl, label: "Instagram", Icon: Instagram },
    { href: settings.youtubeUrl, label: "YouTube", Icon: Youtube },
    { href: settings.facebookUrl, label: "Facebook", Icon: Facebook },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 border-t border-border">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-1">
          <Logo size={26} wordmark={settings.brandHandle} />
          <p className="mt-2 max-w-xs text-sm text-ink-muted">{settings.tagline}</p>
          <div className="mt-4 flex items-center gap-3">
            {social.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Shop</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link href="/shop" className="hover:text-ink">All bundles</Link></li>
            <li><Link href="/purchases" className="hover:text-ink">My purchases</Link></li>
            <li><Link href="/faq" className="hover:text-ink">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link href="/about" className="hover:text-ink">About</Link></li>
            <li><Link href="/contact" className="hover:text-ink">Contact</Link></li>
            <li>
              <a href={`mailto:${settings.contactEmail}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Mail size={14} /> {settings.contactEmail}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Legal</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link href="/terms" className="hover:text-ink">Terms & Conditions</Link></li>
            <li><Link href="/privacy" className="hover:text-ink">Privacy Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-ink">Refund Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border py-6">
        <p className="container-page text-xs text-ink-faint">{settings.footerText}</p>
      </div>
    </footer>
  );
}
