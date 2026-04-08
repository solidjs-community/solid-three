# Solid 1.x → 2.x Migration Notes

This document tracks behavioral differences encountered while migrating `solid-three` from Solid 1.x to Solid 2.x (`solid-js@2.0.0-experimental`). Entries focus on **hurdles and surprises** — things that worked differently than expected, with enough mechanical detail to understand *why* they differ.

---

## 1. `createRenderEffect` signature changed to compute/effect split

**Solid 1.x:**
```ts
createRenderEffect(() => {
  // single callback: reads reactive values AND applies side effects
  applyProp(source, key, props[key])
})
```

**Solid 2.x:**
```ts
createRenderEffect(
  () => props[key],       // compute: reads reactively, returns snapshot
  value => {              // effect: receives snapshot, applies side effects
    applyProp(source, key, value)
  }
)
```

### Why the split exists

In Solid 2.x the reactive graph is strictly two-phase. The **compute** function runs synchronously during the owner graph's update walk — it reads signals, optionally creates child reactive nodes (effects, memos, mapArrays), and returns a snapshot value. The **effect** function runs after the graph settles as a scheduled side effect — it receives the compute's snapshot and applies external mutations (DOM, Three.js imperative calls, etc.). It does **not** track reactive reads.

### Child reactive nodes must be created in compute, never in effect

Any call to `createRenderEffect`, `createMemo`, `createEffect`, `mapArray`, etc. inside the effect phase will either throw or produce orphaned computations with no owner that are never disposed. In Solid 1.x this was legal and common; in Solid 2.x it is not.

**Broken 2.x pattern:**
```ts
createRenderEffect(
  () => resolve(accessor),
  object => {
    // ❌ creating child effects in the effect phase — no owner, never disposed
    createRenderEffect(() => props[key], value => applyProp(object, key, value))
  }
)
```

**Correct 2.x pattern:**
```ts
createRenderEffect(
  () => {
    const object = resolve(accessor)
    if (!object) return undefined
    // ✓ child effects created in compute phase — owned, disposed on re-run
    createRenderEffect(() => props[key], value => applyProp(object, key, value))
    return object
  },
  object => {
    if (object) props.onUpdate?.(object)
  }
)
```

### Pure-compute effects: `createRenderEffect(compute, () => {})`

When you only need the compute phase (e.g., to create child effects or drive `mapArray`) and have no direct side effect to run, pass an empty function as the effect:

```ts
createRenderEffect(
  () => { /* read signals, create child computations */ },
  () => {} // no-op effect phase
)
```

---

## 2. `createComputed` removed

**Solid 1.x:**
```ts
import { createComputed } from "solid-js"
createComputed(() => {
  // synchronous computation — used to drive mapArray or create child effects
  createRenderEffect(() => { ... })
})
```

**Solid 2.x:** `createComputed` does not exist. Replace with `createRenderEffect(compute, () => {})`:

```ts
// 1.x
createComputed(
  mapArray(
    () => c.toArray(),
    _child => createComputed(() => { applySceneGraph(parent, child) })
  )
)

// 2.x
createRenderEffect(
  mapArray(
    () => c.toArray() as (Meta<object> | undefined)[],
    _child => createRenderEffect(
      () => ({ parent: resolve(_parent), child: resolve(_child) }),
      ({ parent, child }) => {
        if (!parent || !child) return
        applySceneGraph(parent, child)
      }
    )
  ),
  () => {}
)
```

---

## 3. `mapArray` must be created once — never inside a `createRenderEffect` compute

**Solid 1.x:**
```ts
createEffect(() => {
  mapArray(() => items, item => { /* manage item */ })()
})
```
In Solid 1.x, the compute/dispose cycle was: dispose old children → re-run compute. A new `mapArray` created inside re-ran correctly because the old one's cleanup (e.g. `scene.remove(item)`) ran first.

**Solid 2.x:**
```ts
// ❌ WRONG — recreates mapArray on every re-run, causing double-adds
createRenderEffect(
  () => mapArray(() => items, mapper)(),
  () => {},
)

// ✅ CORRECT — mapArray is created once, passed as the stable compute function
createRenderEffect(
  mapArray(() => items, mapper),
  () => {},
)
```

`mapArray` in Solid 2.x is an **eager `createMemo`** (no `lazy: true`) wrapping `updateKeyedMap`. It runs synchronously at creation and re-runs when the list changes. It manages item lifecycle via internal per-item owners (`_owner: createOwner()`).

**The double-add bug:** In Solid 2.x, `createRenderEffect(compute, effect)` re-runs the compute whenever any tracked dependency changes. When the compute was `() => mapArray(...)()`, it called `mapArray(...)` on every re-run, creating a **new** `mapArray` instance each time. The old persistent instance also re-ran (because the list changed), and the new instance ran for the same items — causing `applySceneGraph` to try adding the same child twice.

The cleanup (`scene.remove(child)`) registered by the old instance's slot was not yet called when the new instance ran — in Solid 2.x, old children are disposed **after** the new compute runs (the reverse of Solid 1.x). This left the scene with the child added twice and then removed by the old cleanup, resulting in the child being absent from the scene.

