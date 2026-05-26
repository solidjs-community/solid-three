# Editorial review v4 — solid-three tutorial (9 chapters)

Fourth pass. Scope is narrow: judge the tutorial as one continuous read
after the latest trim + cross-link round. Prior reviews (v1–v3, scope
note) are not re-litigated except where an open item is still open.

---

## 1. Does it read top-to-bottom without dragging?

**Mostly yes.** The macro shape is the same as v3 — first scene →
props/children (now with the thesis paragraph as the chapter's opener,
not buried mid-chapter) → control flow → events → useFrame → loaders →
portal → game → WebGPU — but several of the v3 drag points have been
sanded down:

- **Ch2 opens on the thesis.** The button-toggle demo and the "App body
  has run: 1 time" counter are now the first thing the reader meets in
  the chapter, with the prose explicitly anchored to the counter
  ("…and it stays at 1, no matter how often you click"). The
  "Transforms" section follows as the dial-turning beat. This is the
  single biggest improvement since v3 — the highest-leverage flow fix
  the v3 review asked for has landed cleanly.
- **Ch4's "When you actually want the full list" is shorter.** The
  intersections section is now four lines of prose plus a five-line
  snippet — half its v3 length — and ends with one demo-free paragraph
  rather than the longer reference dump. Still on the bubble (see §3),
  but it no longer drags.
- **Ch5's `stage` reference section is gone.** The chapter now ends on
  the punchy `priority` demo plus a one-sentence pointer to the API ref.
  The chapter ends *on* its strongest moment for the first time since
  v1. Real improvement.
- **Ch6's closing reference dump is condensed to two sentences.**
  Errors, base URLs, cache, array/record shapes — all collapsed into
  one paragraph that points at `useLoader`. The voice no longer slips
  into API-doc mode at the end of the chapter.
