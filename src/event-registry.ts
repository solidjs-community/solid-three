import type { Object3D } from "three"

/**
 * The set of objects the pointer system raycasts, with refcounted membership: an
 * object listening for several event types — or re-registering reactively — is
 * listed in {@link objects} exactly once.
 *
 * Framework-agnostic: `register` returns a cleanup, so each pointer source wires it
 * to its own lifecycle (the DOM source returns it up the chain; the XR plugin hands
 * it to `onCleanup`). `onVacated` fires when an object genuinely leaves, after a
 * deferred re-check that tolerates a same-tick reactive re-register — the DOM source
 * uses it to release a pointer capture on a real unmount; XR doesn't subscribe.
 */
export class EventRegistry {
  /** The objects to raycast. Read-only to callers; mutated only by {@link register}. */
  readonly objects: Object3D[] = []
  private counts = new WeakMap<Object3D, number>()
  private vacatedListeners = new Set<(object: Object3D) => void>()

  /** Register `object` (refcounted). Returns a cleanup that decrements, removing it at zero. */
  register(object: Object3D): () => void {
    const count = this.counts.get(object) ?? 0
    if (count === 0) this.objects.push(object)
    this.counts.set(object, count + 1)
    return () => {
      const current = this.counts.get(object)
      if (current === undefined) return
      if (current > 1) {
        this.counts.set(object, current - 1)
        return
      }
      this.counts.delete(object)
      const index = this.objects.indexOf(object)
      if (index !== -1) this.objects.splice(index, 1)
      // A reactive handler re-registers in the same tick (cleanup → body): defer the
      // vacated notice and fire only if the object is still gone — a real unmount, not
      // a re-register that would otherwise tear down a live capture mid-drag.
      if (this.vacatedListeners.size) {
        queueMicrotask(() => {
          if (!this.counts.has(object)) {
            for (const listener of this.vacatedListeners) listener(object)
          }
        })
      }
    }
  }

  /**
   * Subscribe to genuine vacates — an object whose last registration was cleaned up
   * (and not re-registered the same tick). Returns an unsubscribe.
   */
  onVacated(listener: (object: Object3D) => void): () => void {
    this.vacatedListeners.add(listener)
    return () => this.vacatedListeners.delete(listener)
  }
}
