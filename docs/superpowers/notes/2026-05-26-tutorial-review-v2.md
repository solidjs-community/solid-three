# Editorial review v2 — solid-three tutorial (9 chapters)

Second pass. The tutorial has been substantially restructured: 14 → 9 chapters, several merges, ch1 simplified, ch3 expanded with `<Show>`/`<For>`, and the climax (now ch8) rewritten as a whack-a-cube game. This review walks the v1 critiques first, then judges the new shape.

---

## 1. Did the v1 critiques actually get addressed?

### v1 finding → status

**v1-A. Chapter 1 over-promises explanation and under-delivers a hook.** **Partially fixed.** Chapter 1 has been substantially cut — three demos collapsed to one, the `<Entity>` debate removed entirely. But the opening still reads like a textbook:

> "A `three.js` scene needs three things: a **renderer** to draw pixels, a **camera** to decide what gets drawn, and a **scene** to hold everything else."

This is verbatim the line v1 called out as lecture mode. The bullet list survived the rewrite. The rest of the chapter is much tighter, so it stings less, but the literal opening sentence still hasn't been touched.

**v1-B. The `<Entity>` vs `createT` first-decision problem.** **Fixed.** `<Entity>` is gone from chapter 1, and the curated-namespace point is now a single parenthetical:

> "(In real apps you'd hand `createT` a curated object to keep your bundle small; see [the API reference](/api/components/t) for the details.)"

This is exactly the right size for it. The reader gets one runnable thing.

**v1-C. Chapter 4 (now ch3) thesis is asserted, not demonstrated.** **Fixed, and well.** The new `03-button-toggle.tsx` adds a visible `setupRuns` counter and the prose anchors directly to it: *"Click the button repeatedly. Notice the counter at the top: 'App body has run: 1 time' — and it stays at 1, no matter how often you click."* This was the single highest-leverage change in v1's list; it's now the strongest pedagogical moment in the tutorial.

**v1-D. Hand-off from 4→5 is the model.** **Preserved.** The new ch3→ch4 hand-off (*"Same `onClick`, different target. That's the next chapter."*) is intact and still excellent. Multiple chapters now end with explicit hand-offs (3→4, 4→5 implicitly, 8→9), though some hand-offs are still weak (5→6, 6→7).

**v1-E. Chapter 9 (`useThree`) reads like a reference page.** **Sidestepped.** `useThree` no longer has its own chapter. It survives as a single sentence inside ch5 ("What else is in `context`?"):

> "The first argument to your callback is the same scene context exposed by [`useThree`](/api/hooks/use-three) — `gl`, `scene`, `camera`, `clock`, `size`."

Mostly good — but the camera-stack demo that v1 called *"the single best demo in the tutorial"* is now gone with it. That loss isn't replaced. The cleanup-on-unmount story (which welded "ownership" to a visible scene change) is just no longer in the tutorial. See §5.

**v1-F. Chapter 7 (raycaster config) was the weakest, fold or move.** **Fixed.** Removed entirely. Right call.

**v1-G. Chapter 8 (`useFrame`) is dense, `stage: "before/after"` is a reference paragraph with no demo.** **Unfixed.** The `stage` section in the new ch5 still has no demo:

> "Most code never needs to set these, but they're there when you do."

It's now slightly worse: the `priority` demo got promoted ahead of `stage`, which means the chapter ends on a reference-paragraph fizzle rather than the punchy `priority` payoff.

**v1-H. Chapter 10 (loaders) "Errors, options, base URLs" is a reference dump.** **Unfixed.** The new ch6 still closes with the same five-bullet reference list (`base`, `cache`, `onBeforeLoad`/`onLoad`, URL forms, error boundaries). Same problem v1 flagged.

**v1-I. Cut one of the ch1 trio; reconsider `useFrame` imperative.** **Half fixed.** The ch1 trio is gone. But `05-use-frame-imperative.tsx` and `05-use-frame-signal.tsx` are still both present and visually identical — and v1 explicitly flagged this. The prose now openly admits there's no visible difference (*"No signal, no smart-prop call, no allocation per frame"*), but doesn't fix what v1 actually asked for: a `<For>` of cubes to make the perf claim visible.

**v1-J. Make the climax visually climactic (textured floor, real lights, more than three cubes).** **Fixed by replacement.** Three cubes → 3×3 grid of nine cubes with emissive highlights, score, timer, win/lose state. The climax is now genuinely climactic — see §7.

**v1-K. Swap ch11 (Portal) and ch12 (Custom components).** **Sidestepped.** Portal is gone entirely from the tutorial. The chapter just doesn't exist anymore. Custom components is now ch7. This is defensible — Portal probably is a "I'll grok it when I need it" feature — but it's a real cut, not a re-order. Worth knowing it's gone.

