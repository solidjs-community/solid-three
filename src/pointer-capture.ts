import { ReactiveMap } from "@solid-primitives/map"
import type { Object3D } from "three"
import type { PointerCaptureRegistry } from "./pointers.ts"

/**
 * Reactive mirror of which objects currently hold a pointer capture, kept in one
 * global keyed by `Object3D` identity — an object lives in a single scene and is
 * captured by a single pointer system, so the key can't collide across multiple
 * `<Canvas/>`es. This lets {@link hasPointerCapture} be a context-free reactive
 * read instead of a hook.
 *
 * The value is a refcount: one object can be captured by more than one pointer at
 * once (two touches grabbing the same mesh), so the entry survives until the last
 * release. `ReactiveMap.has` tracks *presence*, so a reader only re-runs on the
 * 0↔1 transitions — not on refcount bumps between live captures.
 */
const counts = new ReactiveMap<Object3D, number>()

/**
 * The capture registry handed to the framework-agnostic `Pointer` (via
 * `DOMPointerManager`) so the core can record captures without importing any
 * reactivity. Mirrors `Pointer`'s capture lifecycle: `add` on a successful
 * capture, `delete` on release/drop.
 */
export const captureRegistry: PointerCaptureRegistry = {
  add(object) {
    counts.set(object, (counts.get(object) ?? 0) + 1)
  },
  delete(object) {
    const count = counts.get(object)
    if (count === undefined) return
    if (count <= 1) counts.delete(object)
    else counts.set(object, count - 1)
  },
}

/**
 * Reactive predicate: whether `object` currently holds a pointer capture. Read it
 * inside a tracking scope (a JSX prop, a memo, an effect) and it re-runs only when
 * that object's capture status actually flips — the basis for declarative drag
 * visuals without maintaining your own `dragging` signal:
 *
 * ```tsx
 * // A signal ref, so the read re-subscribes once the object mounts.
 * const [mesh, setMesh] = createSignal<Mesh>()
 * <T.Mesh ref={setMesh}
 *   scale={hasPointerCapture(mesh()) ? 1.15 : 1}
 *   onPointerDown={event => event.setPointerCapture()}
 * />
 * ```
 *
 * A nullish `object` (an unmounted ref) reads `false`. For the imperative,
 * in-handler check, use the event's own `event.hasPointerCapture()` instead.
 */
export function hasPointerCapture(object: Object3D | undefined | null): boolean {
  return object != null && counts.has(object)
}
