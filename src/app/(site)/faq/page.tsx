import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQ" };

const faqs = [
  {
    q: "What's the difference between watermarked and non-watermarked?",
    a: "Watermarked bundles include a visible watermark on every reel and are priced lower. Non-watermarked bundles are the same reels without any watermark, at full quality.",
  },
  {
    q: "How do I get my files after paying?",
    a: "Immediately after payment is confirmed, the bundle appears in My Purchases. Open it to preview and download reels individually, or select several and download them together as a ZIP.",
  },
  {
    q: "Can I download a bundle again later?",
    a: "Yes — as long as your purchase is active, you can return to My Purchases and re-download anytime.",
  },
  {
    q: "What can I do with the reels I buy?",
    a: "You can use them in your own social media content. You can't resell the raw files, redistribute the bundle as a downloadable archive, or claim exclusive ownership. Full terms are on each product page and in our Terms & Conditions.",
  },
  {
    q: "What payment methods are supported?",
    a: "Checkout is handled securely by Cashfree, supporting cards, UPI, netbanking, and other popular payment methods.",
  },
  {
    q: "I paid but don't see my bundle — what do I do?",
    a: "This is rare, but if it happens, contact us with your payment reference and we'll sort it out quickly.",
  },
];

export default function FaqPage() {
  return (
    <div className="container-page max-w-3xl py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Help center
        </p>

        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Frequently asked questions
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-base">
          Everything you need to know about bundles, payments, downloads, and
          using your purchased reels.
        </p>
      </div>

      <div className="mt-10 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        {faqs.map((item, index) => (
          <details
            key={item.q}
            className="group border-b border-border last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-raised sm:px-6">
              <span>{item.q}</span>

              <span
                aria-hidden="true"
                className="shrink-0 text-lg font-normal text-ink-faint transition-transform duration-300 group-open:rotate-45 group-open:text-accent"
              >
                +
              </span>
            </summary>

            <div className="px-5 pb-5 sm:px-6">
              <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
                {item.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
