# `useXR` + `createXR().Provider`: in-scene XR state — design

**Date:** 2026-06-03
**Area:** edit `src/create-xr.tsx` (add `Provider`), new `useXR` export from `src/index.ts`, docs
**Status:** design approved, pending spec review
**Depends on:** [`createXR`](./2026-06-02-create-xr-design.md) — this layers an in-scene reader on top of the entry primitive, and the [frameloop decoupling](./2026-05-29-xr-frameloop-decoupling-design.md) beneath it.

## Problem

`createXR` lives *outside* `<Canvas>` — next to the DOM "Enter XR" button. That is correct for entering a session, but it leaves a gap once you are *in* one: an immersive session takes over the display, so the 2D DOM (including the "Exit VR" button) is not rendered in the headset. Anything the user must see or touch while presenting has to be **in the scene**, as three.js objects.

Today the only in-scene XR access is the raw `XRFrame` forwarded through `useFrame((ctx, delta, frame) => …)`. That is enough for reading poses, but not for the common reactive needs:

- Show/hide scene content based on whether a session is presenting (`<Show when={isPresenting()}>`).
- An in-world control — e.g. a mesh whose `onClick` calls `exit()` — since the DOM exit button is invisible in-session.
- Read the active `XRSession` from a scene component without threading it down by hand.

`createXR` already owns exactly this state (`isPresenting`, `session`) and the `exit` control. The gap is purely *distribution*: getting that state from the `createXR` instance (outer scope) to components inside the scene, reactively.

**Goal:** distribute `createXR`'s existing state into the scene through a Solid context, with a `useXR()` reader — no new `gl.xr` subscriptions, no core changes, `createXR` remaining the single source of truth. And record the larger XR-interaction work (controller input, controller rays driving the existing pointer-event system) as a phased roadmap so this PR stays small while the direction is captured.

## Key insight: distribute existing state, don't re-derive it

`createXR` already runs one reactive effect that listens to the renderer's `sessionstart`/`sessionend` and maintains `presenting`/`session` signals (`create-xr.tsx:55-73`). There are two ways to make that readable in-scene:

1. **Distribute** — `createXR` exposes a `Provider` that supplies *its own* signals into a context; `useXR()` reads them.
2. **Re-derive** — `useXR()` independently subscribes to `gl.xr` events (via `useThree(c => c.gl)`) and maintains its own copy.

Distribution wins. Re-derivation duplicates subscriptions (N hooks = N listener pairs), and worse, creates a *second* source of truth that can disagree with `createXR`'s during the event/microtask window. Distribution keeps one owner of the state and makes `useXR` a pure consumer.

This is only feasible because **solid-three has no react-three-fiber-style renderer boundary.** In r3f, the Canvas reconciler detaches the React tree, so context from outside does not reach scene components without a manual bridge. Here, `<Canvas>`'s children are `canvasProps.children` — JSX created in the *outer* owner — and core layers its own contexts on top via `children(() => <…Provider>{canvasProps.children}</…>)` (`create-three.tsx:582-588`). There is no detached root for the scene graph. So a `Provider` wrapping `<Canvas>` naturally reaches `useXR` inside the scene, through Solid's ordinary owner-based context.

```
<xr.Provider>                  // supplies XRState into context
  <button onClick={enter}/>    // DOM, outside Canvas — closes over xr directly
  <Canvas ref={xr.connect}>
    <Scene/>                   // useXR() reads the same XRState
  </Canvas>
</xr.Provider>
```

## Public API (phase 1)

```ts
const xr = createXR()
xr.Provider           // Solid component; wrap the subtree that needs in-scene XR state
// (existing: connect, enter, exit, isSupported, isPresenting, session)

// new hook — used anywhere inside <xr.Provider>, typically in a scene component:
const { isPresenting, session, exit } = useXR()
```

`useXR()` returns the **read/control slice** scene code needs, named `XRState`:

- `isPresenting(): boolean` — reactive
- `session(): XRSession | undefined` — reactive
- `exit(): Promise<void>`

