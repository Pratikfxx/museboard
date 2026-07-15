# Museboard Creator Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Museboard's existing signal, creation, planning, learning, and collaboration tools into one persistent creator-intelligence loop that helps a creator decide what to make next, explains why, and gets smarter from their work.

**Architecture:** Add a focused `creator-intelligence` domain module for experiments, series, creator memory, adaptive feedback, and next-action recommendations. Persist those records through the existing Zustand store with backward-compatible defaults and explicit recovery notices. Present the same loop progressively across Today, Opportunities, Plan, Learn, Team, and the global app shell rather than adding another top-level destination.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zustand persistence, Zod, Vitest/Testing Library, Playwright, CSS Modules.

## Global Constraints

- Preserve Museboard's warm editorial identity, Instrument Serif/Manrope hierarchy, restrained palette, and existing navigation.
- Keep the sample workspace truthful: no live-data, cloud-sync, email-delivery, publishing, or AI-provider claims without a configured provider.
- Free manual planning remains unlimited; monetization gates live signals, deeper memory, multi-platform intelligence, and collaboration outcomes rather than basic planning.
- Every recommendation must expose why it was chosen, the supporting evidence or learning, and a clear next action; never promise virality.
- New persisted fields must migrate legacy `museboard-demo-v1` payloads safely and must never silently discard recoverable local work.
- Mobile controls must have 44px practical touch targets, app copy must be at least 12px, and all new dialogs/sheets must trap and restore focus.
- No new production dependency unless the existing stack cannot provide the behavior.

---

### Task 1: Creator intelligence domain and store contract

**Files:**
- Create: `src/domain/creator-intelligence.ts`
- Modify: `src/domain/schema.ts`
- Modify: `src/domain/opportunities.ts`
- Modify: `src/lib/demo/fixtures.ts`
- Modify: `src/lib/demo/starter-workspace.ts`
- Modify: `src/lib/store/museboard-store.ts`
- Test: `tests/unit/creator-intelligence.test.ts`
- Test: `tests/unit/store.test.ts`

**Interfaces:**
- Produces `ContentHypothesis`, `ContentSeries`, `CreatorMemory`, `OpportunityFeedback`, `OfflineCapture`, `WorkspaceRecoveryNotice`, and `CreatorNextAction` Zod-backed types.
- Produces `recommendNextCreatorAction(state, at)` that favors a current non-dismissed learning, then an unfinished series item, then the highest-ranked compatible opportunity.
- Store actions: `createSeries`, `addContentToSeries`, `setContentHypothesis`, `recordOpportunityFeedback`, `updateCreatorMemory`, `captureIdea`, `dismissCapture`, `promoteCapture`, and `clearRecoveryNotice`.

- [ ] Write failing domain tests proving a learning-backed recommendation beats a generic opportunity, dismissed learnings are ignored, series work is capacity-aware, and opportunity feedback changes fit ordering without mutating source evidence.
- [ ] Run `pnpm test tests/unit/creator-intelligence.test.ts` and confirm failures are caused by missing domain APIs.
- [ ] Implement the Zod-backed domain types and deterministic recommendation/ranking functions with explicit reason/evidence fields.
- [ ] Run the focused test and confirm it passes.
- [ ] Write failing store tests for persisted experiments, series, creator memory, feedback, offline capture promotion, and legacy defaults.
- [ ] Run `pnpm test tests/unit/store.test.ts` and confirm the new assertions fail.
- [ ] Extend fixtures, starter workspace, persistence schema, store actions, and upgrade path with safe defaults.
- [ ] Run both focused suites and confirm they pass.

### Task 2: Recovery and global workspace controls

