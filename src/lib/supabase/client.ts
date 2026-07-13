"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Direct references are required so Next.js can inline browser-safe values.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) {
    throw new Error("Supabase browser auth is unavailable in the sample workspace");
  }
  return createBrowserClient(url, publishableKey);
}
