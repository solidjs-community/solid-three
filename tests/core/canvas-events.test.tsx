import { fireEvent } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT, hasPointerCapture } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"

const T = createT(THREE)

// offsetX/Y that hits the 2×2 BoxGeometry centred at origin (camera at z=5)
const HIT_X = 640
const HIT_Y = 400

// offsetX/Y that misses the mesh (top-left corner of canvas)
const MISS_X = 0
const MISS_Y = 0

function makeEvent(type: string, clientX: number, clientY: number) {
  // The test canvas is mounted at (0, 0) in document.body, so offsetX/Y === clientX/Y.
  // We dispatch a real MouseEvent; the browser computes offsetX/Y from the target's
  // bounding rect — no `Object.defineProperty` hacks needed.
  return new MouseEvent(type, { clientX, clientY, bubbles: true })
}

function hitEvent(type: string) {
  return makeEvent(type, HIT_X, HIT_Y)
}

function missEvent(type: string) {
  return makeEvent(type, MISS_X, MISS_Y)
}

/** A 2×2 mesh at origin that registers for an event without stopping propagation. */
const ListeningMesh = (props: { eventType: string; handler?: (e: any) => void }) => {
  const handlerProp = { [props.eventType]: (e: any) => props.handler?.(e) }
  return (
    <T.Mesh {...handlerProp}>
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                             Missable Events                                    */
/*                                                                                */
/**********************************************************************************/

describe("canvas onPointerMissed", () => {
  const gestures = [
    { name: "click", dom: "click" },
    { name: "double-click", dom: "dblclick" },
    { name: "context menu", dom: "contextmenu" },
  ] as const

  for (const g of gestures) {
    it(`fires when ${g.name} misses all registered meshes`, () => {
      const handleMissed = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onPointerMissed: handleMissed,
      })

      fireEvent(canvas, missEvent(g.dom))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it(`fires when ${g.name} occurs with no meshes in the scene`, () => {
      const handleMissed = vi.fn()
      const { canvas } = test(() => null, { onPointerMissed: handleMissed })

      fireEvent(canvas, hitEvent(g.dom))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it(`does not fire when ${g.name} hits a registered mesh`, () => {
      const handleMissed = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onPointerMissed: handleMissed,
      })

      fireEvent(canvas, hitEvent(g.dom))

      expect(handleMissed).not.toHaveBeenCalled()
    })
  }
})

/**********************************************************************************/
/*                                                                                */
/*                              Pointer Capture                                   */
/*                                                                                */
/**********************************************************************************/

describe("pointer capture", () => {
  const pointerAt = (type: string, x: number, y: number) =>
    new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true })

  /** A 2×2 mesh that captures on pointerdown and reports move/up. */
  const CapturingMesh = (props: { onMove?: (e: any) => void; onUp?: (e: any) => void }) => (
    <T.Mesh
      onPointerDown={(e: any) => e.setPointerCapture()}
      onPointerMove={(e: any) => props.onMove?.(e)}
      onPointerUp={(e: any) => props.onUp?.(e)}
    >
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )

  it("keeps move/up on the captured mesh after the ray leaves it, and calls canvas.setPointerCapture", () => {
    const onMove = vi.fn()
    const onUp = vi.fn()
    const { canvas } = test(() => <CapturingMesh onMove={onMove} onUp={onUp} />)
    // Synthetic PointerEvents create no *active* pointer, so the real
    // canvas.setPointerCapture(1) would throw InvalidStateError — mock it. We're
    // testing our dispatch logic; events are fired directly at the canvas, so real
    // OS routing isn't needed.
    const captureSpy = vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures
    expect(captureSpy).toHaveBeenCalledWith(1)

    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // ray now off the mesh
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y))

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onUp).toHaveBeenCalledTimes(1)
  })

  it("lostpointercapture clears capture; the next move resumes normal hover", () => {
    const onMove = vi.fn()
    const { canvas } = test(() => <CapturingMesh onMove={onMove} />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures
    fireEvent(canvas, new PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }))

    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // off the mesh, no longer captured
    expect(onMove).not.toHaveBeenCalled()
  })

  it("releases capture when the captured mesh unmounts mid-drag (no dispatch to a detached node)", async () => {
    const onMove = vi.fn()
    const [show, setShow] = createSignal(true)
    const { canvas } = test(() => (show() ? <CapturingMesh onMove={onMove} /> : null))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures the mesh
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // captured move reaches the mesh
    expect(onMove).toHaveBeenCalledTimes(1)

    setShow(false) // unmount mid-drag → registry removal schedules the release
    await Promise.resolve() // the release is deferred a microtask (drains before the next real event)

    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y))
    expect(onMove).toHaveBeenCalledTimes(1) // no further dispatch to the detached mesh
  })

  it("keeps capture when a reactive handler re-registers mid-drag (not a real removal)", async () => {
    const onMove = vi.fn()
    const [flip, setFlip] = createSignal(false)
    // The mesh's ONLY listener is a reactive onPointerMove (reads `flip()`, so flipping
    // re-registers it: refcount 1 → 0 → 1 in one tick). It captures itself on first move.
    const { canvas } = test(() => (
      <T.Mesh onPointerMove={(flip(), (e: any) => (e.setPointerCapture(), onMove(e)))}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    ))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointermove", HIT_X, HIT_Y)) // captures the mesh
    expect(onMove).toHaveBeenCalledTimes(1)

    setFlip(true) // re-registers the only handler — must NOT drop the live capture
    await Promise.resolve() // drain the deferred release check (object was re-added → skip)

    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // off the mesh
    expect(onMove).toHaveBeenCalledTimes(2) // still captured → second move reaches it
  })

  const clickAt = (x: number, y: number) =>
    new MouseEvent("click", { clientX: x, clientY: y, bubbles: true })

  /** Captures on pointerdown and reports clicks. */
  const Draggable = (props: { onClick?: (e: any) => void }) => (
    <T.Mesh
      onPointerDown={(e: any) => e.setPointerCapture()}
      onClick={(e: any) => props.onClick?.(e)}
    >
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )

  it("a captured drag suppresses the trailing click (a drag isn't a click)", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Draggable onClick={onClick} />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // moved while captured → dragged
    fireEvent(canvas, pointerAt("pointerup", MISS_X, MISS_Y))
    fireEvent(canvas, clickAt(MISS_X, MISS_Y)) // browser-synthesized click

    expect(onClick).not.toHaveBeenCalled()
  })

  it("a captured press that doesn't move still clicks", () => {
    const onClick = vi.fn()
    const { canvas } = test(() => <Draggable onClick={onClick} />)
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures, no move
    fireEvent(canvas, pointerAt("pointerup", HIT_X, HIT_Y))
    fireEvent(canvas, clickAt(HIT_X, HIT_Y))

    expect(onClick).toHaveBeenCalledTimes(1) // a tap, not a drag
  })

  it("hasPointerCapture(object) reactively drives a child prop binding (the demo pattern)", async () => {
    // A plain `let` ref read by a CHILD binding — the drag demo's exact shape (material
    // color keyed off the mesh's capture). Works because the renderer assigns the ref
    // before children mount; the predicate supplies the reactivity.
    let mesh: THREE.Mesh | undefined
    let material: THREE.MeshBasicMaterial | undefined
    const { canvas } = test(() => (
      <T.Mesh ref={mesh} onPointerDown={(e: any) => e.setPointerCapture()}>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial ref={material} wireframe={hasPointerCapture(mesh)} />
      </T.Mesh>
    ))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})
    await Promise.resolve() // let the refs land and the binding take its first read

    const before = material?.wireframe
    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures → true
    await Promise.resolve()
    const during = material?.wireframe
    fireEvent(canvas, pointerAt("pointerup", HIT_X, HIT_Y))
    // The browser auto-releases on pointerup, firing lostpointercapture → false.
    fireEvent(canvas, new PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }))
    await Promise.resolve()
    const after = material?.wireframe

    expect({ before, during, after }).toEqual({ before: false, during: true, after: false })
  })
})

/**********************************************************************************/
/*                                                                                */
/*                          Listener Lifecycle                                    */
/*                                                                                */
/**********************************************************************************/

describe("listener lifecycle", () => {
  it("removes its canvas listeners when the Canvas unmounts", () => {
    const three = test(() => null)
    const removeSpy = vi.spyOn(three.canvas, "removeEventListener")

    three.unmount()

    const removed = removeSpy.mock.calls.map(call => call[0])
    expect(removed).toContain("pointermove")
    expect(removed).toContain("lostpointercapture")
  })
})
