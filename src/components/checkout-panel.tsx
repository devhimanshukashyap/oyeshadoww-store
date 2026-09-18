"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Loader2, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    Cashfree: any;
  }
}

export function CheckoutPanel({
  productId,
  productName,
  variant,
}: {
  productId: string;
  productName: string;
  variant: "WATERMARKED" | "CLEAN";
  userEmail: string;
}) {
  const router = useRouter();

  const [status, setStatus] = useState<
    "idle" | "creating" | "paying"
  >("idle");

  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setStatus("creating");

    try {
      if (!window.Cashfree) {
        throw new Error(
          "Payment checkout is still loading. Please try again.",
        );
      }

      const createRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          variant,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(
          createData.error ?? "Could not start checkout",
        );
      }

      setStatus("paying");

      const cashfree = window.Cashfree({
        mode:
          process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT ===
          "production"
            ? "production"
            : "sandbox",
      });

      await cashfree.checkout({
        paymentSessionId: createData.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (err: any) {
      setError(
        err?.message ??
          "Something went wrong. Please try again.",
      );
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <>
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
      />

      <button
        onClick={handlePay}
        disabled={busy}
        className="btn-primary mt-6 w-full py-3.5 text-base"
      >
        {busy ? (
          <>
            <Loader2
              size={16}
              className="animate-spin"
            />

            {status === "creating" &&
              "Preparing checkout…"}

            {status === "paying" &&
              "Opening secure checkout…"}
          </>
        ) : (
          <>
            <ShieldCheck size={16} />
            Pay securely
          </>
        )}
      </button>

      {error && (
        <p className="mt-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}