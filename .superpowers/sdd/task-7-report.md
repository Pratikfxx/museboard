# Task 7 report — creator team review

## Delivered

- Warm editorial `/app/team` workspace with responsive People, Review, and Inbox views.
- Owner/editor/viewer roster plus pending, active, declined, revoked, expired, and soft-removed lifecycle support.
- Exact seat enforcement for Free 1, Creator 1, Pro 2, and Studio 6, including the owner and pending invites.
- Local invite drafting with explicit `delivery: not_sent`; no email-delivery claim.
- Stage assignee/reviewer controls and recipient-scoped notifications with exact destinations.
- Version- and stage-bound comments, mentions, resolve/reopen, and preserved author snapshots.
- Append-only review request, approve, changes-requested, and stale history.
- Shared workshop-save invalidation that appends a stale event and updates the current approval summary.
- Historical notification links render the requested immutable version read-only with friendly context and a return-to-current link.
- Ownership-transfer guard and soft removal without orphaning authored history.
- Legacy persisted workspaces receive an isolated owner membership and empty collaboration collections; onboarding clears sample collaboration and starts on Free.

## TDD evidence

- RED: `pnpm vitest run tests/integration/collaboration.test.tsx` failed because `@/components/collaboration/team-workspace` did not exist.
- GREEN: `tests/integration/collaboration.test.tsx` — 3/3 passed, covering seats/plan copy, entitlement-gated assignment, reviewer-bound approvals, stale version history, contextual comments, and scoped mention destinations.

## Fresh verification

- `pnpm vitest run` — 13 files, 90 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm build` — passed; `/app/team` emitted as a dynamic App Router route.
- `pnpm playwright test tests/e2e/team-review.spec.ts --project=chromium --project=mobile-chrome` — 2/2 passed with zero captured console/page errors and no horizontal overflow.
- `git diff --check` — passed.
- Visual inspection: 1440×1024 desktop People view and Pixel 7 Review view inspected in light theme; hierarchy, spacing, fixed mobile navigation clearance, 44px controls, and responsive stacking were coherent.

## Intentional boundaries

- Collaboration remains a persistent local sample adapter until production auth/data work lands. Invite records do not send email.
- Local demo decisions use an explicit actor preview and still require that actor to match the assigned active reviewer; production replaces the preview with the authenticated session actor.

## Review hardening follow-up

- Today hook selection now performs one atomic `saveWorkshopVersion` mutation; an approved version edit appends exactly one stale event.
- Removed the unused legacy hook, comment, and approval actions that could bypass append-only review history.
- Notification links carry their notification ID and become read only after the exact mounted destination resolves; missing targets and unrelated IDs remain unread.
- Demo collaboration has an explicit current-actor preview. Approval controls and inbox items are scoped to that actor and the assigned reviewer.
- Stage assignments are immutable revision events with unique IDs, so historical notifications never retarget. Soft member removal preserves those events and display snapshots.
- Actual active owner identity is recorded on stale events after ownership transfer.
- Free/Creator assignment and comment-resolution controls are disabled with visible upgrade guidance; the rich sample is explicitly labeled as a Studio preview.
- Follow-up verification: focused Today + collaboration 10/10, full Vitest 90/90, TypeScript, lint, production build, and Chromium + Pixel 7 workflow 2/2 passed with missing-target and read-on-mounted-destination assertions.
