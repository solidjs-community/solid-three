import { fireEvent } from "@solidjs/testing-library"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

/**
 * Behavioural tests for the pointer-event system: what actually fires when the
 * user interacts, on a real scene through the real raycaster. Most of the rest
 * of `tests/core` pins which objects get *registered*; these pin which handlers
 * get *called* on a click / move / wheel.
 *
 * NOTE: raycasting reads each object's `matrixWorld`, which is refreshed once
 * per render frame. A synthetic `fireEvent` fires before the first frame, so
 * any test that relies on an object's *position* must `await waitTillNextFrame()`
 * first — otherwise every mesh hit-tests as if at the origin. Tests that use
 * only an origin mesh (or an empty scene) don't need it.
 *
 * A test marked `it.fails` documents a behaviour the system is meant to have but
 * currently doesn't — it stays green while broken and turns red the day it's
 * fixed, prompting the `.fails` removal.
 */

const T = createT(THREE)

// (640,400) hits a 2×2 box centred at origin (camera at z=5).
const HIT_X = 640
const HIT_Y = 400
const AT = { clientX: HIT_X, clientY: HIT_Y, bubbles: true }

function fire(canvas: HTMLCanvasElement, type: string) {
  fireEvent(canvas, new MouseEvent(type, AT))
}

/** A 2×2 box at origin whose only handler is the one named by `eventType`. */
function SoleHandlerBox(props: { eventType: string }) {
  return (
    <T.Mesh {...{ [props.eventType]: () => {} }}>
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
}

/** A 2×2 box at depth `z` carrying one handler. */
function StackBox(props: { z: number; prop: string; handler: (e: any) => void }) {
  return (
    <T.Mesh position-z={props.z} {...{ [props.prop]: props.handler }}>
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
}

/**********************************************************************************/
/*                                                                                */
/*       Any handler makes an object a target for every gesture (no per-type)     */
/*                                                                                */
/**********************************************************************************/

/**
 * A mesh with *any* pointer handler is hit-tested for *every* gesture. So a
 * click lands on a mesh whose only handler is `onWheel` (or `onPointerMove`):
 * it counts as a hit, the canvas-level `*Missed` does not fire, and the
 * canvas-level handler does.
 */
describe("a mesh whose only handler is a different event still counts as a hit", () => {
  const missable = [
    { gesture: "click", missed: "onClickMissed", canvas: "onClick" },
    { gesture: "dblclick", missed: "onDoubleClickMissed", canvas: "onDoubleClick" },
    { gesture: "contextmenu", missed: "onContextMenuMissed", canvas: "onContextMenu" },
  ] as const
  const unrelated = ["onWheel", "onPointerMove"] as const

  for (const g of missable) {
    for (const u of unrelated) {
      it(`clicking a ${u}-only mesh does not fire ${g.missed}, and canvas ${g.canvas} fires`, () => {
        const missed = vi.fn()
        const canvasHit = vi.fn()
        const { canvas } = test(() => <SoleHandlerBox eventType={u} />, {
          [g.missed]: missed,
          [g.canvas]: canvasHit,
        })

        fire(canvas, g.gesture)

        expect(missed).not.toHaveBeenCalled() // the mesh is a hit, so the click is not a miss
        expect(canvasHit).toHaveBeenCalledTimes(1) // ...and the hit reaches the canvas handler
      })
    }
  }
})

/**********************************************************************************/
/*                                                                                */
/*       Clicking one object notifies the others via their onClickMissed          */
/*                                                                                */
/**********************************************************************************/

/**
 * `onClickMissed` on an object fires when the click lands on a *different*
 * object — so an object can react to "something else was clicked" (the
 * decentralized deselect pattern). Needs a real position for the second mesh,
 * hence the frame wait. This is a real feature today; the void-fork branches
 * drop per-object miss, so this turns red there — the removal made visible.
 */
describe("clicking one object fires another object's onClickMissed", () => {
  it("clicking A fires B's onClickMissed; A's own does not fire", async () => {
    const aClick = vi.fn()
    const aMissed = vi.fn()
    const bMissed = vi.fn()
    const { canvas, waitTillNextFrame } = test(() => (
      <>
        <T.Mesh onClick={aClick} onClickMissed={aMissed}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-x={100} onClick={() => {}} onClickMissed={bMissed}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))
    await waitTillNextFrame() // B's position only reaches the raycaster after a frame

    fire(canvas, "click") // hits A at the origin; B is off to the side

    expect(aClick).toHaveBeenCalledTimes(1)
    expect(bMissed).toHaveBeenCalledTimes(1) // B wasn't hit → it hears that something else was
    expect(aMissed).not.toHaveBeenCalled() // A was the hit
  })
})

/**********************************************************************************/
/*                                                                                */
/*           A click passes through to objects stacked behind the front          */
/*                                                                                */
/**********************************************************************************/

/** Every gesture that propagates, with the DOM event that triggers it. */
const PROPAGATING = [
  { name: "click", prop: "onClick", make: () => new MouseEvent("click", AT) },
  { name: "dblclick", prop: "onDoubleClick", make: () => new MouseEvent("dblclick", AT) },
  { name: "contextmenu", prop: "onContextMenu", make: () => new MouseEvent("contextmenu", AT) },
  { name: "pointerdown", prop: "onPointerDown", make: () => new PointerEvent("pointerdown", AT) },
  { name: "pointerup", prop: "onPointerUp", make: () => new PointerEvent("pointerup", AT) },
  { name: "wheel", prop: "onWheel", make: () => new WheelEvent("wheel", { ...AT, deltaY: 1 }) },
  { name: "pointermove", prop: "onPointerMove", make: () => new PointerEvent("pointermove", AT) },
] as const

describe("an object behind the front one still receives the gesture; stopPropagation stops it", () => {
  for (const g of PROPAGATING) {
    it(`${g.name}: front and rear both fire (the front does not occlude the rear)`, async () => {
      const front = vi.fn()
      const rear = vi.fn()
      const { canvas, waitTillNextFrame } = test(() => (
        <>
          <StackBox z={0} prop={g.prop} handler={front} />
          <StackBox z={-3} prop={g.prop} handler={rear} />
        </>
      ))
      await waitTillNextFrame() // the rear's depth only takes effect after a frame

      fireEvent(canvas, g.make())

      expect(front).toHaveBeenCalledTimes(1)
      expect(rear).toHaveBeenCalledTimes(1)
    })

    it(`${g.name}: stopPropagation on the front object stops the rear`, async () => {
      const front = vi.fn((e: any) => e.stopPropagation())
      const rear = vi.fn()
      const { canvas, waitTillNextFrame } = test(() => (
        <>
          <StackBox z={0} prop={g.prop} handler={front} />
          <StackBox z={-3} prop={g.prop} handler={rear} />
        </>
      ))
      await waitTillNextFrame()

      fireEvent(canvas, g.make())

      expect(front).toHaveBeenCalledTimes(1)
      expect(rear).not.toHaveBeenCalled()
    })
  }
})

/**********************************************************************************/
/*                                                                                */
/*      A click inside a group should not register as a miss of that group        */
/*                                                                                */
/**********************************************************************************/

/**
 * When a child stops propagation, the event never bubbles up to its parent
 * group — so the group is treated as "missed" even though the click landed
 * inside it. A click within a group is not a miss of the group; assert the
 * intended behaviour and mark it `it.fails` until that holds.
 */
it.fails("a group's onClickMissed should not fire when its own child is clicked", async () => {
  const childClick = vi.fn()
  const groupMissed = vi.fn()
  const { canvas, waitTillNextFrame } = test(() => (
    <T.Group onClickMissed={groupMissed}>
      <T.Mesh onClick={(e: any) => (childClick(e), e.stopPropagation())}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </T.Group>
  ))
  await waitTillNextFrame()

  fire(canvas, "click")

  expect(childClick).toHaveBeenCalledTimes(1)
  expect(groupMissed).not.toHaveBeenCalled() // intended; currently fires (the child stopped the bubble)
})

/**********************************************************************************/
/*                                                                                */
/*       raycastable={false} takes a mesh out of hit-testing; ray passes on       */
/*                                                                                */
/**********************************************************************************/

/**
 * `raycastable={false}` must take a handler-bearing mesh out of hit-testing
 * entirely: its own handler never fires, and the ray passes through to whatever
 * is behind it.
 */
describe("raycastable={false} skips the mesh and the ray passes through to what is behind", () => {
  it("the opted-out front mesh's onClick does not fire; the rear mesh's does", async () => {
    const front = vi.fn()
    const rear = vi.fn()
    const { canvas, waitTillNextFrame } = test(() => (
      <>
        <T.Mesh raycastable={false} onClick={front}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <StackBox z={-3} prop="onClick" handler={rear} />
      </>
    ))
    await waitTillNextFrame()

    fire(canvas, "click")

    expect(front).not.toHaveBeenCalled()
    expect(rear).toHaveBeenCalledTimes(1)
  })
})

/**********************************************************************************/
/*                                                                                */
/*           Clicking empty space: the canvas handler fires with no object        */
/*                                                                                */
/**********************************************************************************/

describe("clicking empty space is a void", () => {
  it.fails("a void should not fire both onClick and onClickMissed", () => {
    let click = 0
    let missed = 0
    const { canvas } = test(() => null, {
      onClick: () => click++,
      onClickMissed: () => missed++,
    })

    fire(canvas, "click")

    // A void is one event; it should deliver a single canvas signal, not both a
    // positive (onClick) and a negative (onClickMissed). Today it fires both —
    // assert the intended single-signal and mark it `fails` until a void delivers
    // one or the other. (Both void-fork branches resolve this, in different ways.)
    expect(click + missed).toBeLessThan(2)
  })

  it("the canvas onClick on a void receives an event whose object is undefined", () => {
    let object: unknown = "unset"
    const { canvas } = test(() => null, { onClick: (e: any) => (object = e.object) })

    fire(canvas, "click")

    expect(object).toBeUndefined()
  })
})

/**********************************************************************************/
/*                                                                                */
/*                              Pointer capture                                   */
/*                                                                                */
/**********************************************************************************/

// Synthetic PointerEvents create no *active* OS pointer, so the real
// canvas.setPointerCapture would throw — mock it (we're testing dispatch, not
// OS routing). Off-mesh coordinates simulate the ray leaving the mesh; the
// meshes sit at the origin, so no frame wait is needed.
const MISS_X = 0
const MISS_Y = 0
const pointerAt = (type: string, x: number, y: number) =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })

