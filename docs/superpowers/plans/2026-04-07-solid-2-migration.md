# Solid 2.0 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate solid-three from Solid.js 1.x (^1.8.17) to Solid 2.0.0-beta.5.

**Architecture:** File-by-file API surface migration in dependency order. The `next` branch already uses the right reactive architecture (no custom reconciler, manual scene graph). Foundation utilities are migrated first so downstream files can import from them. Tests are fixed last once the library itself compiles.

**Tech Stack:** Solid.js 2.0.0-beta.5, `@solidjs/signals` (re-exported via solid-js), Three.js ^0.164.1, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-solid-2-migration-design.md`

---

## File Map

| File | Changes |
|------|---------|
| `package.json` | solid-js 2.0.0-beta.5, remove @bigmistqke/solid-whenever |
| `src/utils.ts` | `mergeProps→merge`, `Provider→context()`, split `useRef`, add `whenMemo` export |
| `src/props.ts` | `splitProps→omit`, `createComputed→createRenderEffect` (split), restructure nested effects, hoist texture color space effect to `useProps` compute phase |
| `src/hooks.ts` | `createResource→createMemo(async)`, `mergeProps→merge`, return type change |
| `src/components.tsx` | `splitProps→omit`, `mergeProps→merge`, `<Loading>`, import `whenMemo` from utils, remove debug effect |
| `src/create-three.tsx` | `mergeProps→merge` (3 sites), `<X.Provider>→<X>`, restructure gl `createRenderEffect` |
| `src/canvas.tsx` | `onMount→onSettled`, wrap in `createRoot` |
| `src/utils/use-measure.ts` | `mergeProps→merge`, inline `when`/`whenEffect`, restructure nested effects |
| `src/testing/index.tsx` | `mergeProps→merge` (3 sites), add `settled()` export |
| `tests/core/renderer.test.tsx` | `onMount→onSettled`, `await settled()` after signal writes, `<For>` children |
| `tests/core/hooks.test.tsx` | `await settled()` after signal writes |
| `tests/core/events.test.tsx` | `await settled()` after signal writes |
| `tests/web/canvas.test.tsx` | `renderer.unmount()` → `cleanup()` from `@solidjs/testing-library` |

---

## Task 1: Update dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update `package.json`**

In `devDependencies`, change:
```json
"solid-js": "^2.0.0-beta.5",
"vite-plugin-solid": "next",
"babel-preset-solid": "next",
"@solidjs/testing-library": "next"
```

Remove from `dependencies`:
```json
"@bigmistqke/solid-whenever": "^0.1.0"
```

- [ ] **Step 2: Install**

Run: `pnpm install`

Expected: lock file updated. TypeScript errors across the project are expected — that's the migration work ahead.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: upgrade to solid-js 2.0.0-beta.5, remove solid-whenever"
```

---

## Task 2: Migrate `src/utils.ts`

**Files:**
- Modify: `src/utils.ts`

This is the foundation file. It exports `whenMemo`, `defaultProps`, `withContext`, `withMultiContexts`, `useRef` — all used downstream.

- [ ] **Step 1: Update imports**

```ts
// Replace the first two import lines:
import type { Accessor, Context, JSX } from "solid-js"
import { createMemo, createRenderEffect, onCleanup, type Ref } from "solid-js"
import { merge } from "@solidjs/signals"
// Remove: mergeProps from solid-js import
```

- [ ] **Step 2: Update `defaultProps`**

```ts
// before
export function defaultProps<
  const T,
  const TDefaults extends Partial<Required<Pick<T, KeyOfOptionals<T>>>>,
>(props: T, defaults: TDefaults): Prettify<TDefaults & Omit<T, keyof TDefaults>> {
  return mergeProps(defaults, props)
}

// after
export function defaultProps<
  const T,
  const TDefaults extends Partial<Required<Pick<T, KeyOfOptionals<T>>>>,
>(props: T, defaults: TDefaults): Prettify<TDefaults & Omit<T, keyof TDefaults>> {
  return merge(defaults, props)
}
```

- [ ] **Step 3: Update `withContext`**

```ts
// before
export function withContext<T, TResult>(
  children: Accessor<TResult>,
  context: Context<T>,
  value: T,
) {
  let result: TResult
  context.Provider({
    value,
    children: (() => {
      result = children()
      return ""
    }) as any as JSX.Element,
  })
  return result!
}

// after
export function withContext<T, TResult>(
  children: Accessor<TResult>,
  context: Context<T>,
  value: T,
) {
  let result: TResult
  context({
    value,
    children: (() => {
      result = children()
      return ""
    }) as any as JSX.Element,
  })
  return result!
}
```

