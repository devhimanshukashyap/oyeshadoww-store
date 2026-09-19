import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
}));

vi.mock("@/lib/verification", () => ({
  createVerificationChallenge: vi.fn(async () => ({
    challengeId: "challenge_1",
    code: "123456",
    expiresAt: new Date("2026-09-19T01:00:00.000Z"),
  })),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { createVerificationChallenge } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { POST } from "@/app/api/register/route";

const mockDb = db as any;
const mockCreateVerificationChallenge =
  createVerificationChallenge as any;
const mockSendEmail = sendEmail as any;

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const validRegistration = {
  name: "Test User",
  email: "Test@Example.com",
  phone: "9876543210",
  password: "strongPassword123",
};

beforeEach(() => {
  vi.clearAllMocks();

  mockDb.user.findUnique.mockResolvedValue(null);

  mockDb.user.create.mockResolvedValue({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    phone: "9876543210",
  });
});

describe("POST /api/register", () => {
  it("creates the account and sends an email verification code", async () => {
    const response = await POST(makeRequest(validRegistration) as any);
    const data = await response.json();

    expect(response.status).toBe(200);

    expect(mockDb.user.create).toHaveBeenCalled();

    expect(mockCreateVerificationChallenge).toHaveBeenCalledWith({
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "Verify your email — Oye Shadoww",
      })
    );

    expect(data.ok).toBe(true);
    expect(data.requiresEmailVerification).toBe(true);
    expect(data.challengeId).toBe("challenge_1");
    expect(data.email).toBe("test@example.com");

    // Never expose the actual OTP to the browser.
    expect(data.code).toBeUndefined();
  });

  it("rejects registration when the email already exists", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: "existing_user",
      email: "test@example.com",
    });

    const response = await POST(makeRequest(validRegistration) as any);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe(
      "Could not create account with those details."
    );

    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockCreateVerificationChallenge).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("rejects invalid registration data", async () => {
    const response = await POST(
      makeRequest({
        ...validRegistration,
        phone: "12345",
      }) as any
    );

    expect(response.status).toBe(400);

    expect(mockDb.user.create).not.toHaveBeenCalled();
    expect(mockCreateVerificationChallenge).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
