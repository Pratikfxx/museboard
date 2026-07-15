# Museboard Thinking Rooms Implementation Plan

> **Required sub-skill:** Use `superpowers:executing-plans` to implement this plan task-by-task, and `superpowers:test-driven-development` for every behavior change.

**Goal:** Ship a complete, comfortable question-to-content Thinking Room workflow that works in the sample workspace, is represented as normalized collaboration data for live workspaces, and converts an agreed direction into the existing Idea Board without losing its reasoning trail.

**Architecture:** Thinking Rooms get their own domain model and client store rather than being embedded in the revisioned creator-workspace snapshot. Sample mode persists the normalized room graph locally under a separate versioned key. Live mode uses dedicated authenticated room endpoints backed by normalized Supabase tables and organization RLS. The UI exposes a room library and one responsive guided decision canvas with four lenses plus a persistent synthesis rail.

**Tech stack:** Next.js App Router, React 19, Zustand 5, Zod 4, Supabase/Postgres RLS, Vitest/Testing Library, Playwright, CSS Modules, Phosphor icons.

---

## Acceptance checklist

- A creator can create a room from a strategic question and see it in a room library.
- A creator or collaborator can contribute under Audience tensions, Evidence, Challenges, or Possibilities.
- Contributions preserve author, timestamp, lens, status, and lightweight reactions.
- A facilitator can synthesize the room, edit the current belief, set confidence, and preserve open challenges.
- “Create content direction” creates exactly one Idea Board item with immutable room origin and links back to the source room.
- Reloading sample mode preserves rooms separately from `museboard-demo-v1`.
- Live persistence is represented by normalized tenant-owned tables, explicit grants/RLS, and authenticated repository/API boundaries; Thinking Rooms never enter `workspace_snapshots.payload`.
- Viewer/editor permissions, stale-revision conflicts, offline/error messaging, empty states, and duplicate conversion are handled safely.
- Desktop and mobile have no horizontal overflow, keyboard focus remains visible, reduced motion is respected, and all core controls have accessible names.
- The finished UI uses the approved warm editorial system: cream workspace, warm charcoal navigation, muted lens colors, generous spacing, integrated synthesis rail, and no dense card wall.

## Task 1: Model the decision canvas as a strict domain

**Files:**
- Create: `src/domain/thinking-rooms.ts`
- Create: `tests/unit/thinking-rooms.test.ts`

1. Write failing tests for parsing room states and lenses, creating a room, adding a contribution, rejecting blank input, recording reactions once per actor, editing only the current revision, and enforcing the state sequence `exploring → synthesizing → decided → converted`.
2. Run `pnpm vitest run tests/unit/thinking-rooms.test.ts` and confirm the tests fail because the module does not exist.
3. Implement Zod-backed types for `ThinkingRoom`, `ThinkingContribution`, `ContributionReaction`, `ThinkingSynthesisRevision`, `ThinkingRoomOrigin`, `ThinkingRoomRole`, `ThinkingRoomState`, and `ThinkingLens`.
4. Implement pure functions `createThinkingRoom`, `addThinkingContribution`, `toggleContributionReaction`, `createSynthesisRevision`, `updateThinkingRoomState`, and `roomCanConvert` with injected IDs/timestamps for deterministic tests.
5. Re-run the focused test and commit the domain slice.

## Task 2: Add isolated sample persistence and question-to-content conversion

**Files:**
- Create: `src/lib/store/thinking-room-store.ts`
- Modify: `src/domain/opportunities.ts`
- Modify: `src/lib/store/museboard-store.ts`
- Modify: `src/lib/demo/fixtures.ts`
- Create: `tests/unit/thinking-room-store.test.ts`
- Modify: `tests/unit/promoted-idea-workshop.test.ts`

1. Write failing store tests proving rooms persist under `museboard-thinking-rooms-v1`, never appear in `workspacePayloadFromState`, hydrate a useful sample room, and remain idempotent when converted twice.
2. Extend `IdeaRecord.provenance` with an optional immutable `thinkingRoomOrigin` containing room ID, question, synthesis revision ID, contributor count, and converted timestamp. Keep legacy opportunity provenance valid.
3. Add `createIdeaFromThinkingRoom(roomId, at?)` to the main Museboard store. It must require a decided synthesis, create one shaped Idea Board record, preserve its room origin, mark the room converted through the Thinking Room store, and return the existing idea ID on repeated conversion.
4. Implement a separate persisted Zustand store for rooms, contributions, reactions, synthesis revisions, selected room, sync state, and CRUD actions. Sample fixtures must be plainly labelled sample data and use the current workspace members as author snapshots.
5. Re-run focused tests and verify local storage separation explicitly.

## Task 3: Create normalized live persistence and authorization boundaries

**Files:**
- Create: `supabase/migrations/20260716090000_thinking_rooms.sql`
- Create: `src/lib/thinking-rooms/repository.ts`
- Create: `src/app/api/thinking-rooms/route.ts`
- Create: `src/app/api/thinking-rooms/[roomId]/route.ts`
- Create: `tests/unit/thinking-room-repository.test.ts`
- Modify: `tests/integration/rls-contract.test.ts`
- Create: `tests/integration/thinking-room-api.test.ts`