- [ ] **Step 4: Update `withMultiContexts`**

One change: `context.Provider({...})` → `context({...})` inside the reducer:

```ts
// before (inside reduce callback)
return () =>
  context.Provider({
    value,
    children: () => {
      if (index === 0) result = acc()
      else acc()
    },
  })

// after
return () =>
  context({
    value,
    children: () => {
      if (index === 0) result = acc()
      else acc()
    },
  })
```

- [ ] **Step 5: Split `useRef` into compute/effectFn**

```ts
// before
export function useRef<T>(props: { ref?: Ref<T> }, value: T | Accessor<T>) {
  createRenderEffect(() => {
    const result =
      typeof value === "function"
        ? // @ts-expect-error
          value()
        : value
    if (typeof props.ref === "function") {
      // @ts-expect-error
      props.ref(result)
    } else {
      props.ref = result
    }
  })
}

// after
export function useRef<T>(props: { ref?: Ref<T> }, value: T | Accessor<T>) {
  createRenderEffect(
    // @ts-expect-error
    () => (typeof value === "function" ? (value as Accessor<T>)() : value),
    (result: T) => {
      if (typeof props.ref === "function") {
        // @ts-expect-error
        props.ref(result)
      } else {
        props.ref = result
      }
    },
  )
}
```

- [ ] **Step 6: Add `whenMemo` export**

Add after `useRef`:

```ts
/**********************************************************************************/
/*                                                                                */
/*                                   When Memo                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Returns a memo that evaluates `fn(value)` when `accessor` is truthy, `undefined` otherwise.
 * Inlined replacement for `whenMemo` from `@bigmistqke/solid-whenever`.
 */
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

- [ ] **Step 7: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/utils.ts"`

Expected: no output (no errors in this file).

- [ ] **Step 8: Commit**

```bash
git add src/utils.ts
git commit -m "feat: migrate utils.ts to Solid 2.0 (merge, context(), split useRef, whenMemo)"
```

---

## Task 3: Migrate `src/props.ts`

**Files:**
- Modify: `src/props.ts`

Three areas change: `splitProps→omit`, `createComputed→createRenderEffect` (split), nested effect restructure. Plus one subtle fix: `applyProp` creates a `createRenderEffect` inside what will become an effectFn — wrap it in `createRoot`.

- [ ] **Step 1: Update imports**

```ts
// before
import {
  type Accessor,
  children,
  createComputed,
  createRenderEffect,
  type JSXElement,
  mapArray,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js"

// after
import {
  type Accessor,
  children,
  createRenderEffect,
  type JSXElement,
  mapArray,
  onCleanup,
  untrack,
} from "solid-js"
import { omit } from "@solidjs/signals"
```

- [ ] **Step 2: Remove texture color space effect from `applyProp`**

The `createRenderEffect` at lines 261–275 of `applyProp` creates a reactive primitive from inside `applyProp`, which will be called from an effectFn in `useProps`. This is invalid in Solid 2.0 — and `createRoot` is not a valid fix because nothing owns the cleanup. Instead, **remove** the effect from `applyProp` entirely. The tracking will be moved to `useProps` in Step 4.

```ts
// Remove this entire block from applyProp (lines 261–275):
// if (
//   source[type] instanceof Texture &&
//   source[type].format === RGBAFormat &&
//   source[type].type === UnsignedByteType
// ) {
//   createRenderEffect(() => { ... })
// }
```

`applyProp` becomes a pure side-effectful function: it sets properties on THREE objects but no longer creates reactive computations.

- [ ] **Step 3: Migrate `useSceneGraph`**

`createComputed` is removed. Replace with `createRenderEffect` (split), nesting the per-child `createRenderEffect` in the compute phase. Preserve `props.onUpdate`.

```ts
// before
export const useSceneGraph = <T extends object>(
  _parent: AccessorMaybe<T | undefined>,
  props: { children?: JSXElement | JSXElement[]; onUpdate?(event: T): void },
) => {
  const c = children(() => props.children)
  createComputed(
    mapArray(
      () => c.toArray() as unknown as (Meta<object> | undefined)[],
      _child =>
        createComputed(() => {
          const parent = resolve(_parent)
          if (!parent) return
          const child = resolve(_child)
          if (!child) return
          applySceneGraph(parent, child)
          props.onUpdate?.(parent)
        }),
    ),
  )
}

// after
export const useSceneGraph = <T extends object>(
  _parent: AccessorMaybe<T | undefined>,
  props: { children?: JSXElement | JSXElement[]; onUpdate?(event: T): void },
) => {
  const c = children(() => props.children)
  createRenderEffect(
    () =>
      mapArray(
        () => c.toArray() as unknown as (Meta<object> | undefined)[],
        _child =>
          createRenderEffect(
            () => ({ parent: resolve(_parent), child: resolve(_child) }),
            ({ parent, child }) => {
              if (!parent || !child) return
              applySceneGraph(parent, child)
              untrack(() => props.onUpdate)?.(parent as T)
            },
          ),
      )(),   // call the mapArray accessor in compute to track the array
    () => {},
  )
}
```