**v1-L. Trim reference-doc bullet lists in 9/10.** **Half fixed.** Ch9 (`useThree`) is gone, so its bullet dump is gone. Ch6 (loaders) still has its bullet dump (see v1-H).

### Over-corrections / regressions

- **Composing-transforms / `<T.Group>` demo lost its callout box wrapping.** Actually it's still there as a blockquote — fine, but it's pulling double duty as both demo caption and conceptual aside. Minor.
- **The `useThree` chapter cut deletes the strongest demo in the v1 tutorial.** The camera-stack-on-unmount demo (`autodispose` / ownership made visible) is genuinely missing now. The `autodispose` concept is preserved in ch7, but only via `AxesHelper`, which is a much less satisfying demonstration than swapping cameras.
- **Hand-offs got patchier.** Ch1 ends well ("we unpack the last one in the next chapter"), ch3 ends superbly, ch8 ends superbly. But ch2→ch3 has no hand-off ("Reaching into nested props" just stops). Ch4→ch5, ch5→ch6, ch6→ch7 all just stop. The v1 review praised the 4→5 hand-off as the model; that model isn't being applied consistently.

---

## 2. Story coherence at 9 chapters

**Net better.** The cut version flows more cleanly. The spine is:

> JSX is the scene (1–2) → signals drive it (3) → events talk back (4) → time talks back (5) → async (6) → composition (7) → climax (8) → encore (9)

That's eight beats plus an encore in nine chapters. Each part of the original 6-part outline is now compressed to roughly one chapter, except Part 2 (signals + events) which is two. The reader doesn't feel beaten over the head with sub-parts.

**What got dropped:**

- **`useThree` as a standalone beat.** Folded into ch5's "what else is in context" aside. Mostly fine, but see v1-E above — the visible ownership demo went with it.
- **Raycaster configuration (layers, thresholds).** Cut entirely. Right call.
- **Portal.** Cut entirely. Defensible but a real omission — readers wanting to render into another scene have no in-tutorial pointer.
- **`autodispose` & `meta` as their own beat.** Folded into ch7. Acceptable; the v1 review already endorsed this.

**What got added:**

- **`<Show>` and `<For>` in ch3.** Excellent addition. The button-toggle is the thesis demo; `<Show>` and `<For>` are the "this really is just Solid" payoff that v1 wanted ch1 to deliver. By the time the reader reaches ch4, they've already had the "oh, I get this" moment v1 said took too long.
- **The `setupRuns` counter.** Welds the thesis to evidence (see v1-C).
- **The whack-a-cube game.** Real climax (see §7).

**Coherence wins overall.** The tutorial reads more like one continuous story than v1 did.

---

## 3. Ordering

Chapter-to-chapter the progression is now:

1. First scene (JSX → mesh)
2. Props/children/transforms/args
3. Signals + control flow (thesis chapter)
4. Pointer events
5. useFrame (time)
6. Loaders (async)
7. Custom components (composition + autodispose)
8. Game (synthesis)
9. WebGPU (encore)

**Strong:** 1→2, 2→3, 3→4, 4→5, 7→8, 8→9. Each one is a natural next dial to turn.

**Awkward:** 5→6 and 6→7.

- **5→6:** From frame loop to async loaders is a real topic switch. Ch5 ends on a `stage` reference paragraph; ch6 opens with "Textures, models, audio". There's no bridge sentence. The reader notices the gear-shift.
- **6→7:** Loaders to custom components is also a topic switch. Again no bridge. The natural framing would be "now that you can mount async assets, you'll want reusable wrappers for them" — but ch7's `<Cube>` and `<Axes>` examples don't actually use loaders, so the bridge isn't available.

These are the seams of the merge. They aren't fatal, but they're the places where the tutorial stops feeling like one story and starts feeling like a sequence of topics.