1. Write failing contract tests that require normalized `thinking_rooms`, `thinking_contributions`, `thinking_contribution_reactions`, and `thinking_synthesis_revisions` tables; organization foreign keys; user-ID attribution; role-aware RLS; explicit grants; and a compare-and-swap room revision function.
2. Add the migration. Store authors by Supabase user ID plus display-name snapshot; never use local `member-*` IDs. Viewers may select; active owners/editors may write. Cross-room and cross-organization foreign keys must be impossible.
3. Write failing repository tests for list/load/create/save, a stale revision mapped to `ThinkingRoomRevisionConflictError`, and row-to-domain validation.
4. Implement the repository and the two authenticated same-origin endpoints. `GET` lists or loads; `POST` creates; `PUT` applies a validated full-room mutation through compare-and-swap so one room changes independently of the workspace snapshot.
5. Add API tests for 401, 403, 400, 409, no-store caching, organization isolation, and successful serialization.
6. Run all focused database/repository/API tests. Confirm `workspacePayloadFromState` still has no Thinking Room fields.

## Task 4: Add the room library and primary navigation

**Files:**
- Create: `src/app/app/thinking/page.tsx`
- Create: `src/components/thinking-rooms/thinking-room-library.tsx`
- Create: `src/components/thinking-rooms/thinking-rooms.module.css`
- Modify: `src/components/app-shell/app-shell.tsx`
- Modify: `src/components/app-shell/app-shell.module.css`
- Create: `tests/integration/thinking-room-library.test.tsx`
- Modify: `tests/integration/app-shell.test.tsx`

1. Write failing component tests for the navigation item, empty and populated libraries, create-room form validation, status filters, keyboard focus after creation, and room deep links.
2. Add “Think” to desktop navigation and the mobile More sheet without displacing Today/Create/Plan from the primary mobile row.
3. Build the library as a warm editorial page with one clear hero action, recent rooms grouped by active/decided, quiet status metadata, and a useful empty state. Avoid equal-weight repetitive cards.
4. In live mode, load the dedicated endpoint and show explicit loading, retry, permission, offline, and conflict states. In sample mode, use the isolated persisted store.
5. Re-run focused tests.

## Task 5: Build the guided decision canvas

**Files:**
- Create: `src/app/app/thinking/[roomId]/page.tsx`
- Create: `src/components/thinking-rooms/thinking-room-workspace.tsx`
- Create: `src/components/thinking-rooms/thinking-contribution-composer.tsx`
- Create: `src/components/thinking-rooms/thinking-synthesis-rail.tsx`
- Modify: `src/components/thinking-rooms/thinking-rooms.module.css`
- Create: `tests/integration/thinking-room-workspace.test.tsx`

1. Write failing interaction tests for a missing room, lens navigation, adding a contribution, reacting, resolving a challenge, entering synthesis, editing belief/confidence, preserving an unresolved challenge, and returning focus to the composer.
2. Implement a responsive workspace:
   - compact room header with question, status, participant presence, and facilitator actions;
   - four lens sections using muted coral/cobalt/ochre/lavender accents;
   - contributions rendered as readable editorial notes with author/time/reaction controls;
   - a desktop sticky synthesis rail that becomes an inline bottom section on mobile;
   - comfortable line length, generous vertical rhythm, visible hover/focus, and no ornamental 3D sculpture.
3. Provide safe optimistic feedback: “Saving…”, “Saved”, “Couldn’t save — retry”, and a conflict banner that preserves the unsaved draft.
4. Re-run focused tests at both wide and narrow DOM conditions.

## Task 6: Complete synthesis and question-to-content conversion

**Files:**
- Modify: `src/components/thinking-rooms/thinking-synthesis-rail.tsx`
- Modify: `src/components/thinking-rooms/thinking-room-workspace.tsx`
- Modify: `src/components/opportunities/opportunities-workspace.tsx`
- Modify: `src/components/opportunities/opportunities.module.css`
- Modify: `tests/integration/thinking-room-workspace.test.tsx`
- Modify: `tests/integration/opportunities.test.tsx`

1. Write a failing end-to-end component test that starts with a strategic question, adds evidence and a challenge, saves a synthesis, converts once, and finds the new Idea Board item with “From Thinking Room” provenance and a source-room link.
2. Implement deterministic synthesis assistance locally: propose a concise belief from the strongest possibility/evidence while surfacing unresolved challenges. It must remain editable, labelled “Suggested”, and never silently replace facilitator text.
3. Add conversion gating: require a current belief and confidence; warn but allow conversion with open challenges; disable duplicate conversion; and navigate to the created Idea Board record.
4. Update the Idea Board item treatment to show its source question, synthesis confidence, and “Open room” link without exposing internal IDs.
5. Re-run focused tests and the existing opportunity promotion regression tests.

## Task 7: Browser workflow, accessibility, and visual QA

**Files:**
- Create: `tests/e2e/thinking-rooms.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Create screenshots under Playwright test output only; do not commit approval images unless intentionally adding a snapshot test.

1. Write the failing Playwright workflow for room creation → two contributions → synthesis → conversion → Idea Board provenance.
2. Add mobile coverage at 390×844 and desktop coverage at 1440×1000 for navigation, sticky/inline synthesis behavior, no overflow, keyboard completion, and zero page/console errors.
3. Run the flow in light and dark themes. Inspect screenshots at full resolution and fix spacing, contrast, clipped controls, text density, focus visibility, and mobile reachability.
4. Run axe on library and room routes and fix serious/critical violations.

## Task 8: Full release verification

1. Re-read the approved design spec and this acceptance checklist; trace each item to a test or browser observation.
2. Run focused tests, then `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
3. Run `pnpm playwright test tests/e2e/thinking-rooms.spec.ts tests/e2e/accessibility.spec.ts` against the production build.
4. Inspect `git diff --check` and `git status --short --branch`; ensure `docs/business/` remains untouched and uncommitted.
5. Open the verified room route in the user’s app, capture final desktop/mobile evidence, and report remaining live-collaboration risk honestly if Supabase credentials are unavailable for remote verification.
