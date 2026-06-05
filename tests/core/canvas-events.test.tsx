import { fireEvent } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
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

/** A plain 2×2 mesh at origin with no event handlers. */
const BasicMesh = () => (
  <T.Mesh>
    <T.BoxGeometry args={[2, 2]} />
    <T.MeshBasicMaterial />
  </T.Mesh>
)

/** A 2×2 mesh at origin whose onClick stops propagation. */
const StoppingMesh = (props: { eventType: string; handler?: (e: any) => void }) => {
  const handlerProp = { [props.eventType]: (e: any) => { e.stopPropagation(); props.handler?.(e) } }
  return (
    <T.Mesh {...handlerProp}>
      <T.BoxGeometry args={[2, 2]} />
      <T.MeshBasicMaterial />
    </T.Mesh>
  )
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

describe("canvas missable events", () => {
  //
  // onClick
  //
  describe("onClick", () => {
    it("fires when canvas is clicked and no meshes are in the scene", () => {
      const handleClick = vi.fn()
      const { canvas } = test(() => null, { onClick: handleClick })

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when click propagates through a mesh that does not stop it", () => {
      const handleClick = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when click misses all meshes", () => {
      const handleClick = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, missEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleClick = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  //
  // onClickMissed
  //
  describe("onClickMissed", () => {
    it("fires when click misses all registered meshes", () => {
      const handleClickMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onClick" />,
        { onClickMissed: handleClickMissed },
      )

      fireEvent(canvas, missEvent("click"))

      expect(handleClickMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is clicked with no meshes in the scene", () => {
      const handleClickMissed = vi.fn()
      const { canvas } = test(() => null, { onClickMissed: handleClickMissed })

      fireEvent(canvas, hitEvent("click"))

      expect(handleClickMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when click hits a registered mesh", () => {
      const handleClickMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onClick" />,
        { onClickMissed: handleClickMissed },
      )

      fireEvent(canvas, hitEvent("click"))

      expect(handleClickMissed).not.toHaveBeenCalled()
    })

    it("does not fire when onClick is also registered and click hits a mesh", () => {
      const handleClick = vi.fn()
      const handleClickMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onClick" />,
        { onClick: handleClick, onClickMissed: handleClickMissed },
      )

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
      expect(handleClickMissed).not.toHaveBeenCalled()
    })
  })

  //
  // onDoubleClick
  //
  describe("onDoubleClick", () => {
    it("fires when canvas is double-clicked and no meshes are in the scene", () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = test(() => null, { onDoubleClick: handleDoubleClick })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when double-click propagates through a mesh that does not stop it", () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when double-click misses all meshes", () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, missEvent("dblclick"))

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleDoubleClick).not.toHaveBeenCalled()
    })
  })

  //
  // onDoubleClickMissed
  //
  describe("onDoubleClickMissed", () => {
    it("fires when double-click misses all registered meshes", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClickMissed: handleMissed },
      )

      fireEvent(canvas, missEvent("dblclick"))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is double-clicked with no meshes in the scene", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(() => null, { onDoubleClickMissed: handleMissed })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when double-click hits a registered mesh", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClickMissed: handleMissed },
      )

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleMissed).not.toHaveBeenCalled()
    })
  })

  //
  // onContextMenu
  //
  describe("onContextMenu", () => {
    it("fires when canvas receives contextmenu and no meshes are in the scene", () => {
      const handleContextMenu = vi.fn()
      const { canvas } = test(() => null, { onContextMenu: handleContextMenu })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("fires when contextmenu propagates through a mesh that does not stop it", () => {
      const handleContextMenu = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("fires when contextmenu misses all meshes", () => {
      const handleContextMenu = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, missEvent("contextmenu"))

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleContextMenu = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleContextMenu).not.toHaveBeenCalled()
    })
  })

  //
  // onContextMenuMissed
  //
  describe("onContextMenuMissed", () => {
    it("fires when contextmenu misses all registered meshes", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenuMissed: handleMissed },
      )

      fireEvent(canvas, missEvent("contextmenu"))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas receives contextmenu with no meshes in the scene", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(() => null, { onContextMenuMissed: handleMissed })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when contextmenu hits a registered mesh", () => {
      const handleMissed = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenuMissed: handleMissed },
      )

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleMissed).not.toHaveBeenCalled()
    })
  })
})

/**********************************************************************************/
/*                                                                                */
/*                             Default Events                                     */
/*                                                                                */
/**********************************************************************************/

