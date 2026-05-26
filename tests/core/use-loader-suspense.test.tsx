import { render } from "@solidjs/testing-library"
import { Suspense } from "solid-js"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { Canvas, createT, useLoader } from "../../src/index.ts"
import type { RendererLike } from "../../src/types.ts"

const T = createT(THREE)

class MockTexture extends THREE.Texture {
  url: string
  constructor(url: string) {
    super()
    this.url = url
  }
}
class MockTextureLoader extends THREE.Loader<MockTexture, string> {
  load(
    url: string,
    onLoad: (texture: MockTexture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    _onError?: (err: unknown) => void,
  ): void {
    setTimeout(() => onLoad(new MockTexture(url)), 10)
  }
}

const fakeRenderer = (): RendererLike => ({
  render: () => {},
  setSize: () => {},
  setPixelRatio: () => {},
  getPixelRatio: () => 1,
  domElement: document.createElement("canvas"),
})

/**
 * Regression: previously a `useLoader` resource read into a `<T.* />` prop
 * inside `<Suspense>` (without an explicit `fallback`) raised
 * "S3: Hooks can only be used within the Canvas component!" once the resource
 * resolved.
 *
 * Root cause was solid-three's createThree passing children to `useSceneGraph`
 * via `mergeProps(props, { get children() { return c() }})`. When `c()`
 * resolved to `undefined`, mergeProps' fallback chain reached the user's raw
 * `<Canvas>` JSX children getter and invoked it again — spawning a fresh
 * Suspense in an owner without solid-three's contexts. The fix drops the
 * mergeProps wrapper; useSceneGraph only needs `children`, so a plain object
 * literal with the override is enough.
 */
describe("useLoader inside Suspense", () => {
  it("does not throw 'outside <Canvas/>' when the resource resolves", async () => {
    let invocations = 0
    function TexturedCube() {
      invocations++
      const texture = useLoader(MockTextureLoader, "https://example.com/image.png")
      return (
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshBasicMaterial map={texture() as unknown as THREE.Texture | null} />
        </T.Mesh>
      )
    }

    const windowErrors: string[] = []
    const onError = (event: ErrorEvent) => {
      windowErrors.push(event.error?.message ?? event.message)
      event.preventDefault()
    }
    window.addEventListener("error", onError)
    try {
      render(() => (
        <Canvas
          gl={() => fakeRenderer()}
          camera={{ position: [0, 0, 3] as [number, number, number] }}
        >
          <Suspense>
            <TexturedCube />
          </Suspense>
        </Canvas>
      ))
      await new Promise(r => setTimeout(r, 100))
    } finally {
      window.removeEventListener("error", onError)
    }

    // The user's component must be instantiated exactly once. Prior to the
    // fix it was instantiated twice — once inside the proper Provider tree
    // and once in a context-stripped owner where `useThree` would throw.
    expect(invocations).toBe(1)
    expect(windowErrors.filter(e => e.includes("Hooks can only be used"))).toEqual([])
  })
})