**Fix:** Pass `mapArray(...)` (the returned accessor) directly as the compute argument. It is a stable function reference — calling it reads the current mapped state without recreating the underlying `mapArray` instance.

---

## 4. `setContext` / `getContext` moved to `@solidjs/signals`; no longer walks owner chain

**Solid 1.x:**
```ts
import { setContext } from "solid-js"
// getContext walked up the owner chain to find the nearest provider
```

**Solid 2.x:**
```ts
import { setContext } from "@solidjs/signals"
// getContext does a direct lookup on owner._context[context.id] — no chain walk
```

Context must be explicitly set on the owner node that will be the parent of consumers. If you set context on a root and then create child components through a different code path (e.g., via `withContext`), you must call `setContext` inside a `createRoot` that is the direct owner of those children:

```ts
export function withContext<T, TResult>(children: Accessor<TResult>, context: Context<T>, value: T) {
  return createRoot(() => {
    setContext(context as any, value)
    return children()
  })
}
```

The lack of chain-walking means that intermediate `createRoot` calls without `transparent: true` that don't explicitly set context will break context propagation for their subtrees.

---

## 5. Context inheritance in transparent roots (`devComponent`) — snapshot semantics

In Solid 2.x dev mode, every component call is wrapped in `devComponent`:

```js
function devComponent(Comp, props) {
  return createRoot(() => {
    return untrack(() => Comp(props))
  }, { transparent: true })
}
```

`createRoot({ transparent: true })` copies `_context` from the **current owner at call time** by reference:
```js
_context: parent?._context || defaultContext
```

Context is inherited as a **snapshot of the object reference** at the time the root is created, not by dynamic lookup. This has two consequences:

1. If a context is set *after* a transparent root is created (even on the same owner), the transparent root won't see it.
2. If `devComponent` runs while the current owner has no context, the component's `useContext` calls will return `undefined`.

**Hurdle:** Vitest's `deepClone` traverses JSX element objects via `Object.getOwnPropertySymbols`, which can trigger a JSX `children` getter that calls `devComponent` outside any reactive owner scope. This caused `useThree()` to throw "Hooks can only be used within Canvas" from deep inside Vitest's error formatting, masking the real test failure.

**Fix:** Guard `useThree()` with `if (!getOwner()) return` to silently no-op when called with no owner:
```ts
export function useThree(callback?: (value: Context) => any) {
  if (!getOwner()) return (callback ? () => undefined : undefined) as any
  // ...
}
```

---

## 6. `children()` uses `lazy: true` memos — `flatten` tracks memo return values

In Solid 2.x, `children()` creates memos with `{ lazy: true }`:
```js
function children(fn) {
  const c = createMemo(fn, undefined, { lazy: true })
  const memo = createMemo(() => flatten(c()), undefined, { name: "children", lazy: true })
  memo.toArray = () => ...
  return memo
}
```

`flatten()` resolves function values (0-arity accessors) by calling them recursively. This means if a component returns a reactive memo (e.g., `createMemo(() => instance)`), `flatten` will call it and track it as a dependency of the `children()` memo.

**Implication:** When `Entity` swaps its internal `whenMemo` value (from `o1` to `o2`), the `children()` memo in `useSceneGraph` re-evaluates because it tracks the return value of each child component's render output. This is what makes the scene graph update automatically when an entity swaps its underlying Three.js object — no explicit notification needed.

The `toArray()` helper on the memo flattens nested arrays and filters out `null`/`undefined`, giving `useSceneGraph` a flat list of `Meta` objects to iterate with `mapArray`.

---

## 7. `onMount` removed; `onSettled` + `createRoot` replaces it

**Solid 1.x:**
```ts
onMount(() => {
  const context = createThree(canvas, props)
  createResizeObserver(container, onResize)
  // reactive nodes are owned by the component — disposed on unmount
})
```

**Solid 2.x:**
```ts
onSettled(() => {
  createRoot(() => {
    const context = createThree(canvas, props)
    createResizeObserver(container, onResize)
  })
  // createRoot autodisposes when the Canvas component's owner disposes
})
```

`onMount` is completely removed in Solid 2.x. `onSettled` fires when the synchronous reactive graph settles after initial render.

**Why `createRoot` is required:** `onSettled` callbacks run with **no reactive owner**. Reactive nodes created directly inside have no owner, so `onCleanup` calls won't register and effects won't be disposed when the component unmounts. Wrapping in `createRoot` gives the tree a proper owner. The root is tied to the component's lifetime because `createRoot` captures the calling owner context at registration time (when `onSettled` was called inside the component), not at callback-fire time.

---

## 8. Context provider syntax changed; `.Provider` removed

### JSX providers

**Solid 1.x:**
```tsx
<SomeContext.Provider value={value}>
  {props.children}
</SomeContext.Provider>
```

**Solid 2.x:**
```tsx
// The context object IS the provider component
// Variable MUST be capitalized — lowercase JSX tags compile to HTML element strings
const SomeContext = someContext
<SomeContext value={value}>
  {props.children}
</SomeContext>
```

