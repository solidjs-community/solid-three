import { onCleanup } from "solid-js"
import { Object3D, type Intersection } from "three"
import { plugin } from "./plugin.ts"
import { type Context, type Intersect, type Meta, type Prettify, type When } from "./types.ts"
import { getMeta } from "./utils.ts"

const EVENT_NAME_MAP = {
  onClick: "click",
  onContextMenu: "contextmenu",
  onDoubleClick: "dblclick",
  onMouseDown: "mousedown",
  onMouseMove: "mousemove",
  onMouseUp: "mouseup",
  onMouseLeave: "mouseleave",
  onPointerUp: "pointerup",
  onPointerDown: "pointerdown",
  onPointerMove: "pointermove",
  onPointerLeave: "pointerleave",
  onWheel: "wheel",
} as const

/**********************************************************************************/
/*                                                                                */
/*                                      Event                                     */
/*                                                                                */
/**********************************************************************************/

export type Event<
  TEvent,
  TConfig extends { stoppable?: boolean; intersections?: boolean } = {
    stoppable: true
    intersections: true
  },
> = Prettify<
  Intersect<
    [
      { nativeEvent: TEvent },
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
        }
      >,
    ]
  >
>

type EventHandlersMap = {
  onClick: Prettify<Event<MouseEvent>>
  onClickMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onDoubleClick: Prettify<Event<MouseEvent>>
  onDoubleClickMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onContextMenu: Prettify<Event<MouseEvent>>
  onContextMenuMissed: Prettify<Event<MouseEvent, { stoppable: false; intersections: false }>>
  onMouseDown: Prettify<Event<MouseEvent>>
  onMouseEnter: Prettify<Event<MouseEvent, { stoppable: false }>>
  onMouseLeave: Prettify<Event<MouseEvent, { stoppable: false }>>
  onMouseMove: Prettify<Event<MouseEvent>>
  onMouseUp: Prettify<Event<MouseEvent>>
  onPointerUp: Prettify<Event<PointerEvent>>
  onPointerDown: Prettify<Event<PointerEvent>>
  onPointerMove: Prettify<Event<PointerEvent>>
  onPointerEnter: Prettify<Event<PointerEvent, { stoppable: false }>>
  onPointerLeave: Prettify<Event<PointerEvent, { stoppable: false }>>
  onWheel: Prettify<Event<WheelEvent>>
}

export type EventHandlers = {
  [TKey in keyof EventHandlersMap]: (event: EventHandlersMap[TKey]) => void
}

export type EventListeners = {
  [TKey in keyof EventHandlersMap]: (cb: (event: EventHandlersMap[TKey]) => void) => void
}

export type CanvasEventHandlers = {
  [TKey in keyof EventHandlersMap]: (
    event: Prettify<Omit<EventHandlersMap[TKey], "currentIntersection">>,
  ) => void
}

export type EventName = keyof EventHandlersMap

/**********************************************************************************/
/*                                                                                */
/*                                   Create Event                                 */
/*                                                                                */
/**********************************************************************************/

//
/** Creates a `ThreeEvent` (intersection excluded) from the current `MouseEvent` | `WheelEvent`. */
function createEvent<
  TEvent extends globalThis.Event,
  TConfig extends { stoppable?: boolean; intersections?: Array<Intersection> },
>(nativeEvent: TEvent, config?: TConfig) {
  const { stoppable = true, intersections } = config ?? {}
  const event: Record<string, any> = stoppable
    ? {
        nativeEvent,
        stopped: false,
        stopPropagation() {
          event.stopped = true
        },
      }
    : { nativeEvent }

  if (intersections) {
    event.intersections = intersections
    event.intersection = intersections[0]
  }

  return event as Prettify<
    Omit<
      Event<
        TEvent,
        {
          stoppable: TConfig["stoppable"] extends false
            ? TConfig["stoppable"] extends true
              ? true
              : false
            : true
          intersections: TConfig["intersections"] extends Intersection[] ? true : false
        }
      >,
      "currentIntersection"
    >
  >
}

