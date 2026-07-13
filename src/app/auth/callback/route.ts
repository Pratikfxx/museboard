import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/app/today";
  if (!code) return NextResponse.redirect(new URL("/login?error=callback", url.origin));

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(new URL(safeNext, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=callback", url.origin));
  }
}