Solid's JSX transform compiles lowercase tags as `document.createElement("tagname")`. So `<eventContext value={...}>` would produce a literal DOM element instead of calling the context as a component. Storing contexts in PascalCase variables is required:

```ts
// in create-three.tsx
const EventContext = eventContext
const FrameContext = frameContext
const ThreeContext = threeContext

return (
  <EventContext value={addEventListener}>
    <FrameContext value={addFrameListener}>
      <ThreeContext value={context}>{canvasProps.children}</ThreeContext>
    </FrameContext>
  </EventContext>
)
```

### Programmatic providers

**Solid 1.x:**
```ts
context.Provider({ value, children: () => result = children() })
```

**Solid 2.x:**
```ts
context({ value, children: () => result = children() })
```

The `.Provider` property no longer exists on context objects. The context itself is callable as a component function. Both `withContext` and `withMultiContexts` in `src/utils.ts` were updated to call `context(...)` directly.

---

## 9. Reactive computations created in a memo's compute phase are owned by that memo

In Solid 2.x, reactive nodes (effects, memos, children) created during a memo or effect's **compute** phase are owned by that computation and disposed when it re-runs or is itself disposed.

**How this is used intentionally:** `useProps` creates a `createRenderEffect` per prop key, plus one for `useSceneGraph` — all inside the outer compute phase that reads `resolve(accessor)`. When `Entity`'s `whenMemo` re-runs (because `from` changes from `o1` to `o2`), `useProps` is re-called in the new compute, disposing all old per-prop effects for `o1` and creating fresh ones for `o2`. This is the mechanism by which the scene graph correctly detaches `o1` and attaches `o2`.

**The key constraint:** Effects created in compute are *also* disposed when the compute re-runs due to *any* tracked dep change — not just object identity changes. If `resolve(accessor)` returns the same object but some other tracked dep in the compute changes, all child effects are unnecessarily torn down and recreated. Design computations carefully to return stable references where possible, and put only the minimal required deps in the compute phase.

---

## 10. `merge` replaces `mergeProps`; `undefined` arguments must be guarded

**Solid 1.x:**
```ts
import { mergeProps } from "solid-js"
const config = mergeProps({ cache: true }, options)        // safe with undefined options
const merged = mergeProps(contextA, { get scene() { ... } }) // reactive merge
```

**Solid 2.x:**
```ts
import { merge } from "solid-js"
const config = merge({ cache: true }, options ?? {})       // undefined must be guarded
const merged = merge(contextA, { get scene() { ... } })    // same reactive merge
```

`merge` creates a Proxy that resolves keys across all source objects at access time — reads remain reactive. The behavioral difference from `mergeProps`: `merge` enumerates the source objects' own keys at construction time to build the Proxy's key list. Passing `undefined` causes an iteration error at runtime. Always pass `options ?? {}` when the argument may be undefined.

**Spreading a merged object loses reactivity:**
```ts
const config = merge(defaults, props)
config.value    // ✓ reactive — Proxy getter fires
{ ...config }   // ❌ snapshots all values at spread time
```

---

## 11. `splitProps` replaced by `omit`; reactive subsets require explicit getter objects

### `omit`

**Solid 1.x:**
```ts
const [local, rest] = splitProps(props, ["ref", "args", "attach", "children"])
// local.ref — reactive, tracked
// rest — reactive remainder
```

**Solid 2.x:**
```ts
const rest = omit(props, "ref", "args", "attach", "children")
// props.ref — still reactive on the original props proxy
// rest — reactive remainder as a Proxy
```

`omit` returns a Proxy of `props` excluding the listed keys. Both `rest` and the original `props` remain fully reactive. Since `props` is itself a reactive Proxy, reading `props.ref` inside a computation tracks `ref` reactively — the split-off object is not needed.

### Constructing reactive options objects

When you need to pass a reactive subset of props as an options object (e.g., to a function that accepts a plain object), you cannot use a snapshot:

```ts
// ❌ snapshot — not reactive, captures values at call time
useLoader(() => props.loader, () => props.url, {
  base: props.base,
  cache: props.cache,
})

// ✓ getter object — reactive, reads props at access time
useLoader(() => props.loader, () => props.url, {
  get base() { return props.base },
  get cache() { return props.cache },
  get onBeforeLoad() { return props.onBeforeLoad },
  get onLoad() { return props.onLoad },
})
```

This pattern is necessary anywhere `splitProps` was used to pass a sub-object into a function.

---

## 12. `A Signal was written to in an owned scope` warning — `useRef` must write in effect phase

In Solid 2.x, writing to a signal (or a reactive setter like a prop assignment) while inside a compute phase triggers a runtime warning. This surfaces with `props.ref = object`.

```ts
// 1.x — single callback reads and writes
createRenderEffect(() => {
  const result = typeof value === "function" ? value() : value
  if (typeof props.ref === "function") props.ref(result)
  else props.ref = result  // ← writing inside a tracking context
})

// 2.x — compute reads, effect writes
createRenderEffect(
  () => (typeof value === "function" ? (value as Accessor<T>)() : value),
  (result: T) => {
    // ← effect phase: no tracking, safe to write
    if (typeof props.ref === "function") props.ref(result)
    else props.ref = result
  },
)
```

