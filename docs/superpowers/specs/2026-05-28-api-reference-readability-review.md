# API reference readability review

Date: 2026-05-28
Scope: the 17 API reference pages under `site/src/routes/api/`. Read-only review. No `.mdx`, no components, and no tutorial files were changed.

The tutorial is the taste benchmark. The tutorial voice is: short declarative sentences, one idea per paragraph, a demo or code block as the visual anchor every few lines, and the *mechanism* stated plainly ("the body runs once. Only the small reactive expression that reads `hot()` re-runs"). The API pages should read like that — reference-dense, but scannable, with a predictable shape on every page. Today they do not. They drift between four or five different presentation conventions, and a few pages have collapsed into spec-grade walls of text that read like internal design notes rather than docs.

---

## 1. Current-state audit

The same *kinds* of information are presented in incompatible shapes across the pages. Catalogued below by information kind.

### "What this returns / what its fields are"

Four different shapes for the same job:

- **Bold-label bullet list with inline type annotations** — `hooks/use-three.mdx:26-41` ("Returns:" with `- **bounds** (`Measure`): ...`). This is the most readable of the lot but it is unique to this one page.
- **Bold-label bullet list without types** — `components/canvas.mdx:9-33` ("Props:"), `components/portal.mdx:9-12`, `components/entity.mdx:25-29`. Types are absent from the prose and only appear in the collapsible (see below), so the reader either trusts the prose or expands a separate block.
- **Backtick-label bullet list** — `components/resource.mdx:11-18` uses `` `loader` - ... `` rather than `**loader**: ...`. Same information kind, third punctuation convention on the same site.
- **Feature bullet list with nested method sub-bullets** — `utilities/loader-cache.mdx:9-16` mixes "Features" with disposal-method signatures (`dispose(loader, path)`) inside the same list, so capability and API surface are interleaved.

### "The shape of this type"

Almost universally hidden behind a `<details>` collapsible, but even the summary text is inconsistent:

- `<summary>Typescript Interface</summary>` — `components/canvas.mdx:36`, `components/entity.mdx:32`, `components/portal.mdx:15`, `hooks/use-frame.mdx:22`, `hooks/use-loader.mdx:25` and `:110`, `utilities/raycasters.mdx:14`, `events/overview.mdx:62`.
- `<summary>Typescript Signature</summary>` — `hooks/use-props.mdx:18`, `hooks/use-loader.mdx:149`. Same kind of content (a `function`/`interface` block), different label, sometimes on the same page (`use-loader` uses both "Interface" and "Signature").
- **No collapsible at all** — `hooks/use-three.mdx` shows its signatures *inline and uncollapsed* (`:11-17`, under a "Signatures:" heading), the opposite choice from every other page. `components/canvas.mdx:167-203` also dumps the renderer types inline and uncollapsed under a "Renderer types" heading.
- A `<details>` is also used for *prose*, not types: `events/overview.mdx:202-224` hides the entire "Differences from react-three-fiber" comparison behind a collapsible.

Net effect: a type is sometimes the first thing you see, sometimes a click away, sometimes labelled "Interface", sometimes "Signature". A reader cannot form a habit.

### "Defaults / value tables"

- **Markdown table** — `components/canvas.mdx:96-105` ("Defaults"). The table is fine as a concept, but several cells contain multi-clause prose (the `gl` and `shadows` rows are full sentences), so it reads like a table that lost an argument with a paragraph.
- **Markdown table** — `events/overview.mdx:38-45` (the Event Object) and `:73-84` coercion semantics live both in a table and in a `<details>` type block, restating the same facts twice.
- **Prose** — `hooks/use-loader.mdx:9-15` describes the three caching modes as a numbered prose list, while the *same* options reappear as a bullet list at `:17-22`. Two shapes, one fact set, adjacent.

### "Edge-case behavior / gotchas"

No convention at all. Gotchas appear:

- inline inside a prop bullet as a bolded sub-paragraph — `components/canvas.mdx:20` ("**Constructor args are applied once.**", a 9-line paragraph buried inside the `gl` bullet);
- as a dedicated `##` section — `components/entity.mdx:60-94` ("Manual disposal of instance-entities", with Wrong/Good headers);
- as a trailing "Notes" bullet list — `components/portal.mdx:119-129`;
- folded into the coercion narrative — `hooks/use-props.mdx:113-131`.

