# Museboard Thinking Rooms Design

**Date:** 2026-07-15  
**Status:** Approved design, ready for implementation planning  
**Product surface:** Museboard creator operating system  
**Primary outcome:** Turn a strategic question and collaborative reasoning into a source-linked content direction.

## 1. Product decision

Museboard will add **Thinking Rooms**, a first-class collaborative reasoning workspace. A room begins with a standalone strategic question and may later create a structured Idea Board item. It is not a blank whiteboard, comment thread, or AI chat.

The selected interaction model is a **guided decision canvas**:

- Flexible enough for unexpected connections.
- Structured enough to converge on a decision.
- Async-first, with lightweight live presence when collaborators overlap.
- Human-owned synthesis with optional, visibly labeled AI assistance.
- Durable reasoning history from question through content creation.

Thinking Rooms strengthen Museboard's existing identity: an expert creative strategist that sharpens the creator's thinking instead of replacing it.

## 2. Problem

Museboard already supports evidence, ideas, comments, assignments, approvals, hypotheses, and creator memory. These features preserve work and review, but not the reasoning that produced a strategic choice.

Small creator teams currently lose this reasoning across messages, calls, notes, whiteboards, and document comments. They can see the finished hook or script but cannot reliably answer:

- What question were we trying to resolve?
- Which audience tension mattered most?
- What evidence supported the direction?
- Which objections remained unresolved?
- Who contributed the decisive perspective?
- Why did this idea become content?

Thinking Rooms make that reasoning inspectable and reusable without turning Museboard into enterprise project management.

## 3. Goals

1. Help solo creators and small teams investigate a meaningful question before generating content.
2. Preserve distinct perspectives, evidence, disagreement, and authorship.
3. Guide the room toward an explicit synthesis instead of accumulating notes forever.
4. Convert an accepted synthesis into a structured content direction with complete provenance.
5. Support asynchronous collaboration while making overlapping participation feel alive.
6. Measure AI and persistence costs without exposing users to confusing infrastructure language.
7. Match Museboard's warm, editorial, comfortable visual identity in light and dark themes.

## 4. Non-goals

The first release will not include:

- An infinite zoomable whiteboard.
- Freehand drawing, diagramming, or arbitrary spatial node placement.
- Character-by-character simultaneous editing inside one contribution.
- Video calls, audio rooms, screen sharing, or meeting recording.
- Autonomous decision-making or automatic conversion to content.
- Cross-workspace public rooms.
- Anonymous external guests.
- Generic document editing or a replacement for comments and approvals.

## 5. Entry points and navigation

Thinking Rooms receive a primary `Think` destination in the application navigation.

Entry points:

- `Think` navigation item opens the room index.
- `New Thinking Room` starts from a strategic question.
- An opportunity or learning may prefill a new question, but the room remains standalone until conversion.
- An Idea Board item created from a room links back to its originating room and accepted synthesis.

The room index shows active, waiting, decided, and converted rooms. It prioritizes rooms requiring the current user's contribution or decision.

## 6. Core room workflow

### 6.1 Create the question

The creator enters one strategic question and may add optional context:

- Creator niche or archetype.
- Audience.
- Platform or format.
- Related opportunity, learning, or source.
- Collaborators and decision owner.
- Intended decision date.

A strong question is open enough to investigate and narrow enough to resolve. Museboard may offer a rewrite, but the creator controls the final wording.

### 6.2 Explore through guided lenses

The default **Content Direction** template uses four lenses:

1. **Audience tensions** — what the audience wants, fears, assumes, or struggles to articulate.
2. **Evidence** — sources, observations, creator experience, and signals that support or weaken the idea.
3. **Challenges** — counterarguments, risks, missing context, and conditions that would make the idea wrong.
4. **Possibilities** — new angles, combinations, experiments, and content directions.

Templates may change lens names and prompts later, but every template must preserve evidence, challenge, and synthesis behavior.

### 6.3 Contribute atomically

A contribution is one focused thought, not a long discussion thread. It contains:

- Body.
- Lens.
- Author snapshot.
- Created and edited timestamps.
- Optional evidence/source reference.
- Optional mention.
- Optional relationship to another contribution.
- Edit history.