The same applies to any imperative write (signal setter, DOM mutation, Three.js property assignment) — it belongs in the effect phase.

---

## 13. Texture color space effect must be hoisted out of `applyProp`

**Solid 1.x:** Inside `applyProp`, after assigning `source[type] = value`, a nested `createRenderEffect` subscribed to `context.props.linear` and `context.gl` to keep the texture's `colorSpace` in sync with the renderer:

```ts
// inside applyProp (1.x)
source[type] = value
if (source[type] instanceof Texture && ...) {
  createRenderEffect(() => {
    context.props.linear   // tracked
    context.gl             // tracked
    texture.colorSpace = context.gl.outputColorSpace
  })
}
```

**Solid 2.x:** `applyProp` is called from inside an effect phase. Creating a child `createRenderEffect` there is illegal. The texture tracking was hoisted into `useProps`'s **compute** phase, alongside the per-key prop effects:

```ts
// in useProps compute phase (2.x)
createRenderEffect(
  () => {
    const value = props[key]
    if (
      value instanceof Texture &&
      value.format === RGBAFormat &&
      value.type === UnsignedByteType
    ) {
      return { texture: value, linear: context.props.linear, gl: context.gl }
    }
    return null
  },
  result => {
    if (!result) return
    const { texture, gl } = result
    if (hasColorSpace(texture) && hasColorSpace(gl)) {
      texture.colorSpace = gl.outputColorSpace
    } else {
      texture.encoding = gl.outputEncoding
    }
  },
)
```

The compute reads `context.props.linear` and `context.gl` reactively; the effect applies the color space assignment.

---

## 14. `createResource` removed; replaced by async `createMemo`

**Solid 1.x:**
```ts
import { createResource, type Resource } from "solid-js"

const [resource] = createResource(
  () => [resolve(url), options?.base, loader()] as const,  // explicit source tuple
  async ([url, base, loader]) => {
    config.onBeforeLoad?.(loader)
    const result = await loadUrl(base ? resolveUrls(base, url) : url)
    config.onLoad?.(result)
    return result
  }
)
// resource.loading, resource.error, resource.state
// resource.refetch(), resource.mutate()
// return type: Resource<T>
```

**Solid 2.x:**
```ts
const resource = createMemo(async () => {
  // all reads inside the memo body are tracked automatically
  const _url = resolve(url)
  const _loader = loader()
  const base = options?.base
  config.onBeforeLoad?.(_loader)
  const result = await loadUrl(base ? resolveUrls(base, _url) : _url)
  config.onLoad?.(result)
  return result
})
// return type: Accessor<T>
```

Key differences:

- **Source tracking:** 1.x required an explicit source tuple listing reactive deps. 2.x tracks everything read in the memo body. Be careful not to accidentally track deps you don't intend to (e.g., reading a signal inside a branch that may not always execute).
- **Loading/error state:** `resource.loading`, `resource.error`, `resource.state` are gone. Pending state is handled by a `Loading` boundary component (see entry 15).
- **Refetch/mutate:** `resource.refetch()` and `resource.mutate()` are gone. To retrigger, write to a signal that the memo reads.
- **Return type:** `Resource<T>` (an accessor with extra properties) becomes plain `Accessor<T>`.

---

## 15. `Loading` replaces `Suspense` for async boundaries

**Solid 1.x:**
```tsx
<Suspense fallback={<span>Loading...</span>}>
  <AsyncChild />
</Suspense>
```

**Solid 2.x:**
```tsx
import { Loading } from "solid-js"

<Loading>
  <Show when={"children" in props && resource()} fallback={resource() as unknown as JSX.Element}>
    {r => props.children?.(r)}
  </Show>
</Loading>
```

`Loading` is the async boundary component in Solid 2.x. It catches pending Promises thrown or returned by async memos in its subtree. The `Show` inside gates rendering until `resource()` resolves to a truthy value; the `fallback` shows the Promise (or `undefined`) during the pending state.

---

## 16. Effect cleanup via return value (new in 2.x)

In Solid 2.x, the **effect** callback (second argument to `createRenderEffect`, first argument to `createEffect` when used as a single-arg form) can return a cleanup function. It is called before the next run and on dispose — equivalent to calling `onCleanup` inside the effect, but scoped to that invocation:

```ts
// 1.x — onCleanup inside effect
createEffect(() => {
  const observer = new ResizeObserver(onResize)
  observer.observe(el)
  onCleanup(() => observer.disconnect())
})

// 2.x — return cleanup from effect phase (onCleanup still works too)
createRenderEffect(
  () => ({ el: element(), onResize: getDebounce("resize") }),
  ({ el, onResize }) => {
    if (!el) return
    const observer = new ResizeObserver(onResize)
    observer.observe(el)
    return () => observer.disconnect()
  },
)
```

