import { fireEvent } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { pointerEvents } from "../../src/events/index.ts"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"
import { clickCanvasCentre, makeClickAt } from "../utils/pointer-utils.ts"

const T = createT(THREE, [pointerEvents()])

describe("events", () => {
  it("can handle onPointerDown", async () => {
    const handlePointerDown = vi.fn()

    const { canvas } = test(() => (
      <T.Mesh onPointerDown={handlePointerDown}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointerdown", { clientX: 640, clientY: 400, pointerId: 1, bubbles: true }),
    )

    expect(handlePointerDown).toHaveBeenCalled()
  })

  // TODO:  implement onPointerMissed-api
  // NOTE:  unsure if/how we should implement onPointerMissed
  //        the heuristics are unclear imo

  // it("can handle onPointerMissed", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = test(() => (
  //     <T.Mesh onPointerMissed={handleMissed} onClick={handleClick}>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 0 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 0 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).not.toHaveBeenCalled();
  //   expect(handleMissed).toHaveBeenCalledWith(evt);
  // });

  // TODO:  implement onPointerMissed-api

  // it("should not fire onPointerMissed when same element is clicked", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = test(() => (
  //     <T.Mesh onPointerMissed={handleMissed} onClick={handleClick}>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const down = new Event("pointerdown");
  //   Object.defineProperty(down, "offsetX", { get: () => 577 });
  //   Object.defineProperty(down, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, down);

  //   const up = new Event("pointerup");
  //   Object.defineProperty(up, "offsetX", { get: () => 577 });
  //   Object.defineProperty(up, "offsetY", { get: () => 480 });

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 577 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).toHaveBeenCalled();
  //   expect(handleMissed).not.toHaveBeenCalled();
  // });

  // TODO:  implement onPointerMissed-api

  // it("should not fire onPointerMissed on parent when child element is clicked", async () => {
  //   const handleClick = vi.fn();
  //   const handleMissed = vi.fn();

  //   const { canvas } = test(() => (
  //     <T.Group onPointerMissed={handleMissed}>
  //       <T.Mesh onClick={handleClick}>
  //         <T.BoxGeometry args={[2, 2]} />
  //         <T.MeshBasicMaterial />
  //       </T.Mesh>
  //     </T.Group>
  //   ));

  //   const down = new Event("pointerdown");
  //   Object.defineProperty(down, "offsetX", { get: () => 577 });
  //   Object.defineProperty(down, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, down);

  //   const up = new Event("pointerup");
  //   Object.defineProperty(up, "offsetX", { get: () => 577 });
  //   Object.defineProperty(up, "offsetY", { get: () => 480 });

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 577 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 480 });

  //   fireEvent(canvas, evt);

  //   expect(handleClick).toHaveBeenCalled();
  //   expect(handleMissed).not.toHaveBeenCalled();
  // });

  // TODO:  implement onPointerMissed-api

  // it("can handle onPointerMissed on Canvas", async () => {
  //   const handleMissed = vi.fn();

  //   const { canvas } = test(() => (
  //     <T.Mesh>
  //       <T.BoxGeometry args={[2, 2]} />
  //       <T.MeshBasicMaterial />
  //     </T.Mesh>
  //   ));

  //   const evt = new MouseEvent("click");
  //   Object.defineProperty(evt, "offsetX", { get: () => 0 });
  //   Object.defineProperty(evt, "offsetY", { get: () => 0 });

  //   fireEvent(canvas, evt);
  //   expect(handleMissed).toHaveBeenCalledWith(evt);
  // });

  it("can handle onPointerMove", async () => {
    const handlePointerMove = vi.fn()
    const handlePointerEnter = vi.fn()
    const handlePointerOut = vi.fn()

    const { canvas } = test(() => (
      <T.Mesh
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointermove", { clientX: 577, clientY: 480, bubbles: true }),
    )

    expect(handlePointerMove).toHaveBeenCalled()
    expect(handlePointerEnter).toHaveBeenCalled()

    fireEvent(canvas, new PointerEvent("pointermove", { clientX: 0, clientY: 0, bubbles: true }))

    expect(handlePointerOut).toHaveBeenCalled()
  })

  it("should handle stopPropogation", async () => {
    // onPointerEnter/Leave are non-stoppable (DOM-like behavior)
    const handlePointerEnter = vi.fn()
    const handlePointerLeave = vi.fn()

    const { canvas } = test(() => (
      <>
        <T.Mesh onPointerLeave={handlePointerLeave} onPointerEnter={handlePointerEnter}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-z={3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    fireEvent(
      canvas,
      new PointerEvent("pointermove", { clientX: 577, clientY: 480, bubbles: true }),
    )

    expect(handlePointerEnter).toHaveBeenCalled()

    fireEvent(canvas, new PointerEvent("pointermove", { clientX: 0, clientY: 0, bubbles: true }))

    expect(handlePointerLeave).toHaveBeenCalled()
  })

  it("should handle stopPropagation on click events", async () => {
    const handleClickFront = vi.fn(e => e.stopPropagation())
    const handleClickRear = vi.fn()

    const { canvas } = test(() => (
      <>
        <T.Mesh onClick={handleClickFront}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh onClick={handleClickRear} position-z={-3}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))

    const at = { clientX: 577, clientY: 480, bubbles: true }
    fireEvent(canvas, new PointerEvent("pointerdown", at))
    fireEvent(canvas, new PointerEvent("pointerup", at))
    fireEvent(canvas, new MouseEvent("click", at))

    expect(handleClickFront).toHaveBeenCalled()
    expect(handleClickRear).not.toHaveBeenCalled()
  })
})

/**********************************************************************************/
/*                                                                                */
/*                           Mesh-level onPointerMissed                           */
/*                                                                                */
/**********************************************************************************/

// HIT_X/HIT_Y match CANVAS_CENTRE_X/CANVAS_CENTRE_Y from tests/utils/pointer-utils.ts —
// where a 2×2 BoxGeometry centred at the origin sits, camera at z=5.
const MISS_X = 0
const MISS_Y = 0

describe("mesh onPointerMissed", () => {
  it("fires when a click misses the mesh", async () => {
    const handleMissed = vi.fn()

    const { canvas } = await test(() => (
      <T.Mesh onPointerMissed={handleMissed}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(canvas, makeClickAt(MISS_X, MISS_Y))

    expect(handleMissed).toHaveBeenCalledTimes(1)
  })

  it("does not fire when the mesh itself is clicked", async () => {
    const handleMissed = vi.fn()

    const { canvas } = await test(() => (
      <T.Mesh onPointerMissed={handleMissed}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    clickCanvasCentre(canvas)

    expect(handleMissed).not.toHaveBeenCalled()
  })

  it("fires when a different mesh in the scene is clicked", async () => {
    const handleMissed = vi.fn()

    // Mesh A: off-center (far right), has onPointerMissed.
    // Mesh B: at origin (center of screen), registered and gets clicked.
    const { canvas, waitTillNextFrame } = await test(() => (
      <>
        <T.Mesh onPointerMissed={handleMissed} position-x={100}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh onClick={() => {}}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))
    await waitTillNextFrame() // A's position only reaches the raycaster after a frame

    clickCanvasCentre(canvas) // hits B; A is off to the side

    expect(handleMissed).toHaveBeenCalledTimes(1) // A wasn't hit → it hears that B was
  })

  it("does not fire on a parent when its child is clicked", async () => {
    const handleParentMissed = vi.fn()
    const handleChildClick = vi.fn()

    const { canvas } = await test(() => (
      <T.Group onPointerMissed={handleParentMissed}>
        <T.Mesh onClick={handleChildClick}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </T.Group>
    ))

    clickCanvasCentre(canvas)

    expect(handleChildClick).toHaveBeenCalledTimes(1)
    expect(handleParentMissed).not.toHaveBeenCalled()
  })
})

/**********************************************************************************/
/*                                                                                */
/*                          Event handler reactivity                              */
/*                                                                                */
/**********************************************************************************/

describe("event handler reactivity", () => {
  it("registers object in interaction list when event prop is added", async () => {
    const handleClick = vi.fn()
    const [onClick, setOnClick] = createSignal<((e: any) => void) | undefined>(undefined)

    const { canvas } = await test(() => (
      <T.Mesh onClick={onClick()}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    // No handler yet — click should not fire
    clickCanvasCentre(canvas)

    expect(handleClick).not.toHaveBeenCalled()

    // Add the handler reactively
    setOnClick(() => handleClick)

    clickCanvasCentre(canvas)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it("removes object from interaction list when event prop is removed", async () => {
    const handleClick = vi.fn()
    const [onClick, setOnClick] = createSignal<((e: any) => void) | undefined>(handleClick)

    const { canvas } = await test(() => (
      <T.Mesh onClick={onClick()}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    // Handler active — click fires
    clickCanvasCentre(canvas)

    expect(handleClick).toHaveBeenCalledTimes(1)

    // Remove handler reactively
    setOnClick(undefined)

    clickCanvasCentre(canvas)

    expect(handleClick).toHaveBeenCalledTimes(1) // no new call
  })
})
