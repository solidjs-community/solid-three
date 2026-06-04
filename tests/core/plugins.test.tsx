import { describe, expect, it, vi } from "vitest"
import { Mesh, Object3D, PerspectiveCamera } from "three"
import { plugin, resolvePluginMethods } from "../../src/plugin.ts"
import { createT } from "../../src/create-t.tsx"
import { test as renderThree } from "../../src/testing/index.tsx"

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

describe("resolvePluginMethods", () => {
  it("merges matching plugins' methods, skips non-matching, returns {} for none", () => {
    const a = plugin([Mesh], () => ({ shake: () => "shake" }))
    const b = plugin(() => ({ ping: () => "ping" }))
    const c = plugin([PerspectiveCamera], () => ({ orbit: () => "orbit" }))
    const merged = resolvePluginMethods(new Mesh(), [a, b, c])
    expect(Object.keys(merged).sort()).toEqual(["ping", "shake"])
    expect(resolvePluginMethods(new Mesh(), [])).toEqual({})
  })
})

describe("plugin prop routing", () => {
  it("invokes a contributed method when its prop is set, and does not assign it to the instance", () => {
    const shake = vi.fn()
    const TP = createT({ Mesh }, [plugin([Mesh], () => ({ shake }))])
    const three = renderThree(() => <TP.Mesh shake={0.1} />)
    expect(shake).toHaveBeenCalledWith(0.1)
    expect("shake" in three.scene.children[0]!).toBe(false)
    three.unmount()
  })
})