`onCleanup` still exists and works in Solid 2.x. The return-value pattern is a convenience when cleanup is co-located with setup and you'd rather not import `onCleanup`.

---

## 17. `@bigmistqke/solid-whenever` removed; helpers inlined or replaced

The `solid-whenever` package (`when`, `whenEffect`, `whenMemo`) was removed as an external dependency. All three patterns are expressible with native Solid 2.x primitives.

### `whenMemo` — inlined in `src/utils.ts`

```ts
export function whenMemo<T, U>(
  accessor: Accessor<T | undefined | null | false>,
  fn: (value: T) => U,
): Accessor<U | undefined> {
  return createMemo(() => {
    const v = accessor()
    return v ? fn(v) : undefined
  })
}
```

Identical semantics to `whenMemo` from `solid-whenever`: returns `undefined` when the accessor is falsy, otherwise the result of `fn(value)`. The `fn` body runs in the memo's compute phase, so reactive nodes created there are properly owned.

### `whenEffect` — replaced by `createRenderEffect` with a guard

```ts
// 1.x
whenEffect(element, el => {
  const observer = new ResizeObserver(onResize)
  observer.observe(el)
  onCleanup(() => observer.disconnect())
})

// 2.x
createRenderEffect(
  () => element(),
  el => {
    if (!el) return
    const observer = new ResizeObserver(onResize)
    observer.observe(el)
    return () => observer.disconnect()
  },
)
```

### `when` (inline conditional) — replaced by explicit `if` guard

```ts
// 1.x — returns undefined when element is falsy
const forceRefresh = when(element, el => el.getBoundingClientRect())

// 2.x — plain function with early return
function forceRefresh() {
  const el = element()
  if (!el) return
  el.getBoundingClientRect()
}
```

### `@solid-primitives/resize-observer` also removed

`createResizeObserver` from `@solid-primitives/resize-observer` was inlined in `canvas.tsx`:

```ts
function createResizeObserver(target: Element, callback: () => void) {
  const observer = new ResizeObserver(callback)
  observer.observe(target)
  onCleanup(() => observer.disconnect())
}
```

Identical behavior; dropped to reduce dependencies.

---

## 18. `settled()` test helper; `waitTillNextFrame` no longer sufficient for state assertions

**Solid 1.x testing:** `waitTillNextFrame()` (a frame listener that resolves on the next render loop tick) was used to wait for reactive updates to propagate before asserting.

**Solid 2.x testing:**
```ts
export function settled(): Promise<void> {
  return new Promise<void>(resolve => onSettled(() => resolve()))
}

// in tests:
someSignal.set(newValue)
await settled()
// now assert
```

`settled()` resolves when the Solid reactive graph has fully settled its synchronous phase. This is more semantically correct than waiting for a frame, because it fires exactly when reactivity is done — not after an arbitrary animation frame delay.

**Constraints:**
- Do NOT call `settled()` inside a reactive computation. `onSettled` fires when the sync graph settles; calling it inside an async memo re-registers a new `onSettled` on every resolution, creating an infinite loop.
- `settled()` only covers synchronous settling. If async memos are in flight (e.g., `useLoader`), you may need to await `settled()` multiple times or use a higher-level wait.

---

## 19. JSDOM's `getBoundingClientRect` returns zeros — must be overridden for raycasting tests

JSDOM does not implement layout, so `canvas.getBoundingClientRect()` always returns all zeros. The raycaster in `solid-three` uses the canvas bounding rect to compute normalized device coordinates — all raycasting tests silently produced wrong results before this was found.

The test canvas setup now overrides it:
```ts
canvas.getBoundingClientRect = () =>
  ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 } as DOMRect)
```

This is not a Solid 2.x behavioral change, but it was discovered during the migration and is required for any test that exercises pointer events or raycasting.

---

## Debugging Utilities Added

During migration, the following debug utilities were added to `src/utils.ts` to inspect the reactive owner graph:

```ts
// createDebug(title, enabled) — returns a no-op or logging function
const debug = createDebug("module:context", true)
debug("topic", data)
debug("topic", data, { trace: true })  // also logs full call stack

// describeOwnerChain() — returns string like:
// "(anon)[3ctx](T) -> computed[3ctx] -> Entity[3ctx](T) -> ..."
//                                              ^^^ ctx = number of context keys
//                                                         ^^^ (T) = transparent root
describeOwnerChain()

// hasContextInChain(contextId) — walks owner chain checking for a context id
hasContextInChain(threeContext.id)
```

These are intentionally left in the codebase as markers/documentation of control flow.

---

## 20. `onSettled` inside `createRoot` must be positioned BEFORE `createThree`

In `src/testing/index.tsx`, the test helper calls `onSettled(() => resolve())` inside a `createRoot`. In Solid 2.x, `onSettled` creates a `trackedEffect` node that is prepended to the parent's `_firstChild`. When a `trackedEffect` re-runs, `disposeChildren(node, false)` sets `node._nextSibling = null` — if the trackedEffect is at the HEAD of the sibling chain, this breaks the chain and prevents disposal of all subsequent nodes (including those from `createThree`) on unmount.