- [ ] **Step 4: Migrate `useProps`**

`splitProps→omit`, then restructure the 4-level nesting so all child `createRenderEffect` calls are in compute phases:

```ts
// before
export function useProps<T extends Record<string, any>>(
  accessor: T | undefined | Accessor<T | undefined>,
  props: any,
  context: Pick<Context, "requestRender" | "gl" | "props"> = useThree(),
) {
  const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"])

  useSceneGraph(accessor, props)

  createRenderEffect(() => {
    const object = resolve(accessor)

    if (!object) return

    // Assign ref
    createRenderEffect(() => {
      if (local.ref instanceof Function) local.ref(object)
      else local.ref = object
    })

    // Apply the props to THREE-instance
    createRenderEffect(() => {
      const keys = Object.keys(instanceProps)
      for (const key of keys) {
        const subKeys = keys.filter(_key => key !== _key && _key.includes(key))
        createRenderEffect(() => {
          applyProp(context, object, key, props[key])
          for (const subKey of subKeys) {
            applyProp(context, object, subKey, props[subKey])
          }
        })
      }

      // NOTE: see "onUpdate should not update itself"-test
      untrack(() => props.onUpdate)?.(object)
    })
  })
}

// after
export function useProps<T extends Record<string, any>>(
  accessor: T | undefined | Accessor<T | undefined>,
  props: any,
  context: Pick<Context, "requestRender" | "gl" | "props"> = useThree(),
) {
  const instanceProps = omit(props, "ref", "args", "object", "attach", "children")

  useSceneGraph(accessor, props)

  createRenderEffect(
    () => {
      const object = resolve(accessor)
      if (!object) return undefined

      // Ref effect — created in compute phase ✓
      createRenderEffect(
        () => props.ref,
        ref => {
          if (ref instanceof Function) ref(object)
          else props.ref = object
        },
      )

      // Per-key prop effects — created in compute phase ✓
      createRenderEffect(
        () => {
          const keys = Object.keys(instanceProps)
          for (const key of keys) {
            const subKeys = keys.filter(_key => key !== _key && _key.includes(key))
            createRenderEffect(
              () => props[key],
              value => {
                applyProp(context, object, key, value)
                for (const subKey of subKeys) {
                  applyProp(context, object, subKey, props[subKey])
                }
              },
            )

            // Texture color space tracking — created in compute phase ✓
            // (was previously created inside applyProp's effectFn — invalid in Solid 2.0)
            createRenderEffect(
              () => {
                const value = props[key]
                if (
                  value instanceof Texture &&
                  value.format === RGBAFormat &&
                  value.type === UnsignedByteType
                ) {
                  return { texture: value as Texture, linear: context.props.linear, gl: context.gl }
                }
                return null
              },
              result => {
                if (!result) return
                const { texture, gl } = result
                if (hasColorSpace(texture) && hasColorSpace(gl)) {
                  texture.colorSpace = gl.outputColorSpace
                } else {
                  // @ts-expect-error TODO: fix type-error
                  texture.encoding = gl.outputEncoding
                }
              },
            )
          }
        },
        () => {},
      )

      return object
    },
    object => {
      // NOTE: see "onUpdate should not update itself"-test
      if (object) untrack(() => props.onUpdate)?.(object)
    },
  )
}
```

- [ ] **Step 5: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/props.ts"`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/props.ts
git commit -m "feat: migrate props.ts to Solid 2.0 (omit, split createRenderEffect, createRoot for texture)"
```

---

## Task 4: Migrate `src/hooks.ts`

**Files:**
- Modify: `src/hooks.ts`

- [ ] **Step 1: Update imports**

```ts
// before
import {
  type Accessor,
  createContext,
  createMemo,
  createResource,
  mergeProps,
  type Resource,
  useContext,
} from "solid-js"