Collaborators may react with:

- Agree.
- Concern.
- Needs evidence.
- Promising.

Reactions help scanning but do not act as binding votes.

### 6.4 Connect and challenge

Contribution relationships are explicit:

- Supports.
- Challenges.
- Extends.
- Combines.

A challenge remains unresolved until a permitted collaborator resolves it with a note or intentionally carries it into the synthesis. Resolving a challenge never deletes it.

### 6.5 Synthesize

The persistent synthesis rail contains:

- Current shared belief.
- Important unknowns.
- Decision confidence: low, medium, or high.
- Open challenges.
- Chosen content direction.
- Decision owner.
- Synthesis revision and authorship.

Anyone with edit permission may draft a synthesis. The decision owner accepts it. Museboard may propose a synthesis from room contributions, but it is clearly labeled as a suggestion, includes the contributions it used, consumes metered AI allowance only after a successful response, and cannot overwrite an accepted human synthesis.

### 6.6 Convert question to content

`Create content direction` is available only when:

- A synthesis exists.
- A decision owner is assigned.
- The synthesis has been accepted.
- The chosen direction has an audience tension and angle.
- Required evidence references are available or the direction is explicitly marked as creator experience/opinion.

Conversion creates one Idea Board item containing:

- Title derived from the chosen direction, editable before creation.
- Audience tension.
- Angle.
- Counterargument or key challenge.
- Evidence/source references.
- Platform/format context.
- Contributor acknowledgements.
- Immutable origin link to the room and accepted synthesis revision.

The room remains available after conversion. Repeated conversion requests return the existing Idea Board item unless the user explicitly creates a new direction from a later synthesis revision.

## 7. Room states

Rooms use the following lifecycle:

- `exploring` — accepting contributions across lenses.
- `synthesizing` — a synthesis is being drafted or challenged.
- `decided` — one synthesis revision is accepted.
- `converted` — an accepted synthesis created a content direction.
- `archived` — hidden from active work without deleting history.

A decided or converted room may reopen. Reopening preserves the previous accepted synthesis and begins a new synthesis revision. Existing content is never silently rewritten.

## 8. Collaboration model

### Roles

- **Facilitator:** creates the room, manages participants, organizes contributions, and assigns the decision owner.
- **Contributor:** adds, edits, connects, challenges, and reacts to contributions.
- **Viewer:** reads and reacts but cannot change room reasoning.

Workspace owners retain administrative authority. Existing Pro and Studio collaboration entitlements govern participant access; Thinking Rooms do not create a parallel membership system.

### Async-first behavior

- Notifications link to the exact room, contribution, or synthesis revision.
- Mentions are workspace-scoped.
- Activity summaries highlight new challenges, evidence, synthesis changes, and decisions.
- A participant can mark a room as reviewed without reacting to every contribution.

### Lightweight live presence

When collaborators overlap, Museboard shows:

- Participant avatars.
- Current lens or synthesis area.
- Typing/composing indicators.
- Contribution-level edit ownership.

Presence is ephemeral and never treated as an audit record. The first release avoids simultaneous editing inside the same contribution. If two edits conflict, Museboard preserves both versions and presents an explicit merge choice.

## 9. Domain model

### `ThinkingRoom`

- `id`
- `organizationId`
- `workspaceId`
- `question`
- `templateId`
- `status`
- `facilitatorMembershipId`
- `decisionOwnerMembershipId`
- `context`
- `decisionDueAt`
- `createdAt`
- `updatedAt`
- `archivedAt`

### `ThinkingContribution`

- `id`
- `roomId`
- `lens`
- `body`
- `authorMembershipId`
- `authorDisplayNameSnapshot`
- `sourceReferenceId`
- `createdAt`
- `updatedAt`
- `deletedAt`
- `revision`

### `ContributionLink`

- `id`
- `roomId`
- `fromContributionId`
- `toContributionId`
- `relationship`: `supports | challenges | extends | combines`
- `createdByMembershipId`
- `resolutionStatus`
- `resolutionNote`
- `resolvedByMembershipId`
- `resolvedAt`

