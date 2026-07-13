import { type JSX, createContext, useContext } from "solid-js"

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