It deliberately does **not** return the whole `createXR` instance: `connect` and `enter` are meaningless in-scene (`connect` is a Canvas ref; `enter` needs a user gesture from the DOM). Narrowing keeps the in-scene surface honest. `useXR` throws if used outside a `Provider`, with the same shape of message as `useThree`/`useFrame` use outside `<Canvas>`.

`useXR` is co-located with `xrContext` in `src/create-xr.tsx` (avoiding a cross-module context import) and re-exported from `src/index.ts`. It is a `use*` hook (reads a context, throws when absent) — matching the library's existing convention and contrasting with `createXR` (created outside, owns an effect). This is the "future provider-reading hook" the `createXR` spec reserved the `use*` name for.

## Internals

### The context and `Provider`

A module-level context holds the `XRState`:

```ts
// src/create-xr.tsx
const xrContext = createContext<XRState>()

export type XRState = {
  isPresenting: Accessor<boolean>
  session: Accessor<XRSession | undefined>
  exit: () => Promise<void>
}
```

`createXR` already computes `presenting`, `session`, and `exit`. The only additions are assembling them into one `state` object and returning a bound `Provider`:

```ts
export function createXR() {
  // ... existing signals, effect, connect, enter, exit, isSupported ...

  const state: XRState = { isPresenting: presenting, session, exit }

  function Provider(props: { children: JSX.Element }) {
    return createComponent(xrContext.Provider, {
      value: state,
      get children() {
        return props.children
      },
    })
  }

  return { connect, enter, exit, isSupported, isPresenting: presenting, session, Provider }
}
```

`Provider` carries no logic — `createXR`'s effect already runs in the component-body owner and drives the signals regardless of where `Provider` is mounted. `Provider` only distributes.

### `useXR`

```ts
// src/create-xr.tsx (co-located with xrContext), re-exported from src/index.ts
export function useXR(): XRState {
  const state = useContext(xrContext)
  if (!state) {
    throw new Error("S3: useXR must be used within <xr.Provider> (from createXR())")
  }
  return state
}
```

A plain context read. Reactivity is intact because the returned members are accessors — reading `isPresenting()` inside a scene component's JSX or effect tracks normally, whether that component sits in the DOM subtree or inside `<Canvas>`.

### Why the context value can be `session`, not a re-subscription

Everything `useXR` exposes is already a live signal on the `createXR` instance. `exit()` routes through the existing `sessionend` teardown. No part of phase 1 touches `gl.xr`, `create-three.tsx`, or the event system. The edits to `create-xr.tsx` are additive (define `xrContext`, assemble `state`, return `Provider`, define `useXR`); `src/index.ts` gains the `useXR` and `XRState` exports.

## Phased roadmap

Only **phase 1** is built in this PR. Phases 2–3 are recorded here so the interaction direction is captured and phase 1's surface is chosen to not block them.

### Phase 1 — `createXR().Provider` + `useXR()` → session state *(this PR, #58)*

As specified above. Resolves the in-session DOM-invisibility problem (in-world exit button, presence-gated content, in-scene `session` access).

### Phase 2 — XR input access *(next branch)*

Reactive access to controllers/hands inside the scene:

- A reactive `inputSources()` accessor tracking the session's `inputsourceschange`.
- Per-controller state — pose + `gamepad` (trigger/grip/thumbstick) — most cheaply as a thin wrapper over three's `renderer.xr.getController(i)` / `getControllerGrip(i)` / `getHand(i)`, which three already updates every frame and which dispatch `connected`/`disconnected`/`select`. This avoids re-implementing `getPose` math.
- An `XRControllerRaycaster implements EventRaycaster` whose `update()` sets the ray from a controller's `matrixWorld` instead of camera + NDC — slotting into the existing pluggable raycaster stack (`raycasters.tsx`).
- Likely an `<XRController handedness>` helper component exposing the three objects to scene code.

Phase 2 is self-contained: it reads from `session` (already in `XRState`) and the per-frame loop (`XRFrame` already forwarded), so it extends `useXR`/adds components without changing phase 1's shape.