**Fix:** Call `onSettled` BEFORE `createThree` so the trackedEffect ends up at the TAIL of the chain (its `_nextSibling` is already null, so clearing it is harmless):

```ts
createRoot(dispose => {
  unmount = dispose
  onSettled(() => resolve())  // ← BEFORE createThree
  context = createThree(canvas, props)
})
```

---

## 21. `onSettled` callback must not leak return values

`onSettled` in Solid 2.x stores the callback's return value as `node._cleanup`. If the callback returns a truthy non-function value, `node._cleanup?.()` throws "is not a function" during disposal.

**Broken:**
```ts
onSettled(() => log.push("mounted"))  // Array.push returns a number → stored as cleanup
```

**Fixed:**
```ts
onSettled(() => { log.push("mounted") })  // Block body → returns undefined
```

---

## 22. Signal writes store to `_pendingValue`; reads outside reactive context return `_value`

In Solid 2.x, `setSignal` stores the new value as `_pendingValue`. The actual `_value` is only updated during `finalizePureQueue()` inside `flush()` (via `queueMicrotask`). Reading a signal OUTSIDE a reactive context returns `_value` (the old value), not `_pendingValue`.

**Implication for tests:** After calling `test(() => <Component />)` without `await`, signal values set during rendering (e.g., via `ref={setGroup}`) are NOT immediately visible. Use `await test(...)` to wait for the microtask flush that applies pending values.

---

## 23. Three.js r164+ removed `outputEncoding` / `texture.encoding`

Three.js r164+ only exposes `outputColorSpace` / `colorSpace`. The `hasColorSpace` guard in `applyProp` correctly aliases the old names to the new ones, but test assertions that checked `gl.outputEncoding` or `texture.encoding` need to be updated to use the modern API:

```ts
// Old assertions (undefined in modern Three.js)
expect(gl.outputEncoding).toBe(sRGBEncoding)
expect(texture.encoding).toBe(sRGBEncoding)

// New assertions
expect(gl.outputColorSpace).toBe("srgb")
expect(texture.colorSpace).toBe("srgb")
```

---

## 24. Entity's `useSceneGraph` must be outside `whenMemo` for child persistence

When Entity's `from` prop changes (swapping the underlying Three.js object), children like `<T.Group />` should persist — same instance, same UUID — and be re-attached to the new parent rather than destroyed and recreated.

**Problem:** With `useProps` (which includes `useSceneGraph`) inside `whenMemo`, the entire scene graph management is torn down and rebuilt when `from` changes, giving children new UUIDs.

**Solution:** Split concerns in Entity — `useSceneGraph` is called outside `whenMemo` (children persist), while `useProps` (ref, prop application, onUpdate) remains inside `whenMemo` with children omitted:

```ts
export function Entity(props) {
  const rest = omit(props, "from", "args")
  const restNoChildren = omit(rest, "children")
  const memo = whenMemo(
    () => props.from,
    from => {
      const instance = meta(isConstructor(from) ? new from(...) : from, { props })
      useProps(instance, restNoChildren)  // props without children
      return instance
    },
  )
  useSceneGraph(memo, rest)  // children persist across from changes
  return memo
}
```

---

## 25. `useSceneGraph` reordering effect must guard against no-op reorders

The `mapArray` effect function in `useSceneGraph` handles child reordering (e.g., for `<For each={array}>` with `Entity`). The effect receives the mapped children array and reorders `parent.children` to match.

**Critical:** The reordering logic must early-return when the current order is already correct. During reactive flushes triggered by signal changes, the effect function runs even when no reorder is needed. If it unconditionally splices `parent.children`, it can interfere with concurrent disposal/creation of the scene graph, causing components to be recreated in a detached reactive context (no canvas context → `useThree()` throws).

```ts
// Check if managed children are already in correct relative order
const indices = managedChildren.map(c => parent.children.indexOf(c)).filter(i => i !== -1)
if (indices.length < 2) return
let ordered = true
for (let i = 1; i < indices.length; i++) {
  if (indices[i] <= indices[i - 1]) { ordered = false; break }
}
if (ordered) return  // ← critical guard
```

---

## 26. Event registration must happen in compute phase, not in `applyProp`

In Solid 1.x, `applyProp` was called inside a single-callback `createRenderEffect` that had a reactive owner. It could call `addToEventListeners`, which internally calls `useContext(eventContext)` to look up the event registry.

