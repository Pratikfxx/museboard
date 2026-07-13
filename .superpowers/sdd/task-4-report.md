# Task 4 Report — Museboard Today

## Status

Complete and verified on `codex/museboard-app`.

## Files

- App route and shell: `src/app/app/layout.tsx`, `src/app/app/today/page.tsx`, `src/components/app-shell/*`.
- Today experience: `src/components/today/*`.
- Runtime/tooling: `package.json`, `pnpm-lock.yaml`, `next.config.ts`.
- Supplied production assets: `public/assets/avatar-maya.png`, `avatar-sam.png`, `avatar-priya.png`, `idea-sculpture-light.png`, `idea-sculpture-dark.png`.
- Tests and approved baselines: `tests/integration/today.test.tsx`, `tests/e2e/today-visual.spec.ts`, and four platform snapshot PNGs.
- QA evidence: `design-qa.md`.

## RED

- `pnpm vitest run tests/integration/today.test.tsx` exited 1 because `@/components/today/today-workspace` did not exist. This was the expected initial Today behavior RED.
- The reduced-motion test then exited 1 because the fallback had no semantic figure/reason contract. This was the expected sculpture-boundary RED.
- A final focused fidelity test exited 1 because the three approved idea-thread labels were absent. This was the expected semantic-label RED.

## GREEN

- Focused Today integration: 4/4 passed.
- Full Vitest: 9 files, 45/45 tests passed.
- Typecheck: `tsc --noEmit` exited 0.
- Lint: `eslint .` exited 0.
- Production build: Next.js compiled, typechecked, prerendered `/app/today`, and exited 0.
- Browser/visual: 6/6 Chromium cases passed, covering 1440 × 1024 and 390 × 844 light/dark screenshots, personalized hook persistence and Outline transition, theme persistence, isolated WebGL pause/resume, reduced-motion raster fallback, image readiness, horizontal overflow, and console/page errors.

## Commit

- Branch: `codex/museboard-app`.
- Commit: `feat: build Museboard daily workspace` (branch HEAD at handoff).

## Self-review

- Today joins creator → selected opportunity → matching content/version → content-scoped hooks/tasks, preventing cross-content leakage and preserving onboarding personalization.
- `chooseHook` is followed by `moveTask(..., "outline")`, so the visible CTA and persisted workflow agree.
- R3F is lazy and optional. It caps DPR at 1.5, uses a 30fps demand loop, pauses for user choice, intersection and document visibility, disposes custom geometries/materials, and never captures pointer input.
- All assets are the supplied rasters and Phosphor icons. No initials, placeholders, handcrafted SVGs, CSS illustration, or generic card-grid replacement was introduced.
- Navigation points to the planned app routes, with a mobile agenda and persistent bottom navigation.

## Concerns

- React Three Fiber currently logs Three.js's upstream `Clock` deprecation as a development warning under Three r185; it is not a console error and did not affect build or interaction tests.
- Screenshot baselines are Darwin-specific by Playwright naming. Other CI operating systems will need their own approved platform baselines.

## Fix wave 1

### Status

All four Important and two Minor review findings are fixed and freshly verified.

### RED

- Focused Today integration initially reported 6 failures across 7 tests: the persisted Outline stage still rendered Hook active; rewrite was a button/local textarea instead of a workshop link; an unmatched selected opportunity leaked the prior angle/hooks/tasks; the dismissed learning led the strip; the hidden radio had no row focus-ring contract; and both light/dark fallback images mounted.
- The single-image performance regression then failed with `loading="lazy"` when the browser identified the fallback as the above-the-fold LCP.

### GREEN

- Focused Today integration: 7/7 passed.
- Full Vitest: 9 files, 48/48 tests passed.
- Typecheck: `tsc --noEmit` exited 0.
- Lint: `eslint .` exited 0.
- Production build: Next.js compiled and prerendered `/app/today`, exit 0.
- Today browser suite: 6/6 Chromium cases passed with existing light/dark desktop/mobile baselines, isolated WebGL pause/resume, Outline persistence/action assertions, theme persistence, image readiness, no horizontal overflow, and no console/page errors.

### Changes

- The production spine now derives every visible state from the persisted workflow stage. Choosing is guarded to Hook, then replaced by `Open outline workshop`, preventing a repeated version append.
- Selected opportunities only join content by `opportunityId`; unmatched opportunities render their own truthful shape-empty state and CTA without angle, hook, planner, or learning leakage.
- The learning strip selects the first non-dismissed learning.
- Hook rows expose a visible `:has(input:focus-visible)`/`:focus-within` focus ring.
- `Rewrite in my voice` now links to `/app/create/{contentId}?mode=voice`; the non-persisted textarea state and styles were removed.
- The fallback mounts one resolved-theme raster and loads that single above-the-fold image eagerly without preloading the opposite theme.

### Concerns

- The only remaining runtime note is React Three Fiber's upstream Three.js `Clock` deprecation warning during the isolated development WebGL test; no console errors were emitted.