/** A 2×2 box at origin that captures on pointerdown. */
function Capturing(props: { onMove?: (e: any) => void; onUp?: (e: any) => void }) {
  return (
    <T.Mesh
      onPointerDown={(e: any) => e.setPointerCapture()}
      onPointerMove={(e: any) => props.onMove?.(e)}
      onPointerUp={(e: any) => props.onUp?.(e)}
    >
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
}

describe("a captured pointer's up/move still reach the canvas-level handler unless stopped", () => {
  it("a captured up reaches the canvas onPointerUp", () => {
    const canvasUp = vi.fn()
    const { canvas } = test(() => <Capturing />, { onPointerUp: canvasUp })
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y)) // ray off the mesh

    expect(canvasUp).toHaveBeenCalledTimes(1)
  })

  it("a captured move reaches the canvas onPointerMove", () => {
    const canvasMove = vi.fn()
    const { canvas } = test(() => <Capturing />, { onPointerMove: canvasMove })
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y))
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y))

    expect(canvasMove).toHaveBeenCalledTimes(1)
  })

  it("a captured object that stops propagation withholds the canvas onPointerUp", () => {
    const canvasUp = vi.fn()
    const { canvas } = test(() => <Capturing onUp={(e: any) => e.stopPropagation()} />, {
      onPointerUp: canvasUp,
    })
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y))
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y))

    expect(canvasUp).not.toHaveBeenCalled()
  })
})