In Solid 2.x, `applyProp` is called from the **effect phase** of a `createRenderEffect`. The effect phase runs via `runEffect()` which does NOT set the reactive `context` variable — so `getOwner()` returns whatever was active at flush time (often null or an unrelated owner). `useContext(eventContext)` then fails to find the event context, either throwing `ContextNotFoundError` (silently caught by the effect's try/catch) or returning undefined.

**Result:** Event handlers (`onPointerDown`, `onClick`, etc.) were never registered on the canvas. The raycaster never fired callbacks. All 6 event tests were broken.

**Fix:** Move event registration into the **compute phase** of `useProps`, where the reactive owner chain includes the `EventContext` provider:

```ts
// in useProps compute phase — has reactive owner with eventContext
createRenderEffect(
  () => {
    const keys = Object.keys(instanceProps)
    for (const key of keys) {
      if (isEventType(key) && object instanceof Object3D && hasMeta(object)) {
        const cleanup = addToEventListeners(object, key)
        onCleanup(cleanup)
      }
    }
  },
  () => {},
)
```

And remove the event handling from `applyProp` (it now just early-returns for event types):
```ts
// in applyProp — effect phase, no owner available
if (isEventType(type)) return  // skip — handled in useProps compute phase
```

**Why this wasn't caught before:** The event tests were already failing (handlers never called), so they never reached the assertions that would have exposed the root cause. Fixing the registration path made 4 of 6 event tests pass immediately.

---

## 27. `useProps` called in effect phase creates orphaned reactive nodes — `create-three.tsx` camera/scene/raycaster

In `create-three.tsx`, the camera, scene, and raycaster prop management called `useProps(...)` inside the **effect phase** of a `createRenderEffect`:

```ts
// ❌ BROKEN — useProps creates reactive nodes (effects, memos) but effect phase has no owner
createRenderEffect(
  () => ({ peek: cameraStack.peek(), defaultCamera: props.defaultCamera }),
  ({ peek, defaultCamera: dc }) => {
    if (peek) return
    if (!dc || dc instanceof Camera) return
    useProps(defaultCamera, dc)               // ← orphaned reactive nodes
    defaultCamera().updateMatrixWorld(true)
  },
)
```

`useProps` internally calls `useSceneGraph` and creates per-key `createRenderEffect` nodes. In the effect phase, these have no owner and are never disposed. More critically, the prop values (like `position: [0, 0, 5]`) are never applied because the effects are orphaned.

**Symptom:** The default camera stayed at position `[0, 0, 0]` instead of the configured `[0, 0, 5]`. All raycasting tests silently failed (the ray from `[0,0,0]` looking at `[0,0,0]` with NDC `[0,0]` doesn't intersect anything).

**Fix:** Move `useProps` into the compute phase, return the object for any effect-phase work:

```ts
// ✅ FIXED — useProps in compute phase, imperative update in effect phase
createRenderEffect(
  () => {
    const peek = cameraStack.peek()
    const dc = props.defaultCamera
    if (peek) return
    if (!dc || dc instanceof Camera) return
    useProps(defaultCamera, dc)    // ← compute phase, has owner
    return defaultCamera()
  },
  camera => {
    camera?.updateMatrixWorld(true) // ← effect phase, imperative only
  },
)
```

Same fix applied to scene and raycaster management blocks.

---

## 28. Test helper used `camera` prop instead of `defaultCamera`

The `CanvasProps` interface defines the camera configuration prop as `defaultCamera`, not `camera`. The test helper in `src/testing/index.tsx` was passing `camera: { position: [0, 0, 5] }` which was silently ignored.

```ts
// ❌ wrong prop name — silently ignored
merge({ camera: { position: [0, 0, 5] } }, props ?? {})

// ✅ correct prop name
merge({ defaultCamera: { position: [0, 0, 5] } }, props ?? {})
```

This was not caught earlier because event tests were already broken for other reasons (entries 26–27). Once those were fixed, the camera position issue became the next blocker.

---

## 29. Event bubble-up used wrong object reference

In `createDefaultEventRegistry` (handling `onMouseDown`, `onPointerDown`, etc.), the event bubble-up loop always read the handler from `intersection.object` instead of the current `node` being visited:

```ts
// ❌ BUG — always fires intersection.object's handler, even when visiting parent nodes
while (node && !event.stopped) {
  getMeta(intersection.object)?.props[type]?.(event)  // called N times for same handler
  node = node.parent
}

// ✅ FIXED — fires the current node's handler during bubble-up
while (node && !event.stopped) {
  getMeta(node)?.props[type]?.(event)
  node = node.parent
}
```

**Symptom:** `handlePointerDown` was called twice (once for the Mesh, once when visiting the Scene parent) instead of once. The pointer capture test asserted `toHaveBeenCalledTimes(1)` and failed.

This bug predates the Solid 2.x migration but was never exposed because event registration was broken (entry 26). Fixing registration revealed it.

---

## 30. Non-stoppable events (enter/leave) intentionally omit `stopPropagation`

`createThreeEvent` has a `stoppable` flag. When `stoppable: false`, the event object has no `stopPropagation` method — calling it would be a no-op anyway, and omitting it makes the contract explicit (matching how DOM `pointerenter`/`pointerleave` are non-bubbling events where `stopPropagation` is meaningless).

The original test expected `stopPropagation()` to exist and not throw on enter events. Updated the test to assert the opposite — `stopPropagation` should be `undefined` on non-stoppable events:

```ts
const handlePointerEnter = vi.fn().mockImplementation(e => {
  expect(e.stopPropagation).toBeUndefined()
})
```

**Design decision:** `stopPropagation` is only present on stoppable events (click, pointerdown, pointermove, etc.). Enter/leave events are non-stoppable by design. This keeps the API honest — if a method exists, it does something.

---

## 31. Pointer capture tests skipped — feature not implemented

The `web pointer capture` test group (2 tests) exercises `setPointerCapture` / `releasePointerCapture` / `pointerId` handling. None of these are implemented in `solid-three`'s event system — there is no code that reads `pointerId` from events or calls capture methods on the canvas.

The tests were always destined to fail. They were previously masked by the event registration bug (entry 26). A `TODO: implement pointer capture` comment already existed above the test group.

**Action:** `describe.skip("web pointer capture", ...)` until the feature is implemented.

---

## 32. `onSettled` cannot create reactive primitives

**Solid 1.x:** `onSettled` didn't exist — deferred initialization was done with `queueMicrotask` or similar.

**Solid 2.x:** `onSettled` fires when the synchronous reactive graph settles, but its callback runs in a restricted "owner-backed" scope. Calling `createSignal`, `createMemo`, `createRenderEffect`, `createRoot`, or any other primitive that creates a reactive node inside `onSettled` throws:

```
Cannot create reactive primitives inside createTrackedEffect or owner-backed onSettled
```

### The Canvas problem

The original `Canvas` component used `onSettled` to defer `createThree()` until after JSX ref assignments (`ref={canvas!}`) completed:

```tsx
// Broken in Solid 2.x
onSettled(() => {
  createRoot(() => {
    const context = createThree(canvas, props) // creates memos, effects, etc.
  })
})
```

This worked in Solid 1.x (where `onSettled` didn't exist and `createRoot` was used differently), but Solid 2.x's `onSettled` callback forbids creating reactive nodes.

### Fix: create JSX elements directly, call `createThree` synchronously

Instead of using `ref={canvas!}` in JSX (which requires waiting for ref assignment), create the DOM elements as JSX expressions in the component body. This makes them available immediately, so `createThree` can run synchronously without deferral:

```tsx
// Fixed for Solid 2.x
export function Canvas(props) {
  const canvas = (<canvas />) as HTMLCanvasElement
  const container = (<div ...>{canvas}</div>) as HTMLDivElement

  const context = createThree(canvas, props)   // runs synchronously, no onSettled needed
  createResizeObserver(container, onResize)

  return container
}
```

---

## 33. `createRoot` inside component body throws in Solid 2.x dev mode

In Solid 2.x, component functions execute inside a `createRoot.transparent` + `untrack` wrapper (set up by `devComponent` in dev mode). This sets `leafEffectActive = true` in `@solidjs/signals`, which prevents creating new reactive owners:

```
Cannot create reactive primitives inside createTrackedEffect
```

This affects `withContext` / `withMultiContexts` which previously wrapped their body in `createRoot`:

```tsx
// Broken in Solid 2.x
export function withMultiContexts(children, values) {
  return createRoot(() => {           // throws: leafEffectActive is true
    for (const [context, value] of values) setContext(context, value)
    return children()
  })
}
```

### Fix: remove `createRoot`, call `setContext` directly

Since the component already runs under an owner (provided by `render()` → `createRoot`), there's no need for an additional `createRoot`. Just set the contexts on the current owner:

```tsx
// Fixed for Solid 2.x
export function withMultiContexts(children, values) {
  for (const [context, value] of values) setContext(context, value)
  return children()
}
```

The same fix applies to `withContext`.

**Trade-off:** The old `createRoot` created a disposal boundary — child reactive nodes were disposed when the root was disposed. Without it, disposal is handled by the parent owner (the component's own root). This is fine for `Canvas` since the component's lifecycle matches the Three.js context's lifecycle.

---

## 34. Duplicate `@solidjs/signals` instances cause silent owner mismatch

When `solid-three` is linked locally (e.g. `"solid-three": "link:../solid-three"`), Vite may resolve two separate instances of `@solidjs/signals`:

- One from the app's `node_modules` (used by `solid-js`, `@solidjs/web`, `render()`)
- One from solid-three's own `node_modules` (used by `setContext`)

Each instance has its own module-level `context` variable for tracking the current reactive owner. The app's `render()` sets the owner on instance A, but solid-three's `setContext` reads from instance B — which has no owner. Result:

```
NoOwnerError: Context can only be accessed under a reactive root.
```

`getOwner()` from `solid-js` (re-exported from instance A) returns a valid owner, but `setContext` from `@solidjs/signals` (instance B) sees `null`.

### Fix: externalize + dedupe

1. **`tsup.config.ts`** — add `external: ["solid-js", "@solidjs/signals", "@solidjs/web", "three"]` so these packages are imported at runtime rather than bundled into solid-three's dist.

2. **Consumer `vite.config.ts`** — add `resolve.dedupe: ["solid-js", "@solidjs/signals", "@solidjs/web"]` to force Vite to resolve all imports to a single instance.

3. **Consumer `package.json`** — add `@solidjs/signals` as an explicit dependency so Vite can resolve it when solid-three's externalized `import { setContext } from "@solidjs/signals"` is encountered.