**Files:**
- Create: `src/components/recovery/recovery-center.tsx`
- Create: `src/components/recovery/recovery-center.module.css`
- Modify: `src/lib/store/museboard-store.ts`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/app-shell/app-shell.module.css`
- Modify: `src/components/today/today-workspace.tsx`
- Modify: `src/components/today/today-workspace.module.css`
- Test: `tests/unit/store.test.ts`
- Test: `tests/integration/app-shell.test.tsx`
- Test: `tests/e2e/recovery.spec.ts`

**Interfaces:**
- The persisted storage adapter records a `WorkspaceRecoveryNotice` when JSON is corrupt or schema validation fails, keeps a bounded raw backup under `museboard-recovery-backup-v1`, and exposes recovery/export/reset choices without silently overwriting the backup.
- The app shell owns a global theme control on desktop and inside Mobile More.
- Today writes quick captures through the main store and shows a recoverable inbox with promote, copy, and dismiss actions.

- [ ] Add failing persistence and UI tests for corrupt-state notice, backup preservation, queued capture visibility after reload, capture promotion, and mobile theme access.
- [ ] Run the focused unit/integration/E2E tests and confirm the new checks fail for the intended reasons.
- [ ] Implement recovery metadata, the recovery center, store-backed captures, and global theme controls.
- [ ] Re-run the focused suites until green.

### Task 3: Close the loop across Today, Opportunities, Plan, and Learn

**Files:**
- Create: `src/components/intelligence/next-action-card.tsx`
- Create: `src/components/intelligence/next-action-card.module.css`
- Modify: `src/components/today/today-workspace.tsx`
- Modify: `src/components/today/today-workspace.module.css`
- Modify: `src/components/opportunities/opportunities-workspace.tsx`
- Modify: `src/components/opportunities/opportunities.module.css`
- Modify: `src/components/planner/planner-workspace.tsx`
- Modify: `src/components/planner/planner.module.css`
- Modify: `src/components/learn/learn-workspace.tsx`
- Modify: `src/components/learn/learn.module.css`
- Test: `tests/integration/today.test.tsx`
- Test: `tests/integration/opportunities.test.tsx`
- Test: `tests/integration/planner.test.tsx`
- Test: `tests/integration/analytics-import.test.ts`
- Test: `tests/e2e/export-learning.spec.ts`

**Interfaces:**
- Today renders one `CreatorNextAction` with a reason, evidence label, confidence, and destination CTA.
- Opportunities supports `More like this` and `Not for me`, explains score changes, collapses secondary metadata on mobile, and preserves provenance.
- Plan groups tasks by series, keeps all seven days discoverable at 1440px, and exposes series progress without hiding capacity.
- Learn leads with plain-language patterns and a `Use this in my next post` action; CSV tooling moves behind progressive disclosure.

- [ ] Add failing UI tests for learning-to-Today recommendation, opportunity feedback, series creation/progress, and applying a learning as a content hypothesis.
- [ ] Run the focused suites and confirm expected failures.
- [ ] Implement shared next-action presentation and the four connected workflow surfaces.
- [ ] Re-run focused suites until green.

### Task 4: Creator memory and Studio review outcomes

**Files:**
- Create: `src/components/account/creator-memory-workspace.tsx`
- Create: `src/components/account/creator-memory.module.css`
- Create: `src/app/app/settings/memory/page.tsx`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/workshop/workshop-workspace.tsx`
- Modify: `src/components/workshop/workshop.module.css`
- Modify: `src/components/collaboration/team-workspace.tsx`
- Modify: `src/components/collaboration/team.module.css`
- Modify: `src/domain/collaboration.ts`
- Modify: `src/lib/store/museboard-store.ts`
- Modify: `src/domain/entitlements.ts`
- Modify: `src/app/pricing/page.tsx`
- Test: `tests/integration/workshop.test.tsx`
- Test: `tests/integration/collaboration.test.tsx`
- Test: `tests/integration/billing-ui.test.tsx`
- Test: `tests/e2e/team-review.spec.ts`

**Interfaces:**
- Creator memory is explicit, editable, versioned, and inspectable; it stores preferred phrases/structures and avoidance rules but never silently rewrites creator input.
- Workshop hook/outline suggestions explain which memory or learning influenced them.
- Studio adds expiring local guest-review links, review deadlines, and a client-facing review state without claiming email delivery or public hosting in sample mode.
- Pricing sells live intelligence, connected history, experiments, and review workflow outcomes while retaining current monthly prices.

- [ ] Add failing tests for memory editing/versioning, suggestion provenance, guest token expiry/access boundaries, review deadline state, and revised plan copy.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the memory workspace, workshop provenance, guest-review domain behavior, team UI, entitlements, and pricing copy.
- [ ] Re-run focused suites until green.

### Task 5: Release polish and verification

**Files:**
- Modify: `src/components/planner/planner.module.css`
- Modify: `src/components/opportunities/opportunities.module.css`
- Modify: `src/components/marketing/marketing-shell.tsx`
- Modify: `src/components/marketing/marketing-shell.module.css`
- Modify: `src/app/app/not-found.tsx`
- Test: `tests/e2e/mobile.spec.ts`
- Test: `tests/e2e/accessibility.spec.ts`
- Test: `tests/e2e/activation.spec.ts`
- Create: `.gstack/qa-reports/qa-report-localhost-2026-07-15.md`

- [ ] Add failing browser assertions for seven-day Planner discoverability, 12px minimum app microcopy, compact mobile Opportunity metadata, two-row mobile marketing header, branded not-found route, global theme, and the full signal-to-learning-to-next-action journey.
- [ ] Implement the narrow CSS and not-found fixes.
- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- [ ] Run the production server and `PLAYWRIGHT_BASE_URL=http://localhost:3221 pnpm test:e2e --workers=1 --reporter=line`.
- [ ] Capture and inspect desktop/mobile screenshots for Today, Opportunities, Create, Plan, Learn, Team, Memory, pricing, recovery, and not-found in light/dark and reduced-motion states.
- [ ] Record console errors, failed network requests, overflow, Axe serious/critical findings, external credential blockers, and remaining risks in the QA report.

## Acceptance Checklist

- A creator can move from opportunity to hypothesis to series to plan to published receipt to measured learning to a justified next action.
- The next action changes when a creator applies/dismisses a learning, completes series work, or gives opportunity feedback.
- Offline captures remain visible and actionable after reload; corrupt persisted state produces a recovery notice and preserves a bounded backup.
- Creator memory is editable and attributable; generated choices never hide what influenced them.
- Studio review has clear guest, expiry, deadline, approval, and sample-mode boundaries.
- The existing free workflow remains genuinely useful before payment.
- Desktop and mobile flows pass automated, accessibility, console/network, overflow, and visual inspection gates.