**One specific re-order suggestion:** within ch5, the `stage` section currently follows `priority` and has no demo. Either drop the `stage` section entirely (it's two short paragraphs of reference text) or restore the punchier ending by ending on `priority`'s payoff and moving `stage` to a one-line "and there's also `stage`" parenthetical inside the priority section.

---

## 4. Per-chapter contribution

| Ch | Earns it? | Notes |
|---|---|---|
| 1 | Yes | Much tighter than v1's chapter 1. Still opens in lecture mode (see v1-A). One demo, right size. |
| 2 | Yes | Five concepts (transforms / group / shorthands / args / nested keys) packed in, but each lands. The "Reaching into nested props" section still has no demo (v1 flagged this) — it's now the only non-demo'd syntactic idea in the tutorial. |
| 3 | Yes, *thesis chapter* | The strongest chapter. Three demos, escalating: button-toggle (with setupRuns counter), `<Show>`, `<For>`. Earns the title "Signals drive the scene". |
| 4 | Yes | Four demos (click, hover, click-missed, propagation). Carries its weight; each demo introduces a distinct semantic. |
| 5 | Yes, but lopsided | The `priority` demo is good; the `stage` reference paragraph is filler. The imperative demo is still visually indistinguishable from the signal demo (v1-I). |
| 6 | Yes, just barely | Two demos showing the same outcome two ways. Good "use whichever reads better" framing. The "Errors, options, base URLs" bullet dump remains the chapter's weakest moment. |
| 7 | Yes | Composition + useProps/autodispose pairing is the right shape. The `AxesHelper` demo is a slightly thin demonstration of `autodispose` (the GPU resource being released is invisible) — but it's a real custom component, which is the point. |
| 8 | **Yes — climax** | See §7. Earns it. |
| 9 | Yes — encore | See §7. |

**Density:**
- Ch2 is the densest "reference content" chapter, but each piece is necessary.
- Ch5 is the only chapter where I'd actively cut something (`stage` section, or one of the two visually-identical useFrame demos).

**No chapter is too thin.** The smallest, ch6 and ch7, both earn their place.

---

## 5. Demos

**Demos that pull their weight:**

- `03-button-toggle.tsx` — the `setupRuns` counter is the highest-leverage demo in the tutorial. Welds the thesis to evidence.
- `03-show.tsx`, `03-for.tsx` — minimal, correct, deliver the "just Solid" moment ch1 doesn't.
- `04-click.tsx` — one-line change from ch3's toggle, exactly the right "look how little moved" feel.
- `04-stop-propagation.tsx` — the front/back cubes make propagation spatial.
- `05-use-frame-options.tsx` — the priority demo is a clean motivation for why ordering matters.
- `07-composition.tsx` — three coloured cubes, twelve-line component, payoff visible.
- `08-interactive-scene.tsx` — see §7.
- `09-webgpu-tsl-uniform.tsx` — the slider closing the loop on "signals drive the scene" remains the strongest single demo by emotional payoff.

**Demos that are filler or weak:**

- `02-args.tsx` — still a flat 2×1×1 box. v1 called this out; no change. A button/slider that changes `args` and shows the rebuild would actually teach the lesson.
- `05-use-frame-imperative.tsx` — visually identical to the signal version. v1 flagged this; not addressed. Either drop it or build the `<For>`-of-cubes version that makes the perf claim visible.
- `07-use-props.tsx` — the `AxesHelper` demo shows the smart-prop pipeline applied to a non-`<T.*>` instance, but the disposal claim (`autodispose`) has no visible evidence. The v1 camera-stack demo was the gold-standard "ownership made visible" — its absence is felt here.

**Demo additions still missing:**

- A demo for the dashed-key syntax in ch2 ("Reaching into nested props"). Currently the only syntax introduced without a demo.
- An ownership-visible demo for `autodispose` in ch7. The text claims GPU resources are released, but the reader has no way to see it.

**Demos that exist and shouldn't:** none truly bad. The two weak ones (`02-args`, `05-use-frame-imperative`) are weak in the same way — they look identical to a neighbouring demo and ask the reader to take their thesis on faith.

---

## 6. Voice & tone

Mostly held up. The conversational-but-technical register is consistent. Specific slips:

- **Ch1 still opens in lecture mode.** The literal sentence v1 quoted as the problem ("A `three.js` scene needs three things…") is unchanged. This is the easiest 30-second fix in the whole tutorial.
- **Ch2: "The principle: pass whatever's most ergonomic for the shape of data you have."** Still says "principle". v1 flagged this. Unchanged.
- **Ch5 "Most code never needs to set these, but they're there when you do."** Lifted nearly verbatim from ch4 ("Most scenes never need this — but it's there when you do"). Once is dry; twice within two chapters is a formula.
- **Ch6 closes with the five-bullet reference dump** — voice slips into API-doc mode for the chapter's final paragraph. Same problem as v1.
- **Ch8 "That's the tour"** and **ch9 "That's the tour"** are nearly identical closing sections. Both chapters end with: "You've now seen the whole library — the foundational pieces, the reactivity primitives, the event system, the loader/lifecycle utilities, the composition patterns…". This is a real duplication — the climax (ch8) and the encore (ch9) have the same closing paragraph almost verbatim. Pick one and rewrite the other.
- **"the smart-prop pipeline"** reference still appears in ch2 indirectly, ch7 ("the smart-prop pipeline from Smart props" — and that link points to ch2 even though the link text says "Smart props", which is the old chapter title — broken-ish link), ch9 ("the smart-prop machinery you saw in chapter 3" — pointing to ch2). The cross-references are slightly inconsistent in chapter numbering.

**Where the voice is now best:** the new ch3 prose. *"That's the through-line of the whole library: a scene in `solid-three` is a reactive view over a `three.js` graph."* That's the thesis sentence the v1 tutorial wanted at its top. Now it's at the top of ch3, where the demo has just earned it.

---

## 7. The arc as a whole

**Does ch8 land as a climax?**

Yes, substantially better than v1's chapter 13. Reasons:

- **Nine cubes vs three.** The visual scale finally matches the "everything you've learned, assembled" promise.
- **It's a game with stakes.** Score, timer, win/lose state. The reader plays it, not just watches it. That's the difference between a demo and a climax.
- **The "What's actually in here" retrospective still works.** Each prior chapter is named: state via signals, `<For>`, `useFrame`, `event.stopPropagation()`, `<Show>`. The reader gets a satisfying audit of what they've learned.
- **The DOM panel on top-left** (score + timer) still carries the "DOM and scene are two views over the same signals" argument visually.

What still isn't great:

- **The `setInterval` for the timer is a real `setInterval`, not driven by `useFrame`.** That's a defensible choice (the countdown isn't frame-locked), but a reader who just learned `useFrame` last chapter might wonder why it isn't used here. One sentence acknowledging the choice would prevent the dissonance.
- **No textured anything, no loader use.** Ch6 is the only chapter the climax doesn't actively cite. Worth using `useLoader` for the cube texture or the floor, even briefly, so the climax also retros ch6.
- **The closing paragraph duplicates ch9's closing paragraph.** See §6.

