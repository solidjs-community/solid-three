import { Show, createSignal, onCleanup } from "solid-js"
import { assertType, describe, expect, it, vi } from "vitest"
import * as THREE from "three"
import { Mesh, Object3D, PerspectiveCamera, Vector3 } from "three"
import { plugin, resolvePluginMethods } from "../../src/plugin.ts"
import { createT } from "../../src/create-t.tsx"
import { Entity } from "../../src/components.tsx"
import { test as renderThree } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"
import { getMeta } from "../../src/utils.ts"

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

  it("warns in dev when two plugins contribute the same element prop, and last-wins still holds", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const first = plugin([Mesh], () => ({ onPing: () => "first" }))
    const second = plugin([Mesh], () => ({ onPing: () => "second" }))

    const merged = resolvePluginMethods(new Mesh(), [first, second])

    expect(merged.onPing(undefined)).toBe("second")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("onPing"))
    warn.mockRestore()
  })

  it("does not warn when two plugins contribute different element props", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const first = plugin([Mesh], () => ({ onPing: () => "ping" }))
    const second = plugin([Mesh], () => ({ onPong: () => "pong" }))

    const merged = resolvePluginMethods(new Mesh(), [first, second])

    expect(merged.onPing(undefined)).toBe("ping")
    expect(merged.onPong(undefined)).toBe("pong")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe("plugin prop routing", () => {
  it("invokes a contributed method when its prop is set, and does not assign it to the instance", () => {
    const shake = vi.fn()
    const TP = createT({ Mesh }, [plugin([Mesh], () => ({ shake }))])
    const three = renderThree(() => <TP.Mesh shake={0.1} />)
    expect(shake).toHaveBeenCalledWith(0.1)
    expect("shake" in three.scene.children[0]).toBe(false)
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
    expect("shake" in three.scene.children[0]).toBe(false)
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
    const _TP = createT({ Mesh }, [plugin([Mesh], () => ({ shake: (_intensity: number) => {} }))])
    type MeshProps = Parameters<typeof _TP.Mesh>[0]
    // vitest's assertType is tsc-checked (lint:types): errors if `shake` isn't a `number` prop.
    assertType<number | undefined>(({} as MeshProps).shake)
    expect(true).toBe(true)
  })

  it("a contributed prop overrides a native member of the same name", () => {
    // `lookAt` is a method on Object3D; the contributed prop must *replace* it so a
    // Vector3 is assignable. The naive intersection (`method & Vector3`) is satisfiable
    // by no value, so this assignment would not type-check.
    const _TP = createT({ Mesh }, [plugin([Mesh], () => ({ lookAt: (_target: Vector3) => {} }))])
    type MeshProps = Parameters<typeof _TP.Mesh>[0]
    const props: MeshProps = { lookAt: new Vector3() }
    assertType<Vector3 | undefined>(props.lookAt)
    expect(props).toBeDefined()
  })
})

describe("meta.ctx + initializePlugin", () => {
  it("a contributed method reaches the mount-site context via getMeta(el).ctx and dedups once-per-ctx", () => {
    const setupOnce = vi.fn()
    const token = Symbol("test")
    const p = plugin(el => ({
      onPing() {
        const ctx = getMeta(el).ctx!
        ctx.initializePlugin(token, setupOnce)
      },
    }))
    const TP = createT({ Mesh }, [p])
    const three = renderThree(() => (
      <>
        <TP.Mesh onPing={() => {}} />
        <TP.Mesh onPing={() => {}} />
      </>
    ))
    expect(setupOnce).toHaveBeenCalledTimes(1) // once per ctx across both meshes
    expect(getMeta(three.scene.children[0])?.ctx?.scene).toBe(three.scene)
    three.unmount()
  })
})

describe("plugin statics", () => {
  it("runs install once per context, under the canvas owner, keyed by token", () => {
    const TOKEN = Symbol("test-engine")
    const install = vi.fn()
    const cleanup = vi.fn()

    // Two distinct instances of the "same engine" — separate function objects,
    // sharing one module-level token. If dedup keyed off the plugin instance
    // (or the plugin array entry) rather than `.token`, both would install.
    const makeEngine = () =>
      Object.assign(
        plugin([Object3D], () => ({ onPing: (_handler: () => void) => {} })),
        {
          token: TOKEN,
          install: (context: Context) => {
            install(context)
            onCleanup(cleanup)
          },
        },
      )
    const engineInstanceOne = makeEngine()
    const engineInstanceTwo = makeEngine()
    expect(engineInstanceOne).not.toBe(engineInstanceTwo)

    const T = createT(THREE, [engineInstanceOne, engineInstanceTwo])
    const three = renderThree(() => <T.Mesh onPing={() => {}} />)

    expect(install).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()

    three.unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it("ties install's cleanup to the canvas, not to whichever element mounted first", async () => {
    const TOKEN = Symbol("test-engine-owner")
    const cleanup = vi.fn()

    const engine = Object.assign(
      plugin([Object3D], () => ({ onPing: (_handler: () => void) => {} })),
      {
        token: TOKEN,
        install: (_context: Context) => {
          onCleanup(cleanup)
        },
      },
    )

    const T = createT(THREE, [engine])
    const [visible, setVisible] = createSignal(true)
    const three = renderThree(() => (
      <Show when={visible()}>
        <T.Mesh onPing={() => {}} />
      </Show>
    ))

    await three.waitTillNextFrame()

    // Unmount the (only, first-to-install) element while the canvas stays alive —
    // if `install` ran under that element's own reactive scope instead of the
    // canvas owner, this would fire `cleanup` prematurely.
    setVisible(false)
    await three.waitTillNextFrame()
    expect(cleanup).not.toHaveBeenCalled()

    three.unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