### Heading conventions

Inconsistent casing and structure. Title Case sections ("Custom Cache", "Camera Switching Example", "Stoppable vs Non-Stoppable Events") sit next to sentence-case ("What runs when a prop changes", "Defaults to the scene root"). Some pages lead with an H1 + one-line summary (`utilities/autodispose.mdx:5-11` is a clean example), others with an H1 then immediately a "Props:" label (`components/portal.mdx`).

### Cross-reference style

Reasonably consistent (inline links to sibling pages are used well throughout, e.g. `use-props.mdx:7`), and most pages end with a "See also the [... tutorial chapter]" line. This is the one convention worth keeping as-is and propagating to the pages that lack it (`canvas`, `t`, `metadata`, `raycasters`, `loader-cache`).

---

## 2. Wall-of-text findings (page by page)

### `hooks/use-props.mdx` — worst offender

- **Coercion table, `:73-84`.** A 10-row table whose Condition column contains multi-clause boolean predicates (`source[key].set` exists, `value` is not an object, `source[key]` is **not** a `Color`, and `source[key].setScalar` exists, and `value` is a number — row 8). This reads as the *implementation spec for `applyProp`*, not as user-facing docs. A reader who wants "how do I pass a color?" has to mentally execute a priority-ordered match against 10 predicates to discover the answer is row 9. The tutorial's framing of the same mechanism (`02-props-and-children.mdx:84-97`: "arrays unpack into `.set(...)`, single numbers broadcast via `.setScalar(...)`...") is dramatically more readable because it is organized by *what you pass*, not by *which branch fires*.
- **`:86-90` "Then, in a `finally` after every prop"** describes control flow in terms of the source code (`finally`, "rules 5-10"). This is internals leaking into reference prose.
- **Three consecutive concept subsections with no anchor** — `:113-131` ("NEEDS_UPDATE truthiness list", "Encoding aliasing (since three r152)", "Texture sRGB auto-reconciliation") are three dense paragraphs back to back, each introducing a new mechanism, with no demo, no table, no signature to break the gray. The `### Texture sRGB auto-reconciliation` paragraph (`:130-131`) is a single 4-line sentence with three parenthetical clauses.

### `events/overview.mdx` — second worst

- **Event Object table, `:38-45`** is acceptable as a table, but it is immediately followed by a second list of `Intersection` fields (`:49-58`) and then a 1-sentence essay (`:59`) that crams four use cases into one comma-spliced line ("drag-to-rotate on the hit point, paint-on-surface using `uv`, world-space gizmos that align to `normal`, ray-aware tools that read `distance`"). The information is good; the density is spec-like.
- **The `ThreeEvent` conditional type, `:64-75`**, is shown raw inside a `<details>`. It is a nested conditional-mapped type that no reader can parse at a glance, and the three prose sentences below it (`:77-81`) already say what it means in plain language — so the type block adds noise, not clarity.
- **Stoppable vs Non-Stoppable, `:135-145`**, and **Missed Events, `:147-175`**, are each fine individually but stack into a long unbroken scroll of bold-lead bullets. The page is doing the job of three pages (event object, propagation, hover) and it shows.

### `components/canvas.mdx` — dense in two specific spots

- **The `gl` prop bullet, `:13-20`.** The `gl` bullet alone is ~30 lines and contains a nested 3-item sub-list *plus* the "Constructor args are applied once" essay (`:20`), a single paragraph explaining `getContext` idempotency, WebGL context reuse, and the unmount/remount escape hatch. This is genuinely important behavior buried as a sub-bullet of a sub-bullet. It deserves to be a named "Gotcha" block, not paragraph 4 of a prop description.
- **Defaults table, `:96-105`** — see audit; the `gl` and `shadows` rows are sentences masquerading as cells.
- The rest of the page (Custom renderers, Register narrowing) is actually good — clear examples with `✓`/`✗` annotations. Keep that style.

### `hooks/use-loader.mdx` — redundancy, not density

