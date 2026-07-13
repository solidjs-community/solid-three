/**
 * Does the PUBLISHED type surface actually work across subpath exports?
 *
 * Everything else in this repo typechecks `solid-three` against `src/`. That can never
 * catch a defect in what we ship, because `src/` has exactly one copy of every type by
 * construction. This file is the one place that reads the package the way a dependent
 * does: `solid-three` and `solid-three/events` resolve through the `exports` map in
 * `package.json`, onto the emitted declarations in `types/` — no path alias, no `src/`.
 *
 * What it guards: the two subpaths must agree on the SAME types. They did not when each
 * subpath was rolled up into its own declaration bundle, because each bundle then carried
 * a private `declare const $S3C: unique symbol` — and `unique symbol` identity is
 * per-declaration. `solid-three/events`' `Context`/`Meta`/`Plugin` and `solid-three`'s
 * identically-spelled ones were unrelated types, so `createT(THREE, [pointerEvents()])`
 * did not typecheck at all and every prop the engine contributes went missing.
 *
 * Each assertion below fails loudly under that defect. Keep them: they are the only
 * regression test for the shape of the published `.d.ts` files.
 */
import { createSignal } from "solid-js"
import { Canvas, createT, plugin } from "solid-three"
import { pointerEvents, type EventHandlers } from "solid-three/events"
import * as THREE from "three"

/**
 * A plugin defined the way a consumer would, against the core `plugin()` export. It is
 * here to compose with `pointerEvents()`, because the brand mismatch did not just break
 * the engine's own props — it corrupted its co-plugins'. With a mismatched
 * `pointerEvents()` in the same list, `lookAt` below stopped resolving to this
 * `(target: Vector3) => void` and collapsed back onto `Object3D`'s native overloaded
 * `lookAt` method. So a plugin list of two is the honest test, not one of one.
 */
const lookAt = plugin([THREE.Object3D], (object: THREE.Object3D) => ({
  lookAt: (target: THREE.Vector3) => object.lookAt(target),
}))

/** The load-bearing line: a plugin from one subpath, into `createT` from another. */
const T = createT(THREE, [lookAt, pointerEvents()])

/**
 * Annotated against the engine's own exported handler types, so this asserts more than
 * "the prop exists": it asserts the prop carries the engine's event type. An `any` — the
 * shape a prop degrades to when inference gives up — would not be caught by an inline
 * arrow alone.
 */
const handleClick: EventHandlers["onClick"] = event => event.stopPropagation()
const handlePointerMissed: EventHandlers["onPointerMissed"] = event => event.nativeEvent.button

export function Scene() {
  const [target] = createSignal(new THREE.Vector3())

  return (
    // `plugins` + `onPointerMissed`: the engine contributes the canvas-level prop, so
    // this asserts the engine is assignable to `<Canvas plugins>` too — a separate
    // path through the types from the `createT` one above.
    <Canvas plugins={[pointerEvents()]} onPointerMissed={handlePointerMissed}>
      {/* Both plugins' contributed props on one element: the engine's `onClick` and the
          co-plugin's `lookAt`, which must still take a `Vector3`. */}
      <T.Mesh onClick={handleClick} lookAt={target()}>
        <T.BoxGeometry />
        <T.MeshStandardMaterial />
      </T.Mesh>

      {/* An inline arrow, left unannotated on purpose: `event` has to INFER. Under the
          defect the prop was unknown, so this reported an implicit `any` (TS7006) on top
          of the missing-prop error. `event.intersection` also pins the payload's shape. */}
      <T.Mesh onPointerMove={event => event.intersection.point.clone()}>
        <T.SphereGeometry />
        <T.MeshBasicMaterial />
      </T.Mesh>
    </Canvas>
  )
}