// after
import {
  type Accessor,
  createContext,
  createMemo,
  useContext,
} from "solid-js"
import { merge } from "@solidjs/signals"
```

- [ ] **Step 2: Update `useLoader` signature and `mergeProps→merge`**

Change return type and replace `mergeProps`:

```ts
// before
export function useLoader<...>(...): Resource<LoadOutput<TLoader, TInput>> {
  const config = mergeProps({ cache: true }, options)

// after
export function useLoader<...>(...): Accessor<LoadOutput<TLoader, TInput>> {
  const config = merge({ cache: true }, options ?? {})
```

Note: `options ?? {}` prevents `merge` from treating a missing `options` argument as `undefined` which would not override the default.

- [ ] **Step 3: Replace `createResource` with `createMemo(async ...)`**

```ts
// before
const [resource] = createResource(
  () => [resolve(url), options?.base, loader()] as const,
  async ([url, base, loader]) => {
    config.onBeforeLoad?.(loader)
    url = base ? resolveUrls(base, url) : url
    const result = await loadUrl(url)
    config.onLoad?.(result)
    return result
  },
)

return resource

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

return resource
```

- [ ] **Step 4: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/hooks.ts"`

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/hooks.ts
git commit -m "feat: migrate hooks.ts to Solid 2.0 (async createMemo, merge)"
```

---

## Task 5: Migrate `src/components.tsx`

**Files:**
- Modify: `src/components.tsx`

- [ ] **Step 1: Update imports**

```ts
// before
import { whenMemo } from "@bigmistqke/solid-whenever"
import {
  Show,
  createEffect,
  createMemo,
  mergeProps,
  splitProps,
  type Accessor,
  type JSX,
  type JSXElement,
  type ParentProps,
} from "solid-js"

// after
import {
  Loading,
  Show,
  createMemo,
  type Accessor,
  type JSX,
  type JSXElement,
  type ParentProps,
} from "solid-js"
import { merge, omit } from "@solidjs/signals"
import { whenMemo } from "./utils.ts"
```

- [ ] **Step 2: Update `Portal` — `mergeProps→merge`**

```ts
// before (inside useProps call)
mergeProps(context, {
  get scene() {
    return element()
  },
})

// after
merge(context, {
  get scene() {
    return element()
  },
})
```

- [ ] **Step 3: Update `Entity` — `splitProps→omit`**

```ts
// before
export function Entity<T extends object | Constructor<object>>(props: EntityProps<T>) {
  const [config, rest] = splitProps(props, ["from", "args"])
  const memo = whenMemo(
    () => config.from,
    from => {
      props.key
      const instance = meta(
        isConstructor(from) ? autodispose(new from(...(config.args ?? []))) : from,
        { props },
      ) as Meta<T>
      useProps(instance, rest)
      return instance
    },
  )
  return memo as unknown as JSX.Element
}

// after
export function Entity<T extends object | Constructor<object>>(props: EntityProps<T>) {
  const rest = omit(props, "from", "args")
  const memo = whenMemo(
    () => props.from,
    from => {
      props.key
      const instance = meta(
        isConstructor(from) ? autodispose(new from(...(props.args ?? []))) : from,
        { props },
      ) as Meta<T>
      useProps(instance, rest)
      return instance
    },
  )
  return memo as unknown as JSX.Element
}
```

- [ ] **Step 4: Update `Resource` — `splitProps→omit`, `<Loading>`, remove debug `createEffect`**

The 3-way `splitProps` becomes `omit` (returning rest only) with direct prop access for the other fields:

```ts
// before
export function Resource<const TLoader extends Loader<object, any>>(props: ResourceProps<TLoader>) {
  const [options, config, rest] = splitProps(
    props,
    ["base", "cache", "onBeforeLoad", "onLoad"],
    ["loader", "url", "children"],
  )

  const resource = useLoader(
    () => config.loader,
    () => config.url,
    options,
  )

  createEffect(() => console.log("resource", resource()))

  useProps(resource, rest)

  return (
    <Show when={"children" in config && resource()} fallback={resource()}>
      {resource => props.children?.(resource)}
    </Show>
  )
}

// after
export function Resource<const TLoader extends Loader<object, any>>(props: ResourceProps<TLoader>) {
  const rest = omit(props, "base", "cache", "onBeforeLoad", "onLoad", "loader", "url", "children")

  const resource = useLoader(
    () => props.loader,
    () => props.url,
    {
      get base() { return props.base },
      get cache() { return props.cache },
      get onBeforeLoad() { return props.onBeforeLoad },
      get onLoad() { return props.onLoad },
    },
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

- [ ] **Step 5: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/components.tsx"`

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components.tsx
git commit -m "feat: migrate components.tsx to Solid 2.0 (omit, merge, Loading, whenMemo util)"
```

---

## Task 6: Migrate `src/create-three.tsx`

**Files:**
- Modify: `src/create-three.tsx`

- [ ] **Step 1: Update imports**

```ts
// before
import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  mergeProps,
  onCleanup,
} from "solid-js"

// after
import {
  children,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  onCleanup,
} from "solid-js"
import { merge } from "@solidjs/signals"
```

- [ ] **Step 2: Update context provider JSX (lines 409–415)**

```tsx
// before
const c = children(() => (
  <eventContext.Provider value={addEventListener}>
    <frameContext.Provider value={addFrameListener}>
      <threeContext.Provider value={context}>{canvasProps.children}</threeContext.Provider>
    </frameContext.Provider>
  </eventContext.Provider>
))

// after
const c = children(() => (
  <eventContext value={addEventListener}>
    <frameContext value={addFrameListener}>
      <threeContext value={context}>{canvasProps.children}</threeContext>
    </frameContext>
  </eventContext>
))
```

- [ ] **Step 3: Update `useSceneGraph` call — `mergeProps→merge` (line ~419)**

```ts
// before
useSceneGraph(
  context.scene,
  mergeProps(props, {
    get children() {
      return c()
    },
  }),
)

// after
useSceneGraph(
  context.scene,
  merge(props, {
    get children() {
      return c()
    },
  }),
)
```

- [ ] **Step 4: Update return value — `mergeProps→merge` (line ~428)**

```ts
// before
return mergeProps(context, { addFrameListener })

// after
return merge(context, { addFrameListener })
```

- [ ] **Step 5: Restructure the "Manage gl" `createRenderEffect` block (lines 321–373)**

This outer `createRenderEffect` nests two inner reactive calls (shadow + XR) in its body, which violates the compute/effectFn rule. Move all child effect creation into the compute phase:

```ts
// Replace the entire "Manage gl" block with:
createRenderEffect(
  () => {
    // Shadow map — child created in compute phase ✓
    createRenderEffect(
      () => ({
        enabled: !!props.shadows,
        type:
          typeof props.shadows === "string"
            ? ({ basic: BasicShadowMap, percentage: PCFShadowMap, soft: PCFSoftShadowMap, variance: VSMShadowMap } as const)[props.shadows] ?? PCFSoftShadowMap
            : PCFSoftShadowMap,
        shadowsObj: typeof props.shadows === "object" ? props.shadows : undefined,
        gl: gl(),
      }),
      ({ enabled, type, shadowsObj, gl: _gl }) => {
        if (!_gl.shadowMap) return
        const changed = _gl.shadowMap.enabled !== enabled || _gl.shadowMap.type !== type
        _gl.shadowMap.enabled = enabled
        if (shadowsObj) {
          Object.assign(_gl.shadowMap, shadowsObj)
        } else {
          _gl.shadowMap.type = type
        }
        if (changed) _gl.shadowMap.needsUpdate = true
      },
    )

    // XR connect — intentionally createEffect (DOM side effect, not render phase) ✓
    createEffect(
      () => gl(),
      renderer => {
        if (renderer.xr) context.xr.connect()
      },
    )

    // Color space and tone mapping
    const LinearEncoding = 3000
    const sRGBEncoding = 3001
    useProps(gl, {
      get outputEncoding() {
        return props.linear ? LinearEncoding : sRGBEncoding
      },
      get toneMapping() {
        return props.flat ? NoToneMapping : ACESFilmicToneMapping
      },
    })

    // User-supplied gl options object (must not drop this — handles props.gl={antialias:true} etc.)
    if (props.gl && !(props.gl instanceof WebGLRenderer)) {
      useProps(gl, props.gl)
    }
  },
  () => {},
)
```

- [ ] **Step 6: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/create-three.tsx"`

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/create-three.tsx
git commit -m "feat: migrate create-three.tsx to Solid 2.0 (merge, context providers, split gl effect)"
```

---

## Task 7: Migrate `src/canvas.tsx`

**Files:**
- Modify: `src/canvas.tsx`

- [ ] **Step 1: Update imports**

```ts
// before
import { onMount, type JSX, type ParentProps, type Ref } from "solid-js"

// after
import { createRoot, type JSX, type ParentProps, type Ref } from "solid-js"
import { onSettled } from "@solidjs/signals"
```

- [ ] **Step 2: Replace `onMount` with `onSettled` + `createRoot`**

```ts
// before
onMount(() => {
  const context = createThree(canvas, props)

  createResizeObserver(container, function onResize() {
    const { width, height } = container.getBoundingClientRect()
    context.gl.setSize(width, height)
    context.gl.setPixelRatio(globalThis.devicePixelRatio)

    if (context.camera instanceof OrthographicCamera) {
      context.camera.left = width / -2
      context.camera.right = width / 2
      context.camera.top = height / 2
      context.camera.bottom = height / -2
    } else {
      context.camera.aspect = width / height
    }

    context.camera.updateProjectionMatrix()
    context.render(performance.now())
  })
})

// after
onSettled(() => {
  createRoot(() => {
    const context = createThree(canvas, props)

    createResizeObserver(container, function onResize() {
      const { width, height } = container.getBoundingClientRect()
      context.gl.setSize(width, height)
      context.gl.setPixelRatio(globalThis.devicePixelRatio)

      if (context.camera instanceof OrthographicCamera) {
        context.camera.left = width / -2
        context.camera.right = width / 2
        context.camera.top = height / 2
        context.camera.bottom = height / -2
      } else {
        context.camera.aspect = width / height
      }

      context.camera.updateProjectionMatrix()
      context.render(performance.now())
    })
  })
  // createRoot autodisposes when the Canvas component's owner disposes
})
```

- [ ] **Step 3: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "src/canvas.tsx"`

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/canvas.tsx
git commit -m "feat: migrate canvas.tsx to Solid 2.0 (onSettled + createRoot)"
```

---

## Task 8: Migrate `src/utils/use-measure.ts`

**Files:**
- Modify: `src/utils/use-measure.ts`

This is the most structurally changed file. The `@bigmistqke/solid-whenever` primitives are inlined and the nested `createEffect` blocks are restructured to comply with the nesting-in-compute rule.

- [ ] **Step 1: Update imports**

```ts
// before
import { when, whenEffect } from "@bigmistqke/solid-whenever"
import { createEffect, createMemo, createSignal, mergeProps, onCleanup } from "solid-js"

// after
import { createMemo, createRenderEffect, createSignal, onCleanup } from "solid-js"
import { merge } from "@solidjs/signals"
```

- [ ] **Step 2: Replace `mergeProps` with `merge`**

```ts
// before
const config = mergeProps(
  {
    debounce: 0,
    scroll: false,
    offsetSize: false,
  },
  options,
)

// after
const config = merge(
  {
    debounce: 0,
    scroll: false,
    offsetSize: false,
  },
  options ?? {},
)
```

- [ ] **Step 3: Inline `when(element, ...)` as a plain function**

```ts
// before (lines 80–106)
const forceRefresh = when(element, element => {
  const { left, top, width, height, bottom, right, x, y } =
    element.getBoundingClientRect() as unknown as Measure

  const bounds = {
    left, top, width, height, bottom, right, x, y,
  }

  if (element instanceof HTMLElement && config.offsetSize) {
    bounds.height = element.offsetHeight
    bounds.width = element.offsetWidth
  }

  Object.freeze(bounds)

  if (!lastBounds || !areBoundsEqual(lastBounds, bounds)) {
    lastBounds = bounds
    setBounds(bounds)
  }
})

// after
function forceRefresh() {
  const el = element()
  if (!el) return

  const { left, top, width, height, bottom, right, x, y } =
    el.getBoundingClientRect() as unknown as Measure

  const bounds = {
    left, top, width, height, bottom, right, x, y,
  }

  if (el instanceof HTMLElement && config.offsetSize) {
    bounds.height = el.offsetHeight
    bounds.width = el.offsetWidth
  }

  Object.freeze(bounds)

  if (!lastBounds || !areBoundsEqual(lastBounds, bounds)) {
    lastBounds = bounds
    setBounds(bounds)
  }
}
```

- [ ] **Step 4: Replace scroll listener block (lines 108–133)**

The outer `createEffect` nested a `createEffect` and a `whenEffect` — both must become child `createRenderEffect` calls in a compute phase:

```ts
// before
createEffect(() => {
  const onScroll = getDebounce("scroll")

  createEffect(() => {
    if (!config.scroll) return
    globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true })
    onCleanup(() => globalThis.removeEventListener("scroll", onScroll, true))
  })

  whenEffect(scrollContainers, scrollContainers => {
    if (!config.scroll) return
    scrollContainers.forEach(scrollContainer =>
      scrollContainer.addEventListener("scroll", onScroll, {
        capture: true,
        passive: true,
      }),
    )
    onCleanup(() => {
      scrollContainers.forEach(element => {
        element.removeEventListener("scroll", onScroll, true)
      })
    })
  })
})

// after
createRenderEffect(
  () => {
    const onScroll = getDebounce("scroll")

    // Global scroll listener — child created in compute phase ✓
    createRenderEffect(
      () => config.scroll,
      scroll => {
        if (!scroll) return
        globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true })
        return () => globalThis.removeEventListener("scroll", onScroll, true)
      },
    )

    // Per-container scroll listeners — child created in compute phase ✓
    createRenderEffect(
      () => scrollContainers(),
      containers => {
        if (!config.scroll || !containers) return
        containers.forEach(c =>
          c.addEventListener("scroll", onScroll, { capture: true, passive: true }),
        )
        return () => containers.forEach(c => c.removeEventListener("scroll", onScroll, true))
      },
    )
  },
  () => {},
)
```

- [ ] **Step 5: Replace resize listener block (lines 135–146)**

```ts
// before
createEffect(() => {
  const onResize = getDebounce("resize")

  globalThis.addEventListener("resize", onResize)
  onCleanup(() => globalThis.removeEventListener("resize", onResize))

  whenEffect(element, element => {
    const observer = new ResizeObserver(onResize)
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  })
})

