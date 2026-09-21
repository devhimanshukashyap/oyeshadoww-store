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

type CheckoutStatus =
  | "idle"
  | "creating"
  | "paying"
  | "checking";

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

  const [status, setStatus] =
    useState<CheckoutStatus>("idle");

  const [error, setError] =
    useState<string | null>(null);

  async function checkPaymentStatus(orderId: string) {
    const maxAttempts = 5;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      const response = await fetch(
        "/api/payment/status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "Could not verify payment status.",
        );
      }

      if (data.status === "PAID") {
        router.replace(
          `/order/success?orderId=${encodeURIComponent(
            orderId,
          )}`,
        );

        return;
      }

      if (data.status === "FAILED") {
        const reason =
          data.reason === "cancelled"
            ? "cancelled"
            : "failed";

        router.replace(
          `/order/failed?reason=${reason}`,
        );

        return;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500),
        );
      }
    }

    router.replace(
      `/order/pending?orderId=${encodeURIComponent(
        orderId,
      )}`,
    );
  }

  async function handlePay() {
    setError(null);
    setStatus("creating");

    try {
      if (!window.Cashfree) {
        throw new Error(
          "Payment checkout is still loading. Please try again.",
        );
      }

      const createRes = await fetch(
        "/api/payment/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId,
            variant,
          }),
        },
      );

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(
          createData.error ??
            "Could not start checkout.",
        );
      }

      const orderId = createData.orderId;

      setStatus("paying");

      const cashfree = window.Cashfree({
        mode:
          process.env
            .NEXT_PUBLIC_CASHFREE_ENVIRONMENT ===
          "production"
            ? "production"
            : "sandbox",
      });

      try {
        await cashfree.checkout({
          paymentSessionId:
            createData.paymentSessionId,
          redirectTarget: "_modal",
        });
      } catch {
        // Closing the modal or a checkout SDK error
        // is not proof that the payment failed.
        // We verify the real status on our server.
      }

      setStatus("checking");

      await checkPaymentStatus(orderId);
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

            {status === "checking" &&
              "Checking payment status…"}
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