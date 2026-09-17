import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
}));

import { db } from "@/lib/db";
import { changeEmail, changePassword, AccountError } from "@/server/services/account.service";

const mockDb = db as any;

const existingUser = {
  id: "user_1",
  email: "old@example.com",
  passwordHash: "", // set per-test with a real bcrypt hash
};

beforeEach(async () => {
  vi.clearAllMocks();
  existingUser.passwordHash = await bcrypt.hash("correct-password", 10);
});

describe("changeEmail", () => {
  it("rejects when the current password is wrong", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(existingUser); // account lookup
    await expect(changeEmail("user_1", "new@example.com", "wrong-password")).rejects.toThrow(AccountError);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("rejects when the new email is already registered to someone else, without revealing that fact explicitly", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(existingUser) // account lookup
      .mockResolvedValueOnce({ id: "some_other_user" }); // email uniqueness check finds a clash

    let caught: any;
    try {
      await changeEmail("user_1", "taken@example.com", "correct-password");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AccountError);
    expect(caught.message.toLowerCase()).not.toContain("already registered");
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("updates the email when the password is correct and the new email is free", async () => {
    mockDb.user.findUnique
      .mockResolvedValueOnce(existingUser) // account lookup
      .mockResolvedValueOnce(null); // no clash
    mockDb.user.update.mockResolvedValue({});

    const result = await changeEmail("user_1", "New@Example.com", "correct-password");

    expect(result.email).toBe("new@example.com"); // normalized to lowercase
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { email: "new@example.com" },
    });
  });
});

describe("changePassword", () => {
  it("rejects when the current password is wrong", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(existingUser);
    await expect(changePassword("user_1", "wrong-password", "newStrongPass1")).rejects.toThrow(AccountError);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("updates the password hash and clears any login lockout when the current password is correct", async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(existingUser);
    mockDb.user.update.mockResolvedValue({});

    await changePassword("user_1", "correct-password", "newStrongPass1");

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { passwordHash: "hashed:newStrongPass1", failedLoginCount: 0, lockedUntil: null },
    });
  });
});
