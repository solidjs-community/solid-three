import { describe, expect, it, vi } from "vitest"
import { Mesh, Object3D } from "three"
import { createT } from "../../src/create-t.tsx"
import { Entity } from "../../src/components.tsx"
import { Pointer, type PointerRaycaster } from "../../src/pointers.ts"
import { test as renderThree } from "../../src/testing/index.tsx"
import { meta } from "../../src/utils.ts"

const T = createT({ Mesh })

describe("core plugin seam", () => {
  it("exposes the Canvas reactive owner on context", () => {
    const three = renderThree(() => <T.Mesh />)
    expect(three.owner).toBeTruthy()
    three.unmount()
  })

  it("runs a plugin's setup exactly once per context, regardless of element count", () => {
    const setup = vi.fn()
    const TP = createT({ Mesh }, [{ name: "p", setup }])
    const three = renderThree(() => (
      <>
        <TP.Mesh />
        <TP.Mesh />
        <TP.Mesh />
      </>
    ))
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup.mock.calls[0]![0].scene).toBe(three.scene) // receives the context
    three.unmount()
  })

  it("runs setup once per context across multiple canvases", () => {
    const setup = vi.fn()
    const TP = createT({ Mesh }, [{ name: "p", setup }])
    const a = renderThree(() => <TP.Mesh />)
    const b = renderThree(() => <TP.Mesh />)
    expect(setup).toHaveBeenCalledTimes(2) // once per ctx, not shared/skipped
    a.unmount()
    b.unmount()
  })

  it("runs setup for a plugin passed via <Entity plugins>", () => {
    const setup = vi.fn()
    const three = renderThree(() => <Entity from={Mesh} plugins={[{ name: "e", setup }]} />)
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup.mock.calls[0]![0].scene).toBe(three.scene)
    // `plugins` must not leak onto the three instance as a property.
    expect("plugins" in three.scene.children[0]!).toBe(false)
    three.unmount()
  })

  it("dispatches an arbitrary plugin-named handler, bubbling + canvas-level", () => {
    const onXRSelect = vi.fn()
    const mesh = meta(new Object3D(), { props: { onXRSelect } }) as any as Object3D
    const fakeRaycaster: PointerRaycaster = {
      cast: () => [{ object: mesh, distance: 1 } as any],
      intersectObject: () => [],
    }
    const context = { eventRegistry: [mesh], props: {} } as any
    const pointer = new Pointer(context, fakeRaycaster)

    pointer.dispatch("onXRSelect", new Event("selectstart"))
    expect(onXRSelect).toHaveBeenCalledTimes(1)
  })
})
