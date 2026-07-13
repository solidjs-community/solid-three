import { getVoidObject } from "@pmndrs/pointer-events"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { pointerEvents } from "../../src/events/index.ts"
import { pmndrsEvents } from "../../src/events-pmndrs/index.ts"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"
import type { CameraKind } from "../../src/types.ts"
import {
  CANVAS_CENTRE_X,
  CANVAS_CENTRE_Y,
  clickAt,
  clickCanvasCentre,
} from "../utils/pointer-utils.ts"

/**
 * Every assertion here waits a frame first. pmndrs BATCHES its native events and flushes
 * them only when `update()` runs — which this engine drives from
 * `Context.addFrameListener`. Nothing has dispatched until a frame has passed, so
 * `waitTillNextFrame()` is not incidental sequencing: it is the engine's dispatch tick.
 */

/** Where the pmndrs mesh sits, clear of the reference mesh at the origin. */
const OFFSET_MESH_X = 3

/** Where a world-space point lands in client coordinates, through the live camera. */
function projectToClient(canvas: HTMLCanvasElement, camera: CameraKind, point: THREE.Vector3) {
  const ndc = point.clone().project(camera)
  const { left, top, width, height } = canvas.getBoundingClientRect()
  return {
    clientX: left + ((ndc.x + 1) / 2) * width,
    clientY: top + ((1 - ndc.y) / 2) * height,
  }
}

describe("pmndrs engine", () => {
  it("dispatches a click through nothing but the public boundary", async () => {
    const T = createT(THREE, [pmndrsEvents()])
    const clicked = vi.fn()

    const { canvas, waitTillNextFrame } = test(() => (
      <T.Mesh onClick={clicked}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))
    await waitTillNextFrame()

    clickCanvasCentre(canvas)
    await waitTillNextFrame()

    expect(clicked).toHaveBeenCalledTimes(1)
  })

  it("reports empty space on the void OBJECT, not a canvas prop", async () => {
    const T = createT(THREE, [pmndrsEvents()])
    const missed = vi.fn()
    const hit = vi.fn()

    // The mesh is parked far off-screen, so the centre click hits nothing. pmndrs still
    // produces an intersection — with the VOID object — and dispatches `click` there.
    const { canvas, scene, waitTillNextFrame } = test(() => (
      <T.Mesh position={[100, 100, 0]} onClick={hit}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))
    getVoidObject(scene).addEventListener("click", missed)
    await waitTillNextFrame()

    clickCanvasCentre(canvas)
    await waitTillNextFrame()

    expect(missed).toHaveBeenCalledTimes(1)
    expect(hit).not.toHaveBeenCalled()
  })

  it("co-exists with the reference engine without corrupting it", async () => {
    const reference = pointerEvents()
    const pmndrs = pmndrsEvents()
    const TReference = createT(THREE, [reference])
    const TPmndrs = createT(THREE, [pmndrs])
    const T = createT(THREE)
    const referenceClicked = vi.fn()
    const pmndrsClicked = vi.fn()

    // ONE canvas, BOTH engines. Each mesh carries the handler prop contributed by its own
    // engine, and each engine partitions by provenance: the reference engine raycasts only
    // its own registry, while pmndrs only ever targets objects carrying ITS listeners.
    const { canvas, camera, waitTillNextFrame } = test(
      () => (
        <>
          <TReference.Mesh onClick={referenceClicked}>
            <T.BoxGeometry args={[2, 2]} />
            <T.MeshBasicMaterial />
          </TReference.Mesh>
          <TPmndrs.Mesh position={[OFFSET_MESH_X, 0, 0]} onClick={pmndrsClicked}>
            <T.BoxGeometry args={[2, 2]} />
            <T.MeshBasicMaterial />
          </TPmndrs.Mesh>
        </>
      ),
      { plugins: [reference, pmndrs] },
    )
    await waitTillNextFrame()

    // Importing pmndrs has already patched `Object3D.prototype` process-globally. The
    // reference engine keeps captures in its own registry and never consults the
    // prototype, so its dispatch is untouched — that is what this asserts.
    clickCanvasCentre(canvas)
    await waitTillNextFrame()

    expect(referenceClicked).toHaveBeenCalledTimes(1)
    expect(pmndrsClicked).not.toHaveBeenCalled()

    const offset = projectToClient(canvas, camera, new THREE.Vector3(OFFSET_MESH_X, 0, 0))
    clickAt(canvas, offset.clientX, offset.clientY)
    await waitTillNextFrame()

    expect(pmndrsClicked).toHaveBeenCalledTimes(1)
    expect(referenceClicked).toHaveBeenCalledTimes(1) // still exactly the one from before

    // Sanity: the centre click really was inside the reference mesh and outside the
    // pmndrs one, so the two assertions above are about provenance, not geometry.
    expect(CANVAS_CENTRE_X).not.toBeCloseTo(offset.clientX, 0)
    expect(CANVAS_CENTRE_Y).toBeCloseTo(offset.clientY, 0)
  })
})
