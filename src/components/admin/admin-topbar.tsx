"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/health", label: "System Health" },
];

export function AdminTopbar({ brandHandle }: { brandHandle: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-base/90 px-4 backdrop-blur md:px-8">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Compact, symbol-only mark on mobile where space is tight — the
          full [logo] + wordmark lockup already lives in the sidebar on
          larger screens. */}
      <Link href="/admin" className="md:hidden">
        <Logo size={24} showWordmark={false} iconOnlyLabel={`${brandHandle} admin`} />
      </Link>

      <div className="ml-auto">
        <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="btn-ghost text-sm">
          <LogOut size={16} />
          Log out
        </button>
      </div>

      {open && (
        <nav className="fixed inset-x-0 top-16 z-20 border-b border-border bg-base p-3 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-3 text-sm ${
                pathname === link.href ? "bg-accent/15 text-ink" : "text-ink-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
