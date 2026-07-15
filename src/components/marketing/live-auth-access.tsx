"use client";

import { ArrowRight, CheckCircle, LockSimple, Sparkle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState } from "react";

import {
  signInAction,
  signUpAction,
  type AuthActionState,
} from "@/app/auth/actions";
import { MarketingShell } from "@/components/marketing/marketing-shell";

const initialState: AuthActionState = { status: "idle" };

export function LiveAuthAccess({
  mode,
  next,
}: {
  mode: "login" | "signup";
  next: string;
}) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState(
    isLogin ? signInAction : signUpAction,
    initialState,
  );

  return (
    <MarketingShell accountMode="live">
      <main className="px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-surface shadow-xl lg:grid-cols-[1fr_1.05fr]">
          <section className="order-2 bg-sage/20 p-7 sm:p-10 lg:order-1 lg:p-12">
            <Sparkle aria-hidden="true" className="text-coral" size={32} weight="fill" />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-coral">
              Your secure account foundation
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Keep the thinking, not just the post.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-muted">
              Your organization, membership, and plan follow your account. Creator drafts remain on this device while cloud content sync is being enabled.
            </p>
            <ul className="mt-8 space-y-3 text-sm font-semibold">
              <li>Verified organization and owner access</li>
              <li>Server-confirmed plan and billing access</li>
              <li>A sample path remains available without a card</li>
            </ul>
          </section>

          <section className="order-1 p-7 sm:p-10 lg:order-2 lg:p-12" aria-labelledby="access-heading">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/35 bg-sage/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-success">
              <LockSimple aria-hidden="true" size={16} />
              Secure account access
            </div>
            <h1 className="mt-6 font-display text-4xl sm:text-5xl" id="access-heading">
              {isLogin ? "Welcome back" : "Create your workspace"}
            </h1>
            <p className="mt-4 leading-7 text-muted">
              {isLogin
                ? "Sign in to the organization and subscription attached to your account."
                : "Start free. Museboard creates the organization after your account is verified; no card is required."}
            </p>

            <form action={action} className="mt-7 grid gap-4">
              <input name="next" type="hidden" value={next} />
              {!isLogin ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold">
                    Creator name
                    <input
                      autoComplete="name"
                      className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal"
                      maxLength={120}
                      name="displayName"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold">
                    Workspace name
                    <input
                      className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal"
                      maxLength={120}
                      name="workspaceName"
                      placeholder="Maya's studio"
                      required
                    />
                  </label>
                </div>
              ) : null}
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input
                  autoComplete="email"
                  className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal"
                  name="email"
                  required
                  type="email"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Password
                <input
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="min-h-12 rounded-xl border border-border bg-background px-4 font-normal"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <button
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-background transition hover:bg-coral disabled:cursor-wait disabled:opacity-60"
                disabled={pending || state.status === "check_email"}
                type="submit"
              >
                {pending ? "Securing your workspace…" : isLogin ? "Sign in" : "Create free workspace"}
                <ArrowRight aria-hidden="true" size={18} weight="bold" />
              </button>
            </form>

            {state.message ? (
              <p
                className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${state.status === "error" ? "border-coral/35 bg-coral/5 text-coral" : "border-success/35 bg-sage/15 text-success"}`}
                role={state.status === "error" ? "alert" : "status"}
              >
                {state.status === "check_email" ? <CheckCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} /> : null}
                {state.message}
              </p>
            ) : null}

            <div className="mt-8 grid gap-3 border-t border-border pt-6 text-sm text-muted sm:grid-cols-2">
              <p>
                {isLogin ? "New here?" : "Already have an account?"}{" "}
                <Link className="font-bold text-cobalt underline-offset-4 hover:underline" href={isLogin ? "/signup" : "/login"}>
                  {isLogin ? "Create a workspace" : "Sign in"}
                </Link>
              </p>
              <p className="sm:text-right">
                Not ready?{" "}
                <Link className="font-bold text-cobalt underline-offset-4 hover:underline" href="/onboarding">
                  Try the local sample
                </Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}
