import { Object3D, type Intersection } from "three"
import type { Context } from "vm"
import { $S3C } from "./augment.ts"
import type { CanvasProps } from "./canvas.tsx"
import type { EventName, Instance } from "./types.ts"
import { isInstance } from "./utils/is-instance.ts"

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
/*                                Create Three Event                              */
/*                                                                                */
/**********************************************************************************/

// Creates a `ThreeEvent` from the current `MouseEvent` | `WheelEvent`.
function createThreeEvent<TEvent extends Event>(
  nativeEvent: TEvent,
  stoppable?: true,
): Event<TEvent>
function createThreeEvent<TEvent extends Event>(
  nativeEvent: TEvent,
  stoppable: false,
): Event<TEvent, false>
function createThreeEvent<TEvent extends Event>(
  nativeEvent: TEvent,
  stoppable = true,
): Event<TEvent, boolean> {
  if (!stoppable) {
    return {
      nativeEvent,
    }
  }
  const event = {
    nativeEvent,
    stopped: false,
    stopPropagation() {
      event.stopped = true
    },
  }
  return event
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
  nativeEvent: TNativeEvent,
): Intersection<Instance<Object3D>>[] {
  context.setPointer(pointer => {
    pointer.x = (nativeEvent.offsetX / globalThis.innerWidth) * 2 - 1
    pointer.y = -(nativeEvent.offsetY / globalThis.innerHeight) * 2 + 1
    return pointer
  })
  context.raycaster.setFromCamera(context.pointer, context.camera)

  const nodeSet = new Set<Object3D>()
  const stack = [...registry]

  // Collect all unique descendants of registry
  for (const object of stack) {
    if (nodeSet.has(object)) continue
    nodeSet.add(object)
    stack.push(...object.children)
  }

  return context.raycaster.intersectObjects(nodeSet.values().toArray(), false)
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
  props: CanvasProps,
) {
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(eventNameMap[type], nativeEvent => {
    if (registry.array.length === 0) return
    const event = createThreeEvent(nativeEvent)
    const missedType = `${type}Missed` as const

    // Track which objects have been visited during event processing
    const missedObjects = new Set(registry.array)
    const visitedObjects = new Set()

    // Phase #1 - Process normal click events
    const intersections = raycast(context, registry.array, nativeEvent)

    for (const { object } of intersections) {
      let node: Object3D | null = object
      while (node && !event.stopped && !visitedObjects.has(node)) {
        missedObjects.delete(node)
        visitedObjects.add(node)
        if (isInstance(node)) {
          node[$S3C].props?.[type]?.(event)
        }
        node = node.parent
      }
    }

    // Call the respective canvas event-handler
    // if event propagated all the way down
    if (!event.stopped) {
      props[type]?.(event)
    }

    // Phase #2 - Raycast remaining missed objects
    for (const remainingObject of missedObjects) {
      // Perform raycast on unvisited missed objects
      context.raycaster.setFromCamera(context.pointer, context.camera)
      const intersections = context.raycaster.intersectObject(remainingObject, true)

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
    const missedEvent = createThreeEvent(nativeEvent, false)

    for (const object of missedObjects) {
      if (isInstance(object)) {
        object[$S3C].props?.[missedType]?.(missedEvent)
      }
    }

    if (visitedObjects.size > 0) {
      props[`${type}Missed`]?.(missedEvent)
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
function createHoverEventRegistry(type: "Mouse" | "Pointer", context: Context, props: CanvasProps) {
  const registry = createRegistry<Object3D>()
  let hoveredSet = new Set<Object3D>()
  let intersections: Intersection<Instance<Object3D>>[] = []
  let hoveredCanvas = false

  context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
    intersections = raycast(context, registry.array, nativeEvent)

    // Phase #1 - Enter
    const enterEvent = createThreeEvent(nativeEvent, false)
    const enterSet = new Set<Object3D>()

    for (const { object } of intersections) {
      // Bubble up
      let current: Object3D | null = object
      while (current && !enterSet.has(current)) {
        enterSet.add(current)

        if (isInstance(current) && !hoveredSet.has(current)) {
          current[$S3C].props?.[`on${type}Enter`]?.(enterEvent)
        }
        // We bubble a layer down.
        current = current.parent
      }
    }

    if (hoveredCanvas === false) {
      props[`on${type}Enter`]?.(enterEvent)
      hoveredCanvas = true
    }

    // Phase #2 - Move
    const moveEvent = createThreeEvent(nativeEvent)
    const moveSet = new Set()

    for (const { object } of intersections) {
      if (moveEvent.stopped) break
      // Bubble up
      let current: Object3D | null = object
      while (current && !moveSet.has(current)) {
        moveSet.add(current)

        if (isInstance(current)) {
          current[$S3C].props?.[`on${type}Move`]?.(moveEvent)
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
      props[`on${type}Move`]?.(moveEvent)
    }

    // Handle leave-event
    const leaveEvent = createThreeEvent(nativeEvent)
    const leaveSet = hoveredSet.difference(enterSet)
    hoveredSet = enterSet

    for (const object of leaveSet.values()) {
      if (isInstance(object)) {
        object[$S3C].props?.[`on${type}Leave`]?.(leaveEvent)
      }
    }
  })

  context.canvas.addEventListener(eventNameMap[`on${type}Leave`], nativeEvent => {
    const leaveEvent = createThreeEvent(nativeEvent, false)
    props[`on${type}Leave`]?.(leaveEvent)
    hoveredCanvas = false

    for (const object of hoveredSet) {
      if (isInstance(object)) {
        object[$S3C].props?.[`on${type}Leave`]?.(leaveEvent)
      }
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
  props: CanvasProps,
  options?: AddEventListenerOptions,
) {
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(
    eventNameMap[type],
    nativeEvent => {
      const event = createThreeEvent(nativeEvent)
      const intersections = raycast(context, registry.array, nativeEvent)

      for (const { object } of intersections) {
        // Bubble up
        let node: Object3D | null = object

        while (node && !event.stopped) {
          if (isInstance(object)) {
            object[$S3C].props?.[type]?.(event)
          }
          node = node.parent
        }
      }

      if (!event.stopped) {
        props[type]?.(event)
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
export function createEvents(context: Context, props: CanvasProps) {
  // onMouseMove/onMouseEnter/onMouseLeave
  const hoverMouseRegistry = createHoverEventRegistry("Mouse", context, props)
  // onPointerMove/onPointerEnter/onPointerLeave
  const hoverPointerRegistry = createHoverEventRegistry("Pointer", context, props)

  // onClick/onClickMissed
  const missableClickRegistry = createMissableEventRegistry("onClick", context, props)
  // onContextMenu/onContextMenuMissed
  const missableContextMenuRegistry = createMissableEventRegistry("onContextMenu", context, props)
  // onDoubleClick/onDoubleClickMissed
  const missableDoubleClickRegistry = createMissableEventRegistry("onDoubleClick", context, props)

  // Default mouse-events
  const mouseDownRegistry = createDefaultEventRegistry("onMouseDown", context, props)
  const mouseUpRegistry = createDefaultEventRegistry("onMouseUp", context, props)
  // Default pointer-events
  const pointerDownRegistry = createDefaultEventRegistry("onPointerDown", context, props)
  const pointerUpRegistry = createDefaultEventRegistry("onPointerUp", context, props)
  // Default wheel-event
  const wheelRegistry = createDefaultEventRegistry("onWheel", context, props, { passive: true })

  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the event handling system.
     *
     * @param object - The 3D object to register.
     * @param type - The type of event the object should listen for.
     */
    addEventListener(object: Instance<Object3D>, type: EventName) {
      switch (type) {
        // Missable Events
        case "onClick":
        case "onClickMissed":
          return missableClickRegistry.add(object)
        case "onContextMenu":
        case "onContextMenuMissed":
          return missableContextMenuRegistry.add(object)
        case "onDoubleClick":
        case "onDoubleClickMissed":
          return missableDoubleClickRegistry.add(object)

        // Hover Events
        case "onMouseEnter":
        case "onMouseLeave":
        case "onMouseMove":
          return hoverMouseRegistry.add(object)
        case "onPointerEnter":
        case "onPointerLeave":
        case "onPointerMove":
          return hoverPointerRegistry.add(object)

        // Default Events
        case "onMouseDown":
          return mouseDownRegistry.add(object)
        case "onMouseUp":
          return mouseUpRegistry.add(object)
        case "onPointerDown":
          return pointerDownRegistry.add(object)
        case "onPointerUp":
          return pointerUpRegistry.add(object)
        case "onWheel":
          return wheelRegistry.add(object)
      }
    },
  }
}
