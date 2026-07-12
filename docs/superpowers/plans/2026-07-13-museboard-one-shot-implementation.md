# Museboard One-Shot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a sellable, responsive Museboard creator operating system that completes onboarding → opportunity → hook → plan → collaboration → export → publish receipt → learning, with habit-forming free use and paid service boundaries.

**Architecture:** A Next.js 16 App Router application uses focused domain modules for deterministic creator workflows and a persistent Zustand demo adapter for credential-free local use. Supabase/Stripe adapters and migrations provide production boundaries, while provider interfaces keep live opportunities and AI distinct from explicitly labeled sample/curated data.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 7.0.2, Tailwind CSS 4.3.2, Zustand, Zod, Supabase JS 2.110.2, Stripe 22.3.1, Three.js 0.185.1, React Three Fiber 9.6.1, JSZip, PapaParse, Vitest, Testing Library, Playwright, axe-core, pnpm 10.

## Global Constraints

- Canonical visuals: `docs/design/museboard-approved-today-light.png` and `docs/design/museboard-approved-today-dark.png`.
- Light, dark, and system themes must persist without first-paint flash.
- Three.js is lazy, pausable, `aria-hidden`, optional, and never blocks product interaction.
- Demo data must say `Sample workspace · not live`; no fake social connection, live trend, checkout, or publish success.
- P0 platforms: Instagram Reels, TikTok video, and YouTube Shorts.
- P0 launch archetypes: music, tech/education, and lifestyle/business.
- Free manual planning remains usable without a card; successful provider services are quota-metered.
- Every external result stores provenance; every learning shows metric definition, sample size, and deterministic confidence.
- Desktop, mobile, keyboard, reduced-motion, WebGL-fallback, loading, empty, error, and recovery paths are required.
- Preserve the approved warm editorial identity, 4px spacing base, 44×44px targets, and 14–16px product body text.
- Use semantic DOM and WCAG 2.2 AA contrast in both themes.

---

## File structure

```text
src/
  app/
    (marketing)/page.tsx
    pricing/page.tsx
    login/page.tsx
    signup/page.tsx
    onboarding/page.tsx
    app/layout.tsx
    app/today/page.tsx
    app/opportunities/page.tsx
    app/opportunities/ideas/page.tsx
    app/opportunities/vision/page.tsx
    app/create/[contentId]/page.tsx
    app/plan/page.tsx
    app/learn/page.tsx
    app/team/page.tsx
    app/settings/billing/page.tsx
    api/billing/checkout/route.ts
    api/billing/portal/route.ts
    api/stripe/webhook/route.ts
    api/export/[contentId]/route.ts
    globals.css
    layout.tsx
  components/
    app-shell/
    marketing/
    onboarding/
    today/
    opportunities/
    workshop/
    planner/
    collaboration/
    learn/
    billing/
    ui/
  domain/
    schema.ts
    workflow.ts
    planner.ts
    opportunities.ts
    entitlements.ts
    analytics.ts
    export.ts
  lib/
    demo/fixtures.ts
    store/museboard-store.ts
    providers/strategist.ts
    providers/opportunities.ts
    supabase/client.ts
    supabase/server.ts
    stripe/server.ts
  styles/tokens.css
supabase/migrations/0001_museboard.sql
tests/unit/
tests/integration/
tests/e2e/
public/assets/
```

---

