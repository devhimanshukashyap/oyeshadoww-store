import { describe, it, expect } from "vitest";
import { resolveMiddlewareAction } from "@/lib/middleware-logic";

describe("resolveMiddlewareAction — admin routes", () => {
  it("lets a logged-out visitor reach /admin/login (the redirect-loop regression test)", () => {
    const action = resolveMiddlewareAction("/admin/login", null);
    // Must NOT redirect to itself (or anywhere) — this exact case was the
    // infinite-redirect bug reported against the previous middleware.
    expect(action).toEqual({ type: "next" });
  });

  it("redirects a logged-out visitor away from /admin to /admin/login", () => {
    const action = resolveMiddlewareAction("/admin", null);
    expect(action).toEqual({ type: "redirect", to: "/admin/login" });
  });

  it("redirects a logged-out visitor away from a nested /admin/* route to /admin/login", () => {
    const action = resolveMiddlewareAction("/admin/products/123", null);
    expect(action).toEqual({ type: "redirect", to: "/admin/login" });
  });

  it("redirects a logged-in non-admin (customer) account away from /admin", () => {
    const action = resolveMiddlewareAction("/admin", { role: "CUSTOMER" });
    expect(action).toEqual({ type: "redirect", to: "/admin/login" });
  });

  it("lets an authenticated ADMIN through to /admin", () => {
    const action = resolveMiddlewareAction("/admin", { role: "ADMIN" });
    expect(action).toEqual({ type: "next" });
  });

  it("lets an authenticated ADMIN through to a nested /admin/* route", () => {
    const action = resolveMiddlewareAction("/admin/orders", { role: "ADMIN" });
    expect(action).toEqual({ type: "next" });
  });

  it("redirects an already-signed-in admin away from /admin/login to the dashboard", () => {
    const action = resolveMiddlewareAction("/admin/login", { role: "ADMIN" });
    expect(action).toEqual({ type: "redirect", to: "/admin" });
  });

  it("does NOT redirect a logged-in non-admin away from /admin/login (they should see the form and be told to use different credentials, not bounce silently)", () => {
    const action = resolveMiddlewareAction("/admin/login", { role: "CUSTOMER" });
    expect(action).toEqual({ type: "next" });
  });
});

describe("resolveMiddlewareAction — admin API routes", () => {
  it("returns 401 JSON (not a redirect) for an unauthenticated admin API request", () => {
    const action = resolveMiddlewareAction("/api/admin/products", null);
    expect(action).toEqual({ type: "json", status: 401 });
  });

  it("returns 403 JSON (not a redirect) for a logged-in non-admin calling an admin API route", () => {
    const action = resolveMiddlewareAction("/api/admin/products", { role: "CUSTOMER" });
    expect(action).toEqual({ type: "json", status: 403 });
  });

  it("allows an authenticated admin through to an admin API route", () => {
    const action = resolveMiddlewareAction("/api/admin/orders", { role: "ADMIN" });
    expect(action).toEqual({ type: "next" });
  });
});

describe("resolveMiddlewareAction — other protected API routes", () => {
  it("returns 401 JSON (not an HTML redirect) for unauthenticated /api/my-purchases — a fetch() caller needs JSON back", () => {
    const action = resolveMiddlewareAction("/api/my-purchases", null);
    expect(action).toEqual({ type: "json", status: 401 });
  });

  it("returns 401 JSON for unauthenticated /api/download/reel", () => {
    const action = resolveMiddlewareAction("/api/download/reel", null);
    expect(action).toEqual({ type: "json", status: 401 });
  });

  it("allows any logged-in user through to /api/my-purchases", () => {
    const action = resolveMiddlewareAction("/api/my-purchases", { role: "CUSTOMER" });
    expect(action).toEqual({ type: "next" });
  });
});

describe("resolveMiddlewareAction — customer-facing pages", () => {
  it("redirects a logged-out visitor from /purchases to /login with a callbackUrl", () => {
    const action = resolveMiddlewareAction("/purchases", null);
    expect(action).toEqual({ type: "redirect", to: "/login?callbackUrl=%2Fpurchases" });
  });

  it("redirects a logged-out visitor from /account to /login with a callbackUrl", () => {
    const action = resolveMiddlewareAction("/account", null);
    expect(action).toEqual({ type: "redirect", to: "/login?callbackUrl=%2Faccount" });
  });

  it("allows a logged-in customer through to /purchases and /account", () => {
    expect(resolveMiddlewareAction("/purchases", { role: "CUSTOMER" })).toEqual({ type: "next" });
    expect(resolveMiddlewareAction("/account", { role: "CUSTOMER" })).toEqual({ type: "next" });
  });

  it("a logged-out user who just logged out again is treated identically to a never-logged-in visitor", () => {
    // No special "post-logout" state exists — token is simply null, same
    // as any other unauthenticated request.
    const action = resolveMiddlewareAction("/admin", null);
    expect(action).toEqual({ type: "redirect", to: "/admin/login" });
  });
});
