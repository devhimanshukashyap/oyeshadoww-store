import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/verification", () => ({
  createVerificationChallenge: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

import { requireUser } from "@/lib/session";
import { createVerificationChallenge } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { POST } from "../src/app/api/account/verification/email/route";

const mockRequireUser = requireUser as any;
const mockCreateChallenge = createVerificationChallenge as any;
const mockSendEmail = sendEmail as any;
const mockDb = db as any;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(ip = "127.0.0.1") {
  return new Request(
    "http://localhost/api/account/verification/email",
    {
      method: "POST",
      headers: {
        "x-forwarded-for": ip,
      },
    }
  ) as any;
}

describe("POST /api/account/verification/email", () => {
  it("rejects unauthenticated requests", async () => {
    mockRequireUser.mockRejectedValueOnce(
      Object.assign(new Error("Authentication required"), { status: 401 })
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(mockCreateChallenge).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("rejects an already verified email", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      emailVerifiedAt: new Date(),
    });

    mockDb.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      name: "Test User",
      email: "test@example.com",
      emailVerifiedAt: new Date(),
    });

    const response = await POST(makeRequest("10.0.0.1"));

    expect(response.status).toBe(400);
    expect(mockCreateChallenge).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("creates a challenge and sends the OTP without returning the OTP", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      emailVerifiedAt: null,
    });

    mockDb.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      name: "Test User",
      email: "test@example.com",
      emailVerifiedAt: null,
    });

    mockCreateChallenge.mockResolvedValueOnce({
      challengeId: "challenge_1",
      code: "123456",
      expiresAt: new Date("2026-09-18T15:00:00.000Z"),
    });

    mockSendEmail.mockResolvedValueOnce(undefined);

    const response = await POST(makeRequest("10.0.0.2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.challengeId).toBe("challenge_1");
    expect(body.expiresAt).toBe("2026-09-18T15:00:00.000Z");

    // Never expose the actual OTP to the browser.
    expect(body.code).toBeUndefined();

    expect(mockCreateChallenge).toHaveBeenCalledWith({
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const emailParams = mockSendEmail.mock.calls[0][0];

    expect(emailParams.to).toBe("test@example.com");
    expect(emailParams.subject).toBe("Verify your email");
    expect(emailParams.text).toContain("123456");
    expect(emailParams.html).toContain("123456");
  });

  it("returns 429 when requesting another code during cooldown", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
      name: "Test User",
      emailVerifiedAt: null,
    });

    mockDb.user.findUnique.mockResolvedValueOnce({
      id: "user_1",
      name: "Test User",
      email: "test@example.com",
      emailVerifiedAt: null,
    });

    mockCreateChallenge.mockRejectedValueOnce(
      Object.assign(
        new Error(
          "Please wait 60 seconds before requesting another code"
        ),
        { status: 429 }
      )
    );

    const response = await POST(makeRequest("10.0.0.3"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("Please wait 60 seconds");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});