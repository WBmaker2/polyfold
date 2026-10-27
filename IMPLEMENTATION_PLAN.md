# PolyFold — Implementation Plan

**Project name:** PolyFold
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/polyfold`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All logic runs in the browser.
**Target learners:** Grades 5–8 (Korean 초5~중2)
**Subject:** Mathematics — solids, nets, surface area, volume, cross-sections
**MVP duration:** 3–4 weeks

---

## 0. One-page summary

PolyFold is a 3D geometry playground where students predict how a 2D net folds into a solid, watch the folding animation, slice the solid with a plane, and explain the resulting cross-section.

The app has three layers:

1. **Explore** — choose a solid, choose a net, fold/unfold with a slider, orbit the camera.
2. **Slice** — move an oriented plane through the solid and see the cross-section as a 2D shape.
3. **Challenge** — answer prediction questions, earn stars, and unlock harder solids.

The product is deliberately **not** an AI tutor. The learning comes from prediction, manipulation, and reflection. All content is local JSON; progress stays in `localStorage`.

**Why this is a good first build**

- Tight scope: five solids in the MVP.
- Verifiable math: geometry can be unit-tested against known formulas.
- Strong visual payoff: folding and slicing are inherently satisfying.
- No external 3D assets: all geometry is procedural.
- Exercises 3D rendering, animation, interaction, responsive layout, accessibility, and testing in one project.

---

## 1. Product definition

### 1.1 Learning problem

Students often memorize net diagrams without understanding the relationship between a 2D net and a 3D solid. Cross-sections are especially hard because they require mentally rotating a plane through an object.

### 1.2 Learning goals

By the end of the core challenges, a student should be able to:

- Decide whether a given net can fold into a named solid.
- Match a net to its solid and identify opposite faces.
- Compute surface area and volume from edge lengths.
- Predict the shape of a cross-section for a cube and a pyramid.
- Explain why a particular net does or does not fold.

### 1.3 Core learning loop

1. **Predict** — the app asks a question before the student manipulates anything.
2. **Observe** — the student folds, rotates, or slices the solid.
3. **Explain** — the student chooses or writes a short reason.
4. **Apply** — a new challenge uses the same idea with a different solid.

The prediction gate is mandatory in challenge mode. It prevents the animation from becoming a passive cartoon.

### 1.4 Success criteria

- A student can complete the first three challenges without teacher help.
- A student can explain the difference between a valid and invalid cube net.
- A teacher can reset progress and select a challenge set without editing code.

---

## 2. Scope

### MVP (must ship)

- Five solids: cube, rectangular prism, triangular prism, square pyramid, regular tetrahedron.
- Net gallery with at least three nets per solid (at least one invalid for the cube and pyramid).
- Fold/unfold slider plus auto-play.
- Orbit camera with mouse, touch, and keyboard.
- Cross-section plane with position and orientation controls.
- 2D cross-section panel showing the exact polygon.
- Surface area and volume panel with formula and computed value.
- Eight challenges across four types.
- Local progress, star rating, and teacher reset.
- Responsive layout for desktop, tablet, and phone.
- Keyboard and reduced-motion support.
- PWA install + offline cache.

### Later (do not build in the first pass)

- Free-form net editor.
- Cylinder and cone (curved surfaces complicate unfolding).
- Euler's formula explorer.
- Classroom dashboard or accounts.
- AR/VR mode.
- Localization beyond Korean and English UI labels.

### Out of scope

- Any server, database, login, or analytics service.
- Any runtime AI feature, chatbot, or generated content.
- Uploaded images or user-created 3D models.
- Multiplayer.

---

## 3. Tech stack

| Layer         | Choice                                    | Reason                                         |
| ------------- | ----------------------------------------- | ---------------------------------------------- |
| Build         | Vite + TypeScript                         | Fast dev server, simple static output          |
| 3D            | Three.js                                  | Mature scene graph, OrbitControls, raycasting  |
| UI            | Vanilla DOM + CSS custom properties       | No UI framework needed; keeps bundle small     |
| Math tests    | Vitest                                    | Fast unit tests for geometry                   |
| Browser tests | Playwright                                | Interaction, screenshots, responsive viewports |
| PWA           | `vite-plugin-pwa`                         | Offline cache and install prompt               |
| Lint/format   | ESLint + Prettier                         | Consistent code                                |
| Hosting       | GitHub Pages / Cloudflare Pages / Netlify | Static, no server                              |

**Constraints**

- Node.js 20+.
- No backend, no environment variables, no API keys.
- No network requests at runtime except loading the app's own static assets.
- Prefer procedural geometry over downloaded models.
- Keep the initial gzip bundle under 700 KB.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts                 application shell and routing
    routes.ts              explore / challenge / teacher routes
    state.ts               observable app state
  geometry/
    types.ts               Vec2, Vec3, Face, SolidDefinition, NetLayout
    solids.ts              procedural solid definitions
    nets.ts                net layouts and validity data
    folding.ts             hinge tree and fold transforms
    crossSection.ts        plane-polyhedron intersection
    measure.ts             surface area and volume
    polyhedron.ts          shared geometry helpers
  render/
    SceneManager.ts        renderer, camera, lights, resize
    SolidView.ts           solid mesh, edges, face highlighting
    NetView.ts             2D net preview and face mapping
    SectionPlane.ts        plane helper and cross-section outline
    cameraModes.ts         orbit, front, top, net view
  features/
    explore/               sandbox controls
    challenge/             question flow and scoring
    teacher/               reset, challenge selection, answer key
  data/
    solids.json            optional exported data for review
    challenges.json        challenge content
  ui/
    components/            button, slider, panel, modal, toast
    styles/                tokens.css, base.css, layout.css
  storage/
    progress.ts            localStorage read/write with versioning
  tests/
    unit/                  geometry tests
    e2e/                   Playwright tests
```

