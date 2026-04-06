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

**The only safe pattern** for waiting on settled state — in tests and in imperative setup code — is `onSettled`:

```ts
await new Promise<void>(resolve => onSettled(() => resolve()))
```

This works for both sync and async chains.

**Do not call this inside a reactive computation.** Calling `await settled()` inside a `createMemo(async () => ...)` is dangerous: the async memo is itself a pending computation. `onSettled` fires when the synchronous graph settles (not when async memos complete), so the memo may resume, write signals, trigger a new batch, and the pattern can produce infinite awaits or unpredictable behavior. Keep `settled()` strictly in test/imperative code outside of any reactive scope.

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
  createRoot(() => {
    createThree(canvas, props)
  })
})
```

In Solid 2.0, `createRoot` autodisposes when its owner disposes — no need to return or call `dispose` manually.

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

## Additional Solid 2.0 changes relevant to solid-three

### `batch` is removed — `flush()` exists but must never be relied on

`batch()` no longer exists. All signal writes auto-batch by default (microtask). `flush()` forces a synchronous flush but only settles synchronous chains — do not rely on it (see section 1 above).

### `For` children now receive **accessors**

In Solid 2.0, `<For>` passes accessor functions to the child render function:

```tsx
// before
<For each={items()}>{(item, index) => <Row item={item} index={index} />}</For>

// after
<For each={items()}>{(item, index) => <Row item={item()} index={index()} />}</For>
```

`mapArray` (used in `src/props.ts`) follows the same convention — child callbacks receive `Accessor<T>` not `T`. The existing `useSceneGraph` code already uses `_child` as an accessor, so the `mapArray` call itself is unaffected, but any `<For>` usage in tests or playground files must be updated.

`Index` is removed — use `<For keyed={false}>` instead.

### Effect cleanup: return form preferred

In Solid 2.0, the preferred way to register cleanup in an effect is to **return** a cleanup function from the effectFn, rather than calling `onCleanup()`:

```ts
// both work, but return form is preferred
createRenderEffect(
  () => element(),
  el => {
    const observer = new ResizeObserver(...)
    observer.observe(el)
    return () => observer.disconnect()   // ✅ preferred
  }
)
```

`onCleanup()` still works and is appropriate in non-effect contexts (e.g. inside `createRoot`).

### `isPending` — revalidation state for `useLoader`

`isPending(fn)` is a new API that returns `true` when an async expression is **revalidating with a stale value** (i.e. not the initial load). Consumers of `useLoader` that want a "refreshing" indicator without hiding the existing content should use this:

```tsx
<Show when={isPending(() => resource())}>Refreshing…</Show>
<Loading fallback={<Spinner />}>
  <Mesh map={resource()} />
</Loading>
```

`isPending` returns `false` during the initial `<Loading>` fallback (no stale value yet).

### `untrack` dev warnings

In Solid 2.0 dev mode, top-level reactive reads inside a component body (outside effects/memos) produce a warning. Wrap intentional untracked reads in `untrack()`. This is unlikely to affect solid-three's internal code but may surface in tests or playground components.

### `createRoot` — owned by parent by default

Confirmed: `createRoot` is now owned by the parent scope and autodisposes when the parent disposes. To create a deliberately detached root (1.x behavior), use `runWithOwner(null, () => createRoot(...))`.

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
  createRoot(() => {
    const context = createThree(canvas, props)
    createResizeObserver(container, ...)
  })
  // createRoot autodisposes when owner disposes — no manual cleanup needed
})
```

---

### `src/utils.ts`

**Changes:**

1. `mergeProps` → `merge` (from `@solidjs/signals`)
2. `defaultProps` — internally calls `mergeProps(defaults, props)` (line 177). Update to `merge(defaults, props)`. The `undefined`-override semantic of `merge` matches the intent here (user props override defaults), so this is a safe mechanical swap.
3. `withContext` — `context.Provider({...})` → `context({...})`
4. `withMultiContexts` — same: `context.Provider({...})` → `context({...})`
5. `useRef` — split `createRenderEffect` into compute/effectFn:

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
5. `whenMemo` (from `@bigmistqke/solid-whenever`) — extract to a shared util (see note below)
6. `Portal`: `mergeProps(context, { get scene() { return element() } })` → `merge(context, { get scene() { return element() } })`

**`whenMemo` util** — add to `src/utils.ts` rather than inlining at every call site:
```ts
export function whenMemo<T, U>(
  accessor: Accessor<T | undefined | null | false>,
  fn: (value: T) => U
): Accessor<U | undefined> {
  return createMemo(() => {
    const v = accessor()
    return v ? fn(v) : undefined
  })
}
```

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

1. `mergeProps` → `merge`. This file uses `mergeProps` in multiple places: the `canvasProps` default merge (line 51 via `defaultProps`), plus direct `mergeProps` calls on lines 419 and 428. All must be updated.
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
4. Nested `createRenderEffect` at lines 322–374 — restructure to split compute/effectFn with nesting in compute. **Note on XR effect:** the existing code uses `createEffect` (not `createRenderEffect`) for the XR connection because XR initialization is a DOM side effect that should not run in the render phase. Keep it as `createEffect` (split form) in the after version. **Note:** the restructured block must also preserve the `useProps(gl, props.gl)` call that handles user-supplied renderer options — do not drop it.

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

1. `mergeProps` → `merge`. This file has three `mergeProps` call sites:
   - Line 31: inside `test()` helper — `mergeProps(context, ...)` for the base context merge
   - Line 50: `mergeProps(context, { addFrameListener })` — watch for `merge` behavior when `context` fields may be `undefined`
   - Return value of `test()`: `mergeProps(context, { unmount, waitTillNextFrame })` — all three must be updated
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
- `<For>` child callbacks: update any `(item, index)` that uses `item`/`index` directly to `item()`/`index()` (now accessors)

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
| `onSettled` + `createRoot` in Canvas | `createRoot` autodisposes with owner — no manual dispose needed | Verify in tests that canvas teardown correctly disposes the root |
| `useLoader` return type change | Callers using `.loading`/`.error` break | Audit all call sites; wrap in `<Loading>` |
| `omit` vs `splitProps` semantics | `merge` treats `undefined` as a real value (overrides) | Audit all `mergeProps` call sites for undefined-coalescing patterns |
| Tests timing with `onSettled` | Async test infrastructure changes | Build `settled()` helper early; use throughout |

---

## Import changes summary

```ts
// removed from solid-js
import { batch, createComputed, createResource, mergeProps, onMount, splitProps } from "solid-js"
// ❌ these no longer exist

// replacements
import { merge, omit, isPending, onCleanup, onSettled } from "@solidjs/signals"  // via solid-js re-export
import { createMemo, createRenderEffect, createRoot } from "solid-js"
// For: Index removed → use <For keyed={false}>
// Suspense → Loading, ErrorBoundary → Errored (from solid-js)
```

Context providers in JSX:
```tsx
// before: <Ctx.Provider value={v}>{children}</Ctx.Provider>
// after:  <Ctx value={v}>{children}</Ctx>
```
