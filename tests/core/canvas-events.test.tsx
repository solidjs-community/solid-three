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

/** A 2×2 mesh at origin whose onClick stops propagation. */
const StoppingMesh = (props: { eventType: string; handler?: (e: any) => void }) => {
  const handlerProp = {
    [props.eventType]: (e: any) => {
      e.stopPropagation()
      props.handler?.(e)
    },
  }
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
/*                             Click-Family Events                                */
/*                                                                                */
/**********************************************************************************/

describe("canvas click-family events", () => {
  //
  // onClick
  //
  describe("onClick", () => {
    it("does NOT fire when no meshes are in the scene; onVoidClick fires instead", () => {
      const handleClick = vi.fn()
      const onVoidClick = vi.fn()
      const { canvas } = test(() => null, { onClick: handleClick, onVoidClick })

      fireEvent(canvas, hitEvent("click"))

      expect(onVoidClick).toHaveBeenCalledTimes(1)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it("fires when click propagates through a mesh that does not stop it", () => {
      const handleClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, { onClick: handleClick })

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("does NOT fire when click misses all meshes; onVoidClick fires instead", () => {
      const handleClick = vi.fn()
      const onVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onClick: handleClick,
        onVoidClick,
      })

      fireEvent(canvas, missEvent("click"))

      expect(onVoidClick).toHaveBeenCalledTimes(1)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleClick = vi.fn()
      const onVoidClick = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onClick" />, {
        onClick: handleClick,
        onVoidClick,
      })

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).not.toHaveBeenCalled()
      expect(onVoidClick).not.toHaveBeenCalled()
    })
  })

  //
  // onDoubleClick
  //
  describe("onDoubleClick", () => {
    it("does NOT fire when no meshes are in the scene; onVoidDoubleClick fires instead", () => {
      const handleDoubleClick = vi.fn()
      const onVoidDoubleClick = vi.fn()
      const { canvas } = test(() => null, { onDoubleClick: handleDoubleClick, onVoidDoubleClick })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(onVoidDoubleClick).toHaveBeenCalledTimes(1)
      expect(handleDoubleClick).not.toHaveBeenCalled()
    })

    it("fires when double-click propagates through a mesh that does not stop it", () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onDoubleClick" />, {
        onDoubleClick: handleDoubleClick,
      })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("does NOT fire when double-click misses all meshes; onVoidDoubleClick fires instead", () => {
      const handleDoubleClick = vi.fn()
      const onVoidDoubleClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onDoubleClick" />, {
        onDoubleClick: handleDoubleClick,
        onVoidDoubleClick,
      })

      fireEvent(canvas, missEvent("dblclick"))

      expect(onVoidDoubleClick).toHaveBeenCalledTimes(1)
      expect(handleDoubleClick).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleDoubleClick = vi.fn()
      const onVoidDoubleClick = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onDoubleClick" />, {
        onDoubleClick: handleDoubleClick,
        onVoidDoubleClick,
      })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleDoubleClick).not.toHaveBeenCalled()
      expect(onVoidDoubleClick).not.toHaveBeenCalled()
    })
  })

  //
  // onContextMenu
  //
  describe("onContextMenu", () => {
    it("does NOT fire when no meshes are in the scene; onVoidContextMenu fires instead", () => {
      const handleContextMenu = vi.fn()
      const onVoidContextMenu = vi.fn()
      const { canvas } = test(() => null, { onContextMenu: handleContextMenu, onVoidContextMenu })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(onVoidContextMenu).toHaveBeenCalledTimes(1)
      expect(handleContextMenu).not.toHaveBeenCalled()
    })

    it("fires when contextmenu propagates through a mesh that does not stop it", () => {
      const handleContextMenu = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onContextMenu" />, {
        onContextMenu: handleContextMenu,
      })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("does NOT fire when contextmenu misses all meshes; onVoidContextMenu fires instead", () => {
      const handleContextMenu = vi.fn()
      const onVoidContextMenu = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onContextMenu" />, {
        onContextMenu: handleContextMenu,
        onVoidContextMenu,
      })

      fireEvent(canvas, missEvent("contextmenu"))

      expect(onVoidContextMenu).toHaveBeenCalledTimes(1)
      expect(handleContextMenu).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleContextMenu = vi.fn()
      const onVoidContextMenu = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onContextMenu" />, {
        onContextMenu: handleContextMenu,
        onVoidContextMenu,
      })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleContextMenu).not.toHaveBeenCalled()
      expect(onVoidContextMenu).not.toHaveBeenCalled()
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
    it("does NOT fire when no meshes are in the scene; onVoidPointerDown fires instead", () => {
      const handlePointerDown = vi.fn()
      const onVoidPointerDown = vi.fn()
      const { canvas } = test(() => null, { onPointerDown: handlePointerDown, onVoidPointerDown })

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(onVoidPointerDown).toHaveBeenCalledTimes(1)
      expect(handlePointerDown).not.toHaveBeenCalled()
    })

    it("fires when pointerdown propagates through a mesh that does not stop it", () => {
      const handlePointerDown = vi.fn()
      const onVoidPointerDown = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerDown" />, {
        onPointerDown: handlePointerDown,
        onVoidPointerDown,
      })

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(handlePointerDown).toHaveBeenCalledTimes(1)
      expect(onVoidPointerDown).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerDown = vi.fn()
      const onVoidPointerDown = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onPointerDown" />, {
        onPointerDown: handlePointerDown,
        onVoidPointerDown,
      })

      fireEvent(canvas, hitEvent("pointerdown"))

      expect(handlePointerDown).not.toHaveBeenCalled()
      expect(onVoidPointerDown).not.toHaveBeenCalled()
    })
  })

  //
  // onPointerUp
  //
  describe("onPointerUp", () => {
    it("does NOT fire when no meshes are in the scene; onVoidPointerUp fires instead", () => {
      const handlePointerUp = vi.fn()
      const onVoidPointerUp = vi.fn()
      const { canvas } = test(() => null, { onPointerUp: handlePointerUp, onVoidPointerUp })

      fireEvent(canvas, hitEvent("pointerup"))

      expect(onVoidPointerUp).toHaveBeenCalledTimes(1)
      expect(handlePointerUp).not.toHaveBeenCalled()
    })

    it("fires when pointerup propagates through a mesh that does not stop it", () => {
      const handlePointerUp = vi.fn()
      const onVoidPointerUp = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerUp" />, {
        onPointerUp: handlePointerUp,
        onVoidPointerUp,
      })

      fireEvent(canvas, hitEvent("pointerup"))

      expect(handlePointerUp).toHaveBeenCalledTimes(1)
      expect(onVoidPointerUp).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerUp = vi.fn()
      const onVoidPointerUp = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onPointerUp" />, {
        onPointerUp: handlePointerUp,
        onVoidPointerUp,
      })

      fireEvent(canvas, hitEvent("pointerup"))

      expect(handlePointerUp).not.toHaveBeenCalled()
      expect(onVoidPointerUp).not.toHaveBeenCalled()
    })
  })

  //
  // onWheel
  //
  describe("onWheel", () => {
    it("does NOT fire when no meshes are in the scene; onVoidWheel fires instead", () => {
      const handleWheel = vi.fn()
      const onVoidWheel = vi.fn()
      const { canvas } = test(() => null, { onWheel: handleWheel, onVoidWheel })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(onVoidWheel).toHaveBeenCalledTimes(1)
      expect(handleWheel).not.toHaveBeenCalled()
    })

    it("fires when wheel event propagates through a mesh that does not stop it", () => {
      const handleWheel = vi.fn()
      const onVoidWheel = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onWheel" />, {
        onWheel: handleWheel,
        onVoidWheel,
      })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(handleWheel).toHaveBeenCalledTimes(1)
      expect(onVoidWheel).not.toHaveBeenCalled()
    })

    it("does not fire when a mesh stops propagation", () => {
      const handleWheel = vi.fn()
      const onVoidWheel = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onWheel" />, {
        onWheel: handleWheel,
        onVoidWheel,
      })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(handleWheel).not.toHaveBeenCalled()
      expect(onVoidWheel).not.toHaveBeenCalled()
    })
  })
})

