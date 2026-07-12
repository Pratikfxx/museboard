# Museboard Creator OS — Product and Experience Design

**Date:** 2026-07-13
**Status:** Approved product direction; implementation pending
**Working name:** Museboard
**Primary market:** US-first, globally accessible
**Primary customer:** Broad multi-niche creators with personalized onboarding

## 1. Product thesis

Museboard is a creator operating system that helps creators decide what to make, turn the decision into a realistic production plan, collaborate without losing their voice, and learn what to make next.

The product is not a caption generator or a generic social scheduler. Its core loop is:

`creator context → sourced opportunity → creator-owned angle → hook and brief → production plan → collaborator review → native publishing handoff → performance learning → next recommendation`

The first five-minute value moment is a set of relevant, evidence-backed ideas that become a personalized seven-day plan. The product should feel like a thoughtful creative strategist that strengthens the creator's judgment rather than replacing it.

## 2. Decisions already locked

- Serve broad multi-niche creators through niche-specific onboarding and vocabulary.
- Lead with a creative-strategist experience; AI suggestions remain editable and explainable.
- Include team spaces with owners, editors, collaborators, comments, assignments, and approvals.
- Launch export-first with a polished native-publishing handoff.
- Prepare Instagram as the first direct connector; add YouTube and TikTok after approval and compliance work.
- Position and price the product for the US first, using USD.
- Use a generous free-forever tier with monthly limits so users build a habit before paying.
- Preserve the selected warm editorial design direction, augmented with a useful daily planner and production stages.
- Support a first-class light and dark theme, system preference, reduced motion, and accessible contrast.
- Use Three.js only for optional, pausable atmospheric depth or signal exploration. It must never be required for navigation or understanding.

## 3. Product approaches considered

### Approach A — Scheduler first

Build calendar, platform connections, and direct publishing before creator intelligence.

**Advantage:** Familiar category and obvious utility.
**Rejected because:** Platform reviews and capability differences delay launch; the product becomes another calendar with weak differentiation.

### Approach B — AI generator first

Build high-volume hooks, captions, carousels, and scripts around a prompt interface.

**Advantage:** Fast to demo and easy to explain.
**Rejected because:** Crowded market, generic output, poor creator trust, and weak long-term learning.

### Approach C — Creator operating system

Own the complete decision and learning loop while launching with a reliable native-publishing handoff.

**Advantage:** Strong differentiation, high habit potential, and a credible path from solo subscription to team workspace.
**Chosen:** This is the product direction.

## 4. Research grounding

The design is informed by current category and creator research:

- Patreon reports creator pressure to publish constantly and burnout that reduces motivation: [State of Create](https://stateofcreate.co/).
- Kolsquare's 2025 multi-niche creator survey reports high stress and that most creators manage the workflow themselves: [Voices of the Creator Economy](https://7208750.fs1.hubspotusercontent-na1.net/hubfs/7208750/250701%20-%20Creators%20Survey%202025/250701-Voices-of-Creator-Economy-2025_Kolsquare_EN.pdf).
- Adobe reports strong interest in AI that learns a creator's style alongside substantial concern about training and output reliability: [Creators' Toolkit Report](https://news.adobe.com/news/2025/10/adobe-max-2025-creators-survey).
- YouTube and TikTok expose audience-specific search and content-gap signals rather than only generic trend lists: [YouTube Trends](https://support.google.com/youtube/answer/11962757), [TikTok Creator Search Insights](https://support.tiktok.com/en/using-tiktok/growing-your-audience/creator-search-insights).
- Competitors separate strategy, production, scheduling, and analytics across products such as [Buffer](https://buffer.com/pricing), [Later](https://later.com/pricing/), [vidIQ](https://vidiq.com/es/plans/), [OpusClip](https://www.opus.pro/pricing), and [Planable](https://planable.io/pricing/).
- Universal direct publishing is not a safe launch dependency: unaudited [TikTok clients have visibility limits](https://developers.tiktok.com/doc/content-posting-api-get-started), and uploads from unverified [YouTube API projects default to private](https://developers.google.com/youtube/v3/docs/videos/insert).

## 5. Target users and jobs

### Solo creator

Publishes across one or more platforms while balancing creation with another job or business.

Needs to:

- find timely opportunities without monitoring every platform;
- choose a differentiated angle before investing production time;
- write in their own voice;
- build a realistic cadence around available hours;
- package content for each platform without blind duplication;
- understand why content worked and what to try next.

### Creator with collaborators

Works with an editor, manager, producer, designer, or community lead.

Needs to:

- keep strategy, assets, status, and feedback attached to one content item;
- assign work with deadlines and context;
- review versions and resolve comments;
- know exactly what is approved, ready for native finish, or published.

### Small creator studio

Manages several creator workspaces or distinct content brands.

Needs to:

- switch workspaces without mixing voice and audience memory;
- manage roles and approvals;
- view capacity and schedule across collaborators;
- preserve separate data, billing, and audit trails.

## 6. Activation and onboarding

Account connection is optional until the creator has seen useful value.

### Guided onboarding sequence

1. **Outcome:** grow an audience, publish consistently, launch a project, establish expertise, promote work, or repurpose an existing body of content.
2. **Niche:** broad niche, sub-niches, location, language, audience, creator stage, and admired references.
3. **Platforms and formats:** current and desired channels, short video, long video, text, carousel, audio, or newsletter.
4. **Capacity:** available weekly hours, comfortable production complexity, cadence, and preferred batch days.
5. **Voice:** paste links, posts, or transcripts, or answer a short guided interview. Show the extracted voice profile for correction.
6. **Boundaries:** avoided topics, sourcing requirements, brand obligations, disclosure needs, rights, humor limits, and phrases to avoid.
7. **Starter workspace:** three pillars, five sourced ideas, one recommendation, three hooks, and a feasible seven-day plan.
8. **First commitment:** the creator selects one angle and schedules the first production action.

### Niche personalization

The underlying workflow remains shared, but prompts and output vocabulary change by niche. A musician sees releases, performances, snippets, and audio-rights guidance. A technology educator sees sources, claims, demonstrations, and learning outcomes. A lifestyle creator sees story arcs, product obligations, locations, and visual shot planning.

### Activation acceptance criteria

- A new user can reach a useful personalized opportunity without connecting a social account.
- The starter result appears within five minutes for a normal onboarding path.
- The user can edit every inferred field.
- The onboarding produces a non-empty Today screen and seven-day plan.
- Returning users resume at the last completed step.

## 7. Primary information architecture

The top-level navigation is intentionally concise:

- **Today:** the next decision, current production work, and workload-aware plan.
- **Opportunities:** sourced niche signals, saved opportunities, and content gaps.
- **Create:** the content workshop for angle, hook, outline, script, shots, assets, and platform variants.
- **Plan:** editorial and production calendar with workload and batch planning.
- **Learn:** creator-specific findings, experiments, baselines, and recent results.
- **Team:** members, assignments, comments, approvals, and workspace activity.

Settings, billing, integrations, privacy, export, and account controls live in the account menu rather than permanent primary navigation.

## 8. Today screen — selected visual target

The approved combined mock is the source of truth for the main visual language.

### Questions the screen answers

1. What should I make today?
2. What is moving toward publication this week?
3. What did my audience teach me?

### Desktop hierarchy

- Concise left navigation and creator workspace identity.
- Editorial greeting and one recommended opportunity.
- Source, freshness, platforms, and audience-fit evidence.
- The selected creator angle.
- Four-stage production spine: Signal → Angle → Hook → Outline.
- Active-stage choices with one obvious primary action.
- Subtle, pausable Three.js ribbon or idea sculpture.
- Inline collaborator state and unresolved feedback.
- Right-side week planner with duration, state, breathing room, and one gentle workload insight.
- Bottom learning strip with sample size and confidence.

### Interaction behavior

- Selecting an angle or hook updates the working brief without navigating away.
- Changes autosave and show a non-intrusive saved state.
- The creator can rewrite a suggestion in their voice or edit it directly.
- The daily planner supports drag-to-reschedule on desktop and explicit move controls on keyboard/mobile.
- Collaborator comments open in context and never obscure the main action.
- The Three.js element pauses when off-screen or the tab is hidden and offers a visible pause control.

## 9. Content workshop

Every content item is one durable object rather than separate feature silos:

`idea → evidence → angle → hooks → outline → script → scene/shot plan → assets → platform variants → schedule → publish handoff → result → learning`

### Workshop stages

- **Evidence:** source, freshness, geography, audience match, and why-now explanation.
- **Angle:** creator-owned interpretation and intended audience promise.
- **Hook:** contrarian, confession, open loop, demonstration, question, or story strategy with editable language.
- **Outline/script:** modular blocks, claims, sources, pacing, and CTA.
- **Production:** A-roll, B-roll, shots, overlays, props, aspect ratio, estimated time, and asset checklist.
- **Variants:** native adaptations for selected platforms with visible differences.
- **Review:** comments, versions, assignments, approvals, and resolved status.
- **Handoff:** post-ready package and publish checklist.

Generated suggestions must never be represented as certainty or a guarantee of virality.

## 10. Opportunities and trends

Opportunities are ranked using:

- niche and sub-niche fit;
- audience and goal fit;
- platform and format fit;
- geography and language;
- freshness and expiry risk;
- source quality;
- content-gap evidence;
- similarity to recent creator output;
- production effort and available capacity.

Every opportunity displays its source, retrieval time, geographic scope when known, and an explanation of why it matches the creator. "Trending music" is guidance to finish natively or use rights-cleared audio; Museboard must not imply that platform audio can be redistributed universally.

## 11. Planner and calendar

The planner combines editorial intent and production capacity.

### Planner capabilities

- Daily next actions with time estimates.
- Seven-day view and month view.
- Production stages, not only publish dates.
- Drag-to-reschedule plus accessible move controls.
- Batch-session planning.
- Breathing-room days and recovery weeks.
- Workload warnings based on estimated effort and creator capacity.
- Evergreen fallback content.
- Team assignments, due dates, blockers, and approval state.

The planner must never punish a creator for taking a break or imply that daily posting is universally optimal.

## 12. Collaboration model

### Roles

- **Owner:** billing, workspace settings, members, deletion, publishing approval.
- **Editor:** create and edit content, assets, comments, assignments, and schedules.
- **Collaborator:** edit assigned content, upload assets, and comment.
- **Viewer:** read-only access.

### Collaboration features

- Contextual comments and mentions.
- Assignment and due date per production stage.
- Version history for strategy, script, and variants.
- Optional owner approval before export or publishing.
- Activity trail for critical changes.
- Clear presence without noisy real-time indicators.

## 13. Native-publishing handoff

Version one is export-first and must make the handoff excellent.

Each export package includes:

- final caption and platform-specific copy;
- hooks, title, description, hashtags, CTA, and metadata;
- selected media or an asset checklist;
- crop/aspect-ratio and safe-zone guidance;
- audio guidance and rights reminder;
- disclosure checklist;
- preferred publish time;
- plain-text copy controls and a downloadable ZIP where assets exist;
- a "finish in platform" checklist;
- manual published URL and timestamp capture.

The product must distinguish **draft**, **approved**, **scheduled**, **ready for native finish**, and **published**. No fake connected or published state is allowed.

## 14. Learning and analytics

The Learn surface prioritizes hypotheses over metric walls.

Examples:

- "Question-led openings held attention longer across your last six Shorts."
- "Behind-the-scenes posts earned more saves than polished reveals across eight posts."
- "This conclusion is low-confidence because only three comparable posts are available."

Every learning shows:

- metric definition and platform;
- sample size;
- date range and freshness;
- confidence level;
- content items used;
- a suggested next experiment.

Version one supports manual results and CSV import. Provider adapters can later add platform analytics without changing the content model.

## 15. Monetization

The free plan remains useful forever with monthly limits.

### Free

- Personalized onboarding and creator profile.
- Idea capture and one active weekly plan.
- Limited sourced opportunities and content briefs per month.
- Basic calendar and manual publishing handoff.
- Manual result entry.

### Creator — target $19/month

- Higher planning and generation limits.
- Full voice memory and content workshop.
- Premium export packages.
- Deeper learning and CSV analytics.

### Pro — target $39/month

- Advanced opportunity intelligence.
- Cross-platform variants and repurposing.
- Multiple active plans, larger history, and higher usage.

### Studio — target $79/month

- Five collaborators.
- Multiple creator workspaces.
- Roles, approvals, shared capacity, and workspace reporting.

Stripe-hosted Checkout and Customer Portal will manage subscription purchase and changes. Entitlements are granted from verified webhook state, not from the browser redirect.

Prices are launch hypotheses and should remain configurable until customer interviews and willingness-to-pay tests are complete.

## 16. Visual system and themes

### Light theme

- Sun-washed ivory base.
- Deep ink text.
- Vermilion/coral primary actions.
- Cobalt information accents.
- Pale butter and restrained sage support colors.
- Minimal tactile texture and editorial whitespace.

### Dark theme

- Warm charcoal, not pure black.
- Bone/ivory primary text.
- Slightly softened coral primary actions.
- Cobalt shifts lighter for contrast.
- Tactile texture becomes subtler rather than inverted mechanically.
- Surfaces remain clearly separated without excessive borders or glow.

### Theme behavior

- Default to the operating-system preference on first visit.
- Provide a visible light/dark/system toggle in the top bar; mirror the same control in appearance settings.
- Persist the explicit choice.
- Apply the theme before first paint to prevent flashing.
- Theme every state, chart, focus ring, empty state, export preview, and Three.js fallback.

### Spacing and formatting rules

- Use an 8px base spacing rhythm with intentional 4px exceptions for compact metadata.
- Desktop content uses generous outer gutters and a readable maximum line length.
- Body copy defaults to 14–16px; interactive labels do not fall below 13px.
- Use no more than two font families.
- Prefer spacing, alignment, and dividers before cards, borders, or shadow.
- Never nest cards or turn every metric/list item into a card.
- Maintain consistent heading, label, metadata, and number formatting.
- Visible dates use the user's locale; stored dates remain UTC.

## 17. Responsive experience

### Desktop

Full strategy context, multi-column planning, drag-and-drop, analytics detail, and team review.

### Tablet

Collapsible navigation, two-column Today layout, touch-friendly planner, and contextual drawers.

### Mobile

Mobile is a production surface, not a compressed desktop dashboard.

Priorities:

- quick idea capture;
- today's next action;
- script/shot checklist;
- collaborator review and approval;
- rescheduling;
- export status and publish recovery;
- concise learnings.

The four-stage production spine becomes a vertical checklist. The week planner becomes an agenda. All drag actions have tap-based alternatives.

## 18. Accessibility and motion

Target WCAG 2.2 AA.

- Full keyboard navigation and visible focus.
- Semantic controls and landmarks.
- Non-color status cues.
- 44px touch targets where practical.
- Accessible authentication and form errors.
- Correct contrast in both themes.
- Screen-reader summaries for charts and the idea sculpture.
- Three.js is optional, dynamically loaded, pausable, and replaced by a static fallback for reduced motion, low-power devices, failed WebGL, or server rendering.
- No continuous animation is required to understand or operate the product.

## 19. Empty, loading, error, and recovery states

### Empty

Use onboarding context to recommend one next action. Never show an empty dashboard grid.

### Loading

Explain what is being analyzed, preserve entered work, and allow cancellation where processing may take time.

### Errors

State what failed, what is safe, whether work was saved or published, and the next recovery action. Platform-specific failures name the platform and capability.

### Recovery

- Autosave drafts and retain local unsent changes temporarily.
- Make retries idempotent.
- Support reconnect and revoke for integrations.
- Preserve version history for destructive content changes.
- Provide explicit undo for rescheduling and reversible status changes.

## 20. Technical architecture

### Application stack

- Next.js App Router with React and TypeScript.
- Server Components by default; small client islands for editing, theme, planner interactions, and Three.js.
- Supabase Postgres, Auth, private Storage, migrations, and row-level security.
- Stripe-hosted Checkout and Customer Portal.
- Provider adapters for analytics and later publishing connectors.
- Postgres-backed jobs/outbox for scheduled or asynchronous work.
- Vercel deployment and cron-triggered idempotent workers when production credentials exist.

### Security boundaries

- Server-only data-access layer enforces organization membership.
- RLS provides a second tenant-isolation boundary.
- Service credentials and social tokens never reach the browser.
- Assets use private buckets and short-lived signed URLs.
- Webhooks verify signatures, record event IDs, tolerate duplication, and do not assume ordering.
- Critical actions write audit events.

### Local and demo operation

The repository must remain usable without external credentials:

- deterministic demo workspace and realistic seeded data;
- local auth/data adapter for the product demo when Supabase is not configured;
- mock provider adapters that are explicitly labeled as demo data;
- manual export and analytics workflows that genuinely work;
- no fake successful social connection, checkout, or publish result.

Production services activate only when their required environment configuration is present.

## 21. Core data model

- `organizations`
- `memberships`
- `creator_profiles`
- `voice_profiles`
- `content_pillars`
- `opportunities`
- `opportunity_sources`
- `content_items`
- `content_versions`
- `content_variants`
- `production_tasks`
- `comments`
- `assignments`
- `assets`
- `calendar_entries`
- `social_connections`
- `publish_attempts`
- `metric_facts`
- `learnings`
- `subscriptions`
- `entitlements`
- `audit_events`
- `webhook_events`

Every tenant-owned row includes `organization_id`. Content variants and performance data remain connected to their source content item.

## 22. Testing strategy

### Unit tests

- Opportunity scoring and explanations.
- Plan capacity and workload rules.
- Entitlement checks.
- Content status transitions.
- Theme preference resolution.
- Provider capability mapping.
- Analytics learning confidence and sample-size rules.

### Integration tests

- Onboarding creates a usable workspace.
- Organization membership and RLS isolation.
- Content workshop autosave and versioning.
- Comments, assignments, approvals, and audit trail.
- Export package generation.
- Stripe webhook idempotency using fixtures.
- CSV analytics import and learning generation.

### End-to-end tests

- Free user onboarding to first seven-day plan.
- Choose opportunity → angle → hook → export.
- Collaborator comment and owner approval.
- Planner reschedule with undo.
- Light, dark, and system-theme persistence.
- Desktop and mobile primary workflows.
- Error and recovery paths.

### Visual and accessibility QA

- Compare desktop implementation against the approved combined mock at 1440 × 1024.
- Inspect mobile at 390 × 844 and tablet at 834 × 1194.
- Test both themes at full resolution.
- Run automated accessibility checks and manual keyboard navigation.
- Verify reduced motion and Three.js fallback.

## 23. First sellable release scope

### Required

- Marketing/landing route with product positioning and pricing.
- Authentication-ready shell and deterministic demo access.
- Personalized onboarding.
- Today screen matching the approved visual direction.
- Opportunity feed with source/freshness evidence and demo/local adapter.
- Angle, hook, outline, and script workshop.
- Shot/asset checklist and platform variants.
- Daily planner and calendar.
- Team roles, comments, assignments, and approvals.
- Light/dark/system themes.
- Export/native-finish workflow with downloadable deliverables.
- Manual/CSV results and actionable learnings.
- Free/Creator/Pro/Studio entitlement model.
- Stripe integration boundary and pricing surface; real checkout activates with credentials.
- Responsive desktop/tablet/mobile workflows.
- Accessible optional Three.js atmosphere with fallback.
- Focused automated tests, production build, and browser/visual QA.

### Deferred until credentials, review, or licensing exist

- Real social OAuth and direct publishing.
- Live platform analytics.
- Automated universal trend feeds.
- Automated trending-music feed or redistributed platform audio.
- Production email delivery.
- Live Stripe purchases and webhook verification.

Deferred integrations must have honest capability states and documented activation requirements.

## 24. Acceptance checklist

- [ ] A first-time visitor understands the product promise and can enter a demo or sign-up path.
- [ ] A new creator completes personalized onboarding and receives a useful non-empty workspace.
- [ ] The Today screen clearly answers what to do, what is moving, and what was learned.
- [ ] Opportunity recommendations show source, freshness, fit, and why-now reasoning.
- [ ] The creator can select/edit an angle and hook and produce a complete brief.
- [ ] The daily planner reflects effort, breathing room, and production stages.
- [ ] Collaborators can be represented with roles, assignments, comments, and approvals.
- [ ] Export produces an inspectable, usable native-publishing package.
- [ ] Manual or CSV performance data produces evidence-qualified learnings.
- [ ] Free-to-paid entitlements are visible and understandable without blocking basic product use.
- [ ] Light, dark, and system themes render without flash and preserve contrast.
- [ ] Desktop, tablet, and mobile primary workflows are usable.
- [ ] Keyboard, reduced-motion, and accessible fallback behavior work.
- [ ] Empty, loading, error, and recovery states are implemented for the primary workflow.
- [ ] Focused tests, typecheck, lint, production build, and browser smoke tests pass.
- [ ] Desktop and mobile screenshots are inspected at full resolution in both themes.
- [ ] No real external integration is presented as working without live verification.

## 25. Remaining risks

- Social platform review timing and changing API capabilities.
- Trend-data availability and licensing.
- Music-rights complexity.
- AI inference cost on a generous free tier.
- Generic output if voice memory and evidence are weak.
- Metric incompatibility across platforms.
- Users perceiving export-first as incomplete unless the native handoff is exceptionally polished.
- The Museboard working name may require trademark and domain clearance before public launch.

The mitigation is to make the creator-decision and production workflow valuable before any connection, keep expensive services metered, expose evidence and confidence, and treat each live connector as a separately verified capability.
