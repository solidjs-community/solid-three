# Editorial review v3 — solid-three tutorial (9 chapters)

Third pass. Scope is tight: **flow & story arc**, plus **API cross-linking**. The
tutorial has been restructured again since v2: ch3 is now pure control flow,
the reactive-props demo and prose absorbed into ch2, Portal restored as ch7,
and the custom-components/`useProps`/`autodispose` chapter dropped. Below I
walk chapter-by-chapter on flow only, then handle cross-linking as its own
section.

---

## 1. Flow & story

### Macro shape

```
1 First scene → 2 Props/children → 3 Control flow → 4 Pointer events
→ 5 useFrame → 6 Loaders → 7 Portal → 8 Game → 9 WebGPU
```

Compared to v2, the **thesis moment moved**. In v2 it lived in ch3
(button-toggle with the `setupRuns` counter, anchored to the prose
"that's the through-line of the whole library"). In v3 the thesis demo
and that exact sentence are now inside **ch2** ("Reactive props" section,
lines 47–63). Ch3 has been re-cast as a pure tour of Solid's control-flow
components.

That move is mostly good — it means the thesis is locked in by the time
the reader reaches ch3 — but it has a cost: **ch2 is now lopsided.** It
contains transforms, group composition, the thesis, args, dashed keys, and
the shorthand reference, in that order. The thesis sentence is the most
important sentence in the tutorial and it's now buried in slot 3 of 6
inside a chapter titled "Props and children". See §1.2.

### 1.1 Chapter 1 — Your first scene

**Opening (lines 9–11)**: "Mounting a `<Canvas>` is the whole boilerplate.
It wires up a renderer, a camera, and a scene…" Good. The v1/v2 lecture-mode
opening ("A three.js scene needs three things…") is finally gone. The new
opening leads with the action (mount a Canvas) and folds the renderer/
camera/scene tax into a subordinate clause. Right shape.

**Close (lines 38–41)**: "Three new ideas snuck into that snippet —
`createT`, the `T.*` namespace, and the way `<T.Mesh>` consumes its
children as a geometry and a material. We unpack the last one in the next
chapter…" This is doing too much. It enumerates three things and then says
only one of them will be addressed next. The reader is left wondering about
the other two (will `createT` get a proper explanation later? does the
`T.*` namespace have anything else to say?). In practice neither gets
revisited — ch2 just *uses* them.

Tighter: "Nesting `<T.BoxGeometry>` and `<T.MeshNormalMaterial>` inside
`<T.Mesh>` is your first taste of the scene graph. The next chapter is
about how that nesting actually works." Names what ch2 is about; doesn't
trail loose ends.

### 1.2 Chapter 2 — Props and children

**The thesis is buried.** Lines 61–63: *"That's the through-line of the
whole library: a scene in `solid-three` is a reactive view over a
`three.js` graph. Anything that drives a Solid component also drives the
scene."* This is the sentence the v1 review said the whole tutorial wants
at the top of an early chapter. It now lives in the middle of ch2,
sandwiched between transforms and `args`. A reader skimming heading
levels would not see it; the section is called "Reactive props", which
sounds like one feature among many.

Two options:

1. **Promote it** — make "Reactive props" the chapter's first major
   section (before transforms/group), so the thesis lands while the
   reader's attention is fresh. The mechanical transforms can follow as
   "now that you know the model, here are the dials".