### `RoomReaction`

- `id`
- `roomId`
- `contributionId`
- `membershipId`
- `kind`: `agree | concern | needs_evidence | promising`
- `createdAt`

One active reaction of each kind is allowed per member and contribution.

### `SynthesisRevision`

- `id`
- `roomId`
- `number`
- `belief`
- `unknowns`
- `confidence`
- `chosenDirection`
- `openChallengeIds`
- `sourceContributionIds`
- `createdByMembershipId`
- `generationProvenance`
- `status`: `draft | proposed | accepted | superseded`
- `createdAt`
- `acceptedAt`
- `acceptedByMembershipId`

### `ContentOrigin`

- `roomId`
- `synthesisRevisionId`
- `ideaId`
- `createdByMembershipId`
- `createdAt`

The origin link is immutable.

## 10. Persistence and conflict behavior

Thinking Rooms use incremental entity persistence. They must not expand the existing whole-workspace snapshot as their primary durable storage model.

Writes are scoped to one room entity, contribution, link, reaction, or synthesis revision. Every mutation uses organization-scoped authorization and optimistic version checks.

Conflict rules:

- Non-overlapping contribution edits apply independently.
- A stale edit to the same contribution creates a merge candidate; it never silently wins.
- Duplicate conversion requests are idempotent per accepted synthesis revision.
- Offline contribution creation uses a client-generated identifier so retrying cannot duplicate it.
- Deleted contributors retain display-name snapshots and authorship history.

## 11. AI and cost controls

Thinking Rooms support AI as an optional reasoning assistant, not an invisible participant.

Metered operations:

- Question refinement.
- Synthesis proposal.
- Challenge clustering.
- Content-direction formatting.

Each operation records:

- Organization and room.
- Provider and model.
- Prompt/schema version.
- Input and output tokens.
- Provider cost.
- Latency.
- Retry count.
- Success/failure status.
- Result identifier.

Failed requests, validation failures, safety refusals, and automatic retries do not consume user allowance. Successful duplicate/idempotent responses consume allowance once.

The target blended provider cost is at most **$0.03–$0.05 per successful room operation**. Requests that would exceed the configured cap use a cheaper strategy or return a clear unavailable state. Manual thinking and synthesis always remain usable.

## 12. Visual and interaction design

The interface uses Museboard's warm editorial identity:

- Warm cream canvas rather than stark white.
- Quiet warm-charcoal navigation instead of dominant black/navy.
- Restrained dusty coral, misty cobalt, muted ochre, and soft lavender lens surfaces.
- Generous spacing and comfortable line lengths.
- Large rounded surfaces with restrained hairlines and minimal shadows.
- Serif display typography for questions and synthesis; clear sans-serif UI text.
- Contribution cards that feel like editorial notes, not social-media posts.
- A parchment-toned synthesis rail visually integrated with the canvas.
- No gradients, glassmorphism, decorative floating objects, or generic AI chat panel.

Controls meet a 44px minimum target. Color is never the only indicator of a lens, relationship, status, or reaction.

### Responsive behavior

- Desktop: question header, 2×2 lens canvas, and persistent synthesis rail.
- Tablet: lens canvas remains two columns; synthesis moves below the question and can remain sticky within the content column.
- Mobile: one lens at a time with a clear lens switcher; synthesis becomes a bottom sheet or dedicated step; presence compresses to avatars and count.
- No horizontal scrolling is required to read or contribute.

## 13. Empty, loading, failure, and recovery states

### Empty room

Each lens shows one concise prompt and a single contribution action. Museboard never fabricates teammate activity.

### Loading

The question and canvas skeleton preserve final layout geometry. Existing room content remains readable during background refresh.

### Offline

New contributions queue locally and show `Waiting to sync`. Sync failure offers retry and copy. A pending contribution is never presented as visible to teammates until the server confirms it.

### Evidence failure

Unavailable sources retain title, author note, and failure state. A broken link does not remove the contribution that referenced it.

### AI failure

The manual synthesis editor remains available. Error copy distinguishes timeout, unavailable provider, safety boundary, and plan allowance without exposing internal stack details.