### 4.2 Data flow

```text
User input
  -> app state (selected solid, net, fold t, section plane, challenge)
  -> geometry modules (fold transforms, section polygon, measurements)
  -> render modules (solid mesh, net preview, outline)
  -> UI panels (formulas, question, feedback)
```

The geometry layer must be pure TypeScript with no Three.js dependency where possible. Three.js objects are created only in the render layer. This makes the math testable in Node.

### 4.3 State

Keep one serializable state object:

```ts
interface AppState {
  route: 'explore' | 'challenge' | 'teacher';
  solidId: string;
  netId: string;
  foldT: number; // 0 = flat, 1 = folded
  section: {
    enabled: boolean;
    normal: Vec3;
    offset: number; // distance from origin
  };
  challenge: {
    currentId: string | null;
    answers: Record<string, string>;
    stars: Record<string, number>;
  };
  preferences: {
    reducedMotion: boolean;
    showFormulas: boolean;
  };
}
```

State changes should go through a small store with subscribe/notify. Avoid a heavy state library.

### 4.4 Persistence

- `localStorage` key: `polyfold.progress.v1`.
- Store only challenge answers, stars, last solid, and preferences.
- Version the schema. If the version is unknown, reset with a warning.
- Teacher reset clears the key after confirmation.
- No personal data, no names, no accounts.

---

## 5. Data model

### 5.1 Solid definition

```ts
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Face {
  id: string;
  vertexIndices: number[]; // counter-clockwise when viewed from outside
  label?: string; // e.g. "front", "base"
}

interface SolidDefinition {
  id: string;
  nameKo: string;
  nameEn: string;
  vertices: Vec3[];
  faces: Face[];
  netLayouts: NetLayout[];
  formulas: {
    surfaceArea: string;
    volume: string;
  };
  measures: {
    surfaceArea: number;
    volume: number;
  };
}
```

### 5.2 Net layout

```ts
interface NetFace {
  faceId: string;
  polygon: Vec2[]; // 2D position in the net
  hinge?: {
    parentFaceId: string;
    edge: [Vec2, Vec2]; // shared edge in 2D
  };
}

interface NetLayout {
  id: string;
  solidId: string;
  valid: boolean;
  faces: NetFace[];
  noteKo?: string; // explanation for invalid nets
}
```

### 5.3 Challenge

