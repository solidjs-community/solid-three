# Design: Migrate Tests from vitest/jsdom to vitest/browser (Playwright)

**Date:** 2026-04-14
**Status:** Approved

## Goal

Run the existing test suite in a real Chromium browser via `@vitest/browser` + Playwright, replacing the jsdom environment. This eliminates the need to mock WebGL — Three.js gets a real `WebGLRenderingContext`. All assertions remain JS-level (no screenshot/pixel testing in scope).

## Approach

Use `@vitest/browser` with the Playwright provider. Tests keep the same `describe`/`it`/`expect` structure and run inside a real Chromium tab. Vitest reports results back to the terminal over a websocket. No Node↔browser boundary to serialize across — `expect(scene.children[0].type)` etc. work identically, just in the browser runtime.

## Changes

### `vitest.config.ts`

Replace `environment: "jsdom"` and `setupFiles` with browser mode:

```ts
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
      headless: true,
    },
  },
})
```

### `src/canvas.tsx`

`Canvas` declares `ref?: Ref<Context>` in its props but does not currently call it. Add a `useRef(props, context)` call (the same pattern `TestCanvas` already uses) so callers can receive the context.

### `src/testing/index.tsx`

- Remove `createTestCanvas` — it existed solely for WebGL mocking and the non-DOM fallback, neither of which is needed in a real browser.
- Remove the `WebGL2RenderingContext` import.
- Rewrite `test()` to render `<Canvas>` into a sized container appended to `document.body`. This is closer to real usage: actual `Canvas` component, real DOM layout, real `ResizeObserver`.
- `TestCanvas` becomes a thin wrapper around `<Canvas>`.
- Public API signatures (`test`, `settled`, `TestCanvas`) are unchanged — external consumers are not broken at import level.

`test()` sketch:
```ts
export async function test(children, props) {
  const container = document.createElement("div")
  Object.assign(container.style, { width: "1280px", height: "800px" })
  document.body.appendChild(container)

  let context: Context = null!

  await new Promise<void>(resolve => {
    createRoot(dispose => {
      unmount = dispose
      onSettled(() => resolve())
      solidRender(() => (
        <Canvas ref={context} {...props}>
          {children()}
        </Canvas>
      ), container)
    })
  })

  const waitTillNextFrame = () =>
    new Promise<void>(resolve => {
      const cleanup = context.addFrameListener(() => (cleanup(), resolve()))
    })

  return merge(context, {
    unmount: () => { unmount(); container.remove() },
    waitTillNextFrame,
  })
}
```

### `src/testing/webgl2-rendering-context.ts`

Kept. No longer used internally but preserved for external consumers who still use jsdom.

### `tests/setup.ts`

Kept. Removed from `setupFiles` in vitest config (the `ResizeObserver` polyfill is unnecessary in a real browser).

### Snapshot file

Delete the existing snapshot for `canvas.test.tsx`. The DOM structure changes slightly because `TestCanvas` now delegates to `<Canvas>` (different wrapper div styles). Vitest regenerates it on first run.

### Test files (`tests/**`)

No changes.

### `libs/testing-library.ts`

No changes.

## Packages to add

```
pnpm add -D @vitest/browser playwright
npx playwright install chromium
```

## What is NOT in scope

- Screenshot / pixel-level assertions
- External consumer migration (jsdom compat layer)
- Changes to any test assertions
