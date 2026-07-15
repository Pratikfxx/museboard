import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getFeatureConfig } from "@/lib/config/features";

export async function proxy(request: NextRequest) {
  const config = getFeatureConfig();
  const protectsOperations = request.nextUrl.pathname === "/app/internal/ops";
  const protectsWorkspace =
    request.nextUrl.pathname === "/app" || request.nextUrl.pathname.startsWith("/app/");
  if (!config.supabase.configured || !config.supabase.url || !config.supabase.publishableKey) {
    if (protectsOperations) {
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (protectsWorkspace && config.authMode === "unavailable") {
      return NextResponse.redirect(new URL("/login?error=configuration", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.supabase.url, config.supabase.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headersToSet)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (protectsOperations && (error || !data?.claims)) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (protectsWorkspace && (error || !data?.claims)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