/**********************************************************************************/
/*                                                                                */
/*                               Void Events                                      */
/*                                                                                */
/**********************************************************************************/

describe("void events", () => {
  //
  // onVoidClick
  //
  describe("onVoidClick", () => {
    it("fires when click misses all registered meshes", () => {
      const handleVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onVoidClick: handleVoidClick,
      })

      fireEvent(canvas, missEvent("click"))

      expect(handleVoidClick).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is clicked with no meshes in the scene", () => {
      const handleVoidClick = vi.fn()
      const { canvas } = test(() => null, { onVoidClick: handleVoidClick })

      fireEvent(canvas, hitEvent("click"))

      expect(handleVoidClick).toHaveBeenCalledTimes(1)
    })

    it("does not fire when click hits a registered mesh", () => {
      const handleVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onVoidClick: handleVoidClick,
      })

      fireEvent(canvas, hitEvent("click"))

      expect(handleVoidClick).not.toHaveBeenCalled()
    })

    it("does not fire when onClick is also registered and click hits a mesh", () => {
      const handleClick = vi.fn()
      const handleVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, {
        onClick: handleClick,
        onVoidClick: handleVoidClick,
      })

      fireEvent(canvas, hitEvent("click"))

      expect(handleClick).toHaveBeenCalledTimes(1)
      expect(handleVoidClick).not.toHaveBeenCalled()
    })
  })

  //
  // onVoidClick (gesture-scoped)
  //
  describe("onVoidClick (gesture-scoped)", () => {
    it("fires when the click lands on a hover-only mesh (no onClick)", () => {
      const onVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, { onVoidClick })
      fireEvent(canvas, hitEvent("click"))
      expect(onVoidClick).toHaveBeenCalledTimes(1)
    })

    it("does NOT fire when the click hits a mesh with onClick; canvas onClick fires instead", () => {
      const onVoidClick = vi.fn()
      const onClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, { onVoidClick, onClick })
      fireEvent(canvas, hitEvent("click"))
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onVoidClick).not.toHaveBeenCalled()
    })

    it("fires on empty space; canvas onClick does NOT (exclusive)", () => {
      const onVoidClick = vi.fn()
      const onClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onClick" />, { onVoidClick, onClick })
      fireEvent(canvas, missEvent("click"))
      expect(onVoidClick).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  //
  // onVoidDoubleClick
  //
  describe("onVoidDoubleClick", () => {
    it("fires when double-click misses all registered meshes", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onDoubleClick" />, {
        onVoidDoubleClick: handleVoid,
      })

      fireEvent(canvas, missEvent("dblclick"))

      expect(handleVoid).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is double-clicked with no meshes in the scene", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => null, { onVoidDoubleClick: handleVoid })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleVoid).toHaveBeenCalledTimes(1)
    })

    it("does not fire when double-click hits a registered mesh", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onDoubleClick" />, {
        onVoidDoubleClick: handleVoid,
      })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(handleVoid).not.toHaveBeenCalled()
    })
  })

  //
  // onVoidContextMenu
  //
  describe("onVoidContextMenu", () => {
    it("fires when contextmenu misses all registered meshes", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onContextMenu" />, {
        onVoidContextMenu: handleVoid,
      })

      fireEvent(canvas, missEvent("contextmenu"))

      expect(handleVoid).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas receives contextmenu with no meshes in the scene", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => null, { onVoidContextMenu: handleVoid })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleVoid).toHaveBeenCalledTimes(1)
    })

    it("does not fire when contextmenu hits a registered mesh", () => {
      const handleVoid = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onContextMenu" />, {
        onVoidContextMenu: handleVoid,
      })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(handleVoid).not.toHaveBeenCalled()
    })
  })

  //
  // onVoid family — wheel / pointer down / up
  //
  describe("onVoid family — wheel / pointer down / up", () => {
    it("onVoidWheel fires on an empty-space wheel", () => {
      const onVoidWheel = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, { onVoidWheel })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: MISS_X, clientY: MISS_Y, bubbles: true }),
      )

      expect(onVoidWheel).toHaveBeenCalledTimes(1)
    })

    it("onVoidPointerDown fires on an empty-space pointerdown", () => {
      const onVoidPointerDown = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onVoidPointerDown,
      })

      fireEvent(canvas, missEvent("pointerdown"))

      expect(onVoidPointerDown).toHaveBeenCalledTimes(1)
    })

    it("onVoidPointerUp fires on an empty-space pointerup", () => {
      const onVoidPointerUp = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onVoidPointerUp,
      })

      fireEvent(canvas, missEvent("pointerup"))

      expect(onVoidPointerUp).toHaveBeenCalledTimes(1)
    })
  })

  //
  // onVoid* — gesture-scoped parity (hover-only mesh is transparent to the void family)
  //
  describe("onVoid* — gesture-scoped (hover-only object is transparent)", () => {
    it("onVoidClick fires when click hits a hover-only mesh; canvas onClick does NOT", () => {
      const onClick = vi.fn()
      const onVoidClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onClick,
        onVoidClick,
      })

      fireEvent(canvas, hitEvent("click"))

      expect(onVoidClick).toHaveBeenCalledTimes(1)
      expect(onClick).not.toHaveBeenCalled()
    })

    it("onVoidDoubleClick fires when double-click hits a hover-only mesh; canvas onDoubleClick does NOT", () => {
      const onDoubleClick = vi.fn()
      const onVoidDoubleClick = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onDoubleClick,
        onVoidDoubleClick,
      })

      fireEvent(canvas, hitEvent("dblclick"))

      expect(onVoidDoubleClick).toHaveBeenCalledTimes(1)
      expect(onDoubleClick).not.toHaveBeenCalled()
    })

    it("onVoidContextMenu fires when contextmenu hits a hover-only mesh; canvas onContextMenu does NOT", () => {
      const onContextMenu = vi.fn()
      const onVoidContextMenu = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onContextMenu,
        onVoidContextMenu,
      })

      fireEvent(canvas, hitEvent("contextmenu"))

      expect(onVoidContextMenu).toHaveBeenCalledTimes(1)
      expect(onContextMenu).not.toHaveBeenCalled()
    })

    it("onVoidWheel fires when wheel hits a hover-only mesh; canvas onWheel does NOT", () => {
      const onWheel = vi.fn()
      const onVoidWheel = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onWheel,
        onVoidWheel,
      })

      fireEvent(
        canvas,
        new WheelEvent("wheel", { deltaY: 100, clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(onVoidWheel).toHaveBeenCalledTimes(1)
      expect(onWheel).not.toHaveBeenCalled()
    })

    it("onVoidPointerDown fires when pointerdown hits a hover-only mesh; canvas onPointerDown does NOT", () => {
      const onPointerDown = vi.fn()
      const onVoidPointerDown = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onPointerDown,
        onVoidPointerDown,
      })

      fireEvent(
        canvas,
        new PointerEvent("pointerdown", { clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(onVoidPointerDown).toHaveBeenCalledTimes(1)
      expect(onPointerDown).not.toHaveBeenCalled()
    })

    it("onVoidPointerUp fires when pointerup hits a hover-only mesh; canvas onPointerUp does NOT", () => {
      const onPointerUp = vi.fn()
      const onVoidPointerUp = vi.fn()
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onPointerUp,
        onVoidPointerUp,
      })

      fireEvent(
        canvas,
        new PointerEvent("pointerup", { clientX: HIT_X, clientY: HIT_Y, bubbles: true }),
      )

      expect(onVoidPointerUp).toHaveBeenCalledTimes(1)
      expect(onPointerUp).not.toHaveBeenCalled()
    })
  })

  //
  // chain-aware: ancestor carries the handler — not a void
  //
  describe("onVoid* — chain-aware (ancestor handler via bubbling)", () => {
    it("a group's onClick fires via bubbling from a hover-only child; onVoidClick does NOT", () => {
      const groupClick = vi.fn()
      const onVoidClick = vi.fn()
      const { canvas } = test(
        () => (
          <T.Group onClick={groupClick}>
            <ListeningMesh eventType="onPointerMove" />
          </T.Group>
        ),
        { onVoidClick },
      )

      fireEvent(canvas, hitEvent("click"))

      expect(groupClick).toHaveBeenCalledTimes(1)
      expect(onVoidClick).not.toHaveBeenCalled()
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
      const { canvas } = test(() => <ListeningMesh eventType="onPointerMove" />, {
        onPointerMove: handlePointerMove,
      })

      fireEvent(canvas, hitEvent("pointermove"))

      expect(handlePointerMove).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", () => {
      const handlePointerMove = vi.fn()
      const { canvas } = test(() => <StoppingMesh eventType="onPointerMove" />, {
        onPointerMove: handlePointerMove,
      })

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
