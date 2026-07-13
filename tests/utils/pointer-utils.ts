import { fireEvent } from "@solidjs/testing-library"

/**
 * offsetX/Y that hits a 2×2 `BoxGeometry` centred at the origin, with the camera at
 * z=5 (the `test()` harness's default camera) on the harness's default 1280x800
 * canvas (see `createTestCanvas` in `src/testing/index.tsx`). The canvas is mounted
 * at (0, 0) in `document.body`, so clientX/Y === offsetX/Y.
 */
export const CANVAS_CENTRE_X = 640
export const CANVAS_CENTRE_Y = 400

/** Builds a `click` `MouseEvent` at the given client coordinates. */
export function makeClickAt(clientX: number, clientY: number) {
  return new MouseEvent("click", { clientX, clientY, bubbles: true })
}

/**
 * Fires a `click` at the centre of `canvas` — where a 2×2 `BoxGeometry` centred at
 * the origin sits, given the harness's default camera and canvas size. Lifted out of
 * `tests/events/events.test.tsx` so both the engine's own suites and the core boundary
 * suite dispatch clicks the same way.
 */
export function clickCanvasCentre(canvas: HTMLCanvasElement) {
  fireEvent(canvas, makeClickAt(CANVAS_CENTRE_X, CANVAS_CENTRE_Y))
}
