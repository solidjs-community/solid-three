# API reference rewrite review

Date: 2026-05-28
Scope: the 17 API reference pages under `site/src/routes/api/`. Read-only review of the uncommitted working-tree rewrite against the last committed version and against the actual source in `src/`.

## Verdict

**Shippable with fixes.** No blockers. The rewrite is a large, genuine improvement: the two reference templates (`use-props`, `events/overview`) are exemplary, every page now opens with a one-line summary, headings are sentence-cased, field tables are consistent, banned vocabulary ("coerce", `finally`, "rule N") is gone, and no non-null assertions or emojis were introduced. All internal page links and `#anchor` fragments resolve. The fixes below are completeness gaps and one stale type that predates the rewrite — none block shipping, but two should be fixed before this is called "done".

Findings by severity: **0 blockers, 3 should-fix, 5 nits.**

Top issues:
1. `components/canvas.mdx:167` — `ResolvedRenderer` documented as `... ? R : Renderer`; source is `... ? R : WebGLRenderer` (should-fix, pre-existing).
2. `hooks/use-three.mdx:28-42` — Returns table omits the real `clock: Clock` and `viewport: Viewport` Context fields (should-fix, pre-existing).
3. `hooks/use-props.mdx:78` — array-conversion description has `.set(...)`/`.fromArray` precedence backwards vs source (nit).

---

## 1. Factual accuracy / regressions

The most important dimension. I diffed every page against its committed original and spot-checked documented signatures/types against `src/`. **No fact was lost or distorted by the rewrite itself** — every value I checked that the new prose states is correct, and where the new pages dropped something, the original had already dropped it too (so it is a pre-existing gap, not a regression).

