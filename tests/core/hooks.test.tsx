import { Show, Suspense } from "solid-js"
import * as THREE from "three"
import { GLTFLoader } from "three-stdlib"
import { describe, expect, it, vi } from "vitest"
import { createT, Entity, useFrame, useLoader, useThree } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"
import type { Context } from "../../src/types.ts"
import { buildGraph } from "../../src/utils.ts"
import { asyncUtils } from "../utils/async-utils.ts"

const resolvers: (() => void)[] = []
const { waitFor } = asyncUtils(resolver => resolvers.push(resolver))

const T = createT(THREE)

describe("hooks", () => {
  it("can handle useThree hook", async () => {
    let result: Context = null!

    const Component = () => {
      result = useThree()
      return <T.Group />
    }

    test(() => <Component />)

    expect(result.camera instanceof THREE.Camera).toBeTruthy()
    expect(result.scene instanceof THREE.Scene).toBeTruthy()
    expect(result.raycaster instanceof THREE.Raycaster).toBeTruthy()
    // expect(result.size).toEqual({ height: 0, width: 0, top: 0, left: 0, updateStyle: false });
  })

  it("can handle useFrame hook", async () => {
    const frameCalls: number[] = []

    const Component = () => {
      let ref!: THREE.Mesh

      useFrame((_, delta) => {
        frameCalls.push(delta)
        ref.position.x = 1
      })

      return (
        <T.Mesh ref={ref}>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      )
    }

    const { scene, waitTillNextFrame, requestRender } = test(() => <Component />, {
      frameloop: "never",
    })
    requestRender()
    await waitTillNextFrame()

    expect(scene.children[0].position.x).toEqual(1)
    expect(frameCalls.length).toBeGreaterThan(0)
  })

  it("can handle useLoader hook", async () => {
    const MockMesh = new THREE.Mesh()
    const mockLoad = vi.fn().mockImplementation((_url, onLoad) => onLoad(MockMesh))
    class mockGLTFLoader extends GLTFLoader {
      constructor() {
        super()
      }
      load = mockLoad
    }

    const Component = () => {
      const model = useLoader(mockGLTFLoader, () => "/suzanne.glb")
      return (
        <Show when={model()}>
          {model => <Entity from={model() as unknown as THREE.Object3D} />}
        </Show>
      )
    }

    const scene = test(() => (
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    )).scene

    await waitFor(() => expect(scene.children[0]).toBeDefined())

    expect(scene.children[0]).toBe(MockMesh)
  })

  it("can handle useLoader hook with a record of URLs", async () => {
    const MockMesh = new THREE.Mesh()

    const MockSceneGroup = new THREE.Group()
    MockSceneGroup.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2), new THREE.MeshBasicMaterial()))

    class MockGLTFLoader extends GLTFLoader {
      load = vi
        .fn()
        .mockImplementationOnce((_url, onLoad) => onLoad(MockMesh))
        .mockImplementationOnce((_url, onLoad) => onLoad(MockSceneGroup))
    }

    const Component = () => {
      const resource = useLoader(
        MockGLTFLoader,
        () => ({ suzanne: "/suzanne.glb", duck: "/duck.glb" }),
        { onBeforeLoad: loader => loader.setPath("/public/models") },
      )

      return (
        <Show when={resource()} keyed>
          {result => (
            <>
              <Entity from={result.suzanne as unknown as THREE.Object3D} />
              <Entity from={result.duck as unknown as THREE.Object3D} />
            </>
          )}
        </Show>
      )
    }

    const scene = test(() => (
      <Suspense fallback={null}>
        <Component />
      </Suspense>
    )).scene

    await waitFor(() => expect(scene.children[0]).toBeDefined())

    // Record iteration order is insertion order; `suzanne` is loaded first.
    expect(scene.children[0]).toBe(MockMesh)
    expect(scene.children[1]).toBe(MockSceneGroup)
  })

  it("can handle useLoader with an onBeforeLoad option", async () => {
    class Loader extends THREE.Loader {
      load = (_url: string) => null
    }

    let proto!: Loader

    function Test() {
      useLoader(Loader, () => "", { onBeforeLoad: loader => (proto = loader) })
      return <></>
    }

    test(() => <Test />)

    await waitFor(() => expect(proto).toBeDefined())
    expect(proto).toBeInstanceOf(Loader)
  })

  it("can handle buildGraph utility", async () => {
    const group = new THREE.Group()
    const mat1 = new THREE.MeshBasicMaterial()
    mat1.name = "Mat 1"
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat1)
    mesh1.name = "Mesh 1"
    const mat2 = new THREE.MeshBasicMaterial()
    mat2.name = "Mat 2"
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat2)
    mesh2.name = "Mesh 2"
    const subGroup = new THREE.Group()
    const mat3 = new THREE.MeshBasicMaterial()
    mat3.name = "Mat 3"
    const mesh3 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat3)
    mesh3.name = "Mesh 3"
    const mat4 = new THREE.MeshBasicMaterial()
    mat4.name = "Mat 4"
    const mesh4 = new THREE.Mesh(new THREE.BoxGeometry(2, 2), mat4)
    mesh4.name = "Mesh 4"

    subGroup.add(mesh3, mesh4)
    group.add(mesh1, mesh2, subGroup)

    const result = buildGraph(group)

    expect(result).toEqual({
      nodes: {
        [mesh1.name]: mesh1,
        [mesh2.name]: mesh2,
        [mesh3.name]: mesh3,
        [mesh4.name]: mesh4,
      },
      materials: {
        [mat1.name]: mat1,
        [mat2.name]: mat2,
        [mat3.name]: mat3,
        [mat4.name]: mat4,
      },
    })
  })
})
