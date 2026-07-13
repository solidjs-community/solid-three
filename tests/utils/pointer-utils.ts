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
 * Fires the event sequence a real browser produces for a primary-button click: the
 * pointer MOVES to the spot, then `pointerdown`, `pointerup`, and finally `click`.
 *
 * Every part of that sequence is load-bearing for one engine or the other:
 * - the reference engine reads the native `click`;
 * - `@pmndrs/pointer-events` never listens for `click` at all — it hears only
 *   `pointerdown`/`pointerup` and synthesises the click itself from that pair;
 * - and pmndrs recomputes a live pointer's intersection on `pointermove`, so without the
 *   move a second click at a NEW location would still dispatch against the OLD one.
 *
 * Firing the true sequence is what lets ONE helper drive both engines, rather than each
 * engine growing its own bespoke dispatch in its own suite.
 */
export function clickAt(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const pointer = {
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    bubbles: true,
  }
  fireEvent(canvas, new PointerEvent("pointermove", { ...pointer, buttons: 0 }))
  fireEvent(canvas, new PointerEvent("pointerdown", { ...pointer, buttons: 1 }))
  fireEvent(canvas, new PointerEvent("pointerup", { ...pointer, buttons: 0 }))
  fireEvent(canvas, makeClickAt(clientX, clientY))
}

/**
 * Clicks the centre of `canvas` — where a 2×2 `BoxGeometry` centred at the origin sits,
 * given the harness's default camera and canvas size. Lifted out of
 * `tests/events/events.test.tsx` so both the engines' own suites and the core boundary
 * suite dispatch clicks the same way.
 */
export function clickCanvasCentre(canvas: HTMLCanvasElement) {
  clickAt(canvas, CANVAS_CENTRE_X, CANVAS_CENTRE_Y)
}