describe("canvas default events", () => {
  //
  // onPointerDown
  //
  describe("onPointerDown", () => {
    it("fires when pointerdown occurs with no meshes in the scene", () => {
      const handlePointerDown = vi.fn()
      const { canvas } = test(() => null, { onPointerDown: handlePointerDown })

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(handlePointerDown).toHaveBeenCalledTimes(1)
    })

    it("fires when pointerdown propagates through a mesh that does not stop it", () => {
      const handlePointerDown = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onPointerDown" />,
        { onPointerDown: handlePointerDown },
      )

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(handlePointerDown).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerDown = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onPointerDown" />,
        { onPointerDown: handlePointerDown },
      )

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(handlePointerDown).not.toHaveBeenCalled()
    })
  })

  //
  // onPointerUp
  //
  describe("onPointerUp", () => {
    it("fires when pointerup occurs with no meshes in the scene", () => {
      const handlePointerUp = vi.fn()
      const { canvas } = test(() => null, { onPointerUp: handlePointerUp })

      fireEvent(canvas, hitEvent("pointerup"))

      expect(handlePointerUp).toHaveBeenCalledTimes(1)
    })

    it("fires when pointerup propagates through a mesh that does not stop it", () => {
      const handlePointerUp = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onPointerUp" />,
        { onPointerUp: handlePointerUp },
      )

      fireEvent(canvas, hitEvent("pointerup"))

      expect(handlePointerUp).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerUp = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onPointerUp" />,
        { onPointerUp: handlePointerUp },
      )

      fireEvent(canvas, hitEvent("pointerup"))

      expect(handlePointerUp).not.toHaveBeenCalled()
    })
  })

  //
  // onWheel
  //
  describe("onWheel", () => {
    it("fires when wheel event occurs with no meshes in the scene", () => {
      const handleWheel = vi.fn()
      const { canvas } = test(() => null, { onWheel: handleWheel })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(handleWheel).toHaveBeenCalledTimes(1)
    })

    it("fires when wheel event propagates through a mesh that does not stop it", () => {
      const handleWheel = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onWheel" />,
        { onWheel: handleWheel },
      )

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(handleWheel).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleWheel = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onWheel" />,
        { onWheel: handleWheel },
      )

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(handleWheel).not.toHaveBeenCalled()
    })
  })
})

/**********************************************************************************/
/*                                                                                */
/*                               Hover Events                                     */
/*                                                                                */
/**********************************************************************************/

describe("canvas hover events", () => {
  //
  // onPointerEnter / onPointerLeave / onPointerMove
  //
  describe("onPointerEnter", () => {
    it("fires when the pointer first moves over the canvas", () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
    })

    it("fires only once per canvas hover session", () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
    })

    it("fires again after the pointer has left and re-entered", () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, makeEvent("pointerleave", HIT_X, HIT_Y))
      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerEnter).toHaveBeenCalledTimes(2)
    })
  })

  describe("onPointerLeave", () => {
    it("fires when the pointer leaves the canvas", () => {
      const handlePointerLeave = vi.fn()
      const { canvas } = test(() => null, { onPointerLeave: handlePointerLeave })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, makeEvent("pointerleave", HIT_X, HIT_Y))

      expect(handlePointerLeave).toHaveBeenCalledTimes(1)
    })
  })

  describe("onPointerMove", () => {
    it("fires when the pointer moves over the canvas with no meshes", () => {
      const handlePointerMove = vi.fn()
      const { canvas } = test(() => null, { onPointerMove: handlePointerMove })

      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerMove).toHaveBeenCalledTimes(1)
    })

    it("fires when pointer move propagates through a mesh that does not stop it", () => {
      const handlePointerMove = vi.fn()
      const { canvas } = test(
        () => <ListeningMesh eventType="onPointerMove" />,
        { onPointerMove: handlePointerMove },
      )

      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerMove).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerMove = vi.fn()
      const { canvas } = test(
        () => <StoppingMesh eventType="onPointerMove" />,
        { onPointerMove: handlePointerMove },
      )

      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerMove).not.toHaveBeenCalled()
    })
  })

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

  it("releases capture when the captured mesh unmounts mid-drag (no dispatch to a detached node)", () => {
    const onMove = vi.fn()
    const [show, setShow] = createSignal(true)
    const { canvas } = test(() => (show() ? <CapturingMesh onMove={onMove} /> : null))
    vi.spyOn(canvas, "setPointerCapture").mockImplementation(() => {})

    fireEvent(canvas, pointerAt("pointerdown", HIT_X, HIT_Y)) // captures the mesh
    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y)) // captured move reaches the mesh
    expect(onMove).toHaveBeenCalledTimes(1)

    setShow(false) // unmount mid-drag → registry removal releases the capture

    fireEvent(canvas, pointerAt("pointermove", MISS_X, MISS_Y))
    expect(onMove).toHaveBeenCalledTimes(1) // no further dispatch to the detached mesh
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