// after
// Global resize listener — tracks debounce config changes
createRenderEffect(
  () => getDebounce("resize"),
  onResize => {
    globalThis.addEventListener("resize", onResize)
    return () => globalThis.removeEventListener("resize", onResize)
  },
)

// Element resize observer — re-runs when element or debounce config changes
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

- [ ] **Step 6: Verify no errors in this file**

Run: `pnpm tsc --noEmit 2>&1 | grep "use-measure"`

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/utils/use-measure.ts
git commit -m "feat: migrate use-measure.ts to Solid 2.0 (inline whenever, split effects)"
```

---

## Task 9: Migrate `src/testing/index.tsx` + add `settled()`

**Files:**
- Modify: `src/testing/index.tsx`

- [ ] **Step 1: Update imports**

```ts
// before
import { type Accessor, type JSX, createRoot, mergeProps } from "solid-js"

// after
import { type Accessor, type JSX, createRoot } from "solid-js"
import { merge, onSettled } from "@solidjs/signals"
```

- [ ] **Step 2: Add `settled()` helper before the `test` function**

```ts
/**
 * Waits for the Solid reactive graph to fully settle (sync and async chains).
 * Use in tests: call `await settled()` after triggering reactive state changes
 * before making assertions.
 *
 * IMPORTANT: Do NOT call inside a reactive computation (createMemo, createEffect, etc.)
 * as onSettled fires when the sync graph settles — calling it inside an async memo
 * can produce infinite awaits.
 */
