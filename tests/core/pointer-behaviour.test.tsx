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
 * it counts as a hit, so the click is not a void and the canvas-level
 * `onPointerMissed` does not fire.
 */
describe("a mesh whose only handler is a different event still counts as a hit", () => {
  const gestures = ["click", "dblclick", "contextmenu"] as const
  const unrelated = ["onWheel", "onPointerMove"] as const

  for (const gesture of gestures) {
    for (const u of unrelated) {
      it(`clicking a ${u}-only mesh does not fire onPointerMissed (union: it is a hit)`, () => {
        const missed = vi.fn()
        const { canvas } = test(() => <SoleHandlerBox eventType={u} />, {
          onPointerMissed: missed,
        })

        fire(canvas, gesture)

        expect(missed).not.toHaveBeenCalled() // the mesh is a hit, so the click is not a void
      })
    }
  }
})

/**********************************************************************************/
/*                                                                                */
/*       Clicking one object notifies the others via their onPointerMissed          */
/*                                                                                */
/**********************************************************************************/

describe("clicking one object fires another object's onPointerMissed (r3f not-me)", () => {
  it("clicking A fires B's onPointerMissed; A's own does not", async () => {
    const aClick = vi.fn()
    const aMissed = vi.fn()
    const bMissed = vi.fn()
    const { canvas, waitTillNextFrame } = test(() => (
      <>
        <T.Mesh onClick={aClick} onPointerMissed={aMissed}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-x={100} onClick={() => {}} onPointerMissed={bMissed}>
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

  it("a total miss fires onPointerMissed on every registered object", async () => {
    const aMissed = vi.fn()
    const bMissed = vi.fn()
    const { canvas, waitTillNextFrame } = test(() => (
      <>
        <T.Mesh onClick={() => {}} onPointerMissed={aMissed}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
        <T.Mesh position-x={100} onClick={() => {}} onPointerMissed={bMissed}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      </>
    ))
    await waitTillNextFrame()

    fireEvent(canvas, new MouseEvent("click", { clientX: 0, clientY: 0, bubbles: true })) // empty space

    expect(aMissed).toHaveBeenCalledTimes(1)
    expect(bMissed).toHaveBeenCalledTimes(1)
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
 * A click inside a group is a hit, not a miss of the group — even when the child
 * stops propagation so the event never bubbles up to the group. The miss is gated
 * solely on a total miss (nothing hit), so a stopped bubble can't reclassify an
 * ancestor as missed (this is what dissolved "Surprise B").
 */
it("a group's onPointerMissed does not fire when its own child is clicked", async () => {
  const childClick = vi.fn()
  const groupMissed = vi.fn()
  const { canvas, waitTillNextFrame } = test(() => (
    <T.Group onPointerMissed={groupMissed}>
      <T.Mesh onClick={(e: any) => (childClick(e), e.stopPropagation())}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </T.Group>
  ))
  await waitTillNextFrame()

  fire(canvas, "click")

  expect(childClick).toHaveBeenCalledTimes(1)
  expect(groupMissed).not.toHaveBeenCalled() // a click inside the group is a hit, not a miss
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
  it("a void fires onPointerMissed and nothing else", () => {
    let missed = 0
    const { canvas } = test(() => null, { onPointerMissed: () => missed++ })

    fire(canvas, "click")

    expect(missed).toBe(1)
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

/** A 2×2 box at origin that captures on pointerdown, wrapped so an ancestor can observe. */
function CapturingInGroup(props: {
  groupMove?: (e: any) => void
  groupUp?: (e: any) => void
  meshStopsUp?: boolean
}) {
  return (
    <T.Group onPointerMove={props.groupMove} onPointerUp={props.groupUp}>
      <T.Mesh
        onPointerDown={(e: any) => e.setPointerCapture()}
        onPointerUp={props.meshStopsUp ? (e: any) => e.stopPropagation() : undefined}
      >
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </T.Group>
  )
}

describe("a captured pointer's up/move still bubble to an ancestor handler unless stopped", () => {
  it("a captured up reaches a root-group onPointerUp", () => {
    const groupUp = vi.fn()
    const { canvas } = test(() => <CapturingInGroup groupUp={groupUp} />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures the mesh
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y)) // ray off the mesh

    expect(groupUp).toHaveBeenCalledTimes(1) // bubbled up the captured object's ancestor chain
  })

  it("a captured move reaches a root-group onPointerMove", () => {
    const groupMove = vi.fn()
    const { canvas } = test(() => <CapturingInGroup groupMove={groupMove} />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y))
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y))

    expect(groupMove).toHaveBeenCalledTimes(1)
  })

  it("a captured mesh that stops propagation withholds the group onPointerUp", () => {
    const groupUp = vi.fn()
    const { canvas } = test(() => <CapturingInGroup groupUp={groupUp} meshStopsUp />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y))
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y))

    expect(groupUp).not.toHaveBeenCalled()
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
