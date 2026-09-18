import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const verificationChallenge = {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const user = {
    update: vi.fn(),
  };

  const tx = {
    verificationChallenge,
    user,
  };

  return {
    db: {
      verificationChallenge,
      user,
      $transaction: vi.fn(async (operations: any[]) => {
        return Promise.all(operations);
      }),
    },
  };
});

import { db } from "@/lib/db";
import {
  createVerificationChallenge,
  verifyChallenge,
} from "@/lib/verification";

const mockDb = db as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createVerificationChallenge", () => {
  it("creates a 6-digit OTP and stores only its hash", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue(null);
    mockDb.verificationChallenge.updateMany.mockResolvedValue({ count: 0 });

    mockDb.verificationChallenge.create.mockImplementation(async ({ data }: any) => ({
      id: "challenge_1",
      ...data,
      expiresAt: data.expiresAt,
    }));

    const result = await createVerificationChallenge({
      userId: "user_1",
      type: "EMAIL",
      target: "Test@Example.com",
    });

    expect(result.challengeId).toBe("challenge_1");
    expect(result.code).toMatch(/^\d{6}$/);
    expect(result.expiresAt).toBeInstanceOf(Date);

    const createCall = mockDb.verificationChallenge.create.mock.calls[0][0];
    expect(createCall.data.target).toBe("test@example.com");
    expect(createCall.data.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createCall.data.codeHash).not.toBe(result.code);
  });

  it("rejects a resend during the cooldown window", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "recent_challenge",
    });

    await expect(
      createVerificationChallenge({
        userId: "user_1",
        type: "EMAIL",
        target: "test@example.com",
      })
    ).rejects.toThrow("Please wait 60 seconds");

    expect(mockDb.verificationChallenge.create).not.toHaveBeenCalled();
  });
});

describe("verifyChallenge", () => {
  it("rejects an invalid verification code and increments attempts", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_1",
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
      codeHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      usedAt: null,
    });

    mockDb.verificationChallenge.update.mockResolvedValue({
      attempts: 1,
    });

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_1",
      code: "123456",
    });

    expect(result).toEqual({
      success: false,
      reason: "INVALID",
    });

    expect(mockDb.verificationChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge_1" },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
  });

  it("rejects an expired challenge", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_1",
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
      codeHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      usedAt: null,
    });

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_1",
      code: "123456",
    });

    expect(result).toEqual({
      success: false,
      reason: "EXPIRED",
    });

    expect(mockDb.verificationChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects an already-used challenge", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_1",
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
      codeHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      usedAt: new Date(),
    });

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_1",
      code: "123456",
    });

    expect(result).toEqual({
      success: false,
      reason: "ALREADY_USED",
    });

    expect(mockDb.verificationChallenge.update).not.toHaveBeenCalled();
  });

  it("rejects a challenge after too many attempts", async () => {
    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_1",
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
      codeHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 5,
      usedAt: null,
    });

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_1",
      code: "123456",
    });

    expect(result).toEqual({
      success: false,
      reason: "TOO_MANY_ATTEMPTS",
    });

    expect(mockDb.verificationChallenge.update).not.toHaveBeenCalled();
  });

  it("verifies the correct OTP and marks the email as verified", async () => {
    const code = "123456";
    const crypto = await import("crypto");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_1",
      userId: "user_1",
      type: "EMAIL",
      target: "test@example.com",
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      usedAt: null,
    });

    mockDb.verificationChallenge.update.mockResolvedValue({});
    mockDb.user.update.mockResolvedValue({});

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_1",
      code,
    });

    expect(result).toEqual({
      success: true,
      type: "EMAIL",
      target: "test@example.com",
    });

    expect(mockDb.verificationChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge_1" },
      data: { usedAt: expect.any(Date) },
    });

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it("marks the phone as verified for a successful PHONE challenge", async () => {
    const code = "654321";
    const crypto = await import("crypto");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    mockDb.verificationChallenge.findFirst.mockResolvedValue({
      id: "challenge_2",
      userId: "user_1",
      type: "PHONE",
      target: "9876543210",
      codeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      usedAt: null,
    });

    mockDb.verificationChallenge.update.mockResolvedValue({});
    mockDb.user.update.mockResolvedValue({});

    const result = await verifyChallenge({
      userId: "user_1",
      challengeId: "challenge_2",
      code,
    });

    expect(result).toEqual({
      success: true,
      type: "PHONE",
      target: "9876543210",
    });

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { phoneVerifiedAt: expect.any(Date) },
    });
  });
});