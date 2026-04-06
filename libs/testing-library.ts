/**
 * Minimal testing-library replacement for Solid 2.0.
 * Uses @solidjs/web which replaces solid-js/web in Solid 2.0.
 */

import { render as solidRender } from "@solidjs/web"
import type { JSX } from "solid-js"

const mountedRoots: Array<{ container: Element; dispose: () => void }> = []

export function render(fn: () => JSX.Element) {
  const container = document.createElement("div")
  document.body.appendChild(container)

  const dispose = solidRender(fn, container)

  mountedRoots.push({ container, dispose })

  return { container, unmount: dispose }
}

export function cleanup() {
  for (const { container, dispose } of mountedRoots) {
    dispose()
    container.parentNode?.removeChild(container)
  }
  mountedRoots.length = 0
}

export function fireEvent(element: Element, event: Event) {
  return element.dispatchEvent(event)
}
