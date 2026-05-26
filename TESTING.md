## Testing

`solid-three` ships a small testing API (`solid-three/testing`) that mounts a real `<canvas>` and creates a `solid-three` root against it. It is **browser-only** — run your tests in a real browser (e.g. [vitest browser mode](https://vitest.dev/guide/browser/) with Playwright + Chromium). jsdom is not supported.

### Setup and Basic Testing

```tsx
import { test, TestCanvas, cleanup } from "solid-three/testing"
import { render } from "@solidjs/testing-library"
import { afterEach } from "vitest"

// Browsers cap concurrent WebGL contexts (~16 in Chromium). Wire `cleanup()`
// into `afterEach` so each test frees its renderer.
afterEach(() => cleanup())

it("renders a mesh", () => {
  const scene = test(() => (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshBasicMaterial />
    </T.Mesh>
  ))

  expect(scene.scene.children).toHaveLength(1)
})

// Or use TestCanvas as JSX
it("renders with TestCanvas", () => {
  render(() => (
    <TestCanvas camera={{ position: [0, 0, 5] }}>
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </TestCanvas>
  ))
})
```

### Testing Events

Dispatch real `MouseEvent`/`PointerEvent`s. The test canvas is mounted at the
top-left of the document body, so `clientX`/`clientY` map 1:1 to canvas
`offsetX`/`offsetY` (which `CursorRaycaster` reads).

```tsx
import { fireEvent } from "@solidjs/testing-library"

it("handles click events", () => {
  let clicked = false
  const { canvas } = test(() => (
    <T.Mesh onClick={() => (clicked = true)}>
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  ))

  fireEvent(canvas, new MouseEvent("click", { clientX: 640, clientY: 400, bubbles: true }))
  expect(clicked).toBe(true)
})
```

### Testing Hooks

```tsx
import { test } from "solid-three/testing"
import { useThree } from "solid-three"

it("useThree returns context", () => {
  let context
  const TestComponent = () => {
    context = useThree()
    return <T.Mesh><T.BoxGeometry /><T.MeshBasicMaterial /></T.Mesh>
  }

  test(() => <TestComponent />)

  expect(context.camera).toBeDefined()
  expect(context.gl).toBeDefined()
  expect(context.scene).toBeDefined()
})
```

### Testing Animations

```tsx
import { test } from "solid-three/testing"
import { useFrame } from "solid-three"

it("animates on frame", async () => {
  let rotation = 0
  const AnimatedBox = () => {
    useFrame(() => { rotation += 0.01 })
    return <T.Mesh />
  }

  const scene = test(() => <AnimatedBox />, { frameloop: "always" })
  await scene.waitTillNextFrame()
  expect(rotation).toBeGreaterThan(0)
})
```

### Recommended vitest browser config

This repo's own `vitest.config.ts` is a good reference. Key bits:

```ts
import { playwright } from "@vitest/browser-playwright"

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Real WebGL contexts are GPU-process-limited (~16 in Chromium).
    // Running test files in parallel exhausts the cap and hangs the browser.
    fileParallelism: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: "chromium",
          // SwiftShader = software WebGL. Removes Chromium's GPU-process
          // context cap so renderer-heavy suites don't crash mid-run.
          launch: {
            args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
          },
        },
      ],
    },
  },
})
```
