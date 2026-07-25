import { NextRequest, NextResponse } from "next/server";

const roleRoutes: Array<[string, string[]]> = [
  ["/admin", ["admin", "support"]],
  ["/dashboard", ["client", "estate_manager", "artisan"]],
  ["/client/dashboard", ["client","estate_manager"]],
  ["/artisan/dashboard", ["artisan"]],
  ["/jobs", ["client", "estate_manager", "artisan", "admin", "support"]],
  ["/post-job", ["client", "estate_manager"]],
  ["/contact-artisan", ["client", "estate_manager"]],
];

export function proxy(request: NextRequest) {
  const session = request.cookies.get("mafundi_session")?.value;
  const role = request.cookies.get("mafundi_role")?.value;
  const rule = roleRoutes.find(([prefix]) => request.nextUrl.pathname.startsWith(prefix));
  if (!rule) return NextResponse.next();
  if (!session) {
    const portal=request.nextUrl.pathname.startsWith("/admin")?"/operations/login":request.nextUrl.pathname.startsWith("/artisan")?"/artisan/login":"/client/login";
    const login = new URL(portal, request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (!role || !rule[1].includes(role)) return NextResponse.redirect(new URL("/unauthorized", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*", "/client/dashboard/:path*", "/artisan/dashboard/:path*", "/post-job/:path*", "/contact-artisan/:path*", "/jobs/:path*"] };