Not a wall of text, but the caching modes are stated three times: numbered prose (`:11-15`), bullet list (`:17-22`), and again in the `Resource` page. The two `<details>` blocks use different summary labels (`:25` "Interface", `:149` "Signature"). Consolidate.

### Pages that are already fine (leave them)

- `utilities/autodispose.mdx` — clean H1 + summary + two worked examples. This is close to the target shape already.
- `components/t.mdx` — short, example-led, sentence-case. Good.
- `components/portal.mdx` — mostly good; only the trailing "Notes" bullets (`:119-129`) are a convention outlier.
- `components/resource.mdx` — short; only issue is the backtick-label list convention (`:11-18`) diverging from siblings.
- `events/raycastable.mdx` — appropriately tiny for a single-prop page.
- `utilities/metadata.mdx` — dense but the bold-label list (`:9-12`) is doing real work and the page is short. Minor.
- `utilities/testing.mdx` — well structured: one `##` per export, inline signature, short example. Notably, this page already does roughly what the proposed template recommends — use it as the in-repo model.

---

## 3. Proposed unified page template

One information hierarchy, applied to every API page. The reader should be able to predict where the answer to any question lives before they scroll. Sections in fixed order; omit a section when it does not apply, never reorder.

1. **H1 + one-line summary.** A single sentence stating what the export *is* and when you reach for it. Model: `autodispose.mdx:7-11` and the tutorial's opening sentences. No "Props:" before this sentence exists.
2. **Signature.** The TypeScript signature, shown via the proposed `<Signature>` component (section 4), *uncollapsed and immediately under the summary*. This replaces the inconsistent `<details>Typescript Interface/Signature</details>` choice. The signature is the table of contents for the page — a reader who knows the type can skip the prose.
3. **Parameters / Props / Returns.** One `<PropTable>` (section 4) per group, in this order: parameters, then returns. Each row: name, type, optional/required, one-line description. This replaces all four current list conventions.
4. **Behavior.** Prose explaining what happens *when you use it* — reactivity, lifecycle, what re-runs. Tutorial voice: short paragraphs, one mechanism each. This is where "the body runs once" style explanation lives.
5. **Examples.** Worked code, smallest-useful-first. Inline `<Demo>` where it adds value.
6. **Gotchas / edge cases.** A clearly demarcated section (a `## Gotchas` heading, or a callout component if one is later added) for the "constructor args are applied once" class of warning. Never bury these inside a prop bullet.
7. **See also.** Link to the related tutorial chapter and sibling API pages. Already near-universal; make it mandatory.

Convention rules that ride along: sentence-case headings everywhere; `**name**` (bold) labels, never `` `name` `` backtick labels, for the rare prose list that survives; types always rendered through the components in section 4, never hand-typed in prose.

### Mapping onto real pages

**`use-three.mdx`** (currently: inline Signatures block, then a bold-label "Returns" list, then two prose mechanism sections):
1. Summary — keep `:6`.
2. Signature — its two overloads (`:11-17`) move into `<Signature>`. Good news: this page already shows them uncollapsed, which is the target.
3. Returns — the `:26-41` bold-label list becomes a single `<PropTable>` (it already carries inline types, so the conversion is mechanical).
4. Behavior — the "Camera and Raycaster Stack System" prose (`:43-51`) stays as Behavior; it is genuinely conceptual.
5. Examples — the camera-switching example (`:53-71`) stays.
6. See also — currently missing; add tutorial cross-link.