export function settled(): Promise<void> {
  return new Promise<void>(resolve => onSettled(() => resolve()))
}
```

- [ ] **Step 3: Update `test()` — all three `mergeProps` call sites**

```ts
// before
export function test(
  children: Accessor<JSX.Element>,
  props?: Omit<CanvasProps, "children">,
): TestApi {
  const canvas = createTestCanvas()
  let context: ReturnType<typeof createThree> = null!
  let unmount: () => void = null!

  createRoot(dispose => {
    unmount = dispose
    context = createThree(
      canvas,
      mergeProps(
        {
          get children() {
            return children()
          },
          camera: {
            position: [0, 0, 5] as [number, number, number],
          },
        },
        props,
      ),
    )
  })

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()))
    })

  return mergeProps(context, {
    unmount,
    waitTillNextFrame,
  })
}

// after
export function test(
  children: Accessor<JSX.Element>,
  props?: Omit<CanvasProps, "children">,
): TestApi {
  const canvas = createTestCanvas()
  let context: ReturnType<typeof createThree> = null!
  let unmount: () => void = null!

  createRoot(dispose => {
    unmount = dispose
    context = createThree(
      canvas,
      merge(
        {
          get children() {
            return children()
          },
          camera: {
            position: [0, 0, 5] as [number, number, number],
          },
        },
        props ?? {},
      ),
    )
  })

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()))
    })

  return merge(context, {
    unmount,
    waitTillNextFrame,
  })
}
```

- [ ] **Step 4: Full TypeScript check — all source files**

Run: `pnpm tsc --noEmit`

Expected: zero errors. If errors remain, fix them before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/testing/index.tsx
git commit -m "feat: migrate testing/index.tsx to Solid 2.0 (merge, settled helper)"
```

