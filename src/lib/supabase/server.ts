import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getFeatureConfig, requireLiveBillingConfig } from "@/lib/config/features";

export async function createClient() {
  const config = getFeatureConfig();
  if (!config.supabase.configured || !config.supabase.url || !config.supabase.publishableKey) {
    throw new Error("Supabase server auth is unavailable in the sample workspace");
  }
  const cookieStore = await cookies();
  return createServerClient(config.supabase.url, config.supabase.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  });
}

export function createAdminClient() {
  const config = requireLiveBillingConfig();
  return createSupabaseClient(config.supabase.url, config.supabase.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
