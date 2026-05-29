# Editorial review — tutorial vs API reference scope

A pass focused on **scope**: which tutorial sections are doing
reference-doc work and which API pages are doing tutorial work. The
prior three reviews focused on narrative flow and cross-linking; this
one asks a different question: *is this content in the right
document?*

Rubric:

- **Tutorial** = continuous story. One idea per chapter, demo-led,
  read top-to-bottom.
- **API reference** = lookup. Per-export, exhaustive, no story.

Verdict shorthand below: **CUT**, **CUT+ADD** (move to API ref, may
need to add there), **TRIM** (one-liner in tutorial, rest in API ref),
**REFRAME** (right content, wrong voice), **KEEP**.

---

## Chapter 1 — Your first scene

`site/src/routes/tutorial/01-your-first-scene.mdx`

The whole chapter is 41 lines. There is essentially **no scope
violation** here — the chapter introduces `<Canvas>`, `createT`, and
the `<T.*>` namespace, each with one or two sentences, and explicitly
defers tree-shaking concerns to the API page:

> "In real apps you'd hand `createT` a curated object to keep your
> bundle small; see [the API reference](/api/components/t) for the
> details." (line 34–36)

This is the model. It does exactly what the rest of the tutorial
should do — names the export, gives the load-bearing idea, points to
the reference for the rest.

