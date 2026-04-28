import { fireEvent } from "../../libs/testing-library.ts"
import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"
import { createT } from "../../src/index.ts"
import { settled, test } from "../../src/testing/index.tsx"

const T = createT(THREE)

// offsetX/Y that hits the 2×2 BoxGeometry centred at origin (camera at z=5)
const HIT_X = 640
const HIT_Y = 400

// offsetX/Y that misses the mesh (top-left corner of canvas)
const MISS_X = 0
const MISS_Y = 0

function makeEvent(type: string, offsetX: number, offsetY: number) {
  const event = new Event(type)
  Object.defineProperty(event, "offsetX", { get: () => offsetX })
  Object.defineProperty(event, "offsetY", { get: () => offsetY })
  return event
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

/** A 2×2 mesh at origin whose handler stops propagation. */
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
    it("fires when canvas is clicked and no meshes are in the scene", async () => {
      const handleClick = vi.fn()
      const { canvas } = await test(() => null, { onClick: handleClick })

      fireEvent(canvas, hitEvent("click"))
      await settled()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when click propagates through a mesh that does not stop it", async () => {
      const handleClick = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, hitEvent("click"))
      await settled()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when click misses all meshes", async () => {
      const handleClick = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, missEvent("click"))
      await settled()

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleClick = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onClick" />,
        { onClick: handleClick },
      )

      fireEvent(canvas, hitEvent("click"))
      await settled()

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  //
  // onClickMissed
  //
  describe("onClickMissed", () => {
    it("fires when click misses all registered meshes", async () => {
      const handleClickMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onClick" />,
        { onClickMissed: handleClickMissed },
      )

      fireEvent(canvas, missEvent("click"))
      await settled()

      expect(handleClickMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is clicked with no meshes in the scene", async () => {
      const handleClickMissed = vi.fn()
      const { canvas } = await test(() => null, { onClickMissed: handleClickMissed })

      fireEvent(canvas, hitEvent("click"))
      await settled()

      expect(handleClickMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when click hits a registered mesh", async () => {
      const handleClickMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onClick" />,
        { onClickMissed: handleClickMissed },
      )

      fireEvent(canvas, hitEvent("click"))
      await settled()

      expect(handleClickMissed).not.toHaveBeenCalled()
    })
  })

  //
  // onDoubleClick
  //
  describe("onDoubleClick", () => {
    it("fires when canvas is double-clicked and no meshes are in the scene", async () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = await test(() => null, { onDoubleClick: handleDoubleClick })

      fireEvent(canvas, hitEvent("dblclick"))
      await settled()

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when double-click propagates through a mesh that does not stop it", async () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, hitEvent("dblclick"))
      await settled()

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("fires when double-click misses all meshes", async () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, missEvent("dblclick"))
      await settled()

      expect(handleDoubleClick).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleDoubleClick = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onDoubleClick" />,
        { onDoubleClick: handleDoubleClick },
      )

      fireEvent(canvas, hitEvent("dblclick"))
      await settled()

      expect(handleDoubleClick).not.toHaveBeenCalled()
    })
  })

  //
  // onDoubleClickMissed
  //
  describe("onDoubleClickMissed", () => {
    it("fires when double-click misses all registered meshes", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClickMissed: handleMissed },
      )

      fireEvent(canvas, missEvent("dblclick"))
      await settled()

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas is double-clicked with no meshes in the scene", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(() => null, { onDoubleClickMissed: handleMissed })

      fireEvent(canvas, hitEvent("dblclick"))
      await settled()

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when double-click hits a registered mesh", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onDoubleClick" />,
        { onDoubleClickMissed: handleMissed },
      )

      fireEvent(canvas, hitEvent("dblclick"))
      await settled()

      expect(handleMissed).not.toHaveBeenCalled()
    })
  })

  //
  // onContextMenu
  //
  describe("onContextMenu", () => {
    it("fires when canvas receives contextmenu and no meshes are in the scene", async () => {
      const handleContextMenu = vi.fn()
      const { canvas } = await test(() => null, { onContextMenu: handleContextMenu })

      fireEvent(canvas, hitEvent("contextmenu"))
      await settled()

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("fires when contextmenu propagates through a mesh that does not stop it", async () => {
      const handleContextMenu = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, hitEvent("contextmenu"))
      await settled()

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("fires when contextmenu misses all meshes", async () => {
      const handleContextMenu = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, missEvent("contextmenu"))
      await settled()

      expect(handleContextMenu).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleContextMenu = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onContextMenu" />,
        { onContextMenu: handleContextMenu },
      )

      fireEvent(canvas, hitEvent("contextmenu"))
      await settled()

      expect(handleContextMenu).not.toHaveBeenCalled()
    })
  })

  //
  // onContextMenuMissed
  //
  describe("onContextMenuMissed", () => {
    it("fires when contextmenu misses all registered meshes", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenuMissed: handleMissed },
      )

      fireEvent(canvas, missEvent("contextmenu"))
      await settled()

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("fires when canvas receives contextmenu with no meshes in the scene", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(() => null, { onContextMenuMissed: handleMissed })

      fireEvent(canvas, hitEvent("contextmenu"))
      await settled()

      expect(handleMissed).toHaveBeenCalledTimes(1)
    })

    it("does not fire when contextmenu hits a registered mesh", async () => {
      const handleMissed = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onContextMenu" />,
        { onContextMenuMissed: handleMissed },
      )

      fireEvent(canvas, hitEvent("contextmenu"))
      await settled()

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
  // onMouseDown
  //
  describe("onMouseDown", () => {
    it("fires when mousedown occurs with no meshes in the scene", async () => {
      const handleMouseDown = vi.fn()
      const { canvas } = await test(() => null, { onMouseDown: handleMouseDown })

      fireEvent(canvas, hitEvent("mousedown"))
      await settled()

      expect(handleMouseDown).toHaveBeenCalledTimes(1)
    })

    it("fires when mousedown propagates through a mesh that does not stop it", async () => {
      const handleMouseDown = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onMouseDown" />,
        { onMouseDown: handleMouseDown },
      )

      fireEvent(canvas, hitEvent("mousedown"))
      await settled()

      expect(handleMouseDown).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleMouseDown = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onMouseDown" />,
        { onMouseDown: handleMouseDown },
      )

      fireEvent(canvas, hitEvent("mousedown"))
      await settled()

      expect(handleMouseDown).not.toHaveBeenCalled()
    })
  })

  //
  // onMouseUp
  //
  describe("onMouseUp", () => {
    it("fires when mouseup occurs with no meshes in the scene", async () => {
      const handleMouseUp = vi.fn()
      const { canvas } = await test(() => null, { onMouseUp: handleMouseUp })

      fireEvent(canvas, hitEvent("mouseup"))
      await settled()

      expect(handleMouseUp).toHaveBeenCalledTimes(1)
    })

    it("fires when mouseup propagates through a mesh that does not stop it", async () => {
      const handleMouseUp = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onMouseUp" />,
        { onMouseUp: handleMouseUp },
      )

      fireEvent(canvas, hitEvent("mouseup"))
      await settled()

      expect(handleMouseUp).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleMouseUp = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onMouseUp" />,
        { onMouseUp: handleMouseUp },
      )

      fireEvent(canvas, hitEvent("mouseup"))
      await settled()

      expect(handleMouseUp).not.toHaveBeenCalled()
    })
  })

  //
  // onPointerDown
  //
  describe("onPointerDown", () => {
    it("fires when pointerdown occurs with no meshes in the scene", async () => {
      const handlePointerDown = vi.fn()
      const { canvas } = await test(() => null, { onPointerDown: handlePointerDown })

      fireEvent(canvas, hitEvent("pointerdown"))
      await settled()

      expect(handlePointerDown).toHaveBeenCalledTimes(1)
    })

    it("fires when pointerdown propagates through a mesh that does not stop it", async () => {
      const handlePointerDown = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onPointerDown" />,
        { onPointerDown: handlePointerDown },
      )

      fireEvent(canvas, hitEvent("pointerdown"))
      await settled()

      expect(handlePointerDown).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handlePointerDown = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onPointerDown" />,
        { onPointerDown: handlePointerDown },
      )

      fireEvent(canvas, hitEvent("pointerdown"))
      await settled()

      expect(handlePointerDown).not.toHaveBeenCalled()
    })
  })

  //
  // onPointerUp
  //
  describe("onPointerUp", () => {
    it("fires when pointerup occurs with no meshes in the scene", async () => {
      const handlePointerUp = vi.fn()
      const { canvas } = await test(() => null, { onPointerUp: handlePointerUp })

      fireEvent(canvas, hitEvent("pointerup"))
      await settled()

      expect(handlePointerUp).toHaveBeenCalledTimes(1)
    })

    it("fires when pointerup propagates through a mesh that does not stop it", async () => {
      const handlePointerUp = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onPointerUp" />,
        { onPointerUp: handlePointerUp },
      )

      fireEvent(canvas, hitEvent("pointerup"))
      await settled()

      expect(handlePointerUp).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handlePointerUp = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onPointerUp" />,
        { onPointerUp: handlePointerUp },
      )

      fireEvent(canvas, hitEvent("pointerup"))
      await settled()

      expect(handlePointerUp).not.toHaveBeenCalled()
    })
  })

  //
  // onWheel
  //
  describe("onWheel", () => {
    it("fires when wheel event occurs with no meshes in the scene", async () => {
      const handleWheel = vi.fn()
      const { canvas } = await test(() => null, { onWheel: handleWheel })

      const event = new WheelEvent("wheel", { deltaY: 100 })
      Object.defineProperty(event, "offsetX", { get: () => HIT_X })
      Object.defineProperty(event, "offsetY", { get: () => HIT_Y })
      fireEvent(canvas, event)
      await settled()

      expect(handleWheel).toHaveBeenCalledTimes(1)
    })

    it("fires when wheel event propagates through a mesh that does not stop it", async () => {
      const handleWheel = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onWheel" />,
        { onWheel: handleWheel },
      )

      const event = new WheelEvent("wheel", { deltaY: 100 })
      Object.defineProperty(event, "offsetX", { get: () => HIT_X })
      Object.defineProperty(event, "offsetY", { get: () => HIT_Y })
      fireEvent(canvas, event)
      await settled()

      expect(handleWheel).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleWheel = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onWheel" />,
        { onWheel: handleWheel },
      )

      const event = new WheelEvent("wheel", { deltaY: 100 })
      Object.defineProperty(event, "offsetX", { get: () => HIT_X })
      Object.defineProperty(event, "offsetY", { get: () => HIT_Y })
      fireEvent(canvas, event)
      await settled()

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
    it("fires when the pointer first moves over the canvas", async () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = await test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
    })

    it("fires only once per canvas hover session", async () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = await test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerEnter).toHaveBeenCalledTimes(1)
    })

    it("fires again after the pointer has left and re-entered", async () => {
      const handlePointerEnter = vi.fn()
      const { canvas } = await test(() => null, { onPointerEnter: handlePointerEnter })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, makeEvent("pointerleave", HIT_X, HIT_Y))
      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerEnter).toHaveBeenCalledTimes(2)
    })
  })

  describe("onPointerLeave", () => {
    it("fires when the pointer leaves the canvas", async () => {
      const handlePointerLeave = vi.fn()
      const { canvas } = await test(() => null, { onPointerLeave: handlePointerLeave })

      fireEvent(canvas, hitEvent("pointermove"))
      fireEvent(canvas, makeEvent("pointerleave", HIT_X, HIT_Y))
      await settled()

      expect(handlePointerLeave).toHaveBeenCalledTimes(1)
    })
  })

  describe("onPointerMove", () => {
    it("fires when the pointer moves over the canvas with no meshes", async () => {
      const handlePointerMove = vi.fn()
      const { canvas } = await test(() => null, { onPointerMove: handlePointerMove })

      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerMove).toHaveBeenCalledTimes(1)
    })

    it("fires when pointer move propagates through a mesh that does not stop it", async () => {
      const handlePointerMove = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onPointerMove" />,
        { onPointerMove: handlePointerMove },
      )

      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerMove).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handlePointerMove = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onPointerMove" />,
        { onPointerMove: handlePointerMove },
      )

      fireEvent(canvas, hitEvent("pointermove"))
      await settled()

      expect(handlePointerMove).not.toHaveBeenCalled()
    })
  })

  //
  // onMouseEnter / onMouseLeave / onMouseMove
  //
  describe("onMouseEnter", () => {
    it("fires when the mouse first moves over the canvas", async () => {
      const handleMouseEnter = vi.fn()
      const { canvas } = await test(() => null, { onMouseEnter: handleMouseEnter })

      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseEnter).toHaveBeenCalledTimes(1)
    })

    it("fires only once per canvas hover session", async () => {
      const handleMouseEnter = vi.fn()
      const { canvas } = await test(() => null, { onMouseEnter: handleMouseEnter })

      fireEvent(canvas, hitEvent("mousemove"))
      fireEvent(canvas, hitEvent("mousemove"))
      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseEnter).toHaveBeenCalledTimes(1)
    })

    it("fires again after the mouse has left and re-entered", async () => {
      const handleMouseEnter = vi.fn()
      const { canvas } = await test(() => null, { onMouseEnter: handleMouseEnter })

      fireEvent(canvas, hitEvent("mousemove"))
      fireEvent(canvas, makeEvent("mouseleave", HIT_X, HIT_Y))
      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseEnter).toHaveBeenCalledTimes(2)
    })
  })

  describe("onMouseLeave", () => {
    it("fires when the mouse leaves the canvas", async () => {
      const handleMouseLeave = vi.fn()
      const { canvas } = await test(() => null, { onMouseLeave: handleMouseLeave })

      fireEvent(canvas, hitEvent("mousemove"))
      fireEvent(canvas, makeEvent("mouseleave", HIT_X, HIT_Y))
      await settled()

      expect(handleMouseLeave).toHaveBeenCalledTimes(1)
    })
  })

  describe("onMouseMove", () => {
    it("fires when the mouse moves over the canvas with no meshes", async () => {
      const handleMouseMove = vi.fn()
      const { canvas } = await test(() => null, { onMouseMove: handleMouseMove })

      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseMove).toHaveBeenCalledTimes(1)
    })

    it("fires when mouse move propagates through a mesh that does not stop it", async () => {
      const handleMouseMove = vi.fn()
      const { canvas } = await test(
        () => <ListeningMesh eventType="onMouseMove" />,
        { onMouseMove: handleMouseMove },
      )

      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseMove).toHaveBeenCalledTimes(1)
    })

    it("does not fire when a mesh stops propagation", async () => {
      const handleMouseMove = vi.fn()
      const { canvas } = await test(
        () => <StoppingMesh eventType="onMouseMove" />,
        { onMouseMove: handleMouseMove },
      )

      fireEvent(canvas, hitEvent("mousemove"))
      await settled()

      expect(handleMouseMove).not.toHaveBeenCalled()
    })
  })
})