### Task 1: Foundation, toolchain, and design tokens

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/styles/tokens.css`
- Create: `src/components/ui/theme-provider.tsx`, `src/components/ui/theme-toggle.tsx`
- Test: `tests/unit/theme.test.tsx`

**Interfaces:**
- Produces: `ThemeProvider`, `ThemeToggle`, semantic CSS tokens, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.

- [ ] **Step 1: Scaffold the pinned Next.js application and install runtime/test dependencies**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Write the failing theme test**

```tsx
it("persists an explicit dark preference", async () => {
  render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
  await userEvent.click(screen.getByRole("button", { name: /theme/i }));
  await userEvent.click(screen.getByRole("menuitemradio", { name: /dark/i }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("museboard-theme")).toBe("dark");
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/theme.test.tsx`

Expected: FAIL because theme modules do not exist.

- [ ] **Step 4: Implement no-flash theme bootstrapping and semantic tokens**

```ts
export type ThemePreference = "light" | "dark" | "system";

export function resolveTheme(preference: ThemePreference, darkSystem: boolean) {
  return preference === "system" ? (darkSystem ? "dark" : "light") : preference;
}
```

The root layout injects a pre-hydration script that reads `museboard-theme`, resolves system preference, and sets `data-theme` before paint. Tokens define background, surface, ink, muted, coral, cobalt, sage, butter, border, focus, success, warning, and danger for both themes.

- [ ] **Step 5: Run theme, type, lint, and build checks**

Run: `pnpm vitest run tests/unit/theme.test.tsx && pnpm typecheck && pnpm lint && pnpm build`

Expected: all pass.

- [ ] **Step 6: Commit foundation**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts playwright.config.ts src tests/unit/theme.test.tsx
git commit -m "feat: scaffold Museboard foundation"
```

---

### Task 2: Domain contracts, deterministic fixtures, and persistent store

**Files:**
- Create: `src/domain/schema.ts`, `src/domain/workflow.ts`, `src/domain/planner.ts`, `src/domain/opportunities.ts`, `src/domain/entitlements.ts`, `src/domain/analytics.ts`, `src/domain/export.ts`
- Create: `src/lib/demo/fixtures.ts`, `src/lib/store/museboard-store.ts`
- Test: `tests/unit/workflow.test.ts`, `tests/unit/planner.test.ts`, `tests/unit/entitlements.test.ts`, `tests/unit/analytics.test.ts`

**Interfaces:**
- Produces: `MuseboardState`, `ContentItem`, `WorkflowStage`, `transitionStage`, `planWeek`, `checkEntitlement`, `deriveLearnings`, `buildExportManifest`.

- [ ] **Step 1: Write failing domain tests for version-bound workflow and planner capacity**

```ts
expect(transitionStage(approvedItem, { type: "EDIT", field: "hook", value: "New" }).approval?.status)
  .toBe("stale");
expect(planWeek({ capacityMinutes: 300, tasks }).scheduledMinutes).toBeLessThanOrEqual(240);
```

- [ ] **Step 2: Write failing entitlement and learning tests**

```ts
expect(checkEntitlement(freeUsage, "strategist_pack")).toEqual({ allowed: false, resetAt });
expect(deriveLearnings(sparseMetrics)).toEqual([]);
expect(deriveLearnings(stableTenByTen)[0].confidence).toBe("high");
```

- [ ] **Step 3: Verify RED**

Run: `pnpm vitest run tests/unit/workflow.test.ts tests/unit/planner.test.ts tests/unit/entitlements.test.ts tests/unit/analytics.test.ts`

Expected: FAIL because domain modules do not exist.

- [ ] **Step 4: Implement exact domain types and pure rules**

```ts
export type WorkflowStage = "signal" | "angle" | "hook" | "outline" | "script" |
  "shoot" | "review" | "ready" | "published" | "measured" | "archived";

export interface ContentVersion {
  id: string;
  contentId: string;
  number: number;
  angle: string;
  selectedHookId?: string;
  script: string;
  createdAt: string;
}

export interface Learning {
  id: string;
  metricKey: string;
  statement: string;
  sampleSize: number;
  confidence: "low" | "medium" | "high";
  includedContentIds: string[];
  dismissedAt?: string;
}
```

Use immutable updates, 15-minute planner increments, 80% default load, deterministic ranking weights, transactional-style quota reservations, and no cross-platform metric merging.

- [ ] **Step 5: Implement persistent demo store with schema versioning**

The Zustand store persists to `museboard-demo-v1`, exposes `resetDemo`, `completeOnboarding`, `selectOpportunity`, `chooseHook`, `moveTask`, `addComment`, `approveVersion`, `createExport`, `recordPublishReceipt`, `importMetrics`, `dismissLearning`, and clearly stores `dataMode: "sample" | "curated" | "live"`.

- [ ] **Step 6: Run domain tests**

Run: `pnpm vitest run tests/unit && pnpm typecheck`

Expected: all pass.

- [ ] **Step 7: Commit domain layer**

```bash
git add src/domain src/lib/demo src/lib/store tests/unit
git commit -m "feat: add creator workflow domain"
```

---

### Task 3: Marketing, pricing, authentication shell, and onboarding

**Files:**
- Create: `src/app/(marketing)/page.tsx`, `src/app/pricing/page.tsx`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/onboarding/page.tsx`
- Create: `src/components/marketing/*`, `src/components/onboarding/onboarding-flow.tsx`
- Test: `tests/integration/onboarding.test.tsx`, `tests/e2e/activation.spec.ts`

**Interfaces:**
- Consumes: `completeOnboarding`, niche fixtures, entitlement copy.
- Produces: usable public acquisition flow and personalized starter workspace.

- [ ] **Step 1: Write failing onboarding integration test**

```tsx
it("creates a personalized starter workspace without connecting a social account", async () => {
  render(<OnboardingFlow />);
  await completeMusicCreatorFlow();
  expect(store.creator.archetypes).toContain("music");
  expect(store.opportunities).toHaveLength(5);
  expect(store.plannerEntries.length).toBeGreaterThan(0);
  expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/onboarding.test.tsx`

Expected: FAIL because UI does not exist.

- [ ] **Step 3: Implement public pages and freemium pricing**

Landing page copy centers one result: "Know what to make next." Pricing accurately shows Free, Creator $19, Pro $39, Studio $79 and exact service limits. The app offers `Try the sample workspace` without a card and never labels demo auth as production authentication.

- [ ] **Step 4: Implement progressive onboarding**

Use one-question sections for outcome, archetypes, audience, platforms/formats, capacity, voice, boundaries, and first hook. Resume from persisted step; allow all inferred fields to be edited. Account connection appears only after first value.

- [ ] **Step 5: Run onboarding tests and browser smoke**

Run: `pnpm vitest run tests/integration/onboarding.test.tsx && pnpm playwright test tests/e2e/activation.spec.ts --project=chromium`

Expected: activation completes and redirects to `/app/today`.

- [ ] **Step 6: Commit acquisition and onboarding**

```bash
git add src/app src/components/marketing src/components/onboarding tests/integration/onboarding.test.tsx tests/e2e/activation.spec.ts
git commit -m "feat: add creator activation flow"
```

---

### Task 4: App shell, approved Today screen, themes, and Three.js sculpture

**Files:**
- Create: `src/app/app/layout.tsx`, `src/app/app/today/page.tsx`
- Create: `src/components/app-shell/*`, `src/components/today/*`, `src/components/today/idea-sculpture.tsx`
- Create: `public/assets/idea-sculpture-fallback.webp`
- Test: `tests/integration/today.test.tsx`, `tests/e2e/today-visual.spec.ts`

**Interfaces:**
- Consumes: store selectors and workflow/planner rules.
- Produces: responsive navigation and the canonical daily decision surface.

- [ ] **Step 1: Write failing Today behavior tests**

```tsx
expect(screen.getByRole("heading", { name: /quiet return of imperfect creative work/i })).toBeVisible();
await user.click(screen.getByLabelText(/contrarian/i));
await user.click(screen.getByRole("button", { name: /choose a hook/i }));
expect(store.activeContent.workflowStage).toBe("outline");
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/today.test.tsx`

- [ ] **Step 3: Implement app shell and Today hierarchy**

Match the canonical light/dark references: editorial heading, concise rail, opportunity evidence, stage spine, hook choices, inline collaborators, right planner, audience-learning strip, real padding rhythm, and no card-grid flattening.

- [ ] **Step 4: Implement lazy Three.js enhancement**

`IdeaSculpture` renders woven tube curves with capped DPR, 30fps during interaction, visible pause, `IntersectionObserver`/visibility pause, full disposal, reduced-motion/save-data/static fallback, and semantic DOM labels outside the `aria-hidden` canvas.

- [ ] **Step 5: Run behavior, accessibility, and screenshot tests**

Run: `pnpm vitest run tests/integration/today.test.tsx && pnpm playwright test tests/e2e/today-visual.spec.ts --project=chromium`

Expected: light/dark 1440×1024 and mobile 390×844 screenshots render without overflow and primary actions work.

- [ ] **Step 6: Commit Today experience**

```bash
git add src/app/app src/components/app-shell src/components/today public/assets tests/integration/today.test.tsx tests/e2e/today-visual.spec.ts
git commit -m "feat: build Museboard daily workspace"
```

---

### Task 5: Opportunities, Idea Board, Vision Board, and craft guidance

**Files:**
- Create: `src/app/app/opportunities/page.tsx`, `src/app/app/opportunities/ideas/page.tsx`, `src/app/app/opportunities/vision/page.tsx`
- Create: `src/app/app/internal/opportunities/page.tsx`
- Create: `src/components/opportunities/*`, `src/lib/providers/opportunities.ts`
- Test: `tests/integration/opportunities.test.tsx`

**Interfaces:**
- Produces: `OpportunityProvider`, `rankOpportunity`, idea promotion, selected-reference IDs.

- [ ] **Step 1: Write failing integrity tests**

```tsx
expect(screen.getByText(/sample workspace · not live/i)).toBeVisible();
expect(screen.getByText(/fresh 3h ago/i)).toHaveAccessibleDescription(/source|observed/i);
expect(rankOpportunity(missingEvidence).score).not.toBeGreaterThan(95);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/opportunities.test.tsx`

- [ ] **Step 3: Implement three-view opportunity workspace**

For You exposes source, observed/expiry, geography, platform, factor breakdown, save/dismiss/shape. Idea Board groups by pillar/format/readiness/goal. Vision Board supports URL/file references, rights status, explicit selection for generation, removal, empty state, 2GB workspace quota, MIME/size/hash validation, duplicate reuse, and demo-safe upload previews.

The owner-only internal ingestion page accepts the exact curated-source contract, validates expiry/source class, previews how an opportunity will appear, and never ingests copied article/media bodies.

- [ ] **Step 4: Implement contextual craft guide drawer**

Seed 24 provenance-bearing micro-guides and show at most two guides matching active stage, platform, format, and creator stage.

- [ ] **Step 5: Test and commit**

Run: `pnpm vitest run tests/integration/opportunities.test.tsx && pnpm typecheck`

```bash
git add src/app/app/opportunities src/app/app/internal/opportunities src/components/opportunities src/lib/providers/opportunities.ts tests/integration/opportunities.test.tsx
git commit -m "feat: add creator opportunity boards"
```

---

### Task 6: Content workshop and workload-aware planner

**Files:**
- Create: `src/app/app/create/[contentId]/page.tsx`, `src/app/app/plan/page.tsx`
- Create: `src/components/workshop/*`, `src/components/planner/*`
- Create: `src/lib/providers/strategist.ts`
- Test: `tests/integration/workshop.test.tsx`, `tests/integration/planner.test.tsx`, `tests/e2e/create-plan.spec.ts`

**Interfaces:**
- Consumes: workflow versions, `planWeek`, craft guidance.
- Produces: stage edits, shot/asset plan, platform variants, accessible rescheduling.

- [ ] **Step 1: Write failing workflow and reschedule tests**

```tsx
await chooseHookAndAdvance();
expect(store.activeContent.versions).toHaveLength(2);
await moveTaskWithKeyboard("Record", "Friday");
expect(screen.getByText(/focused week/i)).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/workshop.test.tsx tests/integration/planner.test.tsx`

- [ ] **Step 3: Implement workshop stages**

Create focused editors for evidence, angle, hooks, outline, script, shoot plan, review, and ready state. Autosave, saved/error status, version history, source-required validation, voice rewrite explanation, and manual continuation all remain visible.

Implement `StrategistProvider.generatePack(request): Promise<StrategistResult>` with Zod input/output schemas, prompt/provider provenance, 25-second timeout, cancellation, deterministic sample fallback, quota reservation/release, no charge on failure, and a visible "How this was made" disclosure.

- [ ] **Step 4: Implement planner**

Desktop supports drag plus Move controls; mobile uses a date/time sheet. Show capacity, 80% buffer, recovery days, dependencies, overdue actions, workload explanation, undo, and timezone-safe display.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm vitest run tests/integration/workshop.test.tsx tests/integration/planner.test.tsx && pnpm playwright test tests/e2e/create-plan.spec.ts --project=chromium`

```bash
git add src/app/app/create src/app/app/plan src/components/workshop src/components/planner src/lib/providers/strategist.ts tests/integration tests/e2e/create-plan.spec.ts
git commit -m "feat: add workshop and creator planner"
```

---

### Task 7: Collaboration, comments, notifications, and approvals

**Files:**
- Create: `src/app/app/team/page.tsx`, `src/components/collaboration/*`
- Test: `tests/integration/collaboration.test.tsx`, `tests/e2e/team-review.spec.ts`

**Interfaces:**
- Consumes: memberships, stage assignments, content versions, entitlement checks.
- Produces: invite lifecycle, comment lifecycle, version-bound approval, notification inbox.

- [ ] **Step 1: Write failing stale-approval and seat-limit tests**

```tsx
await approveCurrentVersion();
await editHook("A later edit");
expect(screen.getByText(/approval needs review again/i)).toBeVisible();
expect(inviteMember(freePlan)).toEqual({ ok: false, reason: "seat_limit" });
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/collaboration.test.tsx`

- [ ] **Step 3: Implement team and contextual review UI**

Support sample invitations, pending/active/removed states, role labels, assignment, reviewer, comment resolve/reopen, mentions, exact notification destinations, stale approvals, ownership-transfer guard, and preserved authored history.

- [ ] **Step 4: Test and commit**

Run: `pnpm vitest run tests/integration/collaboration.test.tsx && pnpm playwright test tests/e2e/team-review.spec.ts --project=chromium`

```bash
git add src/app/app/team src/components/collaboration tests/integration/collaboration.test.tsx tests/e2e/team-review.spec.ts
git commit -m "feat: add creator team review"
```

---

### Task 8: Export, publish receipts, metrics import, and learnings

**Files:**
- Create: `src/app/api/export/[contentId]/route.ts`, `src/app/app/learn/page.tsx`
- Create: `src/components/learn/*`, `src/components/workshop/export-panel.tsx`
- Create: `tests/fixtures/exports/{instagram,tiktok,youtube}/`
- Test: `tests/integration/export.test.ts`, `tests/integration/analytics-import.test.tsx`, `tests/e2e/export-learning.spec.ts`

**Interfaces:**
- Consumes: `buildExportManifest`, content versions, platform variants, `deriveLearnings`.
- Produces: validated ZIP, immutable export record, publish receipt, CSV preview/import, inspectable learning.

- [ ] **Step 1: Write failing ZIP and analytics tests**

```ts
expect(zip.file("manifest.json")).toBeTruthy();
expect(manifest.files.every((file) => file.sha256)).toBe(true);
expect(importPreview.duplicates).toHaveLength(1);
expect(deriveLearnings(crossPlatformOnly)).toEqual([]);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/export.test.ts tests/integration/analytics-import.test.tsx`

- [ ] **Step 3: Implement platform package generation**

Generate exact contract files, SHA-256 manifest hashes, 500MB/250MB validation, unknown-rights exclusion, versioned filenames, desktop copy/download, mobile share fallback, outdated-export warning, and reference fixture packages.

- [ ] **Step 4: Implement receipts, imports, and learnings**

Support manual receipt validation, CSV mapping/preview/errors, duplicate Skip/Replace/Cancel, delete/recompute, platform-native metrics, included/excluded sample inspection, dismiss/restore, and low/medium/high deterministic confidence.

- [ ] **Step 5: Inspect a real export and commit**

Run: `pnpm vitest run tests/integration/export.test.ts tests/integration/analytics-import.test.tsx && pnpm playwright test tests/e2e/export-learning.spec.ts --project=chromium`

Open the generated ZIP, verify every file/hash, and attach inspection notes under `test-results/export-inspection.md`.

```bash
git add src/app/api/export src/app/app/learn src/components/learn src/components/workshop/export-panel.tsx tests
git commit -m "feat: add export and learning loop"
```

---

### Task 9: Supabase production boundary, Stripe billing, and entitlements

**Files:**
- Create: `supabase/migrations/0001_museboard.sql`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/stripe/server.ts`
- Create: `src/lib/auth/session.ts`, `src/app/auth/callback/route.ts`, `src/proxy.ts`
- Create: `src/lib/config/features.ts`
- Create: `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/portal/route.ts`, `src/app/api/stripe/webhook/route.ts`
- Create: `src/app/app/settings/billing/page.tsx`, `src/components/billing/*`
- Test: `tests/integration/rls-contract.test.ts`, `tests/integration/stripe-webhook.test.ts`, `tests/integration/billing-ui.test.tsx`

**Interfaces:**
- Produces: tenant schema/RLS, `createCheckoutSession`, `createPortalSession`, `projectStripeEntitlements`, demo billing adapter.

- [ ] **Step 1: Write failing webhook and entitlement tests**

```ts
expect(await handleStripeEvent(duplicateEvent)).toEqual({ duplicate: true });
expect(projectStripeEntitlements(cancelAtPeriodEnd).activeUntil).toBe(periodEnd);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm vitest run tests/integration/stripe-webhook.test.ts tests/integration/billing-ui.test.tsx`

- [ ] **Step 3: Implement schema and RLS migration**

Create the spec tables with `organization_id`, membership helpers, per-table RLS, private storage policies, immutable audit events, webhook uniqueness, usage reservation constraints, and no client access to provider secrets. Configured mode uses Supabase PKCE/cookie authentication through the callback route and server-validated session helpers; missing credentials use the visibly labeled sample session only. Feature flags independently gate strategist provider, live billing, collaboration, analytics import, and 3D with safe off states.

- [ ] **Step 4: Implement Stripe and safe demo billing**

Configured mode uses hosted Checkout/Portal, raw-body signature verification, duplicate/out-of-order handling, current-object fetch, and webhook-projected entitlements. Missing credentials render a visible Demo billing simulator that changes only sample state and cannot resemble a real charge.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm vitest run tests/integration/stripe-webhook.test.ts tests/integration/billing-ui.test.tsx tests/integration/rls-contract.test.ts && pnpm typecheck`

```bash
git add supabase src/lib/supabase src/lib/stripe src/lib/auth src/lib/config src/app/auth src/proxy.ts src/app/api/billing src/app/api/stripe src/app/app/settings/billing src/components/billing tests/integration
git commit -m "feat: add billing and production data boundaries"
```

---

### Task 10: Legal/support surfaces, hardening, and responsive accessibility

**Files:**
- Create: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/data-policy/page.tsx`
- Create: `src/app/app/settings/data/page.tsx`, `src/app/api/account/export/route.ts`, `src/app/api/account/delete/route.ts`
- Create: `src/app/app/internal/ops/page.tsx`
- Create: `src/components/ui/error-boundary.tsx`, `src/components/ui/empty-state.tsx`, `src/components/ui/loading-state.tsx`
- Modify: all primary routes and components
- Test: `tests/e2e/accessibility.spec.ts`, `tests/e2e/mobile.spec.ts`, `tests/e2e/recovery.spec.ts`

**Interfaces:**
- Produces: review-ready legal/support drafts clearly labeled pre-launch, recovery states, WCAG/mobile behavior, observability-safe error metadata.

- [ ] **Step 1: Write failing accessibility and recovery tests**

```ts
expect((await new AxeBuilder({ page }).analyze()).violations.filter(isSerious)).toEqual([]);
await page.setOffline(true);
await page.getByLabel("Quick capture").fill("Offline idea");
await expect(page.getByText(/saved on this device/i)).toBeVisible();
```

- [ ] **Step 2: Implement intentional state components and responsive polish**

Every route gets context-aware empty/loading/error/retry behavior. Mobile uses bottom navigation, vertical production checklist, touch move sheet, safe-area padding, and no horizontal overflow. Legal pages disclose demo/provider state, AI data use, cancellation behavior, deletion/export, rights, and support status without presenting unreviewed text as final legal advice.

Data settings provide inspectable account export and typed-confirmation deletion jobs with status/retry. The owner-only ops page shows redacted job/webhook state, safe idempotent replay controls, deletion/export SLA status, and no support impersonation or private content body.

- [ ] **Step 3: Run tests and commit**

Run: `pnpm playwright test tests/e2e/accessibility.spec.ts tests/e2e/mobile.spec.ts tests/e2e/recovery.spec.ts`

```bash
git add src/app/privacy src/app/terms src/app/data-policy src/app/app/settings/data src/app/app/internal/ops src/app/api/account src/components/ui src tests/e2e
git commit -m "feat: harden Museboard experience"
```

---

### Task 11: Full verification, visual QA, and final artifact handoff

**Files:**
- Modify: any defects found
- Create: `docs/verification/2026-07-13-museboard-release-evidence.md`
- Create: screenshots under `docs/verification/screenshots/`

**Interfaces:**
- Produces: fresh evidence for every acceptance fixture and an inspectable running app.

- [ ] **Step 1: Run all automated gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:e2e`

Expected: zero failures.

- [ ] **Step 2: Run the real browser workflow**

Use the browser at 1440×1024 and 390×844 for light/dark/system. Complete marketing → sample workspace → onboarding reset → opportunity → hook → planner move → comment/approval → export → receipt → metrics import → learning → billing limit.

- [ ] **Step 3: Compare visual output against canonical sources**

Place source and rendered Today screenshots together, inspect full resolution, fix hierarchy, spacing, typography, padding, borders, radius, theme, and overflow differences, then capture again.

- [ ] **Step 4: Inspect export and adverse cases**

Inspect ZIP contents/hashes. Test quota exhaustion, provider failure, sparse analytics, duplicate import, offline capture, WebGL disabled, reduced motion, 320px width, and keyboard-only flow.

- [ ] **Step 5: Write release evidence and final commit**

```bash
git add docs/verification src tests
git commit -m "test: verify Museboard release workflow"
```

The evidence document lists exact commands, results, screenshot paths, inspected artifact paths, external credential limitations, and next connector activation requirements.
