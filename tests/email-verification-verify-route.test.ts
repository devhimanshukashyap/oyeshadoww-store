import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  requireUser: vi.fn(),
}));

vi.mock("@/lib/verification", () => ({
  verifyChallenge: vi.fn(),
}));

import { requireUser } from "@/lib/session";
import { verifyChallenge } from "@/lib/verification";
import { POST } from "../src/app/api/account/verification/email/verify/route";

const mockRequireUser = requireUser as any;
const mockVerifyChallenge = verifyChallenge as any;

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown, ip = "127.0.0.1") {
  return new Request(
    "http://localhost/api/account/verification/email/verify",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }
  ) as any;
}

describe("POST /api/account/verification/email/verify", () => {
  it("rejects unauthenticated requests", async () => {
    mockRequireUser.mockRejectedValueOnce(
      Object.assign(new Error("Authentication required"), { status: 401 })
    );

    const response = await POST(
      makeRequest({ challengeId: "challenge_1", code: "123456" })
    );

    expect(response.status).toBe(401);
    expect(mockVerifyChallenge).not.toHaveBeenCalled();
  });

  it("rejects a malformed verification code", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
    });

    const response = await POST(
      makeRequest({
        challengeId: "challenge_1",
        code: "12345",
      })
    );

    expect(response.status).toBe(400);
    expect(mockVerifyChallenge).not.toHaveBeenCalled();
  });

  it("returns a safe error when the OTP is invalid", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
    });

    mockVerifyChallenge.mockResolvedValueOnce({
      success: false,
      reason: "INVALID",
    });

    const response = await POST(
      makeRequest({
        challengeId: "challenge_1",
        code: "123456",
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid verification code.");
  });

  it("returns a safe error when the OTP has expired", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
    });

    mockVerifyChallenge.mockResolvedValueOnce({
      success: false,
      reason: "EXPIRED",
    });

    const response = await POST(
      makeRequest({
        challengeId: "challenge_1",
        code: "123456",
      })
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("expired");
  });

  it("verifies the OTP successfully", async () => {
    mockRequireUser.mockResolvedValueOnce({
      id: "user_1",
      email: "test@example.com",
    });

    mockVerifyChallenge.mockResolvedValueOnce({
      success: true,
      type: "EMAIL",
      target: "test@example.com",
    });

    const response = await POST(
      makeRequest({
        challengeId: "challenge_1",
        code: "123456",
      })
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      verified: true,
    });

    expect(mockVerifyChallenge).toHaveBeenCalledWith({
      userId: "user_1",
      challengeId: "challenge_1",
      code: "123456",
    });
  });
});