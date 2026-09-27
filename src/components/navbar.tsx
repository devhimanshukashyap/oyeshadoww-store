import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { MobileNav } from "@/components/mobile-nav";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/components/account-menu";

export async function Navbar() {
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/shop", label: "Shop" },
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-base/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="shrink-0">
          <Logo size={28} wordmark={settings.brandHandle} />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/shop" className="btn-primary">
                Browse bundles
              </Link>
            </>
          )}
        </div>

        <MobileNav links={links} isLoggedIn={!!user} />
      </div>
    </header>
  );
}