**One micro-note**: the parenthetical about `MeshNormalMaterial`
("which tints each face by its surface normal — a handy debugging
material…", line 27–29) is reference-y but tiny and earns its place
because the reader is staring at it in the demo and asking "what is
that colour?". **KEEP.**

---

## Chapter 2 — Props and children

`site/src/routes/tutorial/02-props-and-children.mdx`

Mostly story. Two passages drift into reference work.

### 2.1 "Transforms" section (lines 36–40) — TRIM, lean toward KEEP

```
- `position={[x, y, z]}`
- `rotation={[x, y, z]}` (radians)
- `scale={[x, y, z]}` (or a single number — `scale={2}` doubles every axis)
```

A literal three-bullet enumeration of props. This is exactly the
"bullet list of options" symptom. **But** these three props are the
load-bearing primitives for the whole chapter — the next two sections
(Composing transforms, the group demo) use them — so the inventory is
earning its place by setting up the demos. **KEEP**, but with the
caveat that this is the only "table-shaped" content the tutorial can
afford. Don't repeat the pattern elsewhere.

### 2.2 "Reaching into nested props" (lines 76–86) — CUT+ADD

```
Sometimes you want to set something inside something —
`light.shadow.mapSize.width`, for example. Use a dashed key:
```tsx
<T.DirectionalLight castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
```
`solid-three` walks the chain and applies the same shorthand rules at
the leaf. The whole prop system, all the way down.
```

This is a syntax reference paragraph parked mid-chapter. It has **no
demo** (the only section in the tutorial without one — v1 and v2 both
flagged it on different grounds). The dashed-key syntax is a feature
of `useProps`, not of the tutorial's mental model.

The current API ref at `/api/components/entity.mdx` (lines 96–122)
already documents this exact feature, including the same
`shadow-mapSize-width` shape and the "deep nesting" pattern. The
content is already in the API ref.

**Recommendation**: cut from tutorial entirely, or shrink to one line
inside the closing "shorthands" sub-section:

> "Dashed keys reach into nested setters too:
> `shadow-mapSize-width={1024}`. See [Advanced Prop
> Patterns](/api/components/entity#advanced-prop-patterns)."

Note: `/api/components/entity#advanced-prop-patterns` is the right
target. Worth promoting that section to its own page or to
`use-props.mdx`, since it's *the* prop-pipeline reference and it's
currently buried under "Entity".

### 2.3 "Why arrays work on a `Vector3`" / shorthands list (lines 88–103) — TRIM

```
- `position={[x, y, z]}` — arrays unpack into `Vector3.set(x, y, z)`.
- `scale={1.2}` — a single number sets every axis (via `setScalar`).
- `color="cornflowerblue"` or `color={[1, 0.4, 0.2]}` — both work;
  `Color` accepts strings, hex numbers, and RGB tuples.
```

This is a coercion-rules reference table dressed as a teaching
section. The opening prose ("`solid-three` is forgiving about the
shape of what you hand it…") *is* tutorial; the bullets *are*
reference.

**But**: there is currently nowhere in the API ref that documents the
smart-prop coercion rules in a structured way. `entity.mdx` covers
dashed keys; nothing covers arrays-into-Vector3, single-number-into-
scale, color tuples.

**Recommendation**:

- **Add** a "Smart-prop coercion" section (or its own page) under the
  API ref — likely at `/api/hooks/use-props` since `useProps` is the
  pipeline. It should list each shorthand with the underlying call:
  arrays → `Vector3.set(...)`, scalars → `setScalar(...)`,
  colour-coercion rules, etc.
- **Trim** the tutorial section to two sentences plus the demo, ending
  with a link out:

  > "Arrays unpack into `Vector3.set(...)`, single numbers go through
  > `setScalar`, colour strings and tuples both coerce to a `Color`.
  > The [smart-prop reference](/api/hooks/use-props#coercion-rules)
  > lists the full set."

The demo is the payoff; keep the demo. The list is reference.

---

## Chapter 3 — Control flow

`site/src/routes/tutorial/03-control-flow.mdx`

**The cleanest chapter in the tutorial w.r.t. scope.** Every section
is a Solid primitive + one demo + 1–2 sentences of prose. No
enumerations, no tradeoff tables, no "you can also…" asides. The
`<Suspense>` section names `createResource` (line 67) without
expanding on it, which is the right move — `createResource` belongs in
Solid's docs, not solid-three's.

The "more on disposal later" parenthetical (line 27) gestures at
content that doesn't fully land later in the tutorial; that's a
narrative loose-end, not a scope issue. **KEEP** the whole chapter.

---

## Chapter 4 — Pointer events

`site/src/routes/tutorial/04-pointer-events.mdx`

Two sections drift into reference territory, plus one that's
borderline.

### 4.1 "When you actually want the full list" (lines 73–88) — CUT, link out

```
Stopping is the common case, but sometimes you want to know about every hit
— measuring through walls, x-ray selection, "click through" tools. The event
exposes the full `intersections` array (sorted nearest-first), so a single
handler can deal with the whole stack itself:

```tsx
<T.Mesh onClick={event => {
  for (const hit of event.intersections) {
    console.log(hit.distance, hit.object.name)
  }
}}>
```

Most scenes never need this — but it's there when you do.
```

This is a textbook "tradeoff matrix" section: edge case + code snippet
+ "most code doesn't need this". v3 flagged it as a flow issue; from a
scope perspective it's worse than that — there's no demo, the snippet
just prints to console, and the kicker ("most scenes never need this")
is a tell that the content knows it doesn't belong.

**The API ref does not currently document `intersections`** beyond a
passing mention. `/api/events/overview.mdx` lists the Event interface
(line 41–46) as `{ nativeEvent, stopped, stopPropagation }` — there's
no `intersections` field documented at all.

**Recommendation**:

- **Cut** the section from the tutorial. Replace with one sentence at
  the end of the preceding "Stopping events" section:
  > "If you do want every hit — for x-ray selection, measure-through-
  > walls, or 'click through' tools — `event.intersections` is sorted
  > nearest-first. See the [events
  > reference](/api/events/overview#event-object)."
- **Add** an `intersections` entry to the Event Object table in
  `/api/events/overview.mdx`, plus a short subsection with the
  for-loop pattern.

### 4.2 "What's actually in the event?" (lines 90–98) — REFRAME

```
The handler receives an enriched event object: the original DOM event
plus the `three.js` intersection data — the hit `point`, the
`distance`, the `face` and `faceIndex`, the mesh `object`, the
unprojected `ray`. Useful when "click" alone isn't enough:
drag-to-rotate, paint-on-surface, world-space gizmos. The
[events API reference](/api/events/overview) has the full event-object
shape and the complete list of supported handlers.
```

This is the *correct* shape of a closing reference-pointer section:
short, names what's in the bag, lists use cases, links out. But the
list of fields (`point`, `distance`, `face`, `faceIndex`, `object`,
`ray`) is a mini reference embedded in tutorial prose — **and those
fields are not documented in the API ref at all**. Same omission as
4.1.

**Recommendation**:

- **Add** the full intersection-event shape to
  `/api/events/overview.mdx`. The Event interface there (lines 40–47)
  is currently a stub — it shows three properties but `solid-three`
  actually attaches the full `Intersection` data.
- **Trim** the tutorial paragraph to:

  > "The handler receives an enriched event object — the original DOM
  > event plus the `three.js` intersection data (hit point, distance,
  > face, object, ray). The [events
  > reference](/api/events/overview#event-object) has the full shape."

The use-case examples ("drag-to-rotate, paint-on-surface, world-space
gizmos") can stay — they're the *payoff* sentence, motivating why a
reader would care.

### 4.3 Clicking nothing / `onClickMissed` (lines 38–48) — KEEP

This is the chapter's payoff section, with a real demo. Doesn't drift.

---

## Chapter 5 — useFrame

`site/src/routes/tutorial/05-use-frame.mdx`

Two sections leak into reference work.

### 5.1 "What else is in `context`?" (lines 40–44) — KEEP

```
The first argument to your callback is the same scene context exposed by
[`useThree`](/api/hooks/use-three) — `gl`, `scene`, `camera`, `clock`,
`size`. Useful when your animation depends on more than just elapsed time.
```

Short, names the fields, links out. Right size for what it's doing.
The `useThree` API page (`/api/hooks/use-three.mdx` lines 27–40)
exhaustively documents the context — this paragraph correctly hands
off. **KEEP.**

### 5.2 "Options: `stage`" (lines 58–66) — CUT, fold to one line

```
`stage: "before"` (the default) runs the callback before the render pass —
your mutations show up this frame. `stage: "after"` runs it after — handy
for post-render bookkeeping or custom render passes that need to come
between frames.

Most code never needs to set these, but they're there when you do —
[the full options](/api/hooks/use-frame) are in the API reference.
```

The kicker "most code never needs to set these" is, again, the tell.
And `stage` is already documented in `/api/hooks/use-frame.mdx` (line
17, line 23–30, with a code example on lines 48–53).

**Recommendation**: cut the section. Fold one parenthetical into the
preceding `priority` discussion:

> "…lower numbers run first within the same stage; there's also a
> `stage` option for post-render passes, which most code can ignore.
> See [`useFrame`](/api/hooks/use-frame) for the full options."

v3 made the same suggestion on flow grounds; same answer from scope.

### 5.3 "Options: ordering with `priority`" (lines 46–56) — KEEP

This *is* a demo-led section with the visible "swap the priorities and
the camera will lag the cube by one frame" payoff. Earns its space.

### Inverse: API ref `useFrame` page is correctly scoped

`/api/hooks/use-frame.mdx` is short (57 lines), lists params,
TypeScript signature, two usage examples, and a link back to the
tutorial. Right shape. **KEEP.**

---

## Chapter 6 — Loaders & Resource

`site/src/routes/tutorial/06-loaders-and-resource.mdx`

Mostly story; the closing paragraph is the scope violation.

### 6.1 "Both forms compose with the rest of Solid…" closer (lines 48–54) — TRIM

```
Both forms compose with the rest of Solid the way you'd expect — loader
errors propagate to the nearest `<ErrorBoundary>`, multiple loaders
share the [cache](/api/utilities/loader-cache), you can pass an array
of URLs (`[a, b, c]`) or a labelled record
(`{ albedo, normal, roughness }`) for material sets. The
[`useLoader` API reference](/api/hooks/use-loader) has the full surface;
the shapes above are what you'll reach for daily.
```

Three reference facts in one sentence — error behaviour, cache,
URL-shape overloads. No demo backs any of them. v3 said the paragraph
form was "one-shrug-acceptable" relative to v2's bullet form; from a
scope perspective it's still a reference dump.

Comparing to the API ref:

- `/api/hooks/use-loader.mdx` (lines 40–95) documents URL shapes
  (single, array, record) exhaustively with worked examples. So
  "you can pass an array of URLs… or a labelled record" is **already
  fully covered**.
- `/api/utilities/loader-cache.mdx` documents the cache with refcount
  semantics and dispose API. So "multiple loaders share the cache" is
  **already fully covered**.
- The `<ErrorBoundary>` integration is **not currently mentioned in
  the API ref** — should be added to `use-loader.mdx`.

**Recommendation**:

- **Trim** the tutorial closer to one sentence:
  > "Both compose the rest of the way you'd expect — `<Suspense>` for
  > the wait, `<ErrorBoundary>` for failures, automatic caching
  > across components. The [`useLoader`
  > reference](/api/hooks/use-loader) lists the loader/URL shapes."
- **Add** an "Errors" subsection to `/api/hooks/use-loader.mdx`
  documenting `<ErrorBoundary>` propagation behaviour.

### Inverse: API ref `<Resource>` page is undersized

`/api/components/resource.mdx` (42 lines) is too thin for a public
component. It has no prop typescript signature, no description of the
`cache` prop's semantics (mentioned only in a code comment on line
40), and doesn't explain how `attach` works.

**Recommendation**: not a tutorial-scope issue, but flag for follow-up
— `<Resource>` needs the same Typescript Interface details block that
`<Canvas>` and other components have.

---

## Chapter 7 — Portal

`site/src/routes/tutorial/07-portal.mdx`

Story-heavy throughout. One section drifts.

### 7.1 "Six things to notice" bullet list (lines 43–58) — TRIM (REFRAME)

```
A cube whose faces are *each frame's render* of a spinning torus knot
that lives in a separate scene. Six things to notice:

- `<Portal element={offscreenScene}>` sends the knot into the
  off-screen scene instead of the canvas's main one.
- `CopyOffscreenToTexture` is a regular `solid-three` component that
  uses `useThree()` to grab the renderer and copies the off-screen
  scene into the render target every frame.
- The outer cube reads `renderTarget.texture` for its `map` —
  solid-three's smart-prop pipeline accepts a `THREE.Texture` the same
  as anything else.
- The knot still spins reactively from inside `Portal` — same
  `useFrame`, same ref, same lifecycle. Portal doesn't break Solid.
- The off-screen scene has its own lights — they only affect the knot,
  not the outer cube.
- Both cubes rotate, so you see every face of the outer one with the
  live render mapped onto it.
```

Six post-demo observations in a row. v3 called this a flow problem
(too many bullets to digest); from scope, it's worse — the six
observations are *re-explaining the demo* line by line, which is
neither narrative tutorial nor lookup reference. It's annotated code,
in prose form.

**Recommendation**: keep the demo, but cut the bullet list to three
observations woven into running prose, leading with the payoff:

> "Notice the knot still spins reactively from inside Portal — same
> `useFrame`, same ref, same lifecycle. Portal doesn't break Solid;
> it just redirects the render attachment. The
> `CopyOffscreenToTexture` component copies the off-screen scene into
> the render target each frame, and the smart-prop pipeline accepts
> `renderTarget.texture` for `map` the same as any other Texture."

The remaining three bullets (lights, both-rotate, redirection) are
either obvious from the running demo or supporting detail that the
reader doesn't need spelled out.

### Inverse: API ref `Portal` page is undersized

`/api/components/portal.mdx` (36 lines) documents the props but has
*no* mention of the render-target pattern — which is the single most
interesting thing you can do with Portal. The tutorial chapter has
the only documentation of that pattern.

**Recommendation**: add a "Render-target pattern" subsection to
`/api/components/portal.mdx` with a minimal worked example. Then the
tutorial chapter can link out instead of being the only place this
trick exists.

---

## Chapter 8 — A small game

`site/src/routes/tutorial/08-interactive-scene.mdx`

Story-pure. The "What's actually in here" retrospective (lines
22–43) names earlier chapters' concepts but doesn't introduce new
reference material; it's a victory-lap audit, not a scope leak.

**KEEP.**

---

## Chapter 9 — A peek at WebGPU

`site/src/routes/tutorial/09-webgpu-peek.mdx`

Story-pure for an encore chapter. The TSL function (lines 44–54) is a
worked example, not a reference enumeration. The closing "Where this
is going" (lines 86–93) is a forward-looking essay paragraph — closer
to prose than to reference.

**KEEP.**

---

## Inverse: reference pages reading like tutorial

Quick scan of API ref pages for tutorial-prose drift.

### `/api/components/canvas.mdx`

Lines 78–129 — "Custom renderers" and "Narrowing the renderer type
project-wide". This is a *long* prose+code explanation with worked
examples, comparative analogies ("Same pattern as Vite's
`ImportMetaEnv` or Next's `getServerSideProps`", line 129), and an
arc that walks the reader from problem → solution → result. That's
tutorial voice, in an API page.

**Verdict**: borderline OK because Canvas is the entry-point and
`gl`-narrowing is a setup task new users actually need to do once,
end-to-end. But the analogies are over-friendly for a reference page;
the section reads as a blog post. **REFRAME** to drop the framing
sentences and let the code carry it. Or split into a separate
"Renderer type narrowing" recipe page that's allowed to be
tutorial-shaped.

### `/api/components/entity.mdx`

Lines 60–94 — "Manual disposal of instance-entities" with **Wrong** /
**Good** comparison. That's textbook tutorial voice in a reference
page. The example is also the only place `autodispose` use-with-Entity
is documented; the dedicated `/api/utilities/autodispose.mdx` page
covers different cases.

**Verdict**: useful content but wrongly placed. **CUT** from
`entity.mdx`, **ADD** an "Auto-disposal with Entity" subsection to
`/api/utilities/autodispose.mdx`. Replace the `entity.mdx` section
with one line: "Instances passed via `from` are not disposed
automatically; wrap them in [`autodispose`](/api/utilities/autodispose)."

Also lines 96–122 — "Advanced Prop Patterns" with "**Supported
patterns**" bulleted enumeration. This is fine in voice (genuine
reference), but it's *attached to the wrong page*: the smart-prop
pipeline is a feature of `useProps`, not of `Entity`. The same
content would be much more discoverable at
`/api/hooks/use-props.mdx`.

**Verdict**: move to `use-props.mdx`. Leave a stub link from
`entity.mdx`.

### `/api/hooks/use-three.mdx`

Lines 42–69 — "Camera and Raycaster Stack System". This is a long
prose explanation with bulleted mechanics ("Stack-based Management",
"Default at Tail", "Current Active Camera at Head", "Push To The
Stack To Become Active", "Pop From The Stack To Deactivate"). The
mechanics-as-bullets shape *is* reference, but the introductory prose
("`solid-three` implements a stack-based system for managing its
current camera and raycaster") is tutorial-y.

**Verdict**: **KEEP** but trim the intro. Also: lines 72–88
("Practical Example - Camera Switching") **duplicates** the example
on lines 52–69 nearly verbatim. **CUT** the duplicate.

### `/api/events/overview.mdx`

Lines 60–93 — the EventPropagation worked example, followed by lines
95–101 explaining the click order, followed by 165–189 with two more
worked examples (TreePropagation, RayPropagation). This is *a lot* of
worked-example content for a reference page, and the examples carry
the explanation in a way that reads more like tutorial chapters than
reference.

**Verdict**: borderline. Event propagation is genuinely complex and
hard to grasp without examples; a reference reader benefits from
seeing the patterns. But three examples is one too many. **TRIM** to
the EventPropagation example plus one of the missed-event examples;
cut the other two.

The "Differences from react-three-fiber" `<details>` block (lines
210–231) is reference-shaped (comparison table format) and earns its
place. **KEEP.**

### `/api/utilities/loader-cache.mdx`

The 45-line worked example (lines 19–65) with `<Show when={visible}>`
and refcount commentary is tutorial-shaped. The refcount mechanics
*are* hard to explain without an example, so this isn't a clean cut,
but the example could be ~half the length and still teach the
mechanics. **TRIM** by removing the `<Show>` and `setVisible`
scaffolding; just show the refcount semantics on mount/unmount.

### `/api/utilities/autodispose.mdx`, `/api/utilities/metadata.mdx`, `/api/utilities/testing.mdx`, `/api/events/raycastable.mdx`

All short, focused, no tutorial drift. **KEEP.**

### `/api/components/portal.mdx`, `/api/components/resource.mdx`

Both *too short* — they need *more* content, not less (see notes in
ch6/ch7 above). Not a tutorial-prose-in-API problem; the inverse.

### `/api/components/t.mdx`, `/api/hooks/use-frame.mdx`, `/api/hooks/use-loader.mdx`, `/api/hooks/use-props.mdx`

Right size, right voice. **KEEP.**

---

## Summary, ranked by leverage

The tutorial has roughly **five** sections doing reference work that
should be cut or shrunk, and the API ref has roughly **three** places
hosting content that belongs elsewhere or duplicates itself.

### Tutorial → API ref moves (high leverage first)

1. **Ch4 "When you actually want the full list" (lines 73–88) — CUT
   from tutorial, ADD `intersections` documentation to
   `/api/events/overview.mdx`.** Largest single scope violation; also
   exposes a real gap in the API ref.
2. **Ch4 "What's actually in the event?" (lines 90–98) — TRIM in
   tutorial, ADD full intersection-event shape to
   `/api/events/overview.mdx`.** Same root cause as #1: the events
   API ref undersells the event-object shape.
3. **Ch2 "Reaching into nested props" (lines 76–86) — CUT, link to
   existing dashed-keys docs at `/api/components/entity.mdx` (which
   should move to `/api/hooks/use-props.mdx`).** Already fully
   covered in the API ref; the tutorial paragraph adds nothing.
4. **Ch2 shorthand list (lines 88–103) — TRIM, ADD coercion-rules
   reference to `/api/hooks/use-props.mdx`.** Currently the only
   place coercion is documented is the tutorial.
5. **Ch5 "Options: `stage`" (lines 58–66) — CUT to one parenthetical;
   already fully in `/api/hooks/use-frame.mdx`.**
6. **Ch6 closing reference paragraph (lines 48–54) — TRIM to one
   sentence; cache + URL shapes already in API ref. ADD
   `<ErrorBoundary>` integration docs to
   `/api/hooks/use-loader.mdx`.**
7. **Ch7 "Six things to notice" (lines 43–58) — TRIM to three
   observations in prose. ADD render-target pattern to
   `/api/components/portal.mdx` so the tutorial isn't the sole
   source.**

### API ref → tutorial direction (content that's drifted into reference pages)

1. **`/api/components/entity.mdx` "Manual disposal" (lines 60–94) —
   move to `/api/utilities/autodispose.mdx`.** Wrong/Good comparison
   is tutorial voice; also belongs with the other autodispose docs.
2. **`/api/components/entity.mdx` "Advanced Prop Patterns" (lines
   96–122) — move to `/api/hooks/use-props.mdx`.** The smart-prop
   pipeline is `useProps`, not `Entity`.
3. **`/api/components/canvas.mdx` "Narrowing the renderer type"
   (lines 95–129) — keep here, but trim the analogy
   ("Same pattern as Vite's `ImportMetaEnv`…") to fit reference
   voice.**
4. **`/api/hooks/use-three.mdx` "Practical Example - Camera
   Switching" (lines 72–88) — duplicate of lines 52–69. Cut one.**
5. **`/api/events/overview.mdx` — three worked examples on
   propagation; trim to two.**
6. **`/api/utilities/loader-cache.mdx` — 45-line worked example;
   halve it.**

### Reference pages that need *more*, not less

- `/api/components/portal.mdx` — needs render-target pattern.
- `/api/components/resource.mdx` — needs Typescript Interface block,
  `cache` prop semantics, `attach` mechanics.
- `/api/events/overview.mdx` — needs full intersection-event shape
  (currently only documents `nativeEvent`/`stopped`/`stopPropagation`).
- `/api/hooks/use-loader.mdx` — needs `<ErrorBoundary>` integration
  docs.
- `/api/hooks/use-props.mdx` — needs a coercion-rules section
  (arrays → Vector3.set, scalars → setScalar, color tuple handling).

### Patterns

Two themes account for ~80% of the scope drift:

- **The events API ref is thin**, so the tutorial does its work
  inline. Fix the API ref and chapter 4 can shrink considerably.
- **The smart-prop pipeline has no dedicated reference home.** Its
  content is scattered across `/api/components/entity.mdx`,
  `/api/hooks/use-props.mdx`, and chapter 2's prose. Consolidate it
  in `use-props.mdx` and chapter 2 can lose two sections.

Total work estimate for all moves: ~3 hours. The tutorial would shrink
by about 80 lines (out of ~1200), every dropped section would be
preserved or improved in the API ref, and chapters 4 and 6
specifically would gain narrative momentum by losing their closing
reference dumps.
