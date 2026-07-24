import { NextRequest, NextResponse } from "next/server";

const roleRoutes: Array<[string, string[]]> = [
  ["/admin", ["admin", "support"]],
  ["/dashboard", ["artisan"]],
  ["/post-job", ["client", "estate_manager"]],
];

export function proxy(request: NextRequest) {
  const session = request.cookies.get("mafundi_session")?.value;
  const role = request.cookies.get("mafundi_role")?.value;
  const rule = roleRoutes.find(([prefix]) => request.nextUrl.pathname.startsWith(prefix));
  if (!rule) return NextResponse.next();
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (!role || !rule[1].includes(role)) return NextResponse.redirect(new URL("/unauthorized", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*", "/post-job/:path*"] };
