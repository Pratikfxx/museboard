# Task 5 Report — Museboard Opportunities

## Status

Complete and locally verified on `codex/museboard-app`. The public workspace is explicitly sample/browser-local, and the internal surface is explicitly preview-only; no cloud upload, live trend ingestion, or publish behavior is claimed.

## Files

- Routes: `src/app/app/opportunities/page.tsx`, `src/app/app/opportunities/ideas/page.tsx`, `src/app/app/opportunities/vision/page.tsx`, `src/app/app/internal/opportunities/page.tsx`.
- Opportunity UI: `src/components/opportunities/opportunities-workspace.tsx`, `opportunity-story.tsx`, `owner-opportunity-console.tsx`, `craft-guide-drawer.tsx`, and `opportunities.module.css`.
- Domain/provider: `src/domain/opportunities.ts`, `src/lib/providers/opportunities.ts`.
- Persisted demo state: `src/lib/store/museboard-store.ts`, `src/lib/demo/fixtures.ts`, `src/lib/demo/starter-workspace.ts`.
- Tests: `tests/integration/opportunities.test.tsx`, `tests/e2e/opportunities.spec.ts`, plus compatibility/migration coverage in `tests/unit/planner.test.ts` and `tests/unit/store.test.ts`.

## RED

- The initial focused command, `pnpm vitest run tests/integration/opportunities.test.tsx`, exited 1 because the opportunities workspace and owner console modules did not exist.
- The legacy persistence regression exited 1 because `upgradePersistedMuseboardData` did not exist; the merge now upgrades pre-Task-5 opportunity metadata instead of discarding the saved creator workspace.
- The unsafe duplicate regression exited 1 because a matching hash could bypass HTTPS validation; input now validates before duplicate reuse.
- The rights regression exited 1 because an unknown runtime rights value was accepted by the provider boundary; rights and reference kind now validate at runtime.
- The expiry regression exited 1 because an expired stored signal still appeared in For You; active recommendations now filter against the deterministic demo clock without deleting captured provenance.
- Review regressions then captured lost trigger focus on Escape and a fixed operator clock; Escape now restores focus, while ingestion expiry uses the current clock.

## GREEN

- Focused opportunities integration: 11/11 passed.
- Full Vitest: 10 files, 60/60 tests passed.
- Typecheck: `tsc --noEmit` exited 0.
- Lint: `eslint .` exited 0.
- Production build: Next.js compiled, typechecked, and prerendered all four Task 5 routes; exit 0.
- Task 5 browser smoke: 1/1 Chromium case passed, covering route tabs, persisted shaping, safe workshop promotion, Vision HTTPS failure/recovery, desktop/mobile overflow, mobile navigation, console/page errors on the public workflow, and denial of the owner route without credentials. The same Task 5 workflow also completed in the mobile-chrome project during the full run before an unrelated serialized Today baseline failure.
- Visual QA: inspected full-page 1440 × 1000 For You and 390 × 844 Vision renders. The first mobile pass exposed a selection dock covering the composer; it was moved into non-overlapping sticky flow and the mobile render was re-inspected.

## Commit

- Branch: `codex/museboard-app`.
- Commit: `feat: add creator opportunity boards` (branch HEAD at handoff).

## Self-review

- For You exposes source class/URL, observed and expiry times, geography, platform, explicit sample state, deterministic factor contributions, evidence, and persisted save/dismiss/shape actions. Missing evidence caps ranking at 95.
- Idea shaping is idempotent and provenance-bearing. Workshop promotion is also idempotent, starts at Angle, creates a valid content/version record, and never implies generation or publication.
- Vision stores only URL/file metadata. It validates HTTPS, supported MIME, integer size, SHA-256, runtime rights, duplicate hash/canonical URL, and the local 2GB quota. Removal cleans selection; rights-unknown references cannot be selected for strategy.
- The operator schema is strict, rejects copied article/media body fields and disallowed source classes, enforces future expiry, and reuses the exact public opportunity component for preview.
- The operator route is denied server-side unless `MUSEBOARD_OWNER_PREVIEW_TOKEN` matches the `museboard-owner-preview` cookie; it is also unlinked and `noindex`.
- Exactly 24 internally authored, provenance-bearing craft micro-guides are seeded. Context matching checks stage, platform, format, and creator stage and returns at most two.
- Task 5 uses Phosphor icons, semantic theme tokens, native controls, route-level `aria-current`, live status/error text, 44px actions, keyboard-contained dialog behavior, and flat editorial rows instead of a repeated card grid.

## Concerns

- The full 20-case Playwright command is not green because the existing Today visual suite has no `mobile-chrome` snapshot baselines. The first failure was `[mobile-chrome] Today light desktop matches the approved hierarchy`; an isolated rerun reached screenshot comparison and reported missing `today-desktop-light-mobile-chrome-darwin.png`. The generated unapproved image was moved out of the worktree. No Task 5 browser case failed.
- Deployments that need the internal preview must provision `MUSEBOARD_OWNER_PREVIEW_TOKEN` and the matching secure, HttpOnly `museboard-owner-preview` cookie through the future owner sign-in boundary. With no secret configured, the route fails closed as 404.
- Local file hashing uses browser Web Crypto and intentionally retains no `File`, `Blob`, copied body, or blob URL. Very large local files remain constrained by browser memory even though aggregate demo quota semantics are 2GB.