describe("hover is frozen while captured", () => {
  it("onPointerLeave does not fire while captured; it resumes after release", () => {
    const move = vi.fn()
    const leave = vi.fn()
    const { canvas } = test(() => (
      <T.Mesh
        onPointerDown={(e: any) => e.setPointerCapture()}
        onPointerMove={move}
        onPointerLeave={leave}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointermove", HIT_X, HIT_Y)) // hover onto the mesh
    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // capture
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // captured move, ray off the mesh
    expect(move).toHaveBeenCalled()
    expect(leave).not.toHaveBeenCalled() // hover frozen — no leave while captured

    fireEvent(canvas, new PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }))
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // released; ray still off the mesh
    expect(leave).toHaveBeenCalledTimes(1)
  })
})

describe("releasePointerCapture() inside onPointerUp restores normal delivery", () => {
  it("after release, an off-mesh move no longer reaches the once-captured mesh", () => {
    const move = vi.fn()
    const { canvas } = test(() => (
      <T.Mesh
        onPointerDown={(e: any) => e.setPointerCapture()}
        onPointerUp={(e: any) => e.releasePointerCapture()}
        onPointerMove={move}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // capture
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // captured move (off mesh) reaches it
    expect(move).toHaveBeenCalledTimes(1)

    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y)) // releases capture
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // off mesh, no longer captured
    expect(move).toHaveBeenCalledTimes(1) // not delivered again
  })
})

/**********************************************************************************/
/*                                                                                */
/*               onPointerEnter / onPointerLeave cannot be stopped                */
/*                                                                                */
/**********************************************************************************/

describe("enter and leave are non-stoppable", () => {
  it("their events carry no stopPropagation", () => {
    let enterEvent: any
    let leaveEvent: any
    const { canvas } = test(() => (
      <T.Mesh
        onPointerEnter={(e: any) => (enterEvent = e)}
        onPointerLeave={(e: any) => (leaveEvent = e)}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))

    fireEvent(canvas, pointerAt("pointermove", HIT_X, HIT_Y)) // enter
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // leave

    expect(enterEvent.stopPropagation).toBeUndefined()
    expect(leaveEvent.stopPropagation).toBeUndefined()
  })
})
