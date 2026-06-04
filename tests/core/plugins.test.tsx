import { assertType, describe, expect, it, vi } from "vitest"
import { Mesh, Object3D, PerspectiveCamera } from "three"
import { plugin, resolvePluginMethods } from "../../src/plugin.ts"
import { createT } from "../../src/create-t.tsx"
import { Entity } from "../../src/components.tsx"
import { test as renderThree } from "../../src/testing/index.tsx"

describe("plugin()", () => {
  it("global plugin returns methods for any element", () => {
    const p = plugin(() => ({ ping: vi.fn() }))
    expect(p(new Mesh())).toHaveProperty("ping")
  })

  it("class-filtered plugin returns methods only for matching elements", () => {
    // The filtered overload types the param narrowly; runtime accepts anything,
    // so cast to a loose callable to exercise the non-matching path.
    const call = plugin([Mesh], () => ({ shake: vi.fn() })) as (el: object) => unknown
    expect(call(new Mesh())).toHaveProperty("shake")
    expect(call(new PerspectiveCamera())).toBeUndefined()
  })

  it("type-guard plugin returns methods only when the guard passes", () => {
    const call = plugin(
      (el): el is Mesh => el instanceof Mesh,
      () => ({ setColor: vi.fn() }),
    ) as (el: object) => unknown
    expect(call(new Mesh())).toHaveProperty("setColor")
    expect(call(new Object3D())).toBeUndefined()
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

describe("<Entity plugins>", () => {
  it("invokes a contributed method passed via <Entity plugins>", () => {
    const shake = vi.fn()
    const three = renderThree(() => (
      <Entity from={Mesh} plugins={[plugin([Mesh], () => ({ shake }))]} shake={0.2} />
    ))
    expect(shake).toHaveBeenCalledWith(0.2)
    expect("shake" in three.scene.children[0]!).toBe(false)
    three.unmount()
  })

  it("enforces contributed-prop types (rejects a bogus prop) — not permissive like #37", () => {
    const p = plugin([Mesh], () => ({ shake: (_i: number) => {} }))
    const three = renderThree(() => (
      // @ts-expect-error — `boguz` is not a contributed prop; lint:types must reject it.
      <Entity from={Mesh} plugins={[p]} boguz={1} />
    ))
    three.unmount()
  })
})

describe("plugin prop types", () => {
  it("a contributed method's first-param type becomes the element prop type", () => {
    const TP = createT({ Mesh }, [plugin([Mesh], () => ({ shake: (_intensity: number) => {} }))])
    type MeshProps = Parameters<typeof TP.Mesh>[0]
    // vitest's assertType is tsc-checked (lint:types): errors if `shake` isn't a `number` prop.
    assertType<number | undefined>(({} as MeshProps).shake)
    expect(true).toBe(true)
  })
})
