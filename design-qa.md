**Comparison Target**

- Source visual truth: `docs/design/museboard-approved-today-light.png` and `docs/design/museboard-approved-today-dark.png`.
- Rendered implementation: `tests/e2e/today-visual.spec.ts-snapshots/today-desktop-light-chromium-darwin.png`, `today-desktop-dark-chromium-darwin.png`, `today-mobile-light-chromium-darwin.png`, and `today-mobile-dark-chromium-darwin.png` in the same snapshot directory.
- Desktop viewport: 1440 × 1024. Mobile viewport: 390 × 844.
- State: personalized Maya sample workspace; light/dark explicit themes; reduced-motion raster state for deterministic visual baselines; live WebGL pause/resume verified separately.

**Full-view Comparison Evidence**

- The light and dark approved references were scaled to 1440 × 1024 and horizontally paired with their same-theme implementation captures for direct comparison.
- The implementation preserves the reference composition: 204px editorial rail, top date/theme controls, large greeting and opportunity typography, signal/evidence line, angle field, four-stage spine, three hook choices, collaborator context, narrow seven-day planner, and bottom learning strip.
- The 390 × 844 captures verify the compact header, theme/notification controls, personalized title hierarchy, next-block agenda, stage spine, and persistent five-item mobile navigation without horizontal overflow.

**Focused Region Comparison Evidence**

- Sculpture: supplied light/dark raster assets retain the approved woven subject and crop; the three reference labels (`Process stories`, `Imperfection as trust`, and `Creative courage`) are semantic DOM outside the `aria-hidden` canvas.
- Decision controls: selected radio, fit indicator, stage state, primary coral CTA, and rewrite action match the approved hierarchy and remain keyboard-native.
- Planner and learning: data is intentionally personalized and truthful rather than copied from the mock. Empty learning state reports 0 measured posts and unavailable confidence instead of inventing results.

**Required Fidelity Surfaces**

- Fonts and typography: existing Instrument Serif and Manrope product fonts preserve the approved editorial/display and compact product hierarchy; wrapping is stable at both tested viewports.
- Spacing and layout rhythm: the rail, decision column, context column, planner, and learning strip retain the reference proportions; 44px minimum controls and 4px-base spacing are preserved.
- Colors and visual tokens: all surfaces use the existing semantic background, ink, muted, coral, cobalt, success, warning, and border tokens in both themes.
- Image quality and asset fidelity: all five supplied raster assets are used directly through `next/image`; there are no avatar placeholders, CSS illustrations, handcrafted SVGs, or div art.
- Copy and content: greeting, opportunity, evidence, audience, angle, hooks, planner, and voice cues are sourced from the persisted personalized workspace. Sample/provider limitations are explicit.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Accepted product-truth difference: the approved reference shows historical performance and a full generic week, while a newly onboarded workspace has three capacity-feasible tasks and no measured learning yet. The implementation exposes those real states rather than fabricating the reference values.

**Comparison History**

1. First pass found the reference's three visible idea-thread labels absent from the supplied standalone sculpture rasters. Added semantic, theme-safe labels outside the canvas and re-ran focused and visual tests.
2. First automated light capture switched a live GPU surface to static media in-frame and produced compositor artifacts. Separated the isolated WebGL interaction test from reduced-motion screenshot baselines and regenerated all captures.
3. The Next development badge covered the mobile Today tab. Disabled development indicators and regenerated all four visual baselines.
4. Final side-by-side pass found no remaining actionable P0/P1/P2 mismatches.

**Follow-up Polish**

- P3: future measured-data tasks can replace the truthful zero-state learning copy with deterministic metric evidence.

**Implementation Checklist**

- [x] Approved light/dark composition preserved.
- [x] Desktop and mobile light/dark captures inspected at requested viewports.
- [x] Personalized store data and truthful sample disclosure retained.
- [x] Hook, theme, pause/resume, reduced-motion fallback, navigation, and overflow verified in browser.
- [x] No browser console errors in the six-case Today suite.

final result: passed
