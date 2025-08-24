import { type JSX, createContext, useContext } from "solid-js"
import { Object3D } from "three"
import type { EventName, Meta } from "./types.ts"

/**
 * Registers an event listener for an `AugmentedElement` to the nearest Canvas component up the component tree.
 * This function must be called within components that are descendants of the Canvas component.
 *
 * @param object - The Three.js object to attach the event listener to.
 * @param type - The type of event to listen for (e.g., 'click', 'mouseenter').
 * @throws Throws an error if used outside of the Canvas component context.
 */
export const addToEventListeners = <T extends Object3D>(object: Meta<T>, type: EventName) => {
  const addToEventListeners = useContext(eventContext)
  if (!addToEventListeners) {
    throw new Error("S3: Hooks can only be used within the Canvas component!")
  }
  return addToEventListeners(object, type)
}
export const eventContext = createContext<(object: Meta<any>, type: EventName) => () => void>()

/**
 * This function facilitates the rendering of JSX elements outside the normal scene
 * graph, and must be used within components that are descendants of the Canvas component.
 *
 * @param children - The child elements to be rendered through the portal.
 * @throws Throws an error if used outside of the Canvas component context.
 */
export const addPortal = (children: JSX.Element | JSX.Element[]) => {
  const addPortal = useContext(portalContext)
  if (!addPortal) {
    throw new Error("S3: Hooks can only be used within the Canvas component!")
  }
  addPortal(children)
}
export const portalContext = createContext<(children: JSX.Element | JSX.Element[]) => void>()