### Permission change

If access is revoked while a user is editing, Museboard preserves unsent text locally and offers copy. It does not attempt an unauthorized write.

## 14. Accessibility

- Full keyboard navigation through room header, lenses, contributions, relationships, synthesis, and conversion.
- Logical DOM order independent of the desktop 2×2 visual grid.
- Screen-reader labels include lens, author, relationship, resolution status, and edit state.
- Focus returns to the initiating control after dialogs and merge flows.
- Live presence uses polite announcements only for meaningful changes; typing indicators are not repeatedly announced.
- Reduced motion removes presence transitions and animated reordering.
- Light and dark themes meet WCAG AA contrast for text and interactive states.

## 15. Notifications and activity

Notifications are created for:

- Room invitation.
- Mention.
- Contribution challenged.
- Evidence requested.
- Synthesis proposed.
- Decision requested.
- Synthesis accepted.
- Room reopened.
- Content direction created.

Activity history records durable changes but does not store ephemeral presence or every keystroke.

## 16. Analytics

Product metrics:

- Room created.
- First contribution.
- Second participant contribution.
- Evidence attached.
- Challenge created and resolved.
- Synthesis proposed and accepted.
- Time from room creation to decision.
- Room-to-content conversion.
- Converted idea reaching plan, export, publish receipt, and learning.
- Week-two room participation.

Cost and reliability metrics:

- Writes per room.
- Contribution payload size.
- Conflict rate.
- Offline retry rate.
- AI tokens, cost, latency, and success rate by operation and plan.
- AI cost per accepted synthesis and converted content direction.

Analytics events exclude contribution bodies and private source content.

## 17. Testing strategy

### Domain tests

- Legal and illegal room-state transitions.
- Contribution link and challenge resolution rules.
- Synthesis revision acceptance and supersession.
- Idempotent conversion.
- Cost-meter reservation, commit, and release behavior.

### Integration tests

- Organization isolation and role permissions.
- Offline/client-generated identifier retry behavior.
- Same-contribution version conflict and merge preservation.
- Notification destinations.
- Origin link from room to Idea Board item.
- AI success, schema failure, timeout, refusal, and retry accounting.

### Browser tests

- Create room → invite collaborator → add perspectives → challenge → synthesize → decide → create content direction.
- Reopen a decided room and create a later synthesis without mutating existing content.
- Desktop and mobile layouts in light and dark themes.
- Keyboard-only contribution, linking, synthesis, and conversion.
- Offline contribution recovery.
- Two overlapping collaborators with visible presence and contribution-level edit ownership.

## 18. Acceptance criteria

The first implementation slice is complete when:

1. A workspace member can create a standalone room from a strategic question.
2. The room renders the four guided lenses with comfortable desktop and mobile layouts.
3. Permitted collaborators can add attributed contributions and explicit relationships.
4. Challenges can be resolved or intentionally carried into synthesis without disappearing.
5. A synthesis revision can be proposed, edited, accepted, and inspected.
6. Live overlap shows lightweight presence without enabling same-card simultaneous editing.
7. Accepted synthesis converts idempotently into one source-linked Idea Board item.
8. Existing room reasoning remains readable after conversion and reopening.
9. Offline, conflict, permission, and AI failure states preserve user work.
10. AI operations are optional, labeled, cost-metered, and do not consume allowance on failure.
11. Focused tests, lint, typecheck, production build, desktop browser QA, and mobile browser QA pass.
12. No unrelated Museboard behavior or existing collaboration workflow regresses.

## 19. Implementation boundaries

The first implementation slice should deliver one complete template and workflow instead of a template marketplace or generalized whiteboard engine.

Recommended sequencing:

1. Domain model and state transitions.
2. Incremental persistence and permission contracts.
3. Room index, creation, and comfortable canvas UI.
4. Contributions, links, challenges, and activity.
5. Synthesis revisions and decision ownership.
6. Idempotent room-to-Idea Board conversion.
7. Presence and offline/conflict recovery.
8. Optional AI adapters and cost telemetry.
9. Responsive, accessibility, and adversarial browser QA.
