import { type Intersection, Object3D } from "three"
import { $S3C } from "./augment.ts"
import { S3 } from "./index.ts"
import { isInstance } from "./utils/is-instance.ts"

const eventNameMap = {
  onClick: "click",
  onContextMenu: "contextmenu",
  onDoubleClick: "dblclick",
  onMouseDown: "mousedown",
  onMouseMove: "mousemove",
  onMouseUp: "mouseup",
  onPointerUp: "pointerup",
  onPointerDown: "pointerdown",
  onPointerMove: "pointermove",
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
export const isEventType = (type: string): type is S3.EventName =>
  /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel|Mouse)/.test(type)

/**********************************************************************************/
/*                                                                                */
/*                                   Bubble Down                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Propagates an event down through the ancestors of a given `Object3D` in a scene graph,
 * calling the event handler for each ancestor as long as the event has not been marked as stopped.
 */
function bubbleDown(
  element: S3.Instance<Object3D>,
  type: S3.EventName,
  event: S3.Event<MouseEvent | WheelEvent>,
) {
  let node: Object3D | null = element.parent
  while (node) {
    // If event has been stopped with event.stopPropagation() we break out.
    if (event.stopped) break
    // If node is an AugmentedElement we call the type's event-handler if it is defined.
    if (isInstance(node)) {
      // @ts-expect-error TODO: fix type-error
      node[$S3C].props[type]?.(event)
    }
    // We bubble a layer down.
    node = node.parent
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                Create Three Event                              */
/*                                                                                */
/**********************************************************************************/

// Creates a `ThreeEvent` from the current `MouseEvent` | `WheelEvent`.
function createThreeEvent<TEvent extends Event>(nativeEvent: TEvent): S3.Event<TEvent> {
  const event = {
    ...nativeEvent,
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
  context: S3.Context,
  registry: Object3D[],
  nativeEvent: TNativeEvent,
): Intersection<S3.Instance<Object3D>>[] {
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
  context: S3.Context,
  type: "onClick" | "onDoubleClick" | "onContextMenu",
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
    for (const object of missedObjects) {
      if (isInstance(object)) {
        object[$S3C].props?.[missedType]?.(nativeEvent)
      }
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
function createHoverEventRegistry(context: S3.Context, type: "Mouse" | "Pointer") {
  const registry = createRegistry<Object3D>()
  const hoveredSet = new Set<Object3D>()

  context.canvas.addEventListener(eventNameMap[`on${type}Move`], nativeEvent => {
    const leaveSet = new Set(hoveredSet)
    hoveredSet.clear()

    const intersections = raycast(context, registry.array, nativeEvent)

    // Phase #1 - Enter
    const enterEvent = createThreeEvent(nativeEvent)

    for (const { object } of intersections) {
      // Bubble up
      let current: Object3D | null = object
      while (current && !hoveredSet.has(current)) {
        if (isInstance(current)) {
          if (!leaveSet.has(current)) {
            current[$S3C].props?.[`on${type}Enter`]?.(enterEvent)
          }
          leaveSet.delete(current)
          hoveredSet.add(current)
        }
        // We bubble a layer down.
        current = current.parent
      }
    }

    // Phase #2 - Move
    const moveEvent = createThreeEvent(nativeEvent)

    for (const { object } of intersections) {
      if (moveEvent.stopped) break
      // Bubble up
      let current: Object3D | null = object
      while (current) {
        if (isInstance(current)) {
          current[$S3C].props?.[`on${type}Move`]?.(moveEvent)
          if (moveEvent.stopped) {
            break
          }
        }
        // We bubble a layer down.
        current = current.parent
      }
    }

    // Handle leave-event
    const leaveEvent = createThreeEvent(nativeEvent)

    for (const object of leaveSet.values()) {
      if (isInstance(object)) {
        object[$S3C].props?.[`on${type}Leave`]?.(leaveEvent)
      }
    }
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
  context: S3.Context,
  type: "onMouseDown" | "onMouseUp" | "onPointerDown" | "onPointerUp" | "onWheel",
  options?: AddEventListenerOptions,
) {
  const registry = createRegistry<Object3D>()

  context.canvas.addEventListener(
    eventNameMap[type],
    nativeEvent => {
      const event = createThreeEvent(nativeEvent)
      const intersections = raycast(context, registry.array, nativeEvent)

      for (const { object } of intersections) {
        object[$S3C].props?.[type]?.(event)
        bubbleDown(object, type, event)
        if (event.stopped) break
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
export function createEvents(context: S3.Context) {
  // onMouseMove/onMouseEnter/onMouseLeave
  const hoverMouseRegistry = createHoverEventRegistry(context, "Mouse")
  // onPointerMove/onPointerEnter/onPointerLeave
  const hoverPointerRegistry = createHoverEventRegistry(context, "Pointer")

  // onClick/onClickMissed
  const missableClickRegistry = createMissableEventRegistry(context, "onClick")
  // onContextMenu/onContextMenuMissed
  const missableContextMenuRegistry = createMissableEventRegistry(context, "onContextMenu")
  // onDoubleClick/onDoubleClickMissed
  const missableDoubleClickRegistry = createMissableEventRegistry(context, "onDoubleClick")

  // Default mouse-events
  const mouseDownRegistry = createDefaultEventRegistry(context, "onMouseDown")
  const mouseUpRegistry = createDefaultEventRegistry(context, "onMouseUp")
  // Default pointer-events
  const pointerDownRegistry = createDefaultEventRegistry(context, "onPointerDown")
  const pointerUpRegistry = createDefaultEventRegistry(context, "onPointerUp")
  // Default wheel-event
  const wheelRegistry = createDefaultEventRegistry(context, "onWheel", { passive: true })

  return {
    /**
     * Registers an `AugmentedElement<Object3D>` with the event handling system.
     *
     * @param object - The 3D object to register.
     * @param type - The type of event the object should listen for.
     */
    addEventListener(object: S3.Instance<Object3D>, type: S3.EventName) {
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
