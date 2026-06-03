import { Vector2, type Object3D } from "three"
import { Pointer } from "./pointers.ts"
import { ControllerRaycaster, type ScreenRaycaster } from "./raycasters.tsx"
import type { Context } from "./types.ts"

type RayEvent = PointerEvent | MouseEvent | WheelEvent

/**
 * The built-in screen pointer source. Owns the canvas's pointer/click/wheel
 * listeners, one `Pointer` per native `pointerId` (so multi-touch tracks
 * independently), and a `primary` `Pointer` for the family-agnostic
 * click/dblclick/contextmenu/wheel gestures — those are `MouseEvent`s with no
 * `pointerId`, so they don't belong to a specific touch.
 *
 * It aims the (single, shared) screen raycaster from each event before calling
 * the pointer's gesture method; that's safe because `setCursor` → `cast` runs
 * synchronously within one event, so concurrent pointers never collide.
 */
export class DOMPointerManager {
  private pointers = new Map<number, Pointer>()
  private primary: Pointer

  constructor(
    private context: Context,
    private raycaster: ScreenRaycaster,
  ) {
    this.primary = new Pointer(context, raycaster)
  }

  private forId(id: number): Pointer {
    let pointer = this.pointers.get(id)
    if (!pointer) {
      pointer = new Pointer(this.context, this.raycaster)
      this.pointers.set(id, pointer)
    }
    return pointer
  }

  private ndc(event: RayEvent): Vector2 {
    const { width, height } = this.context.bounds
    return new Vector2((event.offsetX / width) * 2 - 1, -(event.offsetY / height) * 2 + 1)
  }

  /** Attach all canvas listeners; returns a disconnect that removes them. */
  connect(): () => void {
    const canvas = this.context.canvas
    const aim = (event: RayEvent) => this.raycaster.setCursor(this.ndc(event))

    const onMove = (event: PointerEvent) => {
      aim(event)
      this.forId(event.pointerId).move(event)
    }
    const onDown = (event: PointerEvent) => {
      aim(event)
      this.forId(event.pointerId).down(event)
    }
    const onUp = (event: PointerEvent) => {
      aim(event)
      this.forId(event.pointerId).up(event)
      // A lifted touch no longer exists — leave + drop it so it keeps no state.
      if (event.pointerType === "touch") {
        this.pointers.get(event.pointerId)?.leave(event)
        this.pointers.delete(event.pointerId)
      }
    }
    const onLeaveOrCancel = (event: PointerEvent) => {
      // Always fire the canvas-level leave (a fresh pointer's leave does that even
      // with nothing hovered), matching the old per-session leave behavior.
      this.forId(event.pointerId).leave(event)
      this.pointers.delete(event.pointerId)
    }
    const onClick = (event: MouseEvent) => {
      aim(event)
      this.primary.click("onClick", event)
    }
    const onDoubleClick = (event: MouseEvent) => {
      aim(event)
      this.primary.click("onDoubleClick", event)
    }
    const onContextMenu = (event: MouseEvent) => {
      aim(event)
      this.primary.click("onContextMenu", event)
    }
    const onWheel = (event: WheelEvent) => {
      aim(event)
      this.primary.wheel(event)
    }

    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointerleave", onLeaveOrCancel)
    canvas.addEventListener("pointercancel", onLeaveOrCancel)
    canvas.addEventListener("click", onClick)
    canvas.addEventListener("dblclick", onDoubleClick)
    canvas.addEventListener("contextmenu", onContextMenu)
    canvas.addEventListener("wheel", onWheel, { passive: true })

    return () => {
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointerleave", onLeaveOrCancel)
      canvas.removeEventListener("pointercancel", onLeaveOrCancel)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("dblclick", onDoubleClick)
      canvas.removeEventListener("contextmenu", onContextMenu)
      canvas.removeEventListener("wheel", onWheel)
    }
  }
}

/** A controller's targetRay space that also dispatches XR select events. */
type SelectTarget = {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/**
 * Wires XR controllers as pointers. three's `renderer.xr.getController(i)` returns
 * an `Object3D` that is both the controller's targetRay space (its `matrixWorld`
 * aims the ray) and the dispatcher of `selectstart`/`selectend`. Each controller
 * gets its own `Pointer` (with a `ControllerRaycaster`); a select press/release
 * drives `onPointerDown`/`onPointerUp`, and a release synthesizes `onClick`
 * (controllers have no DOM click). Event-driven only — continuous sweep-hover
 * needs a per-frame tick and is out of scope here.
 */
export class XRPointerManager {
  private cleanups: Array<() => void> = []

  constructor(
    private context: Context,
    private xr: { getController(index: number): Object3D },
    private count = 2,
  ) {}

  connect(): () => void {
    for (let index = 0; index < this.count; index++) {
      const controller = this.xr.getController(index)
      const pointer = new Pointer(this.context, new ControllerRaycaster(controller))
      const target = controller as unknown as SelectTarget

      const onSelectStart = () => pointer.down(new Event("selectstart"))
      const onSelectEnd = () => {
        pointer.up(new Event("selectend"))
        pointer.click("onClick", new Event("click"))
      }

      target.addEventListener("selectstart", onSelectStart)
      target.addEventListener("selectend", onSelectEnd)
      this.cleanups.push(() => {
        target.removeEventListener("selectstart", onSelectStart)
        target.removeEventListener("selectend", onSelectEnd)
      })
    }
    return () => {
      for (const cleanup of this.cleanups) cleanup()
      this.cleanups = []
    }
  }
}
