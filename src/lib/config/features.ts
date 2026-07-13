import { z } from "zod";

const httpsUrl = z.url().refine((value) => new URL(value).protocol === "https:");

export type BillingMode = "demo" | "live" | "unavailable";

export interface FeatureConfig {
  supabase: {
    configured: boolean;
    url?: string;
    publishableKey?: string;
    secretKey?: string;
  };
  stripe: {
    configured: boolean;
    secretKey?: string;
    webhookSecret?: string;
    priceIds: Partial<Record<"creator" | "pro" | "studio", string>>;
  };
  appUrl?: string;
  billingMode: BillingMode;
  unavailableReason?: string;
  features: {
    strategist: boolean;
    liveBilling: boolean;
    collaboration: boolean;
    analyticsImport: boolean;
    threeDimensional: boolean;
  };
}

function present(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (!present(value)) return fallback;
  return value === "1" || value.toLocaleLowerCase() === "true";
}

export function getFeatureConfig(
  env: Record<string, string | undefined> = process.env,
): FeatureConfig {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseClientConfigured = present(url) && present(publishableKey);
  const supabaseServerConfigured = supabaseClientConfigured && present(secretKey);

  const priceIds = {
    creator: env.STRIPE_PRICE_CREATOR,
    pro: env.STRIPE_PRICE_PRO,
    studio: env.STRIPE_PRICE_STUDIO,
  };
  const completePrices = Object.values(priceIds).every(present);
  const stripeConfigured =
    present(env.STRIPE_SECRET_KEY) &&
    present(env.STRIPE_WEBHOOK_SECRET) &&
    completePrices;
  const parsedAppUrl = httpsUrl.safeParse(env.NEXT_PUBLIC_APP_URL);
  const hasAnyProductionSetting = [
    url,
    publishableKey,
    secretKey,
    env.STRIPE_SECRET_KEY,
    env.STRIPE_WEBHOOK_SECRET,
    ...Object.values(priceIds),
    env.NEXT_PUBLIC_APP_URL,
  ].some(present);

  const liveReady = supabaseServerConfigured && stripeConfigured && parsedAppUrl.success;
  const billingMode: BillingMode = liveReady
    ? "live"
    : hasAnyProductionSetting
      ? "unavailable"
      : "demo";

  return {
    supabase: {
      configured: supabaseClientConfigured,
      url: present(url) ? url : undefined,
      publishableKey: present(publishableKey) ? publishableKey : undefined,
      secretKey: present(secretKey) ? secretKey : undefined,
    },
    stripe: {
      configured: stripeConfigured,
      secretKey: present(env.STRIPE_SECRET_KEY) ? env.STRIPE_SECRET_KEY : undefined,
      webhookSecret: present(env.STRIPE_WEBHOOK_SECRET)
        ? env.STRIPE_WEBHOOK_SECRET
        : undefined,
      priceIds,
    },
    appUrl: parsedAppUrl.success ? parsedAppUrl.data.replace(/\/$/u, "") : undefined,
    billingMode,
    unavailableReason:
      billingMode === "unavailable"
        ? "Live billing is not fully configured. No checkout or account changes are available."
        : undefined,
    features: {
      strategist: flag(env.FEATURE_STRATEGIST, true),
      liveBilling: liveReady && flag(env.FEATURE_LIVE_BILLING, true),
      collaboration: flag(env.FEATURE_COLLABORATION, true),
      analyticsImport: flag(env.FEATURE_ANALYTICS_IMPORT, true),
      threeDimensional: flag(env.FEATURE_3D, true),
    },
  };
}

export function requireLiveBillingConfig(): FeatureConfig & {
  appUrl: string;
  supabase: FeatureConfig["supabase"] & {
    url: string;
    publishableKey: string;
    secretKey: string;
  };
  stripe: FeatureConfig["stripe"] & {
    secretKey: string;
    webhookSecret: string;
    priceIds: Record<"creator" | "pro" | "studio", string>;
  };
} {
  const config = getFeatureConfig();
  if (config.billingMode !== "live" || !config.features.liveBilling) {
    throw new Error("Live billing is unavailable");
  }
  return config as ReturnType<typeof requireLiveBillingConfig>;
}