**Does ch9 (WebGPU) feel like a real bonus?**

Yes. The three-demo escalation (renderer swap → static TSL → reactive TSL with slider) is exactly the right shape for an encore: starts trivial (one line changed), ends with the central thesis re-stated against a brand-new substrate (signal → uniform → GPU). The closing line — *"The same one-property-per-frame discipline you saw with `useFrame`, but the property happens to live on the GPU"* — is the right closing thought.

**The "Have fun" sign-off** in ch9 is dry, warm, doesn't oversell. Don't change it. (But do change the ch8 closing so the two chapters don't end with the same paragraph.)

---

## 8. Anything new to cut, move, or merge

In priority order:

1. **Rewrite the literal opening sentence of ch1.** Replace "A `three.js` scene needs three things…" with something that points at a thing the reader is about to see. The rest of ch1 is now good enough that the opening sentence is the only remaining drag. ~30 seconds of work.

2. **Cut `05-use-frame-imperative.tsx` or rewrite it to show a perf-visible diff.** v1 flagged this; v2 still has it. Two visually-identical demos asking the reader to trust the perf claim.

3. **Cut the `stage: "before"/"after"` section in ch5, or fold to one line.** It's a reference paragraph that breaks the chapter's rhythm. The chapter would end stronger on the `priority` demo's payoff.

4. **Cut the "Errors, options, base URLs" bullet list at the end of ch6.** v1 flagged this; unchanged. Move to API reference. Optionally keep the single most useful bullet (the URL-as-record case for material sets) as a one-sentence aside.

5. **De-duplicate ch8 and ch9 closing paragraphs.** They currently end with the same "You've now seen the whole library…" prose. Pick one chapter to own that paragraph (ch9 reads more naturally as the final word). Replace ch8's with something that hands off to the encore — "If you want a look at where the library is heading next, the encore is a peek at WebGPU" is already its second-to-last line; promote it.

6. **Add a demo for the dashed-key syntax in ch2** (or move that section to ch7 where shadow lights actually come up). It's currently the only syntactic introduction in the tutorial without a runnable demo. Same point v1 made — unfixed.

7. **Add a bridge sentence at the end of ch5 and ch6.** Apply the 3→4 hand-off model. The seams between Part-equivalents are where the tutorial stops feeling like a story.

8. **Cite ch6 (loaders) from ch8's "What's actually in here".** If the climax doesn't touch loaders, the reader retroactively wonders whether ch6 mattered. Cheapest fix: a textured face on the cubes via `useLoader`.

9. **Reconsider what to do with the ownership-made-visible idea.** The camera-stack demo was the strongest ownership demo in v1 and was cut. `autodispose` survives in ch7 but its visible payoff doesn't. Either accept that ownership is now a textual claim (and acknowledge it) or bring back a demo where un-mounting visibly disposes something.

---

## Overall

The cut is a net win. The 9-chapter version reads more like one continuous story than the 14-chapter version did. Three of the v1 review's highest-priority recommendations (rework ch1, demonstrate the thesis, fold ch7-raycaster) were taken. Three (`stage` reference paragraph, loader bullet dump, redundant imperative demo) were not. The new climax (whack-a-cube) is genuinely climactic; the v1 climax wasn't. The encore is unchanged and continues to be the right encore.

The remaining drag is concentrated in three places: the literal opening sentence of ch1, the trailing paragraph of ch5, and the trailing paragraph of ch6. Fixing those three things would be ~15 minutes of work and would lift the whole tutorial perceptibly.