2. **Move it to its own short chapter between 2 and 3** ("Why this is
   just Solid"), a 60-second interlude. Heavyweight, probably not worth
   it.

I'd take option 1. The current ordering treats the thesis as a feature
of "props"; it isn't. It's the whole pitch.

**"Composing transforms" (lines 26–44).** The blockquote on lines 37–40
is doing double duty as both demo caption and concept aside — same minor
complaint v2 noted. Not a flow issue exactly, just clutter. The prose
*around* the blockquote ("Rotate the group instead of the cubes any
time…") is the better paragraph; the blockquote could be cut.

**"Reaching into nested props" (lines 77–87).** Still a syntactic
introduction with no demo. This is the only piece of syntax in the
tutorial with no runnable example. v1 and v2 both flagged it. In a
flow-focused review I'll just note: this section breaks the demo-per-idea
rhythm and reads as a reference paragraph parked mid-chapter. If the
demo isn't coming, fold this into the closing "shorthands" sub-section as
one more bullet ("Use a dashed key for nested setters: `shadow-mapSize-width={1024}`").

**Close (lines 105–107)**: "The principle: pass whatever's most ergonomic
for the shape of data you have. `solid-three` figures out the right call
on the underlying object." v1 and v2 both flagged the word "principle".
Still says "principle". Two reviews in, you've decided to keep it; I'll
let it lie.

**No hand-off to ch3.** Chapter just ends on the shorthand reference.
After the strong "what's next?" close of ch1 (despite its other issues),
ending ch2 with no bridge is a flow drop. Suggested closer: "Props get
even more interesting when they're driven by control flow — `<Show>`,
`<For>`, `<Suspense>`. That's the next chapter, and it's the same
control flow you already know from Solid."

### 1.3 Chapter 3 — Control flow

**Opening (lines 14–18)**: "Solid's control-flow components — the ones
you reach for in any component tree — all work inside `<Canvas>` exactly
the way they work inside a `<div>`. You don't learn a new vocabulary;
you keep using `<Show>`, `<Switch>`, `<For>`, `<Index>`, `<Suspense>`."
Good — confident, terse, sets the reader's expectation that this chapter
is a tour, not a re-education.

**The chapter's job is now narrower than v2's.** With the thesis moved
into ch2, ch3 is the "see, it really is just Solid" tour. That's fine,
but the chapter doesn't ever say so explicitly. The opening sentence
gets close ("exactly the way they work inside a `<div>`"), but the
chapter never closes the loop with a "look how little of this was new"
beat. A one-sentence closer would help — see hand-off note below.

**`<Show>` / `<Switch>` / `<For>` / `<Index>` / `<Suspense>` cadence
is good.** Each section is two short paragraphs plus a demo. The reader
gets forward motion. No sub-section over-stays its welcome.

**`<Suspense>` (lines 67–78).** Mentions `createResource` but doesn't
link out. See §2 (cross-linking).

**Close (lines 80–84)**: "So far the triggers have been DOM buttons. But
what if you wanted to click the cube — the actual `<T.Mesh>` — and have
*that* be the trigger? Same `onClick`, different target. That's the next
chapter." This is the model hand-off the v1 review praised. Preserved
verbatim. Still excellent.

### 1.4 Chapter 4 — Pointer events

**Opens cleanly off ch3's hand-off.** "The button you wrote in the last
chapter handled an `onClick` from the DOM. `solid-three` lets you put
the same handler on a `<T.Mesh>`…" Welds directly to the ch3 closer. The
two chapters read as a continuous arc, not two topics in sequence.

**The "one property assignment runs" refrain (line 36)**: "Move the
pointer over the cube — it grows. Leave — it shrinks. The signal flips;
`scale` reads it; one property assignment runs." Good — this is now the
*echo* of the thesis from ch2, not the assertion of it. By moving the
thesis demo back to ch2, ch4 gets to *use* the thesis without having to
prove it. Better story shape.

**"When you actually want the full list" (lines 73–87).** This is a
reference paragraph parked at the end of a teaching chapter. The
preceding `event.stopPropagation()` section ends on a strong demo
("Take the line out and click the front cube again: both cubes
toggle"). Then the reader is handed a five-line `for (const hit of
event.intersections)` snippet with no demo and the kicker "Most scenes
never need this — but it's there when you do." That sentence is
identical in shape to the v2-flagged ch5 "Most code never needs to set
these, but they're there when you do." It's becoming a formula.

If this section stays, give it a single sentence and link out: "The
event also exposes the full `intersections` array, sorted nearest-first
— useful for x-ray selection and through-walls measurement. See [the
events overview](/api/events/overview)." Anything longer wants a demo
or a real reason to be in tutorial prose.

**"What's actually in the event?" (lines 89–95).** Also reference-y, but
this one earns its place because it's a quick inventory the reader
genuinely wants after seeing two event handlers. Five-line paragraph, no
fat. Keep.

**No hand-off to ch5.** Chapter ends on "drag-to-rotate, paint-on-
surface, world-space gizmos." Nice imagery, but no bridge to `useFrame`.
The natural bridge is right there: "All of those need to update across
multiple frames — which is where `useFrame` comes in. That's the next
chapter."

### 1.5 Chapter 5 — useFrame

**Opens clean** ("`<Canvas>` is already running an animation loop. `useFrame`
is the hook that lets you plug a callback into that loop…"). Lead with
the demo, not the inventory. Right shape.

**The two demos still look identical to the eye.** v1 and v2 both
flagged this. `05-use-frame-signal.tsx` and `05-use-frame-imperative.tsx`
produce the same visible spin. The prose openly acknowledges it ("No
signal, no smart-prop call, no allocation per frame"), but the demo
doesn't earn the claim. *Flow-wise*, the consequence is that the
"Imperative: skip the signal" section feels like a downbeat between two
upbeats (`useFrame` intro → `priority`). The reader watches the same
thing spin twice. Either cut the imperative demo, or build the
`<For>`-of-cubes version that makes the perf claim visible. v3 hasn't
addressed this; I won't re-litigate beyond noting it as a flow drag.

**"What else is in `context`?" (lines 41–45)**: this is the only place
in the tutorial that mentions `useThree`. One sentence. It's the right
size for what it now does (the dedicated `useThree` chapter is gone). The
phrasing — "the same scene context exposed by `useThree`" — gracefully
hands off the curious reader to the API page (and it actually links —
see §2). Good.

**The chapter still ends on the `stage` reference paragraph (lines
59–65).** v2 flagged this; unchanged. The chapter's strongest moment is
the `priority` demo at line 52 ("Swap the priorities and the camera will
lag the cube by one frame"). That's the punchy payoff. Then immediately:
"`stage: 'before'` (the default) runs the callback before the render
pass… Most code never needs to set these, but they're there when you
do." The chapter fizzles. Strongest fix: cut `stage` to a one-line
parenthetical in the priority section ("…lower numbers run first within
the same stage; there's also a `stage` option for post-render passes,
which most code can ignore"). The chapter then ends on the priority
demo and feels finished.

**No hand-off to ch6.** v2 explicitly called out the 5→6 seam. v3
hasn't fixed it. Ch5 ends on a reference paragraph; ch6 opens on
"Textures, models, audio…". The reader feels the gear-shift from time to
async loaders.

Natural bridge: "Time is one source of state the scene reads from each
frame. The other source you'll inevitably reach for is data from
outside the app — textures, models, audio. That's the next chapter."

### 1.6 Chapter 6 — Loaders & Resource

**Opens with a topic statement, not a hook.** "Textures, models, audio
— `three.js` ships a loader class for each kind. `solid-three` exposes
two ways to use them…" This is competent but flat. Compare to ch5
("`<Canvas>` is already running an animation loop"), which gives the
reader a fact about the system they didn't know yet. Ch6's opening
re-states a fact most readers already know (three.js has loaders) and
then says "and here are two APIs". The hook would be the *why*: that
both forms plug into `<Suspense>`, which the reader just learned about
two chapters ago. Suggested re-open: "You already taught `<Suspense>` to
wait for a `createResource` in chapter 3. Loaders are the same trick,
plus a cache and some smart-prop wiring."

**Two-demo pair works.** `useLoader` then `<Resource>`, with the "use
whichever reads better" framing at line 39. Clean.

**Close (lines 47–52)**: "Both forms compose with the rest of Solid the
way you'd expect — loader errors propagate to the nearest
`<ErrorBoundary>`, multiple loaders share the cache, you can pass an
array of URLs or a labelled record for material sets. The API reference
has the full surface…" The five-bullet list v1 and v2 flagged has been
rolled into a single paragraph, which is better. But the paragraph is
still a reference dump (errors, cache, URL forms) and still has no
demo. *Flow-wise* it's now less obtrusive than the bullet form; I'd
call this one-shrug-acceptable.

**No hand-off to ch7.** v2 flagged 6→7 as the second-worst seam. v3
brought Portal back as ch7, which *deepens* the seam — Portal is even
further from loaders than custom components were. There is no natural
bridge from loaders to Portal. The cleanest move is either (a) accept
the seam and put a section break with a brief recap ("That covers the
everyday plumbing — Canvas, props, control flow, events, frames,
loaders. The last chapter before the climax is the escape hatch for
when the JSX tree and the scene tree need to disagree."), or (b) move
Portal somewhere else (between 7 and 8 makes no sense; it could
arguably go between 4 and 5, since the "render-target" Portal demo
*does* use `useFrame`, but that creates a forward reference too). The
seam is real; v3 has not improved it.

### 1.7 Chapter 7 — Portal

**The chapter is good in isolation.** Two demos, escalating: scene-root
escape, then render-target. The second demo is genuinely impressive —
a cube whose faces are a live render of another scene — and it
re-uses every prior chapter's machinery (`useFrame`, `ref`, smart props,
`useThree`) in a way that feels earned.

**But it's the wrong chapter for slot 7.** Portal answers a question
the tutorial reader doesn't have yet. Chapters 1–6 build a model where
"JSX is the scene graph". Chapter 7's pitch is "here's how to break
that mapping". That's a sophisticated move; it lands better as a
post-game appendix than as the chapter immediately before the climax.
A reader's curve at this point in the tutorial is "I want to build
something" — and the climax (ch8) is *exactly* that promise. Portal
sits in front of it like a speed bump.

If you keep Portal here, give it a stronger opening that grounds the
reader in why they'd care *now*: "Up until now, your JSX has been a
faithful mirror of the scene graph. There's one exception, and it
unlocks some genuinely interesting tricks." The current opener
("So far the scene graph has been a faithful mirror of your JSX")
is the right shape; just add one more beat ("and you might be
wondering when that ever stops being true").

**Close (line 60)**: "The next chapter pulls all of this together into
a small game." This is a clean hand-off. Best one in the back half.
Keep.

**One specific flow problem inside the chapter**: the render-target
demo's six-bullet "things to notice" list (lines 44–58) is a reference
dump in disguise. After a chapter that's mostly prose, you ask the
reader to absorb six observations in a row. The bullets *are* well-
chosen, but six is too many to digest in one sitting. Cut to three: the
`<Portal element={offscreenScene}>` redirection, the `CopyOffscreenToTexture`
component, and the smart-prop pipeline accepting `renderTarget.texture`.
The "knot still spins reactively" bullet is the chapter's payoff —
promote it to a sentence in the running prose, not a bullet.

### 1.8 Chapter 8 — A small game

**Opens correctly.** "You've now seen every piece. Time to put them
together into something that actually plays." The voice and the
promise match. The reader is primed.

**The 130-line claim is now off.** The snippet is 145 lines (I
counted). Either round up ("under 150 lines") or count again. Off-by-
fifteen is the kind of thing a careful reader notices, and a "fewer
than 130" promise that becomes 145 by the time you look at the file is
a tiny credibility hit.

**The "What's actually in here" retrospective (lines 23–43)** works
exactly as v2 said it did. Five bullets, each naming a prior chapter.
The reader gets a satisfying audit.

But two chapters are *not* named: **ch6 (loaders)** and **ch7 (Portal)**.
v2 flagged the ch6 omission; v3 hasn't fixed it. Now ch7 is also
missing — Portal does not appear in the game at all. This means two of
the nine chapters do not contribute to the climax. The reader who
just spent time on Portal in particular will notice it doesn't show
up here, and that's a flow problem: it retroactively makes ch7 feel
like a detour rather than a beat in the arc.

Cheapest fix: pick one. Either add a textured surface to one cube
(via `useLoader`) to bring ch6 in, or render the active cube's
emissive glow through a Portal-style trick to bring ch7 in. Doing both
is overkill; doing neither leaves two chapters orphaned.

**Close (lines 45–57)**: "What you just shipped" + "If you'd like a
peek…". The v2-flagged duplication with ch9's closing paragraph is
*not* an issue any more in v3 — the two closings read differently now.
Good. The hand-off to ch9 ("If you'd like a peek at where the library
is heading next, the encore is WebGPU") is well-placed.

### 1.9 Chapter 9 — A peek at WebGPU

**Opens with the right hook.** "`three.js` is in the middle of moving
from WebGL to WebGPU. The new renderer is a drop-in replacement…"
States the change, states why the reader cares, sets up the chapter as
a *peek*. Right register for an encore.

**Three-demo escalation works.** Renderer swap → static TSL → reactive
TSL with slider. Each demo motivates the next. The final slider demo
("the property happens to live on the GPU") is the cleanest possible
encore-closer.

**Close (lines 95–96)**: "That's the whole tutorial. Build something —
and if you make something interesting, send it." Dry, warm, doesn't
oversell. The closer the tutorial deserves.

**Two small flow nits inside the chapter:**

- Line 66: "The same smart-prop machinery you saw in
  [chapter 3](/tutorial/02-props-and-children)". The link text says
  "chapter 3" but the URL points to chapter 2 (`02-props-and-children`).
  The "smart-prop" content lives in ch2 ("Why arrays work on a
  Vector3"), not ch3 ("Control flow"). The link target is right; the
  link text is wrong. Should read "chapter 2" or just "the smart-prop
  pipeline".

- Lines 87–93 ("Where this is going"). Short section that mostly
  restates what the demos already showed. Could be cut to one
  sentence and folded into the close, which would make the encore
  feel even more like an encore (light, no extra ceremony).

---

### 1.10 Summary of flow issues, ranked

1. **The thesis is buried inside ch2.** Make "Reactive props" the
   first major section of ch2 (or its own short interlude). This is
   the single highest-leverage flow fix. ~10 minutes of work.

2. **Hand-offs are missing at 2→3, 4→5, 5→6, 6→7.** The 3→4 hand-off
   is the model; the rest of the tutorial doesn't apply it. Add a
   one-sentence bridge to the close of each. ~20 minutes total.

3. **Ch7 (Portal) sits in the wrong slot.** It's the last chapter before
   the climax but doesn't contribute to it. Either move Portal to a
   post-game appendix, or wire one of its tricks into ch8's game so it
   stops feeling orphaned.

4. **Ch6 is also not cited in ch8's "What's actually in here".** Add a
   textured cube via `useLoader`. v2 flagged this; v3 hasn't fixed it.

5. **Ch5 ends on a `stage` reference paragraph.** Cut to one
   parenthetical; let `priority`'s payoff close the chapter. v2
   flagged this; v3 hasn't fixed it.

6. **Ch9's chapter-numbering link is wrong** (says ch3, points at ch2,
   subject matter is ch2). Fix the link text.

7. **The 130-line claim in ch8 is now 145 lines.** Round up or recount.

Items 5, 6, 7 are sub-five-minute fixes.

---

## 2. API cross-linking

### Current state

The whole tutorial contains **five** outbound links. Three to `/api/`,
two to other tutorial chapters:

| File | Line | Target | Notes |
|---|---|---|---|
| 01-your-first-scene.mdx | 36 | `/api/components/t` | Parenthetical aside on curated namespaces. Right size, right placement. |
| 05-use-frame.mdx | 43 | `/api/hooks/use-three` | One-sentence handoff for the curious reader. Right placement. |
| 06-loaders-and-resource.mdx | 51 | `/api/hooks/use-loader` | Closing reference pointer. Right placement. |
| 09-webgpu-peek.mdx | 66 | `/tutorial/02-props-and-children` | Mis-labelled as "chapter 3". |
| 09-webgpu-peek.mdx | 83 | `/tutorial/05-use-frame` | Correct. |
| 08-interactive-scene.mdx | 53 | `/api` | Index page. Generic, but appropriate for a closing pointer. |

Six links across nine chapters. The placement of the existing links is
good (none feel interruptive). The problem is **how many links are
missing**.

### Missing cross-links, by chapter

**Ch1**:
- Line 9: "Mounting a `<Canvas>`" → should link `<Canvas>` to
  `/api/components/canvas` on first mention. This is *the* primary
  export. It deserves an off-ramp.
- Line 21: "`createT`" → already linked downstream (line 36 wraps the
  curated-namespace mention in a link to `/api/components/t`). First
  mention of `createT` at line 21 should be the linked one; move the
  link there.

**Ch2**:
- Line 13: "A `three.js` scene is a tree" — fine as is.
- Line 47–49: "Any prop can be a signal. Pass one and the scene tracks
  it…" The thesis paragraph names the smart-prop pipeline implicitly.
  No link needed here (this is teaching, not reference).
- Line 73: "`args` is spread into the constructor: `new
  BoxGeometry(...args)`." Could link `args` to a `/api/components/t`
  anchor on construction args, if such an anchor exists. Soft miss.
- Line 83: "`<T.DirectionalLight castShadow shadow-mapSize-width={1024}
  shadow-mapSize-height={1024} />`". The dashed-key syntax is the only
  feature in the tutorial without a demo. Link out is exactly the off-
  ramp the curious reader wants. → `/api/hooks/use-props` is the
  likely target, or wherever nested-key resolution is documented.
- Line 96: "`Color` accepts strings, hex numbers, and RGB tuples." Soft
  miss; could link to whatever utility page covers color/vector
  coercion. Skip if no good page exists.

**Ch3**:
- Line 14–16: Names `<Show>`, `<Switch>`, `<For>`, `<Index>`,
  `<Suspense>`. These are *Solid* components, not solid-three exports;
  if the tutorial's link policy is "link our exports, not Solid's",
  skip. Otherwise a link to Solid's docs at first mention would help
  the truly-new reader. Probably skip — the chapter explicitly says
  "you keep using" them, which implies "from Solid".
- Line 67: "Wait for a `createResource` to resolve…" Could link
  `createResource` to Solid's docs. Same policy question. Probably skip.

This chapter has the clearest argument for staying mostly *un*linked.
The reader is being told these are familiar Solid primitives; sending
them away undercuts the chapter's pitch.

**Ch4**:
- Line 14: "lets you put the same handler on a `<T.Mesh>`" — no link
  needed.
- Line 23: "Under the hood, `solid-three` runs a `Raycaster`…" → could
  link `Raycaster` to `/api/utilities/raycasters` if that page covers
  it. Useful off-ramp for the curious.
- Line 41: "`onClickMissed`" → link to `/api/components/canvas` (which
  is where the prop lives) or `/api/events/overview`. **Strong miss.**
  This is a named export on a specific component; the reader who wants
  the full event surface will absolutely want a link.
- Line 51: "longer list of pointer events (`onPointerMove`,
  `onPointerDown`, `onPointerUp`, `onWheel`, …)" → **strong miss.**
  This is the exact moment to link `/api/events/overview`. The prose
  explicitly says "there's a longer list"; that's a *promise* of a
  reference, broken because the reference isn't linked.
- Line 73: "x-ray selection, 'click through' tools" → could link
  `/api/events/raycastable` if that's what gates these patterns. Soft
  miss.
- Line 89: "What's actually in the event?" — the description of the
  enriched event object is exactly the kind of thing
  `/api/events/overview` should fully document. **Strong miss** for a
  link out at the end of this section.

Ch4 is the chapter where the cross-linking deficit is worst. Three
distinct strong misses, all clustered.

**Ch5**:
- Line 14: "`<Canvas>` is already running an animation loop" — could
  link `<Canvas>` (first mention since ch1; debate-able).
- Line 16: `useFrame((context, delta) => ...)` — could link `useFrame`
  to `/api/hooks/use-frame`. First substantive use of the function;
  good place. **Soft miss.**
- Line 43: already links `useThree`. Good.
- Lines 47–55: the `priority` discussion is a perfect candidate for a
  link to `/api/hooks/use-frame#priority` (if anchors exist) or just
  the page. **Soft miss.**
- Lines 59–65: `stage` discussion — same. **Soft miss.**

If `stage` is going to stay as a reference paragraph at all, linking
it out is the cleanest way to make peace with that fact. A reference
paragraph that links to the actual reference reads as "here's a
pointer", not as "here's a half-finished section".

**Ch6**:
- Line 17: `useLoader(loaderClass, url)` — first definitional use.
  **Strong miss** — link to `/api/hooks/use-loader` on first mention,
  not just in the closing sentence at line 51.
- Line 33: `<Resource loader={...} url="...">` — first definitional
  use. **Strong miss** — link to `/api/components/resource`.
- Line 36: "`attach` does the wiring for you." → could link to
  whatever page documents `attach` (a smart-prop feature?). Soft miss
  if no good page.
- Line 47: "loader errors propagate to the nearest `<ErrorBoundary>`"
  — Solid concept, skip per policy.
- Line 48: "multiple loaders share the cache" → could link to
  `/api/utilities/loader-cache`. **Strong miss.** This is the *only*
  mention of the loader cache in the entire tutorial, and it's
  unlinked.

**Ch7**:
- Line 8: First mention of "Portal" with no link to
  `/api/components/portal`. **Strong miss** for any chapter, but
  especially a one-feature chapter where the API page exists
  specifically for this feature.
- Line 41: `CopyOffscreenToTexture` is a regular `solid-three`
  component that uses `useThree()` — already linked downstream in ch5;
  no need.

**Ch8**:
- Line 33: "uses `useFrame` to bob the active cube forward, and
  `onClick`" — could link both. The chapter is the climax retrospective,
  so this is exactly the right place to link aggressively *out* (see
  recommendation §2.2 below).
- Line 53: "The API reference is there when you need a specific
  export." → linked. Good closing pointer.

**Ch9**:
- Line 66: Link mis-numbered ("chapter 3" → ch2). **Fix.**
- Line 83: links `useFrame` correctly. Good.

### 2.1 Net assessment

The tutorial under-links. There are **six** outbound links in roughly
1,200 lines of prose, and at least **ten** of those misses qualify as
"strong" — i.e., a place where the reader is explicitly told about an
API surface that has a dedicated reference page, and the chapter just
moves on. Ch4 and ch6 are the worst offenders.

### 2.2 Recommended cross-linking guideline

A simple rule that fits the tutorial's voice:

> **Link the first definitional use of an export.** "Definitional" means
> the line that names the export and explains what it does, not the
> first time the symbol appears in a snippet. Subsequent uses don't need
> links. If a section is teaching how the export works, *no other links
> in that section* — the reader is in the classroom, not the library.
>
> **Link out aggressively in retrospective sections.** "What else is in
> `context`?" (ch5), "What's actually in the event?" (ch4),
> "Errors, options, base URLs" (ch6), "What's actually in here" (ch8),
> "Where this is going" (ch9) — these are the moments the tutorial
> *stops teaching* and starts being a finger pointing at the API. They
> should link to every export they name.
>
> **Don't link sideways to other tutorial chapters except for explicit
> forward/back references.** The two existing tutorial-internal links
> in ch9 are an example of doing it right (one is wrong-numbered but
> the pattern is correct). Don't sprinkle internal back-refs in
> teaching prose — it breaks the linear-reading promise.

Concrete applications:

- **Ch1**: link `<Canvas>` and `createT` at first mention. Two links.
- **Ch2**: link the dashed-key syntax (`shadow-mapSize-width=…`) to the
  smart-prop docs (this section is the closest the tutorial has to a
  reference paragraph; linking out is more honest than the current
  no-demo half-explanation).
- **Ch3**: no links. The chapter is "this is just Solid"; linking the
  Solid components away would be self-defeating. *Intentional dark
  zone.*
- **Ch4**: link `onClickMissed`, the "longer list of pointer events"
  sentence, and "What's actually in the event?" — three links, all to
  `/api/events/overview` or `/api/components/canvas`.
- **Ch5**: link `useFrame` at first definitional use. In the `priority`
  and `stage` sections, link the reference page. Three links total.
- **Ch6**: link `useLoader` and `<Resource>` at first definitional use.
  Link the loader-cache sentence to `/api/utilities/loader-cache`.
  Three links total. (The current closing link can stay or be cut once
  the in-line ones land.)
- **Ch7**: link `Portal` at first definitional use. One link.
- **Ch8**: light retrospective linking on the chapter-cited features
  (`useFrame`, `onClick`, `<For>`, `<Show>`) — *or* keep the
  retrospective unlinked and lean on the closing `/api` link. Either
  works; pick one.
- **Ch9**: fix the mis-numbered link. No others needed.

Estimated total: from 6 links to ~16. Still far from over-linked; the
tutorial would gain a real off-ramp from every chapter where it
currently asks the reader to take a reference claim on faith.

---

## 3. Overall recommendation

**The tutorial is structurally sound; what it needs now is connective
tissue.** Three of the v2 review's open items are still open (ch5
`stage` paragraph, ch6 closing reference, redundant `useFrame`
imperative demo). One regression has appeared (the thesis sentence has
been pushed deep into ch2). One restructure has helped (ch3 is
pure-Solid control flow, which is the right shape) and one has hurt
(Portal re-inserted as ch7 punctures the run-up to the climax and
doesn't get cited in the climax retrospective).

**If you do nothing else, do these three:**

1. Promote "Reactive props" to ch2's first major section, so the
   thesis lands at slot 1 of 6 instead of slot 3 of 6.
2. Add hand-off sentences at the close of ch2, ch4, ch5, and ch6 —
   model them on the ch3→ch4 hand-off, which still works.
3. Add ~10 inline API links, concentrated in ch4 (events) and ch6
   (loaders).

Total work: about 90 minutes. The tutorial would read as one
continuous story end-to-end, and the reader who wants to leave for the
API would have an exit door in every chapter.

Beyond that, the unresolved structural question is **what to do about
Portal**. It's a real feature, the chapter is well-written in
isolation, and the render-target demo is one of the most impressive
things in the tutorial. But slot 7 isn't its home — it derails the
climax run-up and doesn't show up in the climax. The two clean options
are: (a) move Portal after ch8 as a post-game appendix ("now that
you've shipped, here's an escape hatch you may want later"), or (b)
wire one of its tricks into the ch8 game so it stops being orphaned.
Picking either resolves the v3 review's biggest remaining flow issue.