Verified correct against source:
- `components/canvas.mdx` defaults — `gl` = `new WebGLRenderer({ alpha: true })` (`src/create-three.tsx:337`), `scene` = `new Scene()` (`:277`), `raycaster` = `new CursorRaycaster()` (`:292`), `frameloop` default `"always"` (`:68`), shadow-map string mapping basic/percentage/soft/variance → Basic/PCF/PCFSoft/VSM (`:489-492`), `shadows={true}` → `PCFSoftShadowMap` (`:486`), tone mapping ACESFilmic / NoToneMapping-when-flat (`:529`), color space SRGB / LinearSRGB-when-linear (`:522`). All correct.
- `hooks/use-props.mdx` signature `Pick<Context, "requestRender" | "gl" | "props">` matches `src/props.ts:350-354`. The conversion table matches `applyProp` (`src/props.ts:212-332`) case-for-case. The `needsUpdate` list (`use-props.mdx:184`) matches `NEEDS_UPDATE` (`src/props.ts:190-201`) exactly. Encoding aliasing and texture-colorSpace behavior match `:239-321`.
- `hooks/use-three.mdx` Returns rows for `bounds/camera/setCamera/canvas/dpr/gl/raycaster/setRaycaster/render/requestRender/scene/props/xr` all match `Context` (`src/types.ts:225-244`). `setRaycaster` typed `(raycaster: Raycaster) => () => void` is correct (source's `setRaycaster` takes `Raycaster`; the param is merely mis-named `camera` in `types.ts:238`).
- `hooks/use-frame.mdx` signature and the `priority` default `0` / `stage` default `"before"` match `src/types.ts:259-264` and the loop logic.
- `events/overview.mdx` translated `ThreeEvent` type and the per-handler field matrix match `src/types.ts:274-329` (stoppable/non-stoppable split and which `*Missed` handlers carry no intersections).
- `utilities/metadata.mdx` `meta(instance, augmentation = { props: {} })` matches `src/utils.ts:83`.
- `components/portal.mdx` default destination `context.scene` matches `src/components.tsx:39-45`.

**should-fix — `components/canvas.mdx:167`.** The "Renderer types" `<details>` documents `type ResolvedRenderer = Register extends { renderer: infer R } ? R : Renderer`. The actual source is `... ? R : WebGLRenderer` (`src/types.ts:217`). This contradicts the page's own prose ("Defaults to `WebGLRenderer`", the `Register` example, and the `useThree().gl` page). It is **not a regression** — the committed original had the same stale `: Renderer` text (`HEAD:.../canvas.mdx:176`) — but the rewrite carried it forward, and the task asks to flag types that misrepresent the code.

**should-fix — `hooks/use-three.mdx:28-42`.** The Returns table is missing two real public `Context` fields: `clock: Clock` and `viewport: Viewport` (`src/types.ts:228, 239` / `Viewport` interface `:246-254`). A reader doing `useThree().clock` or `.viewport` finds nothing in the reference. **Not a regression** — the committed original omitted them too — but it is a completeness gap on a documented exported type and worth closing while the page is open.

**nit — `hooks/use-props.mdx:78`.** "`target.position.set(...value)` (or `.fromArray(value)` when the field supports it)" states the precedence backwards: source tries `target.fromArray(value)` first and falls back to `target.set(...value)` (`src/props.ts:276-279`). Both calls are mentioned, so the user-facing effect is correct; only the "which is the fallback" framing is inverted.

## 2. Template conformance

All five components/hooks pages and the two events pages map cleanly onto Template A or B. `index.mdx` is the section landing and is correctly exempt from `## See also`.

- **Every non-index page ends in `## See also`.** Verified on all 16. Good.
- **Template A pages** (`canvas`, `entity`, `t`, `portal`, `resource`, `use-frame`, `use-loader`, `use-props`, `use-three`, `raycasters`, `autodispose`, `metadata`, `testing`, `raycastable`): all lead with H1 + one-line summary, then a signature/props block, then behavior/usage, then concept sections, then See also. Section order is correct on all.
- **Template B pages** (`events/overview`): correct logical concept sequence (catalog → event object → intersection → propagation → sub-rules → filtering → See also).

**nit — `components/t.mdx` and `components/entity.mdx` have no `## Signature` section.** Both are "show by example" pages and lead straight into worked code, which the template explicitly allows (Template A: "omit a section when it doesn't apply"). `entity` carries its types in the `## Props` table + Exact-type footnote, which is the documented substitute. Acceptable as-is; noting only because a strict reading of "every reference page has a Signature" would flag them.

**nit — `components/portal.mdx:29-36`** places a usage code block immediately after the Exact-type footnote with no `## Usage` heading. It reads fine, but a bare top-level example block between `## Props` and `## Default destination` is slightly off the "named section for each thing" convention. Cosmetic.

## 3. Language rules

This is where the rewrite shines. The old walls of text are gone.

- `hooks/use-props.mdx` (the previous worst offender) now leads with the answer, reframes the conversion priority list as a "You pass / Example / What happens" table organized by what the reader passes (`:74-82`), and splits the `NEEDS_UPDATE`/encoding/sRGB trio into three named subsections (`:180-198`). The banned `finally` / "rules 5-10" internals language is gone. Target voice nailed.
- `events/overview.mdx` reads as clean topic prose; the raw conditional `ThreeEvent` type is now a translated field matrix with the exact type tucked in a footnote (`:55-71`); the r3f comparison is a real `### Differences from react-three-fiber` section (`:209-215`) instead of a hidden `<details>`.
- No remaining comma-splice run-ons of the kind called out in the original review (the four-use-case sentence is now a bulleted list at `events/overview.mdx:87-90`).
- No internal function names leak into prose. "applyProp" / "getOrInsert" / "useSceneGraph" do not appear in any page.

No findings in this dimension.

## 4. Links and anchors

All checked; **all resolve.**

- Page links: every `/api/...` target (16 distinct) maps to a real `.mdx` file, and every `/tutorial/...` target (`01`,`02`,`04`,`05`,`06`,`07`) maps to a real tutorial file.
- `#anchor` fragments, all verified against the slug of an existing heading:
  - `#args`, `#behavior` (use-props) — exist.
  - `#caching`, `#options`, `#custom-cache` (use-loader) — exist; `resource.mdx:17` and `loader-cache.mdx:7` cross-link to `use-loader#caching` / `#custom-cache` — both targets exist.
  - `#hover-events`, `#missed-events`, `#stoppable-vs-non-stoppable-events` (overview) — exist.
  - `#rendering-defaults`, `#the-gl-prop` (canvas) — exist (the backticked heading "The `gl` prop" slugs to `the-gl-prop`).
  - `/api/components/canvas#narrowing-the-renderer-type-project-wide` — heading exists (`canvas.mdx:123`).
  - `/api/components/entity#createentity` — heading exists (`entity.mdx:48`).

No broken links or anchors found.

## 5. Consistency across pages

- **Field tables** use consistent columns. Two stable shapes: Props/Params tables are `Prop|Type|Default|Description` (canvas, portal, raycastable) or `Parameter|Type|Description` where no defaults apply (use-frame, use-props, use-three, use-loader). Consistent and sensible.
- **`<details><summary>Exact type</summary>`** is now used uniformly: canvas, entity, portal, use-loader (x3), overview, raycasters all use exactly `Exact type`. The old "Typescript Interface" / "Typescript Signature" inconsistency is gone. The one outlier label is `components/canvas.mdx:156` `<summary>Renderer types</summary>` — intentional (it holds three related types, not one), but it is the lone deviation from the `Exact type` standard (nit).
- **No backtick-style prop labels** remain; `resource.mdx` now uses a table instead of the old `` `loader` - ... `` list.
- **No Title Case headings**, **no "coerce"/"coercion"**, **no emojis** (the `✓`/`✗`/`→` glyphs in canvas/use-props/use-loader/overview are check/arrow symbols carried over from the original and used consistently — not emoji).

**nit — `components/resource.mdx:13-16` and `hooks/use-loader.mdx:25-26`** put prose in the `Type` column ("a loader constructor", "a string, array, or record") rather than an actual type. It reads well and is arguably the right call for these polymorphic params, but it is inconsistent with the monospace-type cells used everywhere else (e.g. `use-three.mdx`, `canvas.mdx`). Minor consistency wrinkle, not wrong.

**nit — `hooks/use-loader.mdx:12`** simplifies the constraint to `TLoader extends Loader` whereas source is `TLoader extends Loader<any, any>` (`src/hooks.ts:184`). Harmless simplification in a Signature block; the Exact-type footnotes on the same page use the full `Loader<any, any>` form, so the two representations differ slightly within the page.

---

## Summary table

| # | Page:line | Dimension | Severity | Issue |
| --- | --- | --- | --- | --- |
| 1 | `components/canvas.mdx:167` | accuracy | should-fix | `ResolvedRenderer` shown as `? R : Renderer`; source is `? R : WebGLRenderer` (pre-existing) |
| 2 | `hooks/use-three.mdx:28-42` | accuracy | should-fix | Returns table omits `clock: Clock` and `viewport: Viewport` (pre-existing) |
| 3 | `hooks/use-props.mdx:78` | accuracy | nit | `.set(...)`/`.fromArray` precedence stated backwards vs source |
| 4 | `components/t.mdx`, `entity.mdx` | template | nit | No `## Signature` (allowed; example-led) |
| 5 | `components/portal.mdx:29-36` | template | nit | Usage code block without a `## Usage` heading |
| 6 | `components/canvas.mdx:156` | consistency | nit | Lone `<summary>Renderer types</summary>` vs the `Exact type` standard |
| 7 | `resource.mdx:13-16`, `use-loader.mdx:25-26` | consistency | nit | Prose in the `Type` column instead of a type |
| 8 | `hooks/use-loader.mdx:12` | consistency | nit | `Loader` vs source `Loader<any, any>` in the Signature block |
