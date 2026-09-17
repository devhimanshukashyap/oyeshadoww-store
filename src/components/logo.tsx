import { cn } from "@/lib/utils";

/**
 * The single source of the brand mark across the app (navbar, footer,
 * login/register, admin login, admin sidebar). Renders the static
 * `public/icon.svg` asset — never generated at request time, so there's
 * no font-loading or filesystem-path dependency (see README "Favicon" /
 * `docs/SECURITY.md` for why the previous `next/og`-based icon was
 * replaced).
 *
 * Accessibility: the mark image is always decorative (`alt=""`) because
 * every place this component is used either shows the "oyeshadoww"
 * wordmark right next to it (which carries the meaning) or is wrapped in
 * a link that supplies its own accessible name via `aria-label` — see
 * `iconOnlyLabel`. This avoids screen readers announcing the brand name
 * twice.
 */
export function Logo({
  size = 28,
  showWordmark = true,
  wordmark = "oyeshadoww",
  iconOnlyLabel,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  wordmark?: string;
  /** Accessible name to apply when no visible wordmark text is present (e.g. compact mobile header). Ignored when showWordmark is true. */
  iconOnlyLabel?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role={!showWordmark && iconOnlyLabel ? "img" : undefined}
      aria-label={!showWordmark ? iconOnlyLabel : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.svg"
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[28%]"
        style={{ width: size, height: size }}
      />
      {showWordmark && <span className="font-display text-base font-semibold tracking-tight text-ink">{wordmark}</span>}
    </span>
  );
}
