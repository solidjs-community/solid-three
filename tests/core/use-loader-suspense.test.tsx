import { render } from "@solidjs/testing-library"
import { Suspense } from "solid-js"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { Canvas, createT, useLoader, useThree } from "../../src/index.ts"
import type { Context, RendererLike } from "../../src/types.ts"

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

describe("useLoader inside Suspense", () => {
  /**
   * Regression: previously a `useLoader` resource read into a `<T.* />` prop
   * inside `<Suspense>` (without an explicit `fallback`) raised
   * "S3: Hooks can only be used within the Canvas component!" once the resource
   * resolved.
   *
   * Root cause: createThree wrapped useSceneGraph's props in
   * `mergeProps(props, { get children() { return c() }})`. When `c()`
   * resolved to `undefined`, mergeProps' fallback chain reached the user's
   * raw `<Canvas>` JSX children getter and invoked it again — spawning a
   * fresh Suspense in an owner without solid-three's contexts. The fix
   * drops the mergeProps wrapper.
   */
  it("does not throw 'outside <Canvas/>' when the resource resolves (no fallback)", async () => {
    let invocations = 0
    let captured: Context | undefined
    function CaptureContext() {
      captured = useThree()
      return null
    }
    function TexturedCube() {
      invocations++
      const texture = useLoader(MockTextureLoader, "https://example.com/image.png")
      return (
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshBasicMaterial map={texture()} />
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
          <CaptureContext />
          <Suspense>
            <TexturedCube />
          </Suspense>
        </Canvas>
      ))
      // While pending: scene should not contain TexturedCube's mesh yet.
      // (Suspense hasn't released its children to the scene graph.)
      expect(captured?.scene.children.filter(c => c instanceof THREE.Mesh)).toEqual([])

      // Let the loader's setTimeout fire and the reactive chain settle.
      await new Promise(r => setTimeout(r, 50))
    } finally {
      window.removeEventListener("error", onError)
    }

    // After resolve: exactly one Mesh in the scene.
    const meshes = captured?.scene.children.filter(c => c instanceof THREE.Mesh) ?? []
    expect(meshes).toHaveLength(1)
    // The user's component must be instantiated exactly once. Prior to the
    // fix it was instantiated twice — once inside the proper Provider tree
    // and once in a context-stripped owner where `useThree` would throw.
    expect(invocations).toBe(1)
    expect(windowErrors.filter(e => e.includes("Hooks can only be used"))).toEqual([])
  })

  it("shows the fallback while pending and the content after resolve", async () => {
    let captured: Context | undefined
    function CaptureContext() {
      captured = useThree()
      return null
    }
    function TexturedCube() {
      const texture = useLoader(MockTextureLoader, "https://example.com/cube.png")
      return (
        <T.Mesh name="content">
          <T.BoxGeometry />
          <T.MeshBasicMaterial map={texture()} />
        </T.Mesh>
      )
    }

    render(() => (
      <Canvas
        gl={() => fakeRenderer()}
        camera={{ position: [0, 0, 3] as [number, number, number] }}
      >
        <CaptureContext />
        <Suspense fallback={<T.Mesh name="fallback" />}>
          <TexturedCube />
        </Suspense>
      </Canvas>
    ))

    const names = () => captured?.scene.children.map(c => c.name) ?? []

    // While pending: fallback mesh is in the scene, content is not.
    expect(names()).toContain("fallback")
    expect(names()).not.toContain("content")

    await new Promise(r => setTimeout(r, 50))

    // After resolve: content is in the scene, fallback is gone.
    expect(names()).toContain("content")
    expect(names()).not.toContain("fallback")
  })
})