---

## Task 10: Fix tests

**Files:**
- Modify: `tests/core/renderer.test.tsx`
- Modify: `tests/core/hooks.test.tsx`
- Modify: `tests/core/events.test.tsx`
- Modify: `tests/web/canvas.test.tsx`

In Solid 2.0, signal writes are microtask-batched. Tests that write a signal and immediately assert will see stale values. Every `setX(...)` followed by an `expect(...)` needs `await settled()` between them.

Also: `@solidjs/testing-library`'s Solid 2.0 version no longer puts `unmount()` on the render return value — use the standalone `cleanup()` import instead.

- [ ] **Step 1: Update imports**

```ts
// before
import {
  type ComponentProps,
  createRenderEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import { test } from "../../src/testing/index.tsx"

// after
import {
  type ComponentProps,
  createRenderEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js"
import { onSettled } from "@solidjs/signals"
import { settled, test } from "../../src/testing/index.tsx"
```

- [ ] **Step 2: Fix `onMount` in the "does the full lifecycle" test (~line 300)**

```ts
// before
const Log = props => {
  onMount(() => log.push("mount " + props.name))
  onCleanup(() => log.push("unmount " + props.name))
  log.push("render " + props.name)
  return <T.Group />
}

const { unmount: dispose } = test(() => <Log name="Foo" />)

dispose()

expect(log).toEqual(["render Foo", "mount Foo", "unmount Foo"])

// after
const Log = props => {
  onSettled(() => log.push("mount " + props.name))
  onCleanup(() => log.push("unmount " + props.name))
  log.push("render " + props.name)
  return <T.Group />
}

const { unmount: dispose } = test(() => <Log name="Foo" />)

await settled()  // wait for onSettled to fire before disposing

dispose()

expect(log).toEqual(["render Foo", "mount Foo", "unmount Foo"])
```

