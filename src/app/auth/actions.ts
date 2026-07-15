"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeInternalPath } from "@/lib/auth/redirect";
import {
  ACTIVE_WORKSPACE_COOKIE,
  ensureAuthenticatedWorkspace,
} from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export interface AuthActionState {
  status: "idle" | "error" | "check_email";
  message?: string;
}

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  next: z.string().optional(),
});

const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(120),
  workspaceName: z.string().trim().min(1).max(120),
});

async function requestOrigin(): Promise<string> {
  const config = getFeatureConfig();
  if (config.appUrl) return config.appUrl;
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin && /^https?:\/\//u.test(origin)) return new URL(origin).origin;
  return "http://localhost:3221";
}

async function rememberWorkspace(organizationId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: (await requestOrigin()).startsWith("https://"),
    path: "/app",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function signInAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and a password of at least 8 characters." };
  }
  if (getFeatureConfig().authMode !== "live") {
    return { status: "error", message: "Production sign-in is not configured." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: "Email or password is incorrect." };
  const organizationId = await ensureAuthenticatedWorkspace();
  await rememberWorkspace(organizationId);
  redirect(safeInternalPath(parsed.data.next));
}

export async function signUpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Complete every field and use a password of at least 8 characters." };
  }
  if (getFeatureConfig().authMode !== "live") {
    return { status: "error", message: "Production account creation is not configured." };
  }
  const next = safeInternalPath(parsed.data.next);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        display_name: parsed.data.displayName,
        workspace_name: parsed.data.workspaceName,
      },
    },
  });
  if (error) {
    return { status: "error", message: "The account could not be created. Check the details and try again." };
  }
  if (!data.session) {
    return { status: "check_email", message: "Check your email to confirm the account, then Museboard will create your workspace." };
  }
  const organizationId = await ensureAuthenticatedWorkspace({
    displayName: parsed.data.displayName,
    workspaceName: parsed.data.workspaceName,
  });
  await rememberWorkspace(organizationId);
  redirect(next);
}

export async function signOutAction(): Promise<void> {
  if (getFeatureConfig().authMode === "live") {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/app",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/login");
}
