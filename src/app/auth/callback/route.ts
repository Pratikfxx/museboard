import { NextResponse } from "next/server";

import { safeInternalPath } from "@/lib/auth/redirect";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ensureAuthenticatedWorkspace,
} from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeNext = safeInternalPath(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data } = await supabase.auth.getUser();
    const metadata = data.user?.user_metadata as Record<string, unknown> | undefined;
    const organizationId = await ensureAuthenticatedWorkspace({
      displayName:
        typeof metadata?.display_name === "string" ? metadata.display_name : undefined,
      workspaceName:
        typeof metadata?.workspace_name === "string" ? metadata.workspace_name : undefined,
    });
    const response = NextResponse.redirect(new URL(safeNext, url.origin));
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/app",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }
}
