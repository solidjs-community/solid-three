import { describe, expect, it, vi } from "vitest"
import { Mesh, Object3D, PerspectiveCamera } from "three"
import { plugin } from "../../src/plugin.ts"

describe("plugin()", () => {
  it("global plugin returns methods for any element", () => {
    const p = plugin(() => ({ ping: vi.fn() }))
    expect(p(new Mesh())).toHaveProperty("ping")
  })

  it("class-filtered plugin returns methods only for matching elements", () => {
    const p = plugin([Mesh], () => ({ shake: vi.fn() }))
    expect(p(new Mesh())).toHaveProperty("shake")
    expect(p(new PerspectiveCamera())).toBeUndefined()
  })

  it("type-guard plugin returns methods only when the guard passes", () => {
    const p = plugin(
      (el): el is Mesh => el instanceof Mesh,
      () => ({ setColor: vi.fn() }),
    )
    expect(p(new Mesh())).toHaveProperty("setColor")
    expect(p(new Object3D())).toBeUndefined()
  })
})
