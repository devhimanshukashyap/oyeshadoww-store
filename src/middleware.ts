import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { resolveMiddlewareAction } from "@/lib/middleware-logic";

/**
 * Route protection. The actual decision logic lives in
 * `src/lib/middleware-logic.ts` (`resolveMiddlewareAction`) as a plain,
 * unit-tested function — this file is only the thin adapter that wires
 * that decision into Next.js's request/response types.
 *
 * IMPORTANT DESIGN NOTE (read before changing this file):
 * next-auth's `withAuth` has a built-in behavior where, if
 * `callbacks.authorized()` returns false, it automatically redirects to a
 * single global `pages.signIn` page. That built-in auto-redirect is NOT
 * used here (`authorized` always returns `true`, below) because this app
 * needs *different* redirect targets depending on the route (admin pages
 * -> /admin/login, customer pages -> /login) and needs plain 401/403 JSON
 * — never an HTML redirect — for API routes. Relying on the built-in
 * auto-redirect previously caused two bugs: (1) an infinite redirect loop
 * on /admin/login (the inner middleware function treated /admin/login as
 * a protected admin route and redirected it to itself), and (2)
 * unauthenticated visits to other /admin/* routes were sent to the
 * customer /login page instead of /admin/login, since `pages.signIn` is a
 * single global setting. Routing every request through
 * `resolveMiddlewareAction` makes both bugs structurally impossible to
 * reintroduce by accident — see tests/middleware-logic.test.ts, which
 * exercises exactly the scenarios above.
 *
 * This is layer one of two. Every /api/admin/* route and every admin page
 * additionally calls requireAdmin() server-side (see src/lib/session.ts)
 * — middleware is a fast UX-oriented redirect layer, never the sole
 * authorization check for an API route.
 */
export default withAuth(
  function middleware(req) {
    const action = resolveMiddlewareAction(req.nextUrl.pathname, req.nextauth.token);

    switch (action.type) {
      case "redirect":
        return NextResponse.redirect(new URL(action.to, req.url));
      case "json":
        return NextResponse.json(
          { error: action.status === 401 ? "Authentication required" : "Forbidden" },
          { status: action.status }
        );
      case "next":
      default:
        return NextResponse.next();
    }
  },
  {
    callbacks: {
      // Always let the request through to the function above — see the
      // design note at the top of this file for why.
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/account/:path*",
    "/purchases/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/my-purchases/:path*",
    "/api/download/:path*",
    "/api/account/:path*",
  ],
};
