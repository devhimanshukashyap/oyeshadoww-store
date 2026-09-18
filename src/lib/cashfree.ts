import crypto from "crypto";

const CASHFREE_API_VERSION = "2025-01-01";

type CashfreeEnvironment = "sandbox" | "production";

interface CashfreeConfig {
  appId: string;
  secretKey: string;
  environment: CashfreeEnvironment;
  baseUrl: string;
}

export function getConfig(): CashfreeConfig {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const environment =
    (process.env.CASHFREE_ENVIRONMENT ?? "sandbox") as CashfreeEnvironment;

  if (!appId) {
    throw new Error("CASHFREE_APP_ID is not configured");
  }

  if (!secretKey) {
    throw new Error("CASHFREE_SECRET_KEY is not configured");
  }

  if (
    environment !== "sandbox" &&
    environment !== "production"
  ) {
    throw new Error(
      "CASHFREE_ENVIRONMENT must be sandbox or production",
    );
  }

  return {
    appId,
    secretKey,
    environment,
    baseUrl:
      environment === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg",
  };
}

export async function cashfreeRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const config = getConfig();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-client-id": config.appId,
    "x-client-secret": config.secretKey,
    "x-api-version": CASHFREE_API_VERSION,
  };

  if (options.idempotencyKey) {
    headers["x-idempotency-key"] =
      options.idempotencyKey;
  }

  const response = await fetch(
    `${config.baseUrl}${path}`,
    {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
    },
  );

  const text = await response.text();

  let data: unknown;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text || "Invalid response from Cashfree",
    };
  }

  if (!response.ok) {
    throw new Error(
      `Cashfree API error ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data as T;
}

export interface CreateCashfreeOrderParams {
  orderId: string;
  amountPaise: number;
  currency: string;

  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;

  returnUrl: string;
  notifyUrl: string;
}

export interface CashfreeOrderResponse {
  cf_order_id: string;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: string;
  payment_session_id: string;
}

export async function createCashfreeOrder(
  params: CreateCashfreeOrderParams,
): Promise<CashfreeOrderResponse> {
  return cashfreeRequest<CashfreeOrderResponse>(
    "/orders",
    {
      method: "POST",

      idempotencyKey: params.orderId,

      body: {
        order_id: params.orderId,
        order_amount:
          params.amountPaise / 100,
        order_currency: params.currency,

        customer_details: {
          customer_id: params.customerId,
          customer_name: params.customerName,
          customer_email: params.customerEmail,
          customer_phone: params.customerPhone,
        },

        order_meta: {
          return_url: params.returnUrl,
          notify_url: params.notifyUrl,
        },
      },
    },
  );
}

export async function fetchCashfreeOrder(
  orderId: string,
): Promise<CashfreeOrderResponse> {
  return cashfreeRequest<CashfreeOrderResponse>(
    `/orders/${encodeURIComponent(orderId)}`,
  );
}

export interface CashfreePayment {
  cf_payment_id: string | number;
  payment_status: string;
  payment_amount: number;
  payment_currency: string;
  order_id: string;
}

export async function fetchCashfreePayments(
  orderId: string,
): Promise<CashfreePayment[]> {
  return cashfreeRequest<CashfreePayment[]>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
}

/**
 * Cashfree webhook signature:
 *
 * Base64(
 *   HMAC-SHA256(
 *     timestamp + rawBody,
 *     CASHFREE_SECRET_KEY
 *   )
 * )
 */
export function verifyCashfreeWebhookSignature(params: {
  signature: string;
  timestamp: string;
  rawBody: string;
}): boolean {
  const config = getConfig();

  const signedPayload =
    params.timestamp + params.rawBody;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        config.secretKey,
      )
      .update(signedPayload)
      .digest("base64");

  const expectedBuffer =
    Buffer.from(expectedSignature);

  const receivedBuffer =
    Buffer.from(params.signature);

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

export interface CreateCashfreeRefundParams {
  orderId: string;
  refundId: string;
  refundAmountPaise: number;
  refundNote?: string;
}

export interface CashfreeRefundResponse {
  cf_payment_id?: string | number;
  cf_refund_id?: string;
  refund_id: string;
  order_id: string;
  refund_amount: number;
  refund_status: string;
}

export async function createCashfreeRefund(
  params: CreateCashfreeRefundParams,
): Promise<CashfreeRefundResponse> {
  return cashfreeRequest<CashfreeRefundResponse>(
    `/orders/${encodeURIComponent(params.orderId)}/refunds`,
    {
      method: "POST",

      idempotencyKey: params.refundId,

      body: {
        refund_amount:
          params.refundAmountPaise / 100,

        refund_id: params.refundId,

        refund_note:
          params.refundNote ??
          "Refund requested by admin",
      },
    },
  );
}