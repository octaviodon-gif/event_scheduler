// Next.js 16 name for middleware. On Next.js 15 or older, rename this file
// to middleware.ts and rename the export to `middleware`.
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((req) => {
  const isLogin = req.nextUrl.pathname === "/login";

  if (!req.auth && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (req.auth && isLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
