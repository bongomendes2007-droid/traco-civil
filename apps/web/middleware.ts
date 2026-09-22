import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("traco_token")?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  // Flag de sessão expirada (set pelo handleSessionExpired em lib/api.ts):
  // o logout backend está zerando o cookie, mas ele ainda viaja neste request.
  // Se rebater /login → /dashboard aqui, o 401 seguinte re-redireciona → loop.
  const isExpiredFlow = request.nextUrl.searchParams.get("expired") === "1";
  const isProtectedRoute = ["/dashboard", "/plantas", "/projetos", "/analises", "/orcamentos", "/upload", "/configuracoes"].some(
    (route) => request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && token && !isExpiredFlow) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/plantas/:path*", "/projetos/:path*", "/analises/:path*", "/orcamentos/:path*", "/upload/:path*", "/configuracoes/:path*", "/login"],
};