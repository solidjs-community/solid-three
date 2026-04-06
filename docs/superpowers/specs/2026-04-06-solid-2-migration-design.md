# solid-three → Solid 2.0 Migration Design

**Date:** 2026-04-06
**Branch:** `next` (v0.3.0-next.12 → v0.3.0-next.x)
**Target:** `solid-js@2.0.0-beta.5` (`@solidjs/signals@0.13.9`)

---

## Context

The `next` branch already made the right architectural decisions (no custom reconciler, manual scene graph via `useSceneGraph`/`useProps`, THREE objects returned as JSX elements via `createMemo`). The migration to Solid 2.0 is therefore an API surface change, not an architecture change.

This document covers every file that needs to change and why.

---

## Core behavioral changes to understand

### 1. Auto-batching — never rely on `flush()`

In Solid 2.0 all signal writes are microtask-batched by default. `batch` is removed. `flush()` exists but **must never be relied on** — it only settles synchronous chains. Any async memo downstream (e.g. `useLoader`'s `createMemo(async () => ...)`) will not be settled after `flush()`.

**The only safe pattern** for waiting on settled state — in tests and in code — is `onSettled`:

```ts
await new Promise<void>(resolve => onSettled(() => resolve()))
```

This works for both sync and async chains.

**Impact on solid-three:**
- The render loop runs via `requestAnimationFrame`, which always runs after microtask queue drains → no issue with stale reads in the render loop.
- `frameloop: "demand"` calls `requestRender()` from effectFn, which is already post-flush → correct.
- Tests that currently assert synchronously after state changes must be updated to `await onSettled(...)`.

### 2. Split effects — nesting in the compute phase

`createEffect` and `createRenderEffect` are split into two phases:

- **compute** `(prev) => next`: reactive tracking, dependency recording, child effect creation. Returns a value.
- **effectFn** `(next, prev) => cleanup | void`: receives the computed value, performs side effects. Returns an optional cleanup function.

**The rule:** nested `createRenderEffect` / `createEffect` calls must be created in the **compute phase (first arg)**, not the effectFn. Child computations created in compute are owned by the parent and disposed when the parent re-runs. Child computations created in effectFn are not properly owned.

```ts
// correct
createRenderEffect(
  () => {
    const object = resolve(accessor)   // tracked read
    createRenderEffect(                // child created in compute ✅
      () => props[key],
      value => applyProp(object, key, value)
    )
    return object
  },
  object => { /* optional outer side effect */ }
)
```

### 3. `onSettled` cannot create nested reactive primitives

`onSettled` (and `createTrackedEffect`) explicitly forbid creating nested reactive computations. When `createThree` (which creates many `createRenderEffect`/`createMemo` calls) needs to run after DOM mount, it must be wrapped in `createRoot`:

```ts
onSettled(() => {
  return createRoot(dispose => {
    createThree(canvas, props)
    return dispose  // returned as cleanup
  })
})
```

### 4. Context is the provider

`Context.Provider` is gone. The context itself is called as a function/component:

```tsx
// before
<ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>

// after
<ThemeContext value="dark">{children}</ThemeContext>
```

This also affects the imperative `withContext` / `withMultiContexts` utilities in `utils.ts` which call `context.Provider({...})`.

---

## File-by-file changes

### `package.json`

- `solid-js`: `^1.8.17` → `^2.0.0-beta.5`
- `vite-plugin-solid`: update to `next` tag version
- `babel-preset-solid`: update to `next` tag version
- `@bigmistqke/solid-whenever`: **remove** — package is not Solid 2.0 compatible. All usages (`whenMemo` in `components.tsx`, `when`/`whenEffect` in `use-measure.ts`) must be inlined.

---

### `src/canvas.tsx`

**Changes:**
1. `onMount` → `onSettled`
2. Wrap `createThree` call in `createRoot` (because `onSettled` cannot create nested primitives)

```ts
// before
onMount(() => {
  const context = createThree(canvas, props)
  createResizeObserver(container, ...)
})

// after
onSettled(() => {
  return createRoot(dispose => {
    const context = createThree(canvas, props)
    createResizeObserver(container, ...)
    return dispose
  })
})
```

---

### `src/utils.ts`

**Changes:**

1. `mergeProps` → `merge` (from `@solidjs/signals`)
2. `withContext` — `context.Provider({...})` → `context({...})`
3. `withMultiContexts` — same: `context.Provider({...})` → `context({...})`
4. `useRef` — split `createRenderEffect` into compute/effectFn:

```ts
// before
createRenderEffect(() => {
  const result = typeof value === "function" ? value() : value
  typeof props.ref === "function" ? props.ref(result) : (props.ref = result)
})

// after
createRenderEffect(
  () => (typeof value === "function" ? (value as Accessor<T>)() : value),
  result => {
    if (typeof props.ref === "function") props.ref(result)
    else props.ref = result
  }
)
```

---

### `src/props.ts`

This is the most complex file. Three areas change.

**1. `splitProps` → `omit`**

`splitProps(props, ["ref", "args", "object", "attach", "children"])` returns `[local, rest]`. In Solid 2.0, `omit` only returns the rest. The picked keys are accessed directly from `props`:

```ts
// before
const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"])

// after
const instanceProps = omit(props, "ref", "args", "object", "attach", "children")
// access props.ref, props.args, etc. directly
```

**2. `useSceneGraph` — `createComputed` → `createRenderEffect` (split)**

`createComputed` is removed. Replace with `createRenderEffect` with nested child creation in the compute phase:

```ts
// before
createComputed(
  mapArray(
    () => c.toArray(),
    _child => createComputed(() => {
      const parent = resolve(_parent)
      const child = resolve(_child)
      if (parent && child) applySceneGraph(parent, child)
    })
  )
)

// after
createRenderEffect(
  () => mapArray(
    () => c.toArray() as (Meta<object> | undefined)[],
    _child => createRenderEffect(
      () => ({ parent: resolve(_parent), child: resolve(_child) }),
      ({ parent, child }) => { if (parent && child) applySceneGraph(parent, child) }
    )
  )(),   // call the mapArray accessor in compute to track the array
  () => {}
)
```

**3. `useProps` — nested `createRenderEffect` restructure**

The 4-level nesting is restructured so all child effect creation stays in compute phases:

```ts
// outer: resolves the THREE object, creates child effects in compute
createRenderEffect(
  () => {
    const object = resolve(accessor)
    if (!object) return undefined

    // ref effect — created in compute phase ✅
    createRenderEffect(
      () => props.ref,
      ref => {
        if (typeof ref === "function") ref(object)
        else props.ref = object
      }
    )

    // per-key prop effects — created in compute phase ✅
    createRenderEffect(
      () => {
        const keys = Object.keys(instanceProps)
        for (const key of keys) {
          const subKeys = keys.filter(k => k !== key && k.startsWith(key))
          createRenderEffect(
            () => props[key],   // compute: track value
            value => {          // effectFn: write to THREE
              applyProp(context, object, key, value)
              for (const subKey of subKeys) {
                applyProp(context, object, subKey, props[subKey])
              }
            }
          )
        }
      },
      () => {}
    )

    return object
  },
  object => {
    if (object) untrack(() => props.onUpdate)?.(object)
  }
)
```

---

### `src/hooks.ts`

**Changes:**

1. `mergeProps({ cache: true }, options)` → `merge({ cache: true }, options)`. **Note:** `merge` treats `undefined` as a real value (unlike `mergeProps`). If `options` is `undefined` or any field is explicitly `undefined`, it will override the default. Verify that `useLoader` callers never pass `{ cache: undefined }` expecting it to fall back to `true`.
2. `createResource` → `createMemo(async () => ...)` — removes `Resource` type, returns `Accessor<T>`

```ts
// before
const [resource] = createResource(
  () => [resolve(url), options?.base, loader()] as const,
  async ([_url, base, _loader]) => {
    config.onBeforeLoad?.(_loader)
    const resolvedUrl = base ? resolveUrls(base, _url) : _url
    const result = await loadUrl(resolvedUrl)
    config.onLoad?.(result)
    return result
  }
)
return resource  // Resource<T>

// after
const resource = createMemo(async () => {
  const _url = resolve(url)
  const _loader = loader()
  const base = options?.base
  config.onBeforeLoad?.(_loader)
  const resolvedUrl = base ? resolveUrls(base, _url) : _url
  const result = await loadUrl(resolvedUrl)
  config.onLoad?.(result)
  return result
})
return resource  // Accessor<T> — throws NotReadyError until resolved
```

Return type: `Resource<LoadOutput<TLoader, TInput>>` → `Accessor<LoadOutput<TLoader, TInput>>`

Consumers of `useLoader` that used `.loading` or `.error` must migrate to `isPending`/`<Loading>` boundaries.

---

### `src/components.tsx`

**Changes:**

1. `mergeProps` → `merge`
2. `splitProps` → `omit` + direct prop access
3. `Resource` component: wrap with `<Loading>` since `resource()` now throws `NotReadyError` when pending
4. Remove debug `createEffect(() => console.log(...))` — or update to split form
5. `whenMemo` (from `@bigmistqke/solid-whenever`) — inline as `createMemo(() => { const v = accessor(); return v ? fn(v) : undefined })`
6. `Portal`: `mergeProps(context, { get scene() { return element() } })` → `merge(context, { get scene() { return element() } })`

```tsx
// Resource component — add Loading boundary
export function Resource<const TLoader extends Loader<object, any>>(props: ResourceProps<TLoader>) {
  const rest = omit(props, "base", "cache", "onBeforeLoad", "onLoad", "loader", "url", "children")
  const resource = useLoader(
    () => props.loader,
    () => props.url,
    { base: props.base, cache: props.cache, onBeforeLoad: props.onBeforeLoad, onLoad: props.onLoad }
  )
  useProps(resource, rest)
  return (
    <Loading>
      <Show when={"children" in props && resource()} fallback={resource()}>
        {r => props.children?.(r)}
      </Show>
    </Loading>
  )
}
```

The `Entity` component's `splitProps` → `omit`:
```ts
// before
const [config, rest] = splitProps(props, ["from", "args"])

// after
const rest = omit(props, "from", "args")
// use props.from, props.args directly
```

---

### `src/create-three.tsx`

**Changes:**

1. `mergeProps` → `merge`
2. `children` — unchanged
3. Context providers: `<X.Provider value={...}>` → `<X value={...}>`. This applies to the JSX block at lines 409–414 that wraps children in `eventContext.Provider`, `frameContext.Provider`, and `threeContext.Provider`:
   ```tsx
   // before
   <eventContext.Provider value={...}>
     <frameContext.Provider value={...}>
       <threeContext.Provider value={...}>{children()}</threeContext.Provider>
     </frameContext.Provider>
   </eventContext.Provider>

   // after
   <eventContext value={...}>
     <frameContext value={...}>
       <threeContext value={...}>{children()}</threeContext>
     </frameContext>
   </eventContext>
   ```
4. Nested `createRenderEffect` at lines 322–374 — restructure to split compute/effectFn with nesting in compute. **Note on XR effect:** the existing code uses `createEffect` (not `createRenderEffect`) for the XR connection because XR initialization is a DOM side effect that should not run in the render phase. Keep it as `createEffect` (split form) in the after version.

The doubly-nested block managing shadows + XR + color space:

```ts
// before
createRenderEffect(() => {
  createRenderEffect(() => { /* shadows */ })
  createEffect(() => { /* xr */ })
  useProps(gl, { ... })
})

// after
createRenderEffect(
  () => {
    // nested effect creation in compute ✅
    createRenderEffect(
      () => ({ enabled: !!props.shadows, type: resolveShadowType(props.shadows), gl: gl() }),
      ({ enabled, type, gl }) => {
        if (!gl.shadowMap) return
        const changed = gl.shadowMap.enabled !== enabled || gl.shadowMap.type !== type
        gl.shadowMap.enabled = enabled
        gl.shadowMap.type = type
        if (changed) gl.shadowMap.needsUpdate = true
      }
    )
    createEffect(           // intentionally createEffect, not createRenderEffect — XR is a DOM side effect
      () => gl(),
      renderer => { if (renderer.xr) context.xr.connect() }
    )
    useProps(gl, {
      get outputEncoding() { return props.linear ? LinearEncoding : sRGBEncoding },
      get toneMapping() { return props.flat ? NoToneMapping : ACESFilmicToneMapping },
    })
  },
  () => {}
)
```

---

### `src/testing/index.tsx`

**Changes:**

1. `mergeProps` → `merge`. Watch for `mergeProps(context, { addFrameListener })` — verify `merge` behavior when `context` object fields may be `undefined`.
2. All test assertion helpers that currently use synchronous checks after state changes must wrap in `onSettled` promise:

```ts
// pattern for all reactive assertions in tests
export async function settled() {
  return new Promise<void>(resolve => onSettled(() => resolve()))
}

// usage in tests
await settled()
expect(scene.children.length).toBe(1)
```

---

### `src/utils/use-measure.ts`

This file has more changes than it first appears.

**1. `mergeProps` → `merge`** (line 35)

**2. `when` and `whenEffect` — inline, remove `@bigmistqke/solid-whenever`**

`when(element, fn)` (line 80) and `whenEffect(signal, fn)` (lines 117, 141) must be inlined:

```ts
// when(element, fn) — used for forceRefresh
// inline as a plain function that reads the signal and runs fn if truthy
const forceRefresh = () => {
  const el = element()
  if (el) {
    // body of the when callback
  }
}

// whenEffect(scrollContainers, fn) — inline as createRenderEffect with null-check in effectFn
createRenderEffect(
  () => scrollContainers(),
  containers => {
    if (!containers || !config.scroll) return
    containers.forEach(c => c.addEventListener("scroll", onScroll, { capture: true, passive: true }))
    return () => containers.forEach(c => c.removeEventListener("scroll", onScroll, true))
  }
)
```

**3. Nested `createEffect` blocks** — lines 108–133 and 135–146 both nest a `createEffect` or `whenEffect` inside an outer `createEffect`. The nesting-in-compute rule applies: child effect creation must move to the compute phase (first arg):

```ts
// before
createEffect(() => {
  const onScroll = getDebounce("scroll")
  createEffect(() => {
    // scroll listener
  })
  whenEffect(scrollContainers, scrollContainers => { /* ... */ })
})

// after
createRenderEffect(
  () => {
    const onScroll = getDebounce("scroll")
    createRenderEffect(
      () => config.scroll,
      scroll => {
        if (!scroll) return
        globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true })
        return () => globalThis.removeEventListener("scroll", onScroll, true)
      }
    )
    createRenderEffect(
      () => scrollContainers(),
      containers => {
        if (!containers || !config.scroll) return
        containers.forEach(c => c.addEventListener("scroll", onScroll, { capture: true, passive: true }))
        return () => containers.forEach(c => c.removeEventListener("scroll", onScroll, true))
      }
    )
  },
  () => {}
)
```

---

### `src/data-structure/stack.ts`, `src/data-structure/loader-cache.ts`, `src/data-structure/augmented-stack.ts`

No changes needed — only use `createSignal`, `onCleanup`, `getOwner`, `untrack`, `Accessor` type, all of which are unchanged in Solid 2.0.

---

### `tests/`

**Changes:**

- Replace all synchronous post-mutation assertions with `await settled()` helper
- Remove any `flush()` calls
- `@solidjs/testing-library`: install the `next`-tagged version (`npm install @solidjs/testing-library@next`). The Solid 2.0-compatible version exports `render`, `fireEvent`, `screen` as before but the `render` return value no longer includes `.unmount()` — use `cleanup()` imported from `@solidjs/testing-library` instead.
- `renderer.test.tsx` line 300: `onMount` import and usage in test component must be replaced with `onSettled` (wrapped in `createRoot` if nested primitives are created inside)
- `<Suspense>` → `<Loading>` in test wrappers
- `<ErrorBoundary>` → `<Errored>` in test wrappers

---

### Playground files

- `<Suspense>` → `<Loading>`
- `<ErrorBoundary>` → `<Errored>`
- `Context.Provider` → context as direct component

---

## Risk areas

| Area | Risk | Mitigation |
|---|---|---|
| `@bigmistqke/solid-whenever` (`when`, `whenEffect`, `whenMemo`) | Not Solid 2.0 compatible — remove package | Inline all usages: `whenMemo` → `createMemo` with conditional, `whenEffect` → `createRenderEffect` with null-check in effectFn, `when` → plain function with null-check |
| `onSettled` + `createRoot` in Canvas | `createRoot` inside `onSettled` may have edge cases | Verify ownership and cleanup are correct in tests |
| `useLoader` return type change | Callers using `.loading`/`.error` break | Audit all call sites; wrap in `<Loading>` |
| `omit` vs `splitProps` semantics | `merge` treats `undefined` as a real value (overrides) | Audit all `mergeProps` call sites for undefined-coalescing patterns |
| Tests timing with `onSettled` | Async test infrastructure changes | Build `settled()` helper early; use throughout |

---

## Import changes summary

```ts
// removed from solid-js
import { createComputed, createResource, mergeProps, onMount, splitProps } from "solid-js"
// ❌ these no longer exist

// replacements
import { merge, omit, onCleanup, onSettled } from "@solidjs/signals"  // via solid-js re-export
import { createMemo, createRenderEffect, createRoot } from "solid-js"
```

Context providers in JSX:
```tsx
// before: <Ctx.Provider value={v}>{children}</Ctx.Provider>
// after:  <Ctx value={v}>{children}</Ctx>
```
