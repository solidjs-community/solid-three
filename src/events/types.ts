import type { Intersection, Object3D, Vector3 as ThreeVector3 } from "three"
import type { Intersect, Prettify, When } from "../types.ts"

/**********************************************************************************/
/*                                                                                */
/*                                      Event                                     */
/*                                                                                */
/**********************************************************************************/

export type ThreeEvent<
  TEvent,
  TConfig extends { stoppable?: boolean; intersections?: boolean } = {
    stoppable: true
    intersections: true
  },
> = Intersect<
  [
    {
      nativeEvent: TEvent
      /**
       * The object a bubbled handler is currently firing on (the ancestor reached
       * while walking up the hit chain), or `undefined` for the canvas-level
       * dispatch — the 3D analogue of a DOM event's `currentTarget`, so it's only
       * valid during the handler. Set by `Pointer.dispatch`; plugin sources read it.
       */
      currentObject?: Object3D
    },
    When<
      TConfig["stoppable"],
      {
        stopped: boolean
        stopPropagation: () => void
      }
    >,
    When<
      TConfig["intersections"],
      {
        currentIntersection: Intersection
        intersection: Intersection
        intersections: Intersection[]
        /** The closest hit object — `intersections[0].object`. The 3D analogue of a DOM event's `target`; stable after dispatch. */
        object: Object3D
      }
    >,
  ]
>

export type PointerCapture = {
  /**
   * Capture this event's pointer to an object — by default the node the handler is
   * firing on (`event.currentObject`). Subsequent move/up for this pointer deliver
   * exclusively to that object's chain (still bubbling to the canvas-level handler)
   * until released — even off-ray and, for the DOM source, off-canvas. Off-ray,
   * `event.intersection` is reprojected onto the captured plane so `point` keeps tracking.
   *
   * Options:
   * - `object` — capture this object instead of `event.currentObject`. Required to
   *   start a capture later (after an `await`/timer), since `currentObject` is cleared
   *   after dispatch (like a DOM event's `currentTarget`); with no live hit the drag
   *   plane is camera-facing through the object's centre.
   * - `normal` — a world-space normal for the drag plane, through the grab point,
   *   instead of the default (the hit surface's normal, or camera-facing). Use it to
   *   constrain a drag, e.g. `{ normal: new Vector3(0, 1, 0) }` to slide on the ground.
   *
   * With no `object`, call it synchronously in the handler.
   */
  setPointerCapture(options?: { object?: Object3D; normal?: ThreeVector3 }): void
  /**
   * Release a capture started with `setPointerCapture`. Also released
   * automatically on pointerup/cancel for the DOM source, and on the paired end
   * event for XR.
   */
  releasePointerCapture(): void
  /** Whether `object` (default: this event's `currentObject`) currently holds the pointer capture. */
  hasPointerCapture(object?: Object3D): boolean
}

export type EventHandlersMap = {
  onClick: Prettify<ThreeEvent<MouseEvent>>
  onDoubleClick: Prettify<ThreeEvent<MouseEvent>>
  onContextMenu: Prettify<ThreeEvent<MouseEvent>>
  onPointerUp: Prettify<ThreeEvent<PointerEvent> & PointerCapture>
  onPointerDown: Prettify<ThreeEvent<PointerEvent> & PointerCapture>
  onPointerMove: Prettify<ThreeEvent<PointerEvent> & PointerCapture>
  onPointerEnter: Prettify<ThreeEvent<PointerEvent, { stoppable: false }>>
  onPointerLeave: Prettify<ThreeEvent<PointerEvent, { stoppable: false }>>
  onWheel: Prettify<ThreeEvent<WheelEvent>>
  // The miss. Object-level fires on every registered object the click did not land on;
  // canvas-level fires only on a total miss. Non-stoppable, no intersection payload.
  onPointerMissed: Prettify<ThreeEvent<MouseEvent, { stoppable: false; intersections: false }>>
}

/** The handler a user writes for each event, keyed by its prop name. */
export type EventHandlers = {
  [TKey in keyof EventHandlersMap]: (event: EventHandlersMap[TKey]) => void
}

/**
 * What the engine's plugin contributes to each `Object3D`: one method per event
 * name, taking the user's handler as its prop value. A contributed method's
 * first-param type becomes the element's prop type, so this is what makes
 * `onClick` a prop of `T.Mesh` — and only when the engine is installed.
 */
export type PointerEventMethods = {
  [TKey in keyof EventHandlersMap]: (handler: EventHandlers[TKey]) => void
}

/** The names of all `EventHandlers` */
export type EventName = keyof EventHandlersMap
