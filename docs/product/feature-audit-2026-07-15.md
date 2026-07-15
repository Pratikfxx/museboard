# Museboard feature, functionality, and bug audit

Date: 2026-07-15  
Branch: `codex/museboard-creator-loop`  
Status: the credential-free product remains a coherent demo. Production account identity, atomic workspace bootstrap, billing ownership, and plan projection foundations now exist; creator content and collaboration are not yet cloud-durable.

## Executive decision

Museboard should not add more broad surface area yet. The highest-leverage move is to make one creator loop genuinely intelligent and one commercial loop genuinely live:

1. Sign up and create a durable workspace.
2. Turn a signal or blank thought into a versioned post.
3. Apply real Creator Memory during generation.
4. Plan within actual capacity and recovery rules.
5. Export, publish natively, and bind results back to the exact post.
6. Invite a collaborator or external reviewer.
7. Upgrade without billing or entitlement ambiguity.

The current UI already communicates the product well enough to support this work. Production identity, persistence, creator-memory consumption, planner enforcement, learning attribution, and server-side billing truth are the sellability boundary.

## Capability truth matrix

| Area | Current truth | Production readiness |
| --- | --- | --- |
| Personalized onboarding | Eight-step, resumable, local setup with a live preview | Strong demo; needs multi-niche ranking, timezone, recovery days, and creator examples |
| Today | Personalized decision, hooks, workflow state, capture, agenda, semantic signal visual | Strong local workflow |
| Opportunities | Provenance-bearing sample opportunities, idea shaping, reference metadata | No live provider ingestion; freshness clock has defects |
| Create workshop | Versioned stage workflow, claims/evidence checks, approval staleness | Evidence attachment is a dead end; several deep links collapse to Hook |
| Planner | Capacity-aware starter week, reschedule, status, undo | Recovery-day and 80% rules are described but not enforced |
| Learn | CSV validation, baseline learning, hypotheses, series, memory editing | Imported metrics are not reliably joined to the published receipt/content |
| Creator Memory | Editable, versioned local profile | Not consumed by workshop or strategist generation |
| Team | Local invitations, actor simulation, comments, approvals, notifications | No email invite, invite acceptance, external review token, or live persistence |
| Export/publish | Validated ZIP, manifest, platform handoff, manual receipt | Export endpoint trusts client state; history cannot redownload exact bytes |
| Billing | Authenticated, organization-scoped Checkout/Portal, idempotent retries, existing-subscription protection, webhook projection | Needs real Stripe/Supabase environment validation and server enforcement across every paid mutation |
| Account/data | Honest local JSON export and destructive clear | No import/restore; live export/delete APIs intentionally return 409 |

## P0 — must fix before charging users

### 1. Production identity and workspace activation — foundation implemented

Evidence:

- `src/app/login/page.tsx` and `src/app/signup/page.tsx` always render sample access.
- `src/components/marketing/demo-access.tsx` explicitly states that production authentication is unavailable.
- `src/lib/auth/session.ts:20-36` requires an authenticated owner for checkout, but there is no supported sign-up → organization bootstrap → workspace path.
- `src/app/api/account/export/route.ts` and `delete/route.ts` always return `409 sample_local_only`.

Impact: a configured live-billing environment still cannot create a real customer workspace.

Acceptance criteria:

- Sign up, sign in, sign out, recovery, and callback failure states work.
- First login creates or joins an organization transactionally.
- Sample and live repositories are explicit and cannot mix.
- Returning users resume their active workspace; re-onboarding cannot orphan prior records.
- Live account export and deletion are authenticated jobs with status and audit history.

### 2. Duplicate billing risk — primary paths hardened

Evidence:

- `src/app/api/billing/checkout/route.ts:21-32` always creates `mode: "subscription"` Checkout.
- It does not reject an active/pending subscription or use a Stripe idempotency key.
- `src/components/billing/billing-workspace.tsx` sends existing subscribers back to new-subscription Checkout for another tier.

Impact: retry, concurrent tabs, upgrade, or downgrade can create multiple billable subscriptions.

Acceptance criteria:

- Checkout is allowed only when no active or pending subscription exists.
- Existing plans change through a controlled subscription update or Customer Portal.
- All mutation calls are idempotent and scoped to an explicit active organization.
- Upgrade, downgrade, cancellation, resume, retry, and concurrency are integration-tested.

### 3. Stripe entitlement truth — shell and billing implemented, product-wide enforcement pending

Evidence:

- Stripe webhooks project `subscription_entitlements` through `src/lib/stripe/webhook.ts`.
- Billing, Team, and Workshop read the locally mutable Zustand plan instead.
- Quotas and paid permissions are enforced only in `src/lib/store/museboard-store.ts`.

Impact: a paid customer can still see Free and remain blocked; a browser can also appear paid without server authorization.

Acceptance criteria:

