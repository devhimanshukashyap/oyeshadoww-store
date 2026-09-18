import { logger } from "@/lib/logger";

/**
 * Transactional email is sent server-side only — no provider credentials
 * ever reach the browser. Swap providers by changing EMAIL_PROVIDER; the
 * rest of the app only ever calls sendEmail().
 *
 * EMAIL_PROVIDER=console  -> logs the email instead of sending (default,
 *                             safe for local development)
 * EMAIL_PROVIDER=resend   -> sends via Resend (https://resend.com)
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  if (provider === "console") {
    logger.info("email.console_send", {
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    return;
  }

  if (provider === "resend") {
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("EMAIL_API_KEY and EMAIL_FROM must be set when EMAIL_PROVIDER=resend");
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return;
  }

  throw new Error(`Unknown EMAIL_PROVIDER: ${provider}`);
}

// --- Templates ---------------------------------------------------------------
// Kept intentionally plain (inline styles, no external images) so they
// render reliably across email clients. No download links are ever
// included here — delivery always happens through the account dashboard.

export function purchaseConfirmationEmail(params: {
  customerName: string;
  productName: string;
  variant: string;
  amountDisplay: string;
  siteUrl: string;
}) {
  const html = `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 12px">Payment successful</h2>
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Your purchase of <strong>${escapeHtml(params.productName)}</strong> (${escapeHtml(
    params.variant
  )}) for ${escapeHtml(params.amountDisplay)} is confirmed.</p>
    <p>It's now available in your account.</p>
    <p style="margin:24px 0">
      <a href="${params.siteUrl}/purchases" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
        Open My Purchases
      </a>
    </p>
    <p style="color:#666;font-size:13px">If you didn't make this purchase, contact support immediately.</p>
  </div>`;
  return { subject: "Your purchase is ready", html };
}

export function paymentFailedEmail(params: { customerName: string; productName: string; siteUrl: string }) {
  const html = `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 12px">Payment failed</h2>
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Your payment for <strong>${escapeHtml(params.productName)}</strong> could not be completed. No amount was captured.</p>
    <p style="margin:24px 0">
      <a href="${params.siteUrl}/shop" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
        Try again
      </a>
    </p>
  </div>`;
  return { subject: "Payment failed", html };
}

export function refundConfirmationEmail(params: { customerName: string; productName: string; siteUrl: string }) {
  const html = `
  <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 12px">Refund processed</h2>
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Your order for <strong>${escapeHtml(params.productName)}</strong> has been refunded and access has been revoked.</p>
  </div>`;
  return { subject: "Refund confirmed", html };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
