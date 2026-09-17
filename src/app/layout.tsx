import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { getSettings } from "@/lib/settings";
import "./globals.css";

/**
 * Typography system — the ONLY place font files are loaded.
 *
 * Both fonts are loaded via `next/font/google`, which downloads and
 * self-hosts the font files at BUILD TIME and serves them from your own
 * domain (no runtime requests to Google, no runtime filesystem/font-path
 * resolution). This is the official, platform-safe Next.js mechanism and
 * works identically on Windows, macOS, Linux, in dev, and in production —
 * unlike the previous `next/og`-based dynamic favicon, which tried to
 * resolve a font file path at REQUEST TIME and broke on Windows because of
 * backslash/`file:` URL handling (see `public/icon.svg` + `docs/SECURITY.md`
 * / README "Favicon" section for how that was replaced with a static
 * asset).
 *
 * - `--font-display` (Space Grotesk): headings, hero text, large numbers,
 *   section titles — a geometric, modern, slightly technical display face
 *   that fits the AI/creator brand without being decorative or harder to
 *   read at heading sizes.
 * - `--font-body` (Inter): body copy, navigation, buttons, forms, and the
 *   entire admin panel — optimized for readability at small sizes.
 *
 * Both variables are set once here on <html> and consumed everywhere via
 * the `font-display` / `font-sans` Tailwind utilities (see
 * `tailwind.config.ts`) — no component ever hardcodes a font-family.
 * Heading-level sizing/spacing (the responsive type scale) lives in
 * `src/app/globals.css` under "Typography".
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${settings.brandHandle} — AI reel bundles`,
      template: `%s · ${settings.brandHandle}`,
    },
    description: settings.tagline,
    // Static, pre-rendered icon assets only — see public/icon.svg,
    // public/favicon.ico, public/apple-touch-icon.png. Nothing here is
    // generated at request time. To change the logo, replace these files
    // (see README.md "Where do I change things?" → Branding).
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    manifest: "/site.webmanifest",
    openGraph: {
      title: `${settings.brandHandle} — AI reel bundles`,
      description: settings.tagline,
      siteName: settings.siteName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${settings.brandHandle} — AI reel bundles`,
      description: settings.tagline,
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
