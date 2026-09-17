import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the max within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      const result = rateLimit(key, 5, 60);
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the request once the max is exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60);
    const blocked = rateLimit(key, 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks separate keys independently (e.g. per-user limits don't cross-contaminate)", () => {
    const keyA = `user-a-${Math.random()}`;
    const keyB = `user-b-${Math.random()}`;
    rateLimit(keyA, 1, 60);
    const blockedA = rateLimit(keyA, 1, 60);
    const allowedB = rateLimit(keyB, 1, 60);

    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});