/**********************************************************************************/
/*                                                                                */
/*                                     Raycast                                    */
/*                                                                                */
/**********************************************************************************/

/**
 * Performs a raycast from the camera through the mouse position to find intersecting 3D objects.
 */
function raycast<TNativeEvent extends MouseEvent | WheelEvent>(
  context: Context,
  registry: Object3D[],
  event: TNativeEvent,
): Intersection<Meta<Object3D>>[] {
  if ("update" in context.currentRaycaster) {
    context.currentRaycaster.update(event, context)
  }

  const nodeSet = new Set<Object3D>()
  const visitedSet = new Set<Object3D>()
  const stack = [...registry]

  // Collect all unique descendants of registry
  for (const object of stack) {
    if (visitedSet.has(object)) continue
    visitedSet.add(object)

    const meta = getMeta(object)
    if (meta && meta.props.raycastable !== false) {
      nodeSet.add(object)
    }

    stack.push(...object.children)
  }

  return context.currentRaycaster.intersectObjects(nodeSet.values().toArray(), false)
}

/**********************************************************************************/
/*                                                                                */
/*                                   Auto Registry                                */
/*                                                                                */
/**********************************************************************************/

function createAutoRegistry<T>() {
  const array: T[] = []

  return {
    array,
    add(instance: T) {
      array.push(instance)
      onCleanup(() => {
        array.splice(
          array.findIndex(_instance => _instance === instance),
          1,
        )
      })
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                           Create Missable Event Registry                       */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `MissableEvents`:
 * - `onClick` / `onClickMissed`
 * - `onContextMenu` / `onContextMenuMissed`
 * - `onDoubleClick` / `onDoubleClickMissed`
 */
function createMissableEventRegistry(
  type: "onClick" | "onDoubleClick" | "onContextMenu",
  context: Context,
) {
  const registry = createAutoRegistry<Object3D>()

  context.canvas.addEventListener(EVENT_NAME_MAP[type], nativeEvent => {
    if (registry.array.length === 0) return
    const missedType = `${type}Missed` as const

    // Track which objects have been visited during event processing
    const missedObjects = new Set(registry.array)
    const visitedObjects = new Set()

    // Phase #1 - Process normal click events
    const intersections = raycast(context, registry.array, nativeEvent)

    const stoppableEvent = createEvent(nativeEvent, { intersections })

    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      stoppableEvent.currentIntersection = intersection

      // Bubble down
      let node: Object3D | null = intersection.object
      while (node && !stoppableEvent.stopped && !visitedObjects.has(node)) {
        missedObjects.delete(node)
        visitedObjects.add(node)
        getMeta(node)?.props[type]?.(stoppableEvent)
        node = node.parent
      }
    }

    // Call the respective canvas event-handler
    // if event propagated all the way down
    if (!stoppableEvent.stopped) {
      // Remove currentIntersection
      // @ts-expect-error TODO: fix type-error
      delete stoppableEvent.currentIntersection

      // @ts-expect-error TODO: fix type-error
      context.props[type]?.(stoppableEvent)
    }

    // Phase #2 - Raycast remaining missed objects
    for (const remainingObject of missedObjects) {
      const intersections = context.currentRaycaster.intersectObject(remainingObject, true)

      // Bubble down intersections
      // if they haven't been visited before:
      // - add object to visitedObjects
      // - remove from remainingObjects,
      for (const { object } of intersections) {
        let node: Object3D | null = object
        while (node && !visitedObjects.has(node)) {
          missedObjects.delete(node)
          visitedObjects.add(node)
          node = node.parent
        }
      }
    }

    // Phase #3 - Fire missed event-handler on missed objects
    const missedEvent = createEvent(nativeEvent, { stoppable: false })

    for (const object of missedObjects) {
      getMeta(object)?.props[missedType]?.(missedEvent)
    }

    if (visitedObjects.size > 0) {
      // @ts-expect-error TODO: fix type-error
      context.props[`${type}Missed`]?.(missedEvent)
    }
  })

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Hover Event Registry                         */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `HoverEvents`:
 * - Mouse
 *    - `onMouseEnter`
 *    - `onMouseMove`
 *    - `onMouseLeave`
 * - Pointer
 *    - `onPointerEnter`
 *    - `onPointerMove`
 *    - `onPointerLeave`
 */
function createHoverEventRegistry(type: "Mouse" | "Pointer", context: Context) {
  const registry = createAutoRegistry<Object3D>()
  let hoveredSet = new Set<Object3D>()
  let intersections: Intersection<Meta<Object3D>>[] = []
  let hoveredCanvas = false

  context.canvas.addEventListener(EVENT_NAME_MAP[`on${type}Move`], nativeEvent => {
    intersections = raycast(context, registry.array, nativeEvent)

    // Phase #1 - Enter
    const enterEvent = createEvent(nativeEvent, { stoppable: false, intersections })
    const enterSet = new Set<Object3D>()

    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      enterEvent.currentIntersection = intersection

      // Bubble up
      let current: Object3D | null = intersection.object
      while (current && !enterSet.has(current)) {
        enterSet.add(current)
        if (!hoveredSet.has(current)) {
          getMeta(current)?.props[`on${type}Enter`]?.(enterEvent)
        }

        // We bubble a layer down.
        current = current.parent
      }
    }

    if (hoveredCanvas === false) {
      // @ts-expect-error TODO: fix type-error
      context.props[`on${type}Enter`]?.(enterEvent)
      hoveredCanvas = true
    }

    // Phase #2 - Move
    const moveEvent = createEvent(nativeEvent, { intersections })
    const moveSet = new Set()

    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      moveEvent.currentIntersection = intersection

      // Bubble up
      let current: Object3D | null = intersection.object

      while (current && !moveSet.has(current)) {
        moveSet.add(current)
        const meta = getMeta(current)
        if (meta) {
          meta.props[`on${type}Move`]?.(moveEvent)
          // Break if event was
          if (moveEvent.stopped) {
            break
          }
        }
        // We bubble a layer down.
        current = current.parent
      }
    }

    if (!moveEvent.stopped) {
      // Remove currentIntersection
      // @ts-expect-error TODO: fix type-error
      delete moveEvent.currentIntersection
      // @ts-expect-error TODO: fix type-error
      context.props[`on${type}Move`]?.(moveEvent)
    }

    // Handle leave-event
    const leaveEvent = createEvent(nativeEvent, { intersections, stoppable: false })
    const leaveSet = hoveredSet.difference(enterSet)
    hoveredSet = enterSet

    for (const object of leaveSet.values()) {
      getMeta(object)?.props[`on${type}Leave`]?.(leaveEvent)
    }
  })

  context.canvas.addEventListener(EVENT_NAME_MAP[`on${type}Leave`], nativeEvent => {
    const leaveEvent = createEvent(nativeEvent, { stoppable: false })
    // @ts-expect-error TODO: fix type-error
    context.props[`on${type}Leave`]?.(leaveEvent)
    hoveredCanvas = false

    for (const object of hoveredSet) {
      getMeta(object)?.props[`on${type}Leave`]?.(leaveEvent)
    }
    hoveredSet.clear()
  })

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                            Create Default Event Registry                       */
/*                                                                                */
/**********************************************************************************/

/**
 * A registry for `DefaultEvents`:
 * - `onMouseDown`
 * - `onMouseUp`
 * - `onPointerDown`
 * - `onPointerUp`
 * - `onWheel`
 */
function createDefaultEventRegistry(
  type: "onMouseDown" | "onMouseUp" | "onPointerDown" | "onPointerUp" | "onWheel",
  context: Context,
  options?: AddEventListenerOptions,
) {
  const registry = createAutoRegistry<Object3D>()

  context.canvas.addEventListener(
    EVENT_NAME_MAP[type],
    nativeEvent => {
      const intersections = raycast(context, registry.array, nativeEvent)
      const event = createEvent(nativeEvent, { intersections })

      const visitedNodes = new Set()

      for (const intersection of intersections) {
        // Update currentIntersection
        // @ts-expect-error TODO: fix type-error
        event.currentIntersection = intersection

        // Bubble up
        let node: Object3D | null = intersection.object

        while (node && !event.stopped && !visitedNodes.has(node)) {
          getMeta(node)?.props[type]?.(event)
          visitedNodes.add(node)
          node = node.parent
        }
      }

      if (!event.stopped) {
        // Remove currentIntersection
        // @ts-expect-error TODO: fix type-error
        delete event.currentIntersection

        // @ts-expect-error TODO: fix type-error
        context.props[type]?.(event)
      }
    },
    options,
  )

  return registry
}

/**********************************************************************************/
/*                                                                                */
/*                                  Create Events                                 */
/*                                                                                */
/**********************************************************************************/

/**
 * Initializes and manages event handling for all `Instance<Object3D>`.
 */
export const EventPlugin = plugin
  .setup(context => ({
    // onMouseMove/onMouseEnter/onMouseLeave
    hoverMouses: createHoverEventRegistry("Mouse", context),
    // onPointerMove/onPointerEnter/onPointerLeave
    hoverPointers: createHoverEventRegistry("Pointer", context),
    // onClick/onClickMissed
    missableClicks: createMissableEventRegistry("onClick", context),
    // onContextMenu/onContextMenuMissed
    missableContextMenus: createMissableEventRegistry("onContextMenu", context),
    // onDoubleClick/onDoubleClickMissed
    missableDoubleClicks: createMissableEventRegistry("onDoubleClick", context),
    // Default mouse-events
    mouseDowns: createDefaultEventRegistry("onMouseDown", context),
    mouseUps: createDefaultEventRegistry("onMouseUp", context),
    // Default pointer-events
    pointerDowns: createDefaultEventRegistry("onPointerDown", context),
    pointerUps: createDefaultEventRegistry("onPointerUp", context),
    // Default wheel-event
    wheels: createDefaultEventRegistry("onWheel", context, { passive: true }),
  }))
  .then(
    (
      object,
      {
        hoverMouses,
        hoverPointers,
        missableClicks,
        missableContextMenus,
        missableDoubleClicks,
        mouseDowns,
        mouseUps,
        pointerDowns,
        pointerUps,
        wheels,
      },
    ): EventListeners => {
      return {
        onClick() {
          missableClicks.add(object)
        },
        onClickMissed() {
          missableClicks.add(object)
        },
        onDoubleClick() {
          missableDoubleClicks.add(object)
        },
        onDoubleClickMissed() {
          missableDoubleClicks.add(object)
        },
        onContextMenu() {
          missableContextMenus.add(object)
        },
        onContextMenuMissed() {
          missableContextMenus.add(object)
        },
        onMouseDown() {
          mouseDowns.add(object)
        },
        onMouseUp() {
          mouseUps.add(object)
        },
        onMouseMove() {
          hoverMouses.add(object)
        },
        onMouseEnter() {
          hoverMouses.add(object)
        },
        onMouseLeave() {
          hoverMouses.add(object)
        },
        onPointerDown() {
          pointerDowns.add(object)
        },
        onPointerUp() {
          pointerUps.add(object)
        },
        onPointerMove() {
          hoverPointers.add(object)
        },
        onPointerEnter() {
          hoverPointers.add(object)
        },
        onPointerLeave() {
          hoverMouses.add(object)
        },
        onWheel() {
          wheels.add(object)
        },
      }
    },
  )
