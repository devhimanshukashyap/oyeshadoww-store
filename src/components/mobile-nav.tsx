"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, X, User2, ShoppingBag, LogOut } from "lucide-react";

export function MobileNav({
  links,
  isLoggedIn,
}: {
  links: { href: string; label: string }[];
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-surface-raised"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className="fixed inset-x-0 top-16 z-50 border-b border-border bg-base p-4">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base text-ink hover:bg-surface-raised"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {isLoggedIn ? (
                <>
                  <Link href="/account" onClick={() => setOpen(false)} className="btn-secondary w-full">
                    <User2 size={16} />
                    My Account
                  </Link>
                  <Link href="/purchases" onClick={() => setOpen(false)} className="btn-secondary w-full">
                    <ShoppingBag size={16} />
                    My Purchases
                  </Link>
                  <button
                    onClick={() => {
                      setOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="btn-ghost w-full text-danger"
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary w-full">
                    Log in
                  </Link>
                  <Link href="/shop" onClick={() => setOpen(false)} className="btn-primary w-full">
                    Browse bundles
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
