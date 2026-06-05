import { onCleanup } from "solid-js"
import { Object3D } from "three"
import { DOMPointerManager } from "./pointer-managers.ts"
import { CursorRaycaster, type ScreenRaycaster } from "./raycasters.tsx"
import type { Context, EventName, Meta } from "./types.ts"

/**********************************************************************************/
/*                                                                                */
/*                                   Is Event Type                                */
/*                                                                                */
/**********************************************************************************/

/**
 * Checks if a given prop key is a pointer-event handler.
 *
 * @param type - The prop key to check.
 * @returns `true` if the key is a recognized pointer-event handler.
 */
export const isEventType = (type: string): type is EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(type)

/**********************************************************************************/
/*                                                                                */
/*                                  Create Events                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Wires the pointer-event system. Registers handler-bearing objects into the
 * single `context.eventRegistry`, and connects the built-in screen pointer
 * source (`DOMPointerManager`), which raycasts that registry and dispatches via
 * per-`pointerId` `Pointer`s. XR controllers are added as further pointers by
 * the XR layer through the same registry.
 */
export function createEvents(context: Context) {
  // The screen pointer's ray strategy: the configured `raycaster` (default
  // `CursorRaycaster`) when it's a screen raycaster, else a fresh one.
  const candidate = context.raycaster
  const screenRaycaster: ScreenRaycaster =
    "setCursor" in candidate && "cast" in candidate
      ? (candidate as ScreenRaycaster)
      : new CursorRaycaster()
  const manager = new DOMPointerManager(context, screenRaycaster)
  // Remove the canvas listeners when the Canvas owner disposes.
  onCleanup(manager.connect())

  // The single registry the pointer system raycasts; refcounted so an object
  // listening for several event types is listed exactly once.
  const refCounts = new Map<Object3D, number>()
  function addToRegistry(object: Object3D) {
    const count = refCounts.get(object) ?? 0
    if (count === 0) context.eventRegistry.push(object)
    refCounts.set(object, count + 1)
    return () => {
      const current = refCounts.get(object)
      if (current === undefined) return
      if (current <= 1) {
        refCounts.delete(object)
        const index = context.eventRegistry.indexOf(object)
        if (index !== -1) context.eventRegistry.splice(index, 1)
        // The object is gone (unmount / last handler removed) — drop any active
        // capture targeting it so a drag stops dispatching to a detached node.
        manager.releaseCaptured(object)
      } else {
        refCounts.set(object, current - 1)
      }
    }
  }

  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the pointer-event system.
     *
     * @param object - The 3D object to register.
     * @param _type - The handler type (accepted for API compatibility; the single
     *   registry is not keyed by type).
     */
    addEventListener(object: Meta<Object3D>, _type: EventName) {
      return addToRegistry(object)
    },
  }
}
