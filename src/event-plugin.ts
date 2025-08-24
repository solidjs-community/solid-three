import { onCleanup } from "solid-js"
import { Object3D, type Intersection } from "three"
import { useThree } from "./hooks.ts"
import type { Context, Event, EventName, Meta, Plugin, Prettify } from "./types.ts"
import { getMeta } from "./utils.ts"

const eventNameMap = {
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

function createRegistry<T>() {
  const array: T[] = []

  return {
    array,
    add(instance: T) {
      array.push(instance)
      return () => {
        array.splice(
          array.findIndex(_instance => _instance === instance),
          1,
        )
      }
    },
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                   Is Event Type                                */
/*                                                                                */
/**********************************************************************************/

/**
 * Checks if a given string is a valid event type within the system.
 *
 * @param type - The type of the event to check.
 * @returns `true` if the type is a recognized `EventType`, otherwise `false`.
 */
export const isEventType = (type: string): type is EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type)

/**********************************************************************************/
/*                                                                                */
/*                                      Events                                    */
/*                                                                                */
/**********************************************************************************/
//
/** Creates a `ThreeEvent` (intersection excluded) from the current `MouseEvent` | `WheelEvent`. */
function createThreeEvent<
  TEvent extends Event,
  TConfig extends { stoppable?: boolean; intersections?: Array<Intersection> },
>(nativeEvent: TEvent, { stoppable = true, intersections }: TConfig = {}) {
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
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(eventNameMap[type], nativeEvent => {
    if (registry.array.length === 0) return
    const missedType = `${type}Missed` as const

    // Track which objects have been visited during event processing
    const missedObjects = new Set(registry.array)
    const visitedObjects = new Set()

    // Phase #1 - Process normal click events
    const intersections = raycast(context, registry.array, nativeEvent)

    const stoppableEvent = createThreeEvent(nativeEvent, { intersections })

    for (const intersection of intersections) {
      // Update currentIntersection
      // @ts-expect-error TODO: fix type-error
      stoppableEvent.currentIntersection = intersection

      // Bubble down
      let node: Object3D | null = intersection.object
      while (node && !stoppableEvent.stopped && !visitedObjects.has(node)) {
        missedObjects.delete(node)
        visitedObjects.add(node)
        getMeta(node)?.props[type]?.(
          // @ts-expect-error TODO: fix type-error
          stoppableEvent,
        )
        node = node.parent
      }
    }

    // Call the respective canvas event-handler
    // if event propagated all the way down
    if (!stoppableEvent.stopped) {
      // Remove currentIntersection
      // @ts-expect-error TODO: fix type-error
      delete stoppableEvent.currentIntersection
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
    const missedEvent = createThreeEvent(nativeEvent, { stoppable: false })

    for (const object of missedObjects) {
      getMeta(object)?.props[missedType]?.(missedEvent)
    }

    if (visitedObjects.size > 0) {
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
  const registry = createRegistry<Object3D>()
  let hoveredSet = new Set<Object3D>()
  let intersections: Intersection<Meta<Object3D>>[] = []
  let hoveredCanvas = false

  context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
    intersections = raycast(context, registry.array, nativeEvent)

    // Phase #1 - Enter
    const enterEvent = createThreeEvent(nativeEvent, { stoppable: false, intersections })
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
          getMeta(current)?.props[`on${type}Enter`]?.(
            // @ts-expect-error TODO: fix type-error
            enterEvent,
          )
        }

        // We bubble a layer down.
        current = current.parent
      }
    }

    if (hoveredCanvas === false) {
      context.props[`on${type}Enter`]?.(
        // @ts-expect-error TODO: fix type-error
        enterEvent,
      )
      hoveredCanvas = true
    }

    // Phase #2 - Move
    const moveEvent = createThreeEvent(nativeEvent, { intersections })
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
          meta.props[`on${type}Move`]?.(
            // @ts-expect-error TODO: fix type-error
            moveEvent,
          )
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
      context.props[`on${type}Move`]?.(
        // @ts-expect-error TODO: fix type-error
        moveEvent,
      )
    }

    // Handle leave-event
    const leaveEvent = createThreeEvent(nativeEvent, { intersections, stoppable: false })
    const leaveSet = hoveredSet.difference(enterSet)
    hoveredSet = enterSet

    for (const object of leaveSet.values()) {
      getMeta(object)?.props[`on${type}Leave`]?.(
        // @ts-expect-error TODO: fix type-error
        leaveEvent,
      )
    }
  })

  context.canvas.addEventListener(eventNameMap[`on${type}Leave`], nativeEvent => {
    const leaveEvent = createThreeEvent(nativeEvent, { stoppable: false })
    // @ts-expect-error TODO: fix type-error
    context.props[`on${type}Leave`]?.(leaveEvent)
    hoveredCanvas = false

    for (const object of hoveredSet) {
      getMeta(object)?.props[`on${type}Leave`]?.(
        // @ts-expect-error TODO: fix type-error
        leaveEvent,
      )
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
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(
    eventNameMap[type],
    nativeEvent => {
      const intersections = raycast(context, registry.array, nativeEvent) /* [0]] */
      const event = createThreeEvent(nativeEvent, { intersections })

      const visitedNodes = new Set()

      for (const intersection of intersections) {
        // Update currentIntersection
        // @ts-expect-error TODO: fix type-error
        event.currentIntersection = intersection

        // Bubble up
        let node: Object3D | null = intersection.object

        while (node && !event.stopped && !visitedNodes.has(node)) {
          getMeta(node)?.props[type]?.(
            // @ts-expect-error TODO: fix type-error
            event,
          )
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
export const EventPlugin = (() => {
  const context = useThree()

  // onMouseMove/onMouseEnter/onMouseLeave
  const hoverMouseRegistry = createHoverEventRegistry("Mouse", context)
  // onPointerMove/onPointerEnter/onPointerLeave
  const hoverPointerRegistry = createHoverEventRegistry("Pointer", context)

  // onClick/onClickMissed
  const missableClickRegistry = createMissableEventRegistry("onClick", context)
  // onContextMenu/onContextMenuMissed
  const missableContextMenuRegistry = createMissableEventRegistry("onContextMenu", context)
  // onDoubleClick/onDoubleClickMissed
  const missableDoubleClickRegistry = createMissableEventRegistry("onDoubleClick", context)

  // Default mouse-events
  const mouseDownRegistry = createDefaultEventRegistry("onMouseDown", context)
  const mouseUpRegistry = createDefaultEventRegistry("onMouseUp", context)
  // Default pointer-events
  const pointerDownRegistry = createDefaultEventRegistry("onPointerDown", context)
  const pointerUpRegistry = createDefaultEventRegistry("onPointerUp", context)
  // Default wheel-event
  const wheelRegistry = createDefaultEventRegistry("onWheel", context, { passive: true })

  return object => {
    return {
      onClick(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableClickRegistry.add(object))
      },
      onClickMissed(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableClickRegistry.add(object))
      },
      onDoubleClick(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableDoubleClickRegistry.add(object))
      },
      onDoubleClickMissed(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableDoubleClickRegistry.add(object))
      },
      onContextMenu(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableContextMenuRegistry.add(object))
      },
      onContextMenuMissed(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(missableContextMenuRegistry.add(object))
      },
      onMouseDown(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(mouseDownRegistry.add(object))
      },
      onMouseUp(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(mouseUpRegistry.add(object))
      },
      onMouseMove(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(hoverMouseRegistry.add(object))
      },
      onMouseEnter(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(hoverMouseRegistry.add(object))
      },
      onMouseLeave(callback: (event: Event<MouseEvent>) => void) {
        onCleanup(hoverMouseRegistry.add(object))
      },
      onPointerDown(callback: (event: Event<PointerEvent>) => void) {
        onCleanup(pointerDownRegistry.add(object))
      },
      onPointerUp(callback: (event: Event<PointerEvent>) => void) {
        onCleanup(pointerUpRegistry.add(object))
      },
      onPointerMove(callback: (event: Event<PointerEvent>) => void) {
        onCleanup(hoverPointerRegistry.add(object))
      },
      onPointerEnter(callback: (event: Event<PointerEvent>) => void) {
        onCleanup(hoverPointerRegistry.add(object))
      },
      onPointerLeave(callback: (event: Event<PointerEvent>) => void) {
        onCleanup(hoverMouseRegistry.add(object))
      },
      onwheel(callback: (event: Event<WheelEvent>) => void) {
        onCleanup(wheelRegistry.add(object))
      },
    }
  }
}) satisfies Plugin
