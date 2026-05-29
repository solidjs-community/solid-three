# Editorial review — solid-three tutorial (chapters 1–14)

Read top-to-bottom as one continuous story, from the perspective of a Solid developer who has never touched three.js. Findings below are organised by the six axes in the brief, then a short list of concrete suggestions.

---

## 1. Story coherence

The tutorial holds together very well at the macro level. The spine — *JSX is the scene → signals drive the scene → events talk back → time talks back → the world outside the scene → composition → ship something* — is legible from chapter to chapter, and each chapter explicitly hands off to the next. The recurring "one property assignment runs" refrain (chapters 4, 5, 14) is genuinely good editorial glue: it gives the reader a single sentence they can hold onto as the surface area grows.

Where it stumbles:

- **Chapter 1 over-promises explanation and under-delivers a hook.** The opening "A three.js scene needs three things… renderer, camera, scene" is correct but bloodless. The very next paragraph says `<Canvas>` is the whole boilerplate. The reader never finds out *what they just got* — they're handed `<Entity from={THREE.Mesh}>` before there's any reason to care. The chapter is the bridge from "I know Solid" to "I am willing to keep reading", and right now it leads with mechanics. A one-line "here is a spinning cube" lure would do more than the bullet list.

- **The `<Entity>` vs `createT` choice in chapter 1 is the wrong first decision to put in front of the reader.** It's three demos to make a tree-shaking point that the reader has no frame of reference for yet ("the bundler only ships the ones you reach for" — which bundler? what bundle?). This is the only chapter that introduces two ways to do the same thing before the reader has done it once. By the time the reader reaches chapter 2, the curated-object footnote is forgotten; every subsequent chapter just uses `createT(THREE)` anyway. The `<Entity>` form is *never used again* in the tutorial. That's a strong signal the chapter is litigating an API design choice rather than teaching.

- **Chapter 4's "one property assignment runs" claim is asserted, not demonstrated.** The reader is told "only that one property assignment runs — the mesh stays mounted, the canvas keeps the same renderer, nothing else moves." This is the most important sentence in the entire tutorial — it's the thesis. But there's no way for the reader to verify it from the demo. Logging `setHot` or putting a `console.count` inside a child wouldn't kill the chapter; it would weld the thesis to evidence. Right now you're asking for trust at the exact moment trust hasn't been earned yet.

- **The hand-off from 4 to 5 is the strongest in the tutorial.** "What about clicking the cube itself? […] Same `onClick`, different target. That's the next chapter." This is the model for how every chapter should end. Most don't.

- **Chapter 9 ("useThree") feels like a reference page in a chapter's clothing.** The bullet list of context fields (`gl`, `scene`, `camera`, `raycaster`, `clock`, `canvas`, `bounds`, `viewport`, `dpr`, `requestRender`, `setCamera`, `setRaycaster`) appears *before* the first demo. The reader is asked to take inventory before they have any reason to care about any one item. Compare to chapter 5, which introduces `onClick` with one sentence and a demo; the list-of-pointer-events shows up afterward as "for reference". Chapter 9 should follow the same shape.

- **Mental model builds cleanly through 4→5→6→7.** This is the best stretch in the tutorial. Each chapter takes a single dial and turns it: click handler on a mesh; what happens when more than one is hit; what happens when you don't want them hit at all. The reader's model of "rays through the scene" is constructed brick by brick.

---

## 2. Ordering

The ordering is mostly right and matches the spec. Three concrete concerns:

- **Chapter 9 (`useThree`) is currently a sibling to chapter 8 (`useFrame`), but chapter 8 already exposes `context` via its callback's first argument.** This is fine in principle — and the chapter does call it out — but in practice the reader has already seen `context.camera`, `context.clock`, etc. inside `useFrame` callbacks before they're told what they are. The `useFrame` chapter ends with "What else is in `context`? […] the same scene context you'll meet in the next chapter — `gl`, `scene`, `camera`, `clock`, `size`." That sentence is doing too much work; it's a forward reference *and* a list dump. Consider front-loading the *concept* of the scene context (a single short prose paragraph before chapter 8's first demo, naming it as "the scene context, which the next chapter will let you reach outside a frame") so chapter 8 doesn't introduce a thing it doesn't own.

- **Chapter 7 (raycaster config) sits awkwardly between propagation and `useFrame`.** It's the chapter that breaks the part-by-part rhythm: chapters 5 and 6 are the everyday event story; chapter 7 is the niche configuration story for two specific cases (Points/Lines and Layers). For most readers this is "I'll come back to this when I need it." If you want to honour the "every chapter earns its place" rule, chapter 7 is the strongest candidate for either (a) demotion to a callout/aside at the end of chapter 6, or (b) moving to after chapter 13 as a "configuration cookbook" entry. Right now it punctures the momentum of Part 2 right before Part 3.

- **The spec promised a chapter on `autodispose` & `meta` as its own beat in Part 4.** That has been folded into chapter 12 (Custom components). I think this is the right call — `autodispose` makes no sense without a custom component to dispose — but it leaves Part 4 ("Stuff that's not in the scene") as a single chapter (Loaders & Resource). Either rename the section or fold loaders into Part 3.

