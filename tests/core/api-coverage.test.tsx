import { createSignal } from "solid-js"
import * as THREE from "three"
import { afterEach, assertType, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createEntity,
  createT,
  CursorRaycaster,
  CenterRaycaster,
  getMeta,
  hasMeta,
  load,
  meta,
  Resource,
  useProps,
} from "../../src/index.ts"
import { LoaderCache } from "../../src/data-structure/loader-cache.ts"
import { useLoader } from "../../src/hooks.ts"
import { test } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"
import { asyncUtils } from "../utils/async-utils.ts"

const resolvers: (() => void)[] = []
const { waitFor } = asyncUtils(resolver => resolvers.push(resolver))

class MockResource {
  constructor(public readonly url: string) {}
  dispose = vi.fn()
}
class MockLoader extends THREE.Loader<MockResource> {
  load(url: string, onLoad: (result: MockResource) => void) {
    onLoad(new MockResource(url))
  }
}
class MockObject3DLoader extends THREE.Loader<THREE.Object3D> {
  load(url: string, onLoad: (result: THREE.Object3D) => void) {
    const object = new THREE.Object3D()
    object.name = url
    onLoad(object)
  }
}

beforeEach(() => {
  useLoader.cache = new LoaderCache()
})
afterEach(() => {
  useLoader.cache = new LoaderCache()
})

describe("createEntity", () => {
  it("creates a component that constructs the given class with args", () => {
    const Group = createEntity(THREE.Group)
    const { scene } = test(() => <Group name="custom" />)
    expect(scene.children[0]).toBeInstanceOf(THREE.Group)
    expect(scene.children[0]?.name).toBe("custom")
  })

  it("passes args to the constructor", () => {
    const Mesh = createEntity(THREE.Mesh)
    const Geo = createEntity(THREE.BoxGeometry)
    const { scene } = test(() => (
      <Mesh>
        <Geo args={[3, 5, 7]} />
      </Mesh>
    ))
    const mesh = scene.children[0] as THREE.Mesh
    const geometry = mesh.geometry as THREE.BoxGeometry
    expect(geometry.parameters.width).toBe(3)
    expect(geometry.parameters.height).toBe(5)
    expect(geometry.parameters.depth).toBe(7)
  })
})

describe("meta / getMeta / hasMeta", () => {
  it("attaches a metadata record to an object and recovers it", () => {
    const group = new THREE.Group()
    const wrapped = meta(group, { props: { name: "tagged" } })

    expect(wrapped).toBe(group)
    expect(hasMeta(group)).toBe(true)
    expect(getMeta(group)?.props.name).toBe("tagged")
    expect(getMeta(new THREE.Group())).toBeUndefined()
    expect(hasMeta(new THREE.Group())).toBe(false)
  })
})

describe("useProps", () => {
  it("reactively applies props to an existing instance", () => {
    const mesh = new THREE.Mesh()
    const [x, setX] = createSignal(1)

    test(() => {
      useProps(mesh, {
        get "position-x"() {
          return x()
        },
      })
      return null
    })

    expect(mesh.position.x).toBe(1)
    setX(7)
    expect(mesh.position.x).toBe(7)
  })
})

describe("load (standalone)", () => {
  it("resolves a single URL via the loader", async () => {
    const result = await load(new MockLoader(), "tex.png")
    expect(result).toBeInstanceOf(MockResource)
    expect((result as MockResource).url).toBe("tex.png")
  })

  it("resolves a record of URLs to a record of results", async () => {
    const result = await load(new MockLoader(), { a: "a.png", b: "b.png" })
    expect(result.a).toBeInstanceOf(MockResource)
    expect(result.b).toBeInstanceOf(MockResource)
    expect((result.a as MockResource).url).toBe("a.png")
    expect((result.b as MockResource).url).toBe("b.png")
  })
})

describe("Resource", () => {
  it("adds an Object3D resource to the parent scene graph", async () => {
    const { scene } = test(() => <Resource loader={MockObject3DLoader} url="model.glb" />)
    await waitFor(() => expect(scene.children[0]?.name).toBe("model.glb"))
  })

  it("propagates `attach` to the loaded resource so the parent attaches it to the right slot", async () => {
    const { scene } = test(() => (
      <Resource loader={MockLoader} url="tex.png" attach="userData-asset" />
    ))
    await waitFor(() => expect(scene.userData.asset).toBeDefined())
    expect((scene.userData.asset as MockResource).url).toBe("tex.png")
  })

  it("renders via children render function with the loaded resource", async () => {
    let observedUrl: string | undefined
    test(() => (
      <Resource loader={MockLoader} url="render-fn.png">
        {resource => {
          observedUrl = (resource() as MockResource).url
          return null
        }}
      </Resource>
    ))
    await waitFor(() => expect(observedUrl).toBe("render-fn.png"))
  })
})

describe("CursorRaycaster / CenterRaycaster", () => {
  function makeContext(width: number, height: number): Context {
    return {
      camera: new THREE.PerspectiveCamera(),
      bounds: { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height },
    } as unknown as Context
  }

  it("CursorRaycaster seeds the ray from the camera at the set cursor", () => {
    const raycaster = new CursorRaycaster()
    const context = makeContext(100, 50)
    const setFromCamera = vi.spyOn(raycaster, "setFromCamera")

    raycaster.setCursor(new THREE.Vector2(0.5, 0))
    raycaster.cast([], context)

    expect(raycaster.pointer.x).toBeCloseTo(0.5)
    expect(raycaster.pointer.y).toBeCloseTo(0)
    expect(setFromCamera).toHaveBeenCalledWith(raycaster.pointer, context.camera)
  })

  it("CenterRaycaster always casts from (0, 0), ignoring setCursor", () => {
    const raycaster = new CenterRaycaster()
    const context = makeContext(200, 100)
    const setFromCamera = vi.spyOn(raycaster, "setFromCamera")

    raycaster.setCursor(new THREE.Vector2(0.99, 0.99)) // ignored — centre is fixed
    raycaster.cast([], context)

    expect(setFromCamera).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0 }),
      context.camera,
    )
  })
})

describe("pointer capture types", () => {
  it("exposes pointer-capture methods on pointer events", () => {
    const T = createT(THREE)
    type MeshProps = Parameters<typeof T.Mesh>[0]
    const onPointerDown: NonNullable<MeshProps["onPointerDown"]> = event => {
      assertType<() => void>(event.setPointerCapture)
      assertType<() => void>(event.releasePointerCapture)
      assertType<() => boolean>(event.hasPointerCapture)
    }
    void onPointerDown
  })
})