### Phase 3 — multi-pointer event refactor *(next branch / separate PR)*

Make XR controller rays fire the **existing** `onClick` / `onPointerMove` / `onPointerEnter` / … handlers, so interaction code is identical for mouse and controller. The current `create-events.ts` has two assumptions that block this:

- **DOM-triggered.** Every registry is driven by `context.canvas.addEventListener(domEvent, …)`. In an immersive session the canvas receives no pointer events; the pipeline must instead be driven **per-frame from the XR loop**.
- **Single-pointer.** Hover state (`hoveredSet`, `hoveredCanvas`) is one set per registry; two controllers need independent hover/capture state.

The refactor: extract the dispatch core (raycast registry → bubble enter/leave/move/down/up/click, `onClickMissed`) into a `processPointer(pointerId, raycaster, buttons, nativeEvent)` driven by *pointer sources*; key hover/capture state by `pointerId`. Then the existing DOM listeners become one source (`processPointer("mouse", cursorRaycaster, …)`) and each XR controller another (`processPointer("xr-left", xrRaycaster, gamepad, syntheticEvent)`, called from the frame loop). The raycaster seam is already done (phase 2's `XRControllerRaycaster`); the cost is the DOM-decoupling + multi-pointer generalization, plus a synthetic `nativeEvent` for handlers that read `event.nativeEvent`.

This is structurally the same generalization `@pmndrs/pointer-events` is (a framework-agnostic, multi-source pointer system). The spec flags an explicit decision point for phase 3: **re-derive natively vs. adopt/wrap `@pmndrs/pointer-events`.** The vanilla pmndrs packages are framework-agnostic by design, but pull in `zustand`/`meshline` and a large opinionated surface that sits awkwardly against solid-three's thin-over-the-three-contract ethos. That trade is deferred to phase 3, not decided here.

## Testing (phase 1)

Browser mode (Playwright + Chromium, software WebGL via SwiftShader); no headset. Reuse the writable-`isPresenting` + dispatchable-`xr`-event-target renderer the `createXR` and decoupling tests already use.

1. `useXR()` throws when used outside a `Provider`.
2. `isPresenting()` / `session()` exposed by `useXR()` track dispatched `sessionstart` / `sessionend`.
3. `exit()` from `useXR()` calls `session().end()`.
4. **Bridge test (the load-bearing one):** a component rendered *inside* `<Canvas>`, which is inside `<xr.Provider>`, reads `useXR().isPresenting()` and observes it flip to `true` on `sessionstart` — proving context crosses the Canvas boundary into the scene graph.

## Docs

- README: a `useXR` section + a `createXR().Provider` note, with the in-VR exit-button example; cross-link from the existing `createXR` section.
- API site: `site/src/routes/api/hooks/use-xr.mdx`, mirroring `create-xr.mdx`.

## Decisions and rejected alternatives

- **Distribute via `Provider`, not re-derive in the hook.** One source of truth (the `createXR` instance), one set of `gl.xr` listeners. Re-derivation was rejected for duplicate subscriptions and a second, divergent source of truth.
- **`useXR()` returns a narrowed `XRState` (`isPresenting`/`session`/`exit`)**, not the full `createXR` instance — `connect`/`enter` are meaningless in-scene.
- **No core changes in phase 1.** `Provider`/`useXR` ride entirely on `createXR`'s existing signals and Solid context; `create-three.tsx` and the event system are untouched until phase 3.
- **Provider-required (throws) over inert-default.** Consistent with `useThree`/`useFrame`; a silent inert `useXR` would mask a missing `Provider`. (A future `createXR`-less `useXR` deriving from `gl.xr` is possible but explicitly out of scope.)
- **Roadmap recorded, not built.** Phases 2–3 are captured to fix direction and keep phase 1's API forward-compatible, but only phase 1 ships in this PR; the pointer-events generalization is a separate branch with its own `@pmndrs/pointer-events`-vs-native decision.