- **Chapter 11 (Portal) and chapter 12 (Custom components) could swap.** As written, the reader learns to portal something *before* they've written their first custom component, which makes the Portal demo's `<Group>` + nested `<Portal>` slightly disorienting — the JSX nesting looks like custom-component composition but isn't. If custom components came first, Portal could be framed as "now that you're composing, here's the escape hatch when nesting and scene-parenting need to disagree."

---

## 3. Per-chapter contribution

| Ch | Earns its place? | Notes |
|---|---|---|
| 1 | Yes, but bloated | Two demos too many — see §1. Could be a single `<T.Mesh>` demo with the curated tree-shaking note as a sidebar. |
| 2 | Yes | Tight. Two demos, both pay off. |
| 3 | Yes | The "Reaching into nested props" section is a non-demo aside — fine here because the reader has just done two demos. |
| 4 | Yes, *thesis chapter* | Strongest argument for the library; weakest demonstration of it. See §1. |
| 5 | Yes | Three demos is the upper bound; the click-missed one carries its weight because it changes the semantics, not just the target. |
| 6 | Yes, just barely | The chapter is short and its prose-only "x-ray" aside is good; the demo is a clean single-idea reveal. |
| 7 | **Weakest** | Two niches stapled together. See §2 — fold or move. |
| 8 | Yes, but dense | Three demos covering: basic signal-driven, imperative escape hatch, priority/stage options. The options demo is a good pedagogical move (it shows *why* you'd care) but the prose around `stage: "before"` / `stage: "after"` is a reference paragraph with no demo to anchor it. Cut to one sentence or give it a demo. |
| 9 | Yes, but reshape | See §1 — lead with the demo, not the list. |
| 10 | Yes | Clean. The "useLoader vs Resource" framing is the right hook. |
| 11 | Yes | One demo, one idea, well-chosen visual (one cube moves, one doesn't). |
| 12 | Yes | The pairing of composition vs `useProps`+`autodispose` is the right shape. |
| 13 | Yes — climax | See §6. |
| 14 | Yes — encore | See §6. |

No chapter is too thin to stand alone. Chapter 7 is the only one I'd seriously consider folding.

---

## 4. Demos

Overall the demos are remarkably disciplined — the camera positions are sensible, the lighting is consistent, the cubes are mostly cornflower-blue-and-tomato. Concrete notes:

**Demos that earn their place unambiguously:**
- `02-group.tsx` — the tilt of the parent group is visible immediately.
- `05-click.tsx` — one-line change from the previous chapter's demo, exactly the right "look how little moved" feel.
- `06-stop-propagation.tsx` — the front/back cubes make the propagation idea spatial, not abstract.
- `09-camera-stack.tsx` — the cleanup-on-unmount is a beautiful demonstration of ownership; this might be the single best demo in the tutorial.
- `11-portal.tsx` — instant, visual, one click.
- `13-interactive-scene.tsx` — the climax demo; see §6.
- `14-webgpu-tsl-uniform.tsx` — the slider closes the loop on "signals drive the scene" from chapter 4. Excellent payoff.

**Demos that are filler or weak:**
- `01-entity.tsx` and `01-curated.tsx` together. The reader doesn't need three separate spinning-cube demos in chapter 1; `01-curated.tsx` is almost identical to `01-create-t.tsx` and demonstrates a build-time concern that is invisible in the runtime canvas. Cut one. A side-by-side code comparison would carry the tree-shaking point better than a demo whose visual output is identical.
- `03-args.tsx`. The 2×1×1 box is a flat visual; the reader has no way to feel that `args` is special vs. just "another prop". The demo would benefit from a `<Show when={...}>` toggle that re-runs with different args, so the reader sees the rebuild. As is, this is a demo that exists because the section needs one.
- `07-points.tsx`. The threshold demo works, but the visible feedback is just "the points change colour" — the reader can't tell whether the threshold matters without removing it themselves. A version that toggles the threshold (slider or button) and lets the reader try-and-fail to hit a point would actually teach the lesson.
- `08-use-frame-imperative.tsx`. Visually identical to `08-use-frame-signal.tsx`. The reader takes on faith that the imperative version is faster. Either drop one demo or stress-test the difference with a large `<For>` of cubes so the perf claim is visible.

**Demos that could be added:**
- Chapter 4 desperately needs an inline `console.count`-style visible trace of "only this assignment ran." Otherwise its thesis lives in prose.
- Chapter 3's "Reaching into nested props" section is the only section in the tutorial that introduces a syntax (`shadow-mapSize-width={1024}`) with no demo. Add one or move the section to chapter 12 where lights and shadows would actually come up.

**Demos that should be cut:**
- One of the chapter 1 trio (probably `01-curated.tsx`).
- `08-use-frame-imperative.tsx` is on the bubble.

---

## 5. Voice & tone

The voice is consistent and good — conversational, terse, occasional dry asides ("rare in practice, but it's there", "Have fun"). Some specific slips:

- **Chapter 1 opens in lecture mode.** "A three.js scene needs three things: a renderer to draw pixels, a camera to decide what gets drawn, and a scene to hold everything else." This reads like the opening paragraph of a textbook chapter. The rest of the tutorial doesn't talk like this; the opening shouldn't either.

- **Chapter 3: "The principle: pass whatever's most ergonomic for the shape of data you have."** This is fine, but the word "principle" is heavier than it needs to be. "The idea:" or just delete the sentence and let the example carry it.

- **Chapter 9 slips into reference-doc mode** with its bullet list of context fields before the first demo (see §1).

- **Chapter 10: "Use whichever reads better in context"** is good. But the "Errors, options, base URLs" trailing section is a reference dump (five bullets covering `base`, `cache`, lifecycle hooks, URL forms, error boundaries). This is a reference paragraph, not tutorial prose. Either cut to a single sentence pointing at the reference, or pick the most useful one (URL as record, for material sets) and show it in a demo.

- **Chapter 7: "Rare in practice, but it's there."** Good. "Both knobs hang off the `raycaster` prop on `<Canvas>`." Also good — terse, mechanical. This chapter has the right voice; it's the *placement* that's the problem.

- **Chapter 13's "ingredients" framing** ("You've now seen every piece. Time to put them together.") is the right tone for a climax. Don't change it.

- **Chapter 14's closing ("That's the tour")** is the right tone for an encore. Don't change it.

- Watch for moments where the prose explains the obvious: "Click the button" (chapters 4, 9, 11) is fine once but repetitive across chapters. Vary it.

- The phrase "the smart-prop pipeline" appears in chapters 3, 12, 13, and 14. By chapter 14 the reader knows; the reference can be trimmed or implicit.

---

## 6. The arc as a whole

**Does the spec's emotional arc land?**

> "It's just Solid → signals drive the scene → climactic interactive scene → WebGPU encore"

Mostly yes. The "It's just Solid" landing happens around chapter 4–5 rather than chapter 1, because chapter 1 is preoccupied with the `<Entity>`/`createT` debate. The reader's "oh, I get this" moment is when they put `onClick` on a `<T.Mesh>` and the colour toggles — that's chapter 5. So the first part (the *promise*) takes too long to pay off.

The "signals drive the scene" beat is the strongest in the tutorial — chapters 4 through 8 do this work without a misstep that matters.

**Is chapter 13 climactic?**

It's *close*, but it doesn't quite earn the word "climax". Reasons:

- The scene is three cubes. Chapter 12 also has three cubes. Chapter 4–6 have one or two cubes. The visual scale of the climax should feel meaningfully bigger than what came before. Right now the climax demo is the same visual idiom as the chapters that built up to it.
- The "What's actually in here" breakdown is excellent — it explicitly names each prior chapter the demo touches, which gives the reader a satisfying retrospective. But the demo itself doesn't have any *new* idea that wasn't shown in 4–12; it's a clean re-mix. That's appropriate for a climax-as-synthesis, but visually it feels like a slightly bigger chapter 5.
- The DOM panel on the top-right is a great touch — it's the visible argument that "the scene and the DOM are two views over the same signals."

If you want the chapter to feel more climactic, the cheapest fix is to make the *scene* feel earned: a textured floor, a couple of lights doing real work, more than three objects, maybe one of them loaded with `useLoader`. Right now the demo is competent; the spec said this should feel like "a real Solid app", and three cubes on a bare canvas doesn't quite get there.

**Is the encore (chapter 14) a bonus, or a wet finish?**

It's a strong encore. The three-demo escalation (renderer swap → static TSL → reactive TSL with a slider) is well-paced, and the final demo brings the tutorial's central thesis back one more time: a signal updates a uniform, and the GPU sees it next frame. "Same one-property-per-frame discipline you saw with `useFrame`, but the property happens to live on the GPU." That's the right closing line.

The "That's the tour. Have fun." sign-off is dry and warm; doesn't try to upsell anything.

---

## Concrete suggestions, in priority order

1. **Rework chapter 1.** Lead with one runnable spinning cube. Move the `<Entity>` vs `createT` discussion to either a sidebar in chapter 1 or its own short interlude after chapter 2. The first chapter should leave the reader with *one* thing in their head, not three.

2. **Demonstrate the thesis in chapter 4.** A visible trace ("only the colour assignment ran") would weld the rest of the tutorial's prose to evidence. This is the single highest-leverage change.

3. **Reshape chapter 9.** Demo first, list of context fields after. Same content, different order.

4. **Fold or move chapter 7.** Easiest: trim it to a callout at the end of chapter 6 and put a longer reference page elsewhere. The Points/Lines threshold case is genuinely useful but doesn't deserve a full chapter.

5. **Swap chapters 11 and 12.** Custom components first, then Portal as "the escape hatch from the composition rules you just learned".

6. **Cut at least one of the chapter 1 demos and reconsider `08-use-frame-imperative.tsx`.** Two demos that don't move the visual story should not stay.

7. **Make the climax visually climactic.** Even one textured floor and a couple of working lights would do it.

8. **Trim the reference-doc bullet lists** in chapters 9 and 10. Move them to a real reference page.