- Live pages hydrate plan, status, grace period, seats, and usage from the authenticated organization.
- Server mutations enforce entitlement and quota; client state is display-only.
- Checkout return shows an honest pending state until the signed webhook projection arrives.
- Cancellation and payment-failure downgrades do not destroy creator work.

### 4. “Rewrite in my voice” does not perform a voice rewrite

Evidence:

- `src/components/today/today-workspace.tsx` presents “Rewrite in my voice.”
- Voice mode in `src/components/workshop/workshop-workspace.tsx` opens the existing script and displays `creator.voiceTraits`.
- `creatorMemory` is editable but not read by workshop generation; `StrategistProvider` is not wired into a product component.

Impact: the strongest differentiation claim is currently label-only.

Acceptance criteria:

- Rewrite generates an explicit preview or immutable new version.
- Input includes memory revision, favored/avoided phrases, structures, notes, boundaries, and prior edits.
- Output records memory and model/provider provenance.
- Avoided phrases and boundary violations are checked before save.
- When generation is unavailable, the control is honestly labeled “Edit script.”

### 5. Evidence gating is simultaneously weak and a dead end

Evidence:

- Ready blocks source-required claims without evidence.
- The recovery action routes to Script, while Evidence is read-only.
- `src/domain/workflow.ts:81` accepts any attached evidence for every required claim.

Impact: a creator can be blocked without a resolution path, while irrelevant evidence can satisfy the gate.

Acceptance criteria:

- A blocked Ready action focuses Evidence directly.
- Users can add, attach, detach, inspect, and replace sources.
- Each source-required claim must link to supporting evidence.
- The tested flow is blocked → attach relevant source → Ready succeeds.

### 6. Publish results do not close the learning loop

Evidence:

- Export receipts are bound to content/version/export/platform.
- Learn imports standalone CSV rows and does not reconcile them to receipts.
- Missing `content_id` becomes a generated imported ID.
- “Use in next post” silently picks the first unfinished content item.

Impact: Museboard cannot prove that a learning came from the post it claims to improve.

Acceptance criteria:

- Imported rows match a known receipt by normalized post URL/platform and inherit content/version.
- Unknown and ambiguous rows enter an explicit reconciliation queue.
- Applying a learning requires choosing the target draft.
- End-to-end verification uses the same export, receipt, metrics, and learning IDs.

## P1 — core product/functionality improvements

### 7. Planner promises are not enforced

- Starter scheduling uses fixed day offsets.
- Onboarding hardcodes UTC and Thursday recovery.
- Manual rescheduling checks only timestamp validity.
- The UI says recovery days stay clear and weekly load stays near 80%.

Build: timezone, recovery-day, preferred-window, custom-capacity onboarding; exclude recovery days automatically; show a deliberate override for recovery/overload changes; recalculate load before confirmation.

### 8. Workshop and contextual deep links lose their target

- Generated `learningId`, `seriesId`, and `opportunityId` parameters are not consumed by destination pages.
- `src/app/app/create/[contentId]/page.tsx` accepts only hook, outline, script, and review even though the workshop exposes eight stages.

Build: make all generated URLs reload-safe, select/focus the named object, support all eight stages, and show recovery for stale IDs.

### 9. Create lacks a blank-draft path

The launcher only starts from Idea Board, Opportunities, or recent drafts. Add four explicit options: Blank draft, From opportunity, From idea/capture, and Recent draft. Blank work must receive neutral evidence guidance, not manufactured trend provenance.

### 10. Vision Board selection has no downstream consumer

`selectedReferenceIds` is stored but never consumed by Create or strategy. Surface selected references as optional inspiration context per draft, keep rights/provenance visible, and never silently treat inspiration as trend evidence.

### 11. Team collaboration is simulation-only

- Invitations are local and no email is sent.
- Review identity can be switched locally.
- There is no invitation token model or external review route.
- UI permits viewers as reviewers while production RLS only permits owner/editor collaboration inserts.

Build: real expiring invitations, atomic acceptance with seat enforcement, version-scoped external review links, revocation, delivery status, and an explicit viewer/reviewer policy aligned with RLS.

### 12. Export security and history need production ownership

- `src/app/api/export/[contentId]/route.ts` accepts client-authored organization, content, approval, and requester state without authentication or origin/rate checks.
- “Immutable export history” stores metadata, not retrievable package bytes.

Build: in live mode accept IDs only, load authoritative records server-side, enforce membership/entitlement, rate-limit work, store packages or deterministic snapshots, and support byte-identical redownload for the advertised retention period.

### 13. Advertised plan limits are not consistently enforced

Workspace count, opportunity quota, export retention, metric history, and platform variants mostly exist as catalog/pricing values. Define each metered unit, enforce it server-side, display usage/reset state, and test pricing-to-policy alignment.

### 14. Freshness and expiry use inconsistent clocks

- Opportunity age is derived from `fetchedAt - observedAt`, not current time.
- Feed expiry uses fixed demo time in the workspace.
- The owner preview previously shipped with fixed timestamps that expired on 2026-07-15; this audit fixed its default to use the live clock.

