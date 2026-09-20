import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({
  items,
}: {
  items: BreadcrumbItem[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex items-center gap-1.5 text-sm"
    >
      <Link
        href="/"
        className="inline-flex items-center text-ink-faint transition hover:text-ink"
        aria-label="Home"
      >
        <Home size={14} />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            <ChevronRight size={14} className="shrink-0 text-ink-faint" />

            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="truncate text-ink-muted transition hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`truncate ${
                  isLast ? "font-medium text-ink" : "text-ink-muted"
                }`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}