- [ ] **Step 3: Add `await settled()` after all signal writes in tests**

Search the file for patterns of setter followed by assertion:

```bash
grep -n "set[A-Z]" tests/core/renderer.test.tsx
```

For every `setX(...)` call that is followed (directly or after a few lines) by `expect(...)` or other assertions, add `await settled()` on the line between. Common occurrences:

- `setType("MeshStandardMaterial")` → add `await settled()` before assertions
- `setFirst(false)` → add `await settled()` before assertions
- `setVisible(false)` → add `await settled()` before assertions
- Any other `set*` calls followed by assertions

- [ ] **Step 4: Check `<For>` usage**

In Solid 2.0, `<For>` child callbacks receive **accessors**: `(item, index) => item()` not `item`. Search for `<For` in the test file and update any that use `item` or `index` directly (not as function calls):

```bash
grep -n "<For" tests/core/renderer.test.tsx
```

Update each occurrence where the callback uses `item` or `index` without calling them.

- [ ] **Step 5: Run tests and fix remaining failures**

Run: `pnpm test`

Expected: tests run. Analyze any failures:
- Assertion failures with stale values → missing `await settled()`
- Unexpected async timeout → wrong settled() placement
- Type errors → check imports

Fix until green.

- [ ] **Step 6: Fix `tests/web/canvas.test.tsx` — `renderer.unmount()` → `cleanup()`**

`@solidjs/testing-library` Solid 2.0 no longer attaches `.unmount()` to the render result. Use the standalone `cleanup()` import:

```ts
// before
import { render } from "@solidjs/testing-library"
// ...
expect(() => renderer.unmount()).not.toThrow()

// after
import { cleanup, render } from "@solidjs/testing-library"
// ...
expect(() => cleanup()).not.toThrow()
```

- [ ] **Step 7: Fix `tests/core/hooks.test.tsx` and `tests/core/events.test.tsx`**

Apply the same pattern as `renderer.test.tsx`: search for `set*` calls followed by assertions, add `await settled()` between them. Add `import { settled } from "../../src/testing/index.tsx"` to each file that needs it.

- [ ] **Step 8: Run all tests and fix remaining failures**

Run: `pnpm test`

Fix until all pass.

- [ ] **Step 9: Commit**

```bash
git add tests/
git commit -m "feat: migrate all tests to Solid 2.0 (onSettled, settled(), cleanup())"
```

---

## Final verification

- [ ] Run: `pnpm tsc --noEmit` → zero errors
- [ ] Run: `pnpm test` → all tests pass
- [ ] Verify no banned imports remain:

```bash
grep -r "from \"solid-js\"" src/ | grep -E "mergeProps|splitProps|createComputed|createResource|onMount|batch"
grep -r "solid-whenever" src/
grep -r "flush()" src/
```

Expected: no output from any of the three commands.