```ts
interface Challenge {
  id: string;
  type: 'valid-net' | 'identify-solid' | 'cross-section' | 'measure';
  solidId: string;
  promptKo: string;
  options?: string[];
  answer: string;
  explanationKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.4 Content rules

- All challenge text is local and teacher-reviewable.
- Every answer must have a short explanation, not just "correct".
- Invalid nets need a concrete reason: overlap, missing face, wrong hinge, or impossible fold.
- Use Korean as the default UI language; keep an `en` field for future localization.

---

## 6. Core algorithms

### 6.1 Solid definitions

Build the five solids from vertex and face tables. Use exact coordinates where possible (unit cube, regular tetrahedron) so tests can assert known values.

Known checks:

| Solid                     | Vertices | Faces | Edges | Surface area       | Volume                 |
| ------------------------- | -------: | ----: | ----: | ------------------ | ---------------------- |
| Cube (edge 1)             |        8 |     6 |    12 | 6                  | 1                      |
| Rectangular prism (1×2×3) |        8 |     6 |    12 | 22                 | 6                      |
| Triangular prism          |        6 |     5 |     9 | depends on base    | base area × length     |
| Square pyramid            |        5 |     5 |     8 | base + 4 triangles | base area × height / 3 |
| Regular tetrahedron       |        4 |     4 |     6 | √3 × edge²         | edge³ / (6√2)          |

### 6.2 Net-to-solid mapping

1. Build a face adjacency graph from shared edges.
2. Choose a root face and a spanning tree of the graph.
3. Lay out the root face in the 2D plane.
4. For each child face, place it across the shared edge with the parent.
5. Record the hinge edge for each child.
6. Validate that no two faces overlap in 2D and that all faces are connected.

For the MVP, the net layouts are authored data, not generated at runtime. The validator can check them, but the app does not need to enumerate all possible nets.

### 6.3 Folding

- Each non-root face has a parent and a hinge axis.
- The flat net is the state at `t = 0`; the solid is the state at `t = 1`.
- Compute the target dihedral angle from the solid's face normals.
- Rotate each face around its hinge axis by `t × targetAngle`.
- Apply transforms hierarchically from the root outward.
- Use quaternions or rotation matrices; avoid Euler angle accumulation errors.
- Animate `t` with a smoothstep curve, but allow scrubbing.

**Critical test:** at `t = 1`, every face's world-space vertices must match the target solid's vertices within `1e-6`.

### 6.4 Cross-sections

For convex solids in the MVP:

1. Represent the cutting plane as `n · p = d`.
2. For each face polygon, clip it against the plane.
3. Collect the intersection segments.
4. Chain segments into one or more closed polygons.
5. Project the polygon into the plane's 2D basis for display.
6. Render the 3D outline and a filled 2D shape.

Known cube cases to test:

- Plane parallel to a face → square.
- Plane through four edges → rectangle.
- Plane through three adjacent vertices → equilateral triangle.
- Plane through six edges → regular hexagon.
- Plane through a vertex and opposite edges → pentagon.

If the polygon has fewer than three points, show "No cross-section" instead of an error.

### 6.5 Measurements

- Surface area: sum the area of each face using the cross product.
- Volume: sum signed tetrahedron volumes from the origin (divergence theorem).
- Display the formula with the actual substitution, not only the final number.
- Round display values to two decimals; keep full precision internally.

### 6.6 Net validity

For the cube, use the known set of 11 valid hexomino nets. For other solids, use authored valid/invalid examples and validate connectivity, overlap, and fold completion.

Do not let the app claim to enumerate every possible net. The MVP teaches recognition, not exhaustive combinatorics.

---

## 7. Screens and UX

### 7.1 Student flow — Explore

1. Land on a gallery of five solids.
2. Pick a solid; the camera frames it.
3. Toggle between 3D solid and 2D net.
4. Drag the fold slider or press Play.
5. Orbit the camera; tap a face to highlight its counterpart in the net.
6. Open the slice panel; move the plane and watch the cross-section.
7. Read the formula panel.

### 7.2 Student flow — Challenge

1. A question appears with a prediction gate.
2. The student selects an answer and commits.
3. The app reveals the correct answer with a short explanation.
4. The student can open the sandbox to verify.
5. Stars are awarded for first-try correctness and for using the explanation panel.

### 7.3 Teacher mode

- Select a challenge set.
- Show or hide answers.
- Reset local progress.
- Print a worksheet of the current challenge set.
- No login. Teacher mode is a local toggle, not a security boundary.

### 7.4 Layout

**Desktop (≥ 1024 px)**

- Left: solid/net gallery and challenge list.
- Center: 3D viewport.
- Right: controls, formulas, cross-section panel.

**Tablet (768–1023 px)**

- Center viewport with collapsible side panels.
- Bottom sheet for controls.

**Phone (< 768 px)**

- Full-width viewport at the top.
- Tabbed bottom panel: Fold | Slice | Measure | Challenge.
- Touch orbit and pinch zoom.
- Large tap targets (≥ 44 px).

### 7.5 Accessibility

- Keyboard: arrow keys orbit, `+`/`-` zoom, `Tab` moves focus, `Space` toggles fold play.
- Every canvas interaction has a DOM control equivalent.
- Show a text description of the current solid and cross-section.
- Respect `prefers-reduced-motion`; replace auto-play with an instant state change.
- Do not rely on color alone; use labels and patterns.
- Provide a 2D net view as the non-3D alternative.
- Focus rings must be visible on all controls.
- Use `aria-live` for challenge feedback.

---

## 8. Implementation milestones

### M0 — Project setup (0.5 day)

- Scaffold Vite + TypeScript.
- Add Three.js, Vitest, Playwright, ESLint, Prettier.
- Add `vite-plugin-pwa`.
- Create the module folders and a blank scene.
- Add npm scripts: `dev`, `build`, `test`, `test:e2e`, `lint`.
- **Verify:** blank page renders, tests run, production build succeeds.

### M1 — Geometry core (3–4 days)

- Implement `Vec2`, `Vec3`, polygon area, face normals, and polyhedron helpers.
- Define the five solids.
- Implement surface area and volume.
- Implement net layouts and the connectivity/overlap validator.
- Write unit tests for every solid and every known measurement.
- **Verify:** all geometry tests pass; no Three.js imports in the geometry layer.

### M2 — 3D solid and net views (3–4 days)

- Render solids with faces, edges, and subtle face colors.
- Add orbit controls.
- Render the 2D net with face labels and hover/click mapping.
- Add the fold slider and auto-play.
- Implement the hinge tree and fold transforms.
- **Verify:** at `t=1`, folded vertices match the solid; at `t=0`, the net is flat.

### M3 — Cross-sections (2–3 days)

- Implement plane-polyhedron intersection.
- Add plane position and orientation controls.
- Render the 3D outline and the 2D cross-section polygon.
- Add the "no cross-section" state.
- Write tests for the known cube cases.
- **Verify:** triangle, square, rectangle, pentagon, and hexagon cases all pass.

### M4 — Challenge and teacher mode (2–3 days)

- Build the challenge data and question flow.
- Add prediction gating and explanations.
- Add star scoring and progress persistence.
- Build teacher reset and answer key.
- **Verify:** a full challenge set can be completed and reset.

### M5 — Responsive, accessibility, PWA (2 days)

- Implement the three layouts.
- Add keyboard controls and focus management.
- Add reduced-motion behavior.
- Add the 2D/text alternatives.
- Configure the service worker and install prompt.
- **Verify:** keyboard-only completion of the first challenge; offline reload works.

### M6 — QA and pilot (2 days)

- Run the full test suite.
- Capture screenshots at desktop, tablet, and phone sizes.
- Test on a low-end tablet or throttled Chromium.
- Ask 3–5 students to try the first three challenges.
- Fix the top three usability issues.
- Deploy to a static host.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- Vertex, face, and edge counts for all five solids.
- Euler characteristic `V - E + F = 2`.
- Surface area and volume against known values.
- All 11 cube nets are valid; at least 5 invalid layouts are rejected.
- Fold transforms at `t=0` and `t=1`.
- Cross-section polygons for known cube cases.
- Measurement rounding and unit labels.

### Interaction tests (Playwright)

- Select each solid and switch between solid/net views.
- Drag the fold slider to both ends.
- Move the section plane and confirm the 2D shape updates.
- Answer a challenge correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only path through the first challenge.

### Visual tests

- Screenshot the default state, folded cube, and hexagon cross-section.
- Compare against stored snapshots with a small pixel tolerance.
- Run at 1440×900, 1024×768, and 390×844.
- Check that UI panels do not cover the viewport on phone.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Tab order reaches every control.
- Focus is visible.
- Reduced motion disables auto-play.
- Canvas has an accessible name and a text summary.

### Performance budget

- Initial load < 2 s on a simulated 4G connection.
- 60 fps on a mid-range laptop; ≥ 30 fps on a school tablet.
- Geometry allocation only on solid/net change, not every frame.
- Pause rendering when the tab is hidden.
- Clamp device pixel ratio to 2.

---

## 10. Acceptance criteria / Go-No-Go

Ship the MVP only if all of these are true:

- [ ] Five solids render with correct faces, edges, and measurements.
- [ ] Fold animation reaches the exact solid at `t=1`.
- [ ] At least 11 valid cube nets and 5 invalid nets are handled correctly.
- [ ] Six known cube cross-sections produce the correct polygon.
- [ ] Eight challenges are playable, scored, and saved locally.
- [ ] Teacher reset works.
- [ ] The core flow works with a keyboard only.
- [ ] Reduced motion is respected.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.
- [ ] Desktop and tablet run at the target frame rate.
- [ ] A 5-student pilot completes the first three challenges with minimal help.

If any of the geometry or cross-section checks fail, stop and fix the math before adding content.

---

## 11. Risks and mitigations

| Risk                                              | Impact                      | Mitigation                                                                                    |
| ------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| Fold transforms produce mirrored or twisted faces | Wrong solid; destroys trust | Golden tests for every solid; debug axes; compare vertex positions at `t=1`                   |
| Net validator accepts an impossible net           | Teaches a false rule        | Use authored valid/invalid sets for MVP; add connectivity and overlap checks; label the scope |
| Cross-section edge cases produce open polygons    | Broken visual               | Handle empty/one-point/two-point cases; test all known cube cuts                              |
| 3D performance on school tablets                  | Unusable in class           | Low-poly meshes, no shadows by default, DPR clamp, pause offscreen                            |
| Animation encourages passive watching             | Weak learning               | Prediction gate, explanation prompts, challenge mode                                          |
| 3D content is inaccessible                        | Excludes some students      | 2D net view, text descriptions, keyboard controls, DOM controls for every action              |
| Scope creep into net enumeration or AR            | Delays MVP                  | Keep the five solids and authored nets; defer generation and AR                               |

---

## 12. AI build guide

This project is intended to be built with an AI coding agent. Use the model for scaffolding, geometry implementations, tests, and screenshot-driven fixes. Do not trust generated math without verification.

### Recommended build order

1. Ask the agent to scaffold the stack and create the empty module map.
2. Ask for the geometry types and pure functions first, with unit tests.
3. Ask for the solid definitions and known-value tests.
4. Ask for the folding rig and the `t=1` vertex-match test.
5. Ask for the cross-section algorithm and the known cube cases.
6. Ask for the Three.js render layer and camera controls.
7. Ask for the UI, challenge flow, and teacher mode.
8. Ask for responsive/accessibility passes.
9. Use screenshots at three viewports and ask the agent to fix visual regressions.
10. Run the full test suite and the acceptance checklist.

### Prompt rules

- State the constraint every time: “No backend, no runtime AI, no network calls.”
- Require tests before or alongside geometry code.
- Ask the agent to explain the folding math in plain language before coding it.
- Give exact expected values for tests; do not let the agent invent them.
- When a visual bug appears, provide a screenshot and the expected state.
- Keep each change small enough to review.

### What not to delegate

- The decision about which nets are valid.
- The final review of cross-section shapes.
- Accessibility judgment.
- Classroom pilot feedback.
- Any claim that the app is “correct” without running the tests.

### Definition of done

- All unit, interaction, and visual tests pass.
- The acceptance checklist is complete.
- The production build runs offline.
- A teacher can use the app without developer help.

---

## 13. Future extensions

- Free-form net editor with live validity checking.
- Cylinder and cone nets with curved-surface approximations.
- Euler characteristic explorer.
- Classroom worksheet generator.
- Localization (English, Japanese).
- Export a challenge result as a printable PDF.
- Optional AR view using WebXR, only after the core experience is solid.

---

## 14. References

- Three.js documentation: https://threejs.org/docs/
- Vite documentation: https://vite.dev/guide/
- Vitest documentation: https://vitest.dev/
- Playwright documentation: https://playwright.dev/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- Cube net enumeration (11 valid hexomino nets): standard elementary geometry reference.

---

**Plan version:** 1.0
**Created:** 2026-10-27
**Next step:** scaffold the project, then implement M0–M1 before writing any UI.
