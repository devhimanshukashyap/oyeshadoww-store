"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Loader2, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function CheckoutPanel({
  productId,
  productName,
  variant,
  userEmail,
}: {
  productId: string;
  productName: string;
  variant: "WATERMARKED" | "CLEAN";
  userEmail: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "creating" | "paying" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setStatus("creating");
    try {
      const createRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variant }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? "Could not start checkout");

      setStatus("paying");

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: createData.amountPaise,
        currency: createData.currency,
        name: "oyeshadoww",
        description: `${productName} — ${variant === "CLEAN" ? "Non-watermarked" : "Watermarked"}`,
        order_id: createData.razorpayOrderId,
        prefill: { email: userEmail },
        theme: { color: "#7C5CFF" },
        handler: async function (response: any) {
          setStatus("verifying");
          try {
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error ?? "Payment verification failed");
            router.push(`/order/success?orderId=${verifyData.orderId}`);
          } catch (err: any) {
            router.push(`/order/failed?reason=${encodeURIComponent(err.message ?? "verification_failed")}`);
          }
        },
        modal: {
          ondismiss: function () {
            setStatus("idle");
          },
        },
      });

      rzp.on("payment.failed", function () {
        router.push(`/order/failed`);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <button onClick={handlePay} disabled={busy} className="btn-primary mt-6 w-full py-3.5 text-base">
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {status === "creating" && "Preparing checkout…"}
            {status === "paying" && "Waiting for payment…"}
            {status === "verifying" && "Confirming payment…"}
          </>
        ) : (
          <>
            <ShieldCheck size={16} />
            Pay securely
          </>
        )}
      </button>
      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
    </>
  );
}