**`use-props.mdx`** (currently: params list, collapsed signature, then the coercion spec):
1. Summary — keep `:7-9`.
2. Signature — `:20-26` moves into `<Signature>` uncollapsed.
3. Parameters — `:11-15` becomes a `<PropTable>`.
4. Behavior — "What runs when a prop changes" (`:58-67`) is good Behavior prose, keep it.
5. Examples — the wrapper example (`:41-55`).
6. Gotchas — the coercion table (`:69-90`) should be *reframed by what you pass* (mirroring tutorial `02:84-97`) and demoted; the `NEEDS_UPDATE`/encoding/sRGB trio (`:113-131`) becomes individual gotcha entries rather than three stacked paragraphs. (Note: `:39` and the tutorial both write `null!` / non-null assertions in examples — examples carried into the new template should narrow with `if`/`?.` instead, per the repo's no-non-null-assertion rule.)
7. See also — keep `:167`.

**`events/overview.mdx`** (the page doing three jobs):
1. Summary — keep `:6-9`.
2. (no single signature — it is a topic page) — the `ThreeEvent` type (`:64-75`) becomes a `<Signature>` under the "Event Object" section instead of a `<details>`.
3. Event Object — the `:38-45` table becomes a `<PropTable>`; the `Intersection` fields (`:49-58`) become a second `<PropTable>`.
4. Behavior — Propagation (`:99-133`) and Hover (`:192-200`) stay as Behavior prose.
5. Examples — already present.
6. Gotchas — the "Differences from react-three-fiber" `<details>` (`:202-224`) is reference content, not a gotcha; surface it as a real `## Differences from react-three-fiber` section rather than hiding it.
   Consider splitting this page into Event Object / Propagation / Hover — it is long enough to justify it.

---

## 4. Type-presentation proposal

Today every type is a hand-formatted code fence inside a `<details>` with one of two summary labels, and `useThree`/`canvas` break even that by showing types inline. The fix is two small components plus a styled replacement for the collapsible. All three are plain Solid components exported from `site/src/theme/mdx-components.tsx` — the exact mechanism already used for `<Demo>` (the file comment at `mdx-components.tsx:1-11` documents that anything exported there is globally available in MDX, wired via `componentsPath` in `vite.config.ts:12`). No new build wiring is needed; these are additional named exports alongside `Demo`.

### Component A — `<Signature>`

What it renders: a syntax-highlighted, *always-visible* code block styled as the canonical "this is the type" element (a left accent bar / subtle background to distinguish it from example code fences). Replaces every `<details><summary>Typescript Interface|Signature</summary>` block and the ad-hoc inline signature dumps.

API sketch:

```tsx
<Signature
  // the source string; could also accept children as a raw code block
  code={`useThree(): Context
useThree<T>(callback: (value: Context) => T): Accessor<T>`}
  lang="tsx"          // default "tsx"
  title="Signature"   // optional caption, default none
/>
```

BEFORE — `use-frame.mdx:21-34`:

```mdx
<details>
<summary>Typescript Interface</summary>

​```tsx
useFrame(
  callback: (context: Context, delta: number, frame?: XRFrame) => void,
  options?: { priority?: number; stage?: "before" | "after" }
): () => void
​```

</details>
```

AFTER:

```mdx
<Signature code={`useFrame(
  callback: (context: Context, delta: number, frame?: XRFrame) => void,
  options?: { priority?: number; stage?: "before" | "after" }
): () => void`} />
```

The type is now visible at a glance instead of one click away, and the label is consistent across all 17 pages.

### Component B — `<PropTable>` / `<PropRow>`

What it renders: a structured table (or definition-list at narrow widths) with fixed columns — name, type, required/default, description. The `type` cell is rendered in monospace; an optional `default` is shown as a pill. Replaces the four competing list/table conventions for parameters/props/returns.

API sketch:

```tsx
<PropTable>
  <PropRow name="camera" type="Partial<Props<Camera>> | Camera" default="new PerspectiveCamera()">
    The camera used in the scene.
  </PropRow>
  <PropRow name="frameloop" type={`"always" | "demand" | "never"`} default={`"always"`}>
    Rendering loop mode.
  </PropRow>
</PropTable>
```

BEFORE — `use-three.mdx:28-37` (bold-label list, abbreviated):

```mdx
**Returns:**

- **bounds** (`Measure`): Reactive canvas bounds measurement.
- **camera** (`CameraKind`): The current camera (`PerspectiveCamera | OrthographicCamera`).
- **setCamera** (`(camera: CameraKind) => () => void`): A setter-function ...
- **canvas** (`HTMLCanvasElement`): The canvas DOM element.
```

AFTER:

```mdx
## Returns

<PropTable>
  <PropRow name="bounds" type="Measure">Reactive canvas bounds measurement.</PropRow>
  <PropRow name="camera" type="CameraKind">The current camera (PerspectiveCamera | OrthographicCamera).</PropRow>
  <PropRow name="setCamera" type="(camera: CameraKind) => () => void">
    Pushes a camera onto the stack and returns a cleanup that pops it.
  </PropRow>
  <PropRow name="canvas" type="HTMLCanvasElement">The canvas DOM element.</PropRow>
</PropTable>
```

BEFORE — `events/overview.mdx:38-45` is already a markdown table, but it is hand-aligned (brittle to edit) and lives next to a `<details>` type block restating the same fields. AFTER: one `<PropTable>` with a `when`/`present` column, and the `ThreeEvent` `<details>` is replaced by a single `<Signature>` so the field list and the type live together instead of duplicating.

### Component C — `<TypeBlock>` (styled replacement for the prose `<details>`)

A few `<details>` blocks hold *prose*, not types (`events/overview.mdx:202-224` "Differences from react-three-fiber"). For genuinely-secondary long-form content that should stay collapsible, ship one styled, consistently-labelled disclosure component rather than raw `<details>` with ad-hoc summaries. API: `<TypeBlock title="Differences from react-three-fiber">...children...</TypeBlock>`. (Lowest priority of the three; arguably the r3f comparison should just be a normal section, in which case this component is unnecessary. Recommend deferring it until a second prose-disclosure use case appears.)

### Tradeoffs

- **For:** one habit for the reader on every page; types become first-class and visible; tables stop being hand-aligned markdown that breaks on edit; conversion is mostly mechanical (the data already exists in the prose).
- **Against:** authoring `.mdx` becomes slightly more verbose (JSX rows vs markdown bullets); contributors must learn three component names; `<Signature>` loses GitHub-markdown portability (these files render only through SolidBase, so this cost is low here). 
- **Scope discipline:** this is two components doing real work plus one optional one. It matches the maintainer's "don't add ceremony" bar — `<Signature>` and `<PropTable>` each remove an existing inconsistency rather than adding a new layer. Resist growing this into a full typedoc-style system.

---

## 5. Prioritized punch list

Worst offenders first. Each item is independently shippable.

1. **`hooks/use-props.mdx` — coercion section (`:69-131`).** Reframe the 10-row priority table by *what you pass* (mirror tutorial `02:84-97`); split the `NEEDS_UPDATE`/encoding/sRGB trio into discrete gotcha entries; remove the `finally`/"rules 5-10" internals language. Highest reader impact, densest page.
2. **`events/overview.mdx` — Event Object + propagation (`:36-145`).** Convert the Event Object and `Intersection` lists to `<PropTable>`; replace the `ThreeEvent` `<details>` with a `<Signature>`; promote the r3f-differences `<details>` to a real section. Consider splitting the page into Event Object / Propagation / Hover.
3. **`components/canvas.mdx` — the `gl` prop (`:13-20`) and Defaults table (`:96-105`).** Lift "Constructor args are applied once" out of the prop sub-bullet into a named Gotcha section; move per-prop types into a `<PropTable>`; tighten the sentence-cells in the Defaults table.
4. **Type-presentation rollout — build `<Signature>` + `<PropTable>`** and convert every `<details>Typescript Interface|Signature</details>` block (canvas, entity, portal, use-frame, use-loader x2, use-props, raycasters, overview) plus the inline signatures in `use-three` and `canvas`. Mechanical once the components exist; this is what makes the whole reference consistent.
5. **`hooks/use-loader.mdx` — de-duplicate caching modes.** Collapse the numbered prose (`:11-15`) and the bullet list (`:17-22`) into one `<PropTable>`; unify the two `<details>` labels.
6. **`hooks/use-three.mdx` — Returns list → `<PropTable>`; signatures → `<Signature>`; add See-also.** Already the best-organized hook; small conversion brings it onto the template.
7. **Convention sweep across all pages.** Sentence-case all headings; standardize on `**name**` labels (fix `resource.mdx:11-18` backtick labels); add the missing "See also" cross-links (`canvas`, `t`, `metadata`, `raycasters`, `loader-cache`); apply the section order from section 3. Lowest individual impact, but it is what makes the set feel like one document.
8. **Leave alone:** `autodispose`, `t`, `raycastable`, `testing` — already on-template (testing is the in-repo model). `portal`, `resource`, `metadata` need only the convention-sweep touch-ups from item 7.
