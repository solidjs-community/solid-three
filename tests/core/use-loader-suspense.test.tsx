import { render as solidRender } from "@solidjs/web"
import { Loading, type Element } from "solid-js"
import { afterEach } from "vitest"

// Minimal inline replacement for @solidjs/testing-library's render. The library
// (v0.8.10) imports from `solid-js/web`, a subpath Solid 2 doesn't expose
// (it moved to `@solidjs/web`). Until a Solid-2-compatible release ships, we
// drive the renderer directly and clean up between tests.
const mountedContainers: { container: HTMLElement; unmount: () => void }[] = []
function render(code: () => Element) {
  const container = document.body.appendChild(document.createElement("div"))
  const dispose = solidRender(code, container)
  const handle = { container, unmount: dispose }
  mountedContainers.push(handle)
  return handle
}
afterEach(() => {
  for (const { container, unmount } of mountedContainers.splice(0)) {
    unmount()
    container.remove()
  }
})
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

describe("useLoader inside Loading", () => {
  /**
   * Regression: previously a `useLoader` resource read into a `<T.* />` prop
   * inside `<Loading>` (without an explicit `fallback`) raised
   * "S3: Hooks can only be used within the Canvas component!" once the resource
   * resolved.
   *
   * Root cause: createThree wrapped useSceneGraph's props in
   * `merge(props, { get children() { return c() }})`. When `c()`
   * resolved to `undefined`, merge's fallback chain reached the user's
   * raw `<Canvas>` JSX children getter and invoked it again — spawning a
   * fresh Loading in an owner without solid-three's contexts. The fix
   * drops the merge wrapper.
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
          <CaptureContext />
          <Loading>
            <TexturedCube />
          </Loading>
        </Canvas>
      ))
      // While pending: scene should not contain TexturedCube's mesh yet.
      // (Loading hasn't released its children to the scene graph.)
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
          <T.MeshBasicMaterial map={texture() as unknown as THREE.Texture | null} />
        </T.Mesh>
      )
    }

    render(() => (
      <Canvas
        gl={() => fakeRenderer()}
        camera={{ position: [0, 0, 3] as [number, number, number] }}
      >
        <CaptureContext />
        <Loading fallback={<T.Mesh name="fallback" />}>
          <TexturedCube />
        </Loading>
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
