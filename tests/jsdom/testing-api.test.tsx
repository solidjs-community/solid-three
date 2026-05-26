import { render } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it } from "vitest"
import { createT } from "../../src/index.ts"
import { test as createTest, TestCanvas } from "../../src/testing/index.tsx"

const T = createT(THREE)

/**
 * Contract suite for the public `solid-three/testing` API. The rest of the
 * suite runs in real Chromium (vitest browser mode), but `src/testing/` is
 * shipped specifically for *external* consumers writing jsdom-based tests —
 * so we keep one tiny suite that runs under jsdom to catch bitrot in that
 * code path (the `WebGL2RenderingContext` mock, the prototype override of
 * `HTMLCanvasElement.getContext`, the `getBoundingClientRect` shim).
 */
describe("solid-three/testing under jsdom", () => {
  it("test() mounts a scene and returns a usable context", () => {
    const scene = createTest(() => (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    expect(scene.scene.children).toHaveLength(1)
    expect(scene.scene.children[0]).toBeInstanceOf(THREE.Mesh)
    expect(scene.camera).toBeInstanceOf(THREE.Camera)
    expect(scene.gl).toBeDefined()

    scene.unmount()
  })

  it("TestCanvas renders a container element with a canvas inside", () => {
    const { container } = render(() => (
      <TestCanvas>
        <T.Group />
      </TestCanvas>
    ))
    expect(container.querySelector("canvas")).toBeTruthy()
  })

  it("installs a WebGL2 mock context so getContext('webgl2') works under jsdom", () => {
    createTest(() => <T.Group />)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("webgl2")
    expect(ctx).toBeTruthy()
  })
})