Build: a single injectable clock for age and expiry, expired history, and before/after fake-clock tests.

### 15. Recovery and restore are incomplete

- The portable JSON export has no import/restore path.
- Recovery fallback can retain raw data in memory while the UI reads only localStorage.

Build: schema-validated import preview, backup-before-replace, merge/replace choice, recovery report, and a download path that uses the same safe storage abstraction.

## P2 — polish, operations, and growth

- Expand onboarding to multi-archetype ranking, a General creator fallback, language/location, current cadence, custom capacity, production comfort, and optional posts/transcripts.
- Make craft guidance vary by stage, platform, format, and creator maturity; Shoot should include framing, lighting, audio, safe zones, rights, and disclosure.
- Wire collaboration/analytics/strategist flags to routes, navigation, actions, APIs, and jobs; disabled must fail closed.
- Add a nonce-based Content Security Policy in report-only mode before enforcement.
- Replace the static internal operations screen with structured logs, correlation IDs, Web Vitals, webhook age/failure metrics, export/deletion SLA, and alerting.
- Extend automated accessibility coverage to onboarding, workshop, opportunities, Learn, Team, billing/data, dialogs, drawers, dark mode, and 200% zoom.
- Add native handoff reminders and platform-specific variants before attempting direct social publishing. If direct publishing is added, start with one provider and explicit confirmation/idempotency/retry visibility.

## Improvements and bug fixes completed during this audit

- Rebuilt onboarding into a guided setup with eight visible milestones, a live workspace payoff, stronger hierarchy, and responsive layout.
- Replaced the ambiguous Three.js tube sculpture with a semantic signal → angle → format → post visualization that supports motion pause, reduced motion, small screens, and save-data fallback.
- Corrected time-dependent onboarding test coverage to anchor the generated plan to the actual workspace creation instant.
- Corrected the obsolete fallback test to validate the new semantic visualization.
- Froze the curated-preview contract test clock and changed the product’s default observed/expiry timestamps to remain valid relative to the current time.
- Regenerated and visually reviewed the approved desktop light/dark Today snapshots.
- Added real sign-up, sign-in, callback, sign-out, live-route protection, and a fail-closed partial-configuration state while preserving explicit local sample access.
- Added a transaction-safe `ensure_user_workspace` database function that serializes first-login creation and derives authorization only from `auth.uid()`.
- Added durable active-organization selection and server-loaded identity, role, plan, Stripe status, grace/period access, and subscription identity.
- Scoped Checkout and Customer Portal to an explicitly verified owner organization, reused Customer Portal for existing subscriptions, and added Stripe idempotency keys.
- Closed the callback open-redirect edge case for protocol-relative, backslash, encoded-backslash, malformed, and external destinations.
- Added an honest live-workspace boundary: account and plan are synced, while creator drafts remain labeled as device-local until repository sync ships.
- Reordered production authentication on mobile so the form appears before promotional content, made footer account state truthful, and added an application icon.

## Recommended build sequence

### Sprint 1 — activation and creator truth

- Production auth, organization bootstrap, and returning-user routing are implemented; cloud creator-data repositories remain next.
- Wire Creator Memory into a real rewrite preview and version save.
- Fix workshop stage/deep-link routing and evidence attachment.

### Sprint 2 — planning and learning truth

- Timezone/recovery-aware planning with overload overrides.
- Receipt-to-metric reconciliation and explicit learning target selection.
- Blank-draft path and Vision Board context consumption.

### Sprint 3 — commercial truth

- Server entitlement hydration/enforcement.
- Idempotent first checkout and controlled plan changes.
- Authenticated, authoritative export storage/redownload.

### Sprint 4 — collaboration and operations

- Real invitations and scoped external review.
- RLS role alignment, kill switches, observability, CSP, and expanded accessibility QA.

## Verified working now

- Lint and TypeScript checks pass.
- Production build completes all 27 routes.
- Vitest: 37 files, 160 tests pass.
- Playwright desktop/mobile: 41 tests pass and 5 intentionally skip, including activation, mobile navigation, accessibility gates, creator workflow, export-learning demo, team review, recovery, and visual regression.
- Today visual suite: 6/6 passes across light/dark desktop/mobile plus motion and workflow behavior.
- Configured-auth visual acceptance passes at 1200×951 and 390×844; the mobile form is above the fold. Screenshots are in `output/playwright/`.
- A real Supabase migration and Stripe test-mode transaction could not run locally because Docker/Postgres and production credentials are absent; static SQL/security contracts and pure billing contracts pass.

## Release assessment

**Local sample product:** review-ready and coherent.

**Paid beta:** still blocked by cloud persistence for creator content, server entitlement/quota enforcement across all paid actions, real invitation/review, and credentialed Supabase/Stripe integration verification.

**Broad sellable release:** additionally blocked by genuine memory-powered generation, evidence resolution, receipt-bound learning, recovery-aware planning, authoritative export history, and operational observability.
