import { Object3D } from "three"
import { describe, expect, it, vi } from "vitest"
import { EventRegistry } from "../../src/event-registry.ts"

describe("EventRegistry", () => {
  it("refcounts membership — listed once, removed only at the last release", () => {
    const registry = new EventRegistry()
    const a = new Object3D()

    const off1 = registry.register(a)
    const off2 = registry.register(a) // a second handler on the same object
    expect(registry.objects).toEqual([a]) // listed once

    off1()
    expect(registry.objects).toEqual([a]) // still referenced
    off2()
    expect(registry.objects).toEqual([]) // last reference gone
  })

  it("fires onVacated (deferred) on a genuine vacate", async () => {
    const registry = new EventRegistry()
    const a = new Object3D()
    const vacated = vi.fn()
    registry.onVacated(vacated)

    registry.register(a)()
    expect(vacated).not.toHaveBeenCalled() // deferred past the current tick
    await Promise.resolve()
    expect(vacated).toHaveBeenCalledWith(a)
  })

  it("does not fire onVacated when re-registered in the same tick", async () => {
    const registry = new EventRegistry()
    const a = new Object3D()
    const vacated = vi.fn()
    registry.onVacated(vacated)

    const off = registry.register(a)
    off() // refcount → 0, schedules the deferred vacate check
    registry.register(a) // re-register same tick → refcount back to 1
    await Promise.resolve()

    expect(vacated).not.toHaveBeenCalled() // still referenced — not a real vacate
    expect(registry.objects).toEqual([a])
  })

  it("onVacated returns an unsubscribe", async () => {
    const registry = new EventRegistry()
    const a = new Object3D()
    const vacated = vi.fn()
    registry.onVacated(vacated)()

    registry.register(a)()
    await Promise.resolve()
    expect(vacated).not.toHaveBeenCalled()
  })
})
