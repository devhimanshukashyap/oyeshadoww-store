export type MiddlewareAction =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "json"; status: 401 | 403 };

export interface MiddlewareTokenLike {
  role?: string;
}

/**
 * The entire access-control decision tree for protected routes, as a pure
 * function: (pathname, token) -> what to do. Kept separate from
 * middleware.ts so it can be unit tested directly (see
 * tests/middleware-logic.test.ts) without needing to construct a real
 * NextRequest/NextResponse — see middleware.ts for why this exists as its
 * own function (the redirect-loop bug this fixed).
 */
export function resolveMiddlewareAction(pathname: string, token: MiddlewareTokenLike | null): MiddlewareAction {
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";

  // --- Admin API routes: JSON only, never a redirect ---
  if (pathname.startsWith("/api/admin")) {
    if (!isLoggedIn) return { type: "json", status: 401 };
    if (!isAdmin) return { type: "json", status: 403 };
    return { type: "next" };
  }

  // --- Admin login page: always reachable while logged out. Bounce an
  //     already-signed-in admin straight to the dashboard. ---
  if (pathname === "/admin/login") {
    if (isAdmin) return { type: "redirect", to: "/admin" };
    return { type: "next" };
  }

  // --- Every other /admin/* page requires an authenticated ADMIN session ---
  if (pathname.startsWith("/admin")) {
    if (!isAdmin) return { type: "redirect", to: "/admin/login" };
    return { type: "next" };
  }

  // --- Other protected API routes (my-purchases, download, account) ---
  if (pathname.startsWith("/api/")) {
    if (!isLoggedIn) return { type: "json", status: 401 };
    return { type: "next" };
  }

  // --- Customer-facing protected pages (/account, /purchases) ---
  if (!isLoggedIn) {
    return { type: "redirect", to: `/login?callbackUrl=${encodeURIComponent(pathname)}` };
  }

  return { type: "next" };
}
