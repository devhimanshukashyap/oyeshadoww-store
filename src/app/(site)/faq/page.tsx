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
    <div className="container-page max-w-prose py-14">
      <h1 className="font-display text-3xl font-semibold text-ink">Frequently asked questions</h1>
      <div className="mt-8 divide-y divide-border">
        {faqs.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="cursor-pointer list-none text-base font-medium text-ink marker:content-none">
              {item.q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
