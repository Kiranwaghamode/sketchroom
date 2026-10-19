import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

// Next.js 16 renamed middleware.ts to proxy.ts. It runs on the Node.js runtime,
// so we can validate the session against the database (not just check a cookie).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!isAuthPage && !session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/dashboard/:path*",
    "/board/:path*",
    "/doc/:path*",
    "/join/:path*",
  ],
};
