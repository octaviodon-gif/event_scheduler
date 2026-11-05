// Next.js 16 name for middleware. On Next.js 15 or older, rename this file
// to middleware.ts and rename the export to `middleware`.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const path = req.nextUrl.pathname;
  const isLogin = path === "/login";
  // Public pages Google needs for the sign-in screen (homepage and privacy policy)
  const isPublic = path === "/about" || path === "/privacy";

  if (isPublic) return;

  if (!req.auth && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (req.auth && isLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