- **Ch7's "six things to notice" bullet list is now two bullets plus a
  prose payoff** ("The knot still spins reactively from inside the
  portal — same `useFrame`, same ref, same lifecycle. Portal doesn't
  break Solid.") That sentence is doing the right work: closing the
  chapter on the *Solid* through-line instead of a bullet enumeration.

**Where the read still drags:**

- **Ch5 "Imperative: skip the signal" is still visually identical to
  the signal demo.** v1, v2, v3 all flagged this. The prose openly
  admits the visuals are the same ("No signal, no smart-prop call, no
  allocation per frame — just a property assignment"), which is honest
  but doesn't fix what the reader sees: a cube spinning, then a cube
  spinning. The "Reach for the imperative one when the profiler tells
  you to" disclaimer is the tell — the chapter knows the demo isn't
  earning the perf claim. Either ship a `<For>`-of-cubes version that
  shows a measurable difference, or cut the demo and keep the section
  as one paragraph.
- **The 5→6 seam is still rough.** Ch5 ends "The scenes so far have
  been hand-built — cubes, lights, geometry from constructors. The
  next chapter brings in *outside* data: textures, models, anything
  you load from a URL." That's a bridge — it didn't exist in v3 — but
  the framing is "and now, a different topic" rather than "and the
  next dial to turn." Adequate, not great. Reading at speed I felt
  the topic switch.
- **Ch6→7 seam is now smoother but still grafted.** Ch6's last line
  ("The next chapter is a deliberate break from the mapping — a way
  to send children somewhere *other* than where their JSX would
  suggest") is honest about the fact that Portal is a topic change.
  The phrase "deliberate break" reads as the author acknowledging
  that Portal is a left turn, which is more reassuring than
  pretending it isn't. Good prose-level fix; the structural
  Portal-vs-climax tension from v3 is unchanged (see §3).
- **Ch7→8 hand-off is the strongest in the back half.** "The next
  chapter pulls all of this together into a small game." One short
  declarative sentence, fully delivers on the chapter's pitch in §1.
- **Ch1's three-ideas closing** ("`createT`, the `T.*` namespace, and
  the way `<T.Mesh>` consumes its children as a geometry and a
  material") still trails two of three loose ends. v3 noted this; v4
  hasn't touched it. Minor.

**Sections that feel too thin after the trim:**

- **Ch2's "Why arrays work on a `Vector3`" closer** (lines 77–90). The
  shorthands enumeration has been cut from a full list to one short
  demo plus an "and the rest is at `useProps`" pointer. The trim is
  the right call — the coercion table lives at `/api/hooks/use-props`
  now — but the way the section transitions is abrupt: one demo
  (`shorthandsSnippet`), one sentence ("The principle: pass whatever's
  most ergonomic…"), one link out. The link is doing a lot of work
  here. As long as the `useProps` page genuinely covers the coercion
  rules (it does — see §2), this is acceptable. Borderline.
- **Ch4 "What's actually in the event?"** (lines 89–94). Five lines,
  ending in two cross-links. Reads as a stub now. The v3 review wanted
  this trimmed and pointed at the events overview — that's been done.
  The result is a paragraph whose only job is to point out. That's
  fine for a tutorial — readers who want detail follow the link — but
  there's no narrative reason for the paragraph to exist as its own
  beat. Could be folded into the preceding "stopping events" section
  or cut entirely. Borderline.
- **Ch5 "What else is in `context`?"** (lines 41–45). Same shape. One
  declarative sentence, one link out, one motivating clause. This is
  the best example in the tutorial of a "trim to a pointer" section
  done well — short enough that it doesn't drag, useful enough that
  the curious reader doesn't bounce. The shape ch4 and ch2 are
  reaching for.

**Hand-offs landing naturally:**

- 3→4 ("Same `onClick`, different target. That's the next chapter.")
  Still the model. Unchanged.
- 7→8 ("The next chapter pulls all of this together into a small
  game.") Clean.
- 8→9 ("If you'd like a peek at where the library is heading next,
  the encore is WebGPU.") Clean.

**Hand-offs that feel grafted on:**

- 1→2 still does the "three ideas" trailing-loose-ends thing.
- 4→5 ("So far every trigger has been a one-off — a click, a hover-in,
  a hover-out. The next chapter introduces the third kind: time.")
  This is new. The "third kind" framing is cute and it scans well —
  but the previous chapters didn't actually frame triggers as "kinds"
  (one-off vs. continuous), so the reader has to construct that
  framing on the fly. Reading at speed, I made it work; on closer
  read it feels like the author retconning a taxonomy. Trim to "And
  the next dial to turn is *time* — every frame, not just on
  pointer."
- 5→6 (see §1 above — bridge present, framing meh).
- 6→7 ("That's the everyday tree: components, props, signals, events,
  frames, loaders. The next chapter is a deliberate break from the
  mapping…"). Honest about the topic change. Works.

**Overall:** the read is significantly tighter than v3. The thesis is
where it should be (ch2 opener); ch5 ends on its strongest demo for
the first time; ch6 doesn't slip into API-doc voice; ch7 doesn't
front-load a six-bullet exegesis after its demo. The remaining drag
is concentrated in two places: the duplicated useFrame demo (ch5) and
the structural mismatch between Portal (ch7) and the climax (ch8) —
items 3 and 4 of v3's list.

---

## 2. Do the API cross-links pull their weight?

The tutorial now has substantially more outbound links than v3 (which
had six). I counted by chapter:

| Chapter | Links | Targets |
|---|---|---|
| 1 | 1 | `/api/components/t` (curated `createT`) |
| 2 | 1 | `/api/hooks/use-props` (coercion table + dashed keys) |
| 3 | 0 | (Solid primitives — intentional dark zone, correct call) |
| 4 | 2 | `/api/events/overview` (×2) |
| 5 | 2 | `/api/hooks/use-three`, `/api/hooks/use-frame` |
| 6 | 2 | `/api/hooks/use-loader` (×2; one for `<Resource>` would be nicer) |
| 7 | 0 | — |
| 8 | 1 | `/api` (index) |
| 9 | 2 | `/tutorial/02-props-and-children`, `/tutorial/05-use-frame` |

About twelve outbound links, of which seven go to API ref pages. That's
roughly double v3's surface. Now: do they land somewhere useful?

**Strong landings** — link target is the right size, the right voice,
and the reader who clicked will be satisfied:

- **Ch2 → `/api/hooks/use-props`.** This is the standout. The page
  *now* covers exactly what ch2 promises: a coercion table (the
  arrays-into-Vector3, scalars-into-setScalar story), a dashed-paths
  section (with the same `shadow-mapSize-width` example), `args`,
  `attach`, `ref`. The tutorial's "the full coercion table — plus how
  `attach`, dashed paths like `shadow-mapSize-width={1024}`, and refs
  work — lives on `useProps`" sentence is *accurately describing what
  is now on that page*. The trim in ch2 + the expansion at use-props
  was the right move; the link pays off.
- **Ch4 → `/api/events/overview`.** This is the other standout. The
  events overview has been substantially expanded — full Intersection
  fields documented (`object`, `point`, `distance`, `face`,
  `faceIndex`, `uv`, `normal`, `instanceId`), the propagation model is
  worked through, missed events get their own section, raycastable is
  pointed at. Both ch4 links land on a page that earns the click.
- **Ch5 → `/api/hooks/use-three`.** Same as v3 — short pointer,
  exhaustive target. Pulls its weight.
- **Ch5 → `/api/hooks/use-frame`.** Short page, parameters listed,
  TypeScript signature, two usage examples covering `priority` and
  `stage`. The "see [`useFrame` in the API reference]" pointer at the
  end of ch5 lands on a page that has the `stage` content ch5 cut.
  Good division of labour.
- **Ch6 → `/api/hooks/use-loader`.** Page covers the URL shapes (single,
  array, record), reactive URLs, custom cache. The "see `useLoader`
  for the full surface" pointer at the end of ch6 lands on a page that
  has roughly the content the v2 review wanted moved out of the
  tutorial. Pulls its weight.

**Weak landings** — link target is too thin or the reader who clicked
will be underserved:

- **Ch7 has no outbound link to `/api/components/portal`.** v3 flagged
  this as a strong miss and it's still missing. The Portal API page
  is currently 36 lines, documenting only the `element` and `children`
  props with a four-line code example — no mention of the render-target
  pattern that is the chapter's payoff demo. Two problems with this:
  (1) the tutorial chapter is the only place the render-target trick
  is documented; (2) even if you linked from the tutorial to the
  Portal page, the reader would arrive at a page that doesn't expand
  on what the tutorial showed. Both ends of this link are weaker than
  they should be.
- **Ch6 doesn't link `<Resource>`.** The component is named ("the
  declarative version") and there's a `useLoader` link, but no
  `/api/components/resource` link. The Resource API page exists; it's
  short (probably also undersized — flagged in the scope review) but
  worth pointing at.
- **Ch8's `/api` index link.** Generic — fine as a closing pointer
  ("the API reference is there when you need a specific export") but
  doesn't pull weight the way a targeted link would. Not worth fixing
  unless ch8 grows in scope.

**Cross-link consistency nit:**

- **The loader cache.** Ch6 says "useLoader caches by URL across the
  whole app, so two components asking for the same texture share one
  load and one GPU upload." This is the *only* mention of the loader
  cache in the tutorial. v3 flagged a missing link to
  `/api/utilities/loader-cache`. Still missing in v4. The cache page
  exists, documents refcounting and `disposeFreeList`, and is a
  natural off-ramp for the curious reader. One link, ten seconds.

**Cross-link errors:**

- Ch9 line 66: `[chapter 2](/tutorial/02-props-and-children)`. v3
  flagged this as "labelled chapter 3, points to chapter 2" — *fixed*.
  Link now reads "chapter 2" and points at ch2. Correct.

**Overall:** the tutorial-to-API links have improved substantially.
The `useProps` and events-overview targets are exactly the kind of
pages that make a "for the full surface, see the API ref" pointer
honest. Two remaining weak spots: Portal (both link and target
missing/thin) and the loader cache (link missing, target exists).

---

## 3. Anything still left to fix

Ranked by leverage:

1. **Ch7 → `/api/components/portal` link is still missing, *and* the
   Portal API page is undersized.** This is the highest-leverage
   remaining item because it fails on both ends: the tutorial doesn't
   link the canonical reference, and the canonical reference doesn't
   cover the render-target pattern the tutorial relies on. Two fixes:
   add an inline link at "Portal is the escape hatch" (ch7 line 12 or
   thereabouts), and expand the Portal API page with a
   render-target-pattern subsection. ~30 minutes total.

2. **Ch6 should link `/api/utilities/loader-cache`** at the sentence
   that mentions caching ("useLoader caches by URL across the whole
   app"). The cache page is the natural off-ramp; without the link, a
   reader who wants to know the disposal semantics has no exit. One
   link, ~1 minute.

3. **Ch5 `05-use-frame-imperative.tsx`** is still visually identical
   to the signal demo. Three reviews flagged it; the prose has
   accommodated the absence of a visible difference but the demo
   itself hasn't been replaced. If a `<For>`-of-cubes perf-visible
   version isn't on the table, just cut the demo and keep the section
   as one short paragraph: "Get a ref to the mesh and write its
   properties directly inside `useFrame`. No signal, no smart-prop
   call. Reach for it when the profiler tells you to." The chapter
   doesn't need the demo to make the point.

4. **Ch7 (Portal) still sits in the wrong slot relative to the
   climax.** v3 flagged this; v4 hasn't moved it. The chapter is good
   in isolation, but slot 7 is the run-up to the climax (ch8) — and
   the climax doesn't use Portal at all. Reader arrives at ch8 and
   the "What's actually in here" retrospective names ch3, ch5, every
   chapter except ch6 (loaders) and ch7 (Portal). Two of the nine
   chapters are not in the climax. Either move Portal to a post-game
   appendix (between ch8 and ch9, or as ch10), or wire something
   Portal-shaped into the ch8 game. Neither has happened. This is the
   structural item the v3 review called out as "the biggest remaining
   flow issue" and it's still there.

5. **Ch6 still doesn't show up in ch8's retrospective.** No `useLoader`
   used in the game. v2 flagged, v3 flagged, v4 unchanged. Cheapest
   fix: a textured face on the cubes via `useLoader(TextureLoader, …)`.
   The texture itself can be ugly — the point is to retro the chapter.

6. **Ch1's "Three new ideas snuck into that snippet" closer.** v3
   flagged that the chapter trails two of three loose ends. v4 hasn't
   touched it. Cheapest fix is the rewrite v3 suggested
   ("Nesting `<T.BoxGeometry>` and `<T.MeshNormalMaterial>` inside
   `<T.Mesh>` is your first taste of the scene graph. The next chapter
   is about how that nesting actually works.") ~30 seconds.

7. **Ch6 should link `<Resource>`** to `/api/components/resource` at
   first definitional use. One link, ~1 minute.

8. **Ch4 "What's actually in the event?"** paragraph is now a stub
   that exists only to point out. Either fold into the preceding
   section or cut. Cosmetic.

Items 1, 2, 4, 5 are the load-bearing ones. The rest are touch-ups.

**Things that are clean and shouldn't be touched:**

- Ch2's reactive-props opener — the thesis lands where it should and
  the counter pays off. Don't change it.
- Ch3 as pure control flow with no API cross-links. The "intentional
  dark zone" is the right call.
- Ch5's `stage` cut. The chapter ends on `priority` and is better for
  it.
- Ch6's two-demo `useLoader`/`<Resource>` shape and the "use whichever
  reads better" framing.
- Ch7's render-target demo itself (the chapter is good *in isolation*;
  it's the position that's wrong).
- Ch8 as the climax — nine-cube game still earns it.
- Ch9 as the encore — three-demo escalation, "Have fun" closer, the
  smart-prop machinery citation pointing at the right chapter for the
  first time in three reviews.

---

## 4. Recommended stopping point

**Ship it after fixing items 1, 2, and 5** (Portal link + page,
loader-cache link, ch8 cites loaders). That's about an hour of work
and resolves the only places where the tutorial currently asks the
reader to take something on faith.

Items 3 (duplicate `useFrame` demo), 4 (Portal slot), and 6 (ch1
closer) are improvements, not blockers. They've each survived
multiple review rounds without being touched, which suggests the
author has made a judgment call to leave them — and the tutorial
reads well enough that I don't think any of them is a publish-blocker
on its own. The Portal-slot question is the biggest one in this
group; if you've decided Portal stays where it is, name it as a
decision in the docs/ADRs and move on.

The tutorial is *much* closer to ready than it was at v3. The three
items the v3 review listed as "if you do nothing else, do these
three" — promote the thesis, add hand-off sentences, add ~10 inline
links — have all landed. The cuts that needed to happen (ch5 `stage`,
ch6 reference dump, ch7 six-bullet list) happened. What's left is
mostly trim, plus the one structural call about Portal that has been
deferred across three reviews.

**Bottom line:** publish-ready after the Portal-link + Portal-page +
loader-cache-link + climax-retros-ch6 changes. ~1 hour of work.
Everything else can ship in a follow-up.
