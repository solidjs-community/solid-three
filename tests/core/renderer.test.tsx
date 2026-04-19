import {
  type ComponentProps,
  createRenderEffect,
  createSignal,
  For,
  onCleanup,
  onSettled,
  Show,
} from "solid-js"
import * as THREE from "three"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { createT, Entity, Portal, useFrame, useThree } from "../../src/index.ts"
import { settled, test } from "../../src/testing/index.tsx"
import type { Context, Meta } from "../../src/types.ts"

type ComponentMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>

interface ObjectWithBackground extends THREE.Object3D {
  background: THREE.Color
}

/* This class is used for one of the tests */
class HasObject3dMember extends THREE.Object3D {
  public attachment?: THREE.Object3D = undefined
}

/* This class is used for one of the tests */
class HasObject3dMethods extends THREE.Object3D {
  attachedObj3d?: THREE.Object3D
  detachedObj3d?: THREE.Object3D

  customAttach(obj3d: THREE.Object3D) {
    this.attachedObj3d = obj3d
  }

  detach(obj3d: THREE.Object3D) {
    this.detachedObj3d = obj3d
  }
}

class MyColor extends THREE.Color {
  constructor(col: number) {
    super(col)
  }
}
const T = createT({ ...THREE, HasObject3dMember, HasObject3dMethods, MyColor })

beforeAll(() => {
  Object.defineProperty(globalThis, "devicePixelRatio", {
    configurable: true,
    value: 2,
  })
})

describe("renderer", () => {
  it("renders a simple component", async () => {
    const Mesh = () => (
      <T.Mesh>
        <T.BoxGeometry args={[2, 2]} />
        <T.MeshBasicMaterial />
      </T.Mesh>
    )
    const scene = (await test(() => <Mesh />)).scene

    expect(scene.children[0].type).toEqual("Mesh")
    expect((scene.children[0] as ComponentMesh).geometry.type).toEqual("BoxGeometry")
    expect((scene.children[0] as ComponentMesh).material.type).toEqual("MeshBasicMaterial")
    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material
        .type,
    ).toEqual("MeshBasicMaterial")
  })

  it("renders an empty scene", async () => {
    const Empty = () => null
    const scene = (await test(() => <Empty />)).scene

    expect(scene.type).toEqual("Scene")
    expect(scene.children).toEqual([])
  })

  it("can render a composite component", async () => {
    const Parent = () => {
      return (
        <T.Group>
          <T.Color attach="background" args={[0, 0, 0]} />
          <Child />
        </T.Group>
      )
    }

    const Child = () => {
      return (
        <T.Mesh>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      )
    }

    const scene = (await test(() => <Parent />)).scene

    expect(scene.children[0].type).toEqual("Group")
    expect((scene.children[0] as ObjectWithBackground).background.getStyle()).toEqual("rgb(0,0,0)")
    expect(scene.children[0].children[0].type).toEqual("Mesh")
    expect((scene.children[0].children[0] as ComponentMesh).geometry.type).toEqual("BoxGeometry")
    expect((scene.children[0].children[0] as ComponentMesh).material.type).toEqual(
      "MeshBasicMaterial",
    )
    expect(
      (scene.children[0].children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>)
        .material.type,
    ).toEqual("MeshBasicMaterial")
  })

  it("renders some basics with an update", async () => {
    let renders = 0

    const Component = () => {
      const [state] = createSignal(7)

      renders++

      return (
        <T.Group position-x={state()}>
          <Child />
          <Null />
        </T.Group>
      )
    }

    const Child = () => {
      renders++
      return <T.Color attach="background" args={[0, 0, 0]} />
    }

    const Null = () => {
      renders++
      return null
    }

    const scene = (await test(() => <Component />)).scene

    expect(scene.children[0].position.x).toEqual(7)
    expect(renders).toBe(3)
  })

  it("updates types & names", async () => {
    const [type, setType] = createSignal<"MeshBasicMaterial" | "MeshStandardMaterial">(
      "MeshBasicMaterial",
    )

    const scene = (await test(() => (
      <T.Mesh>
        {type() === "MeshBasicMaterial" ? (
          <T.MeshBasicMaterial name="basicMat">
            <T.Color attach="color" args={[255, 255, 255]} />
          </T.MeshBasicMaterial>
        ) : (
          <T.MeshStandardMaterial name="standardMat">
            <T.Color attach="color" args={[255, 255, 255]} />
          </T.MeshStandardMaterial>
        )}
      </T.Mesh>
    ))).scene

    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.type,
    ).toEqual("MeshBasicMaterial")
    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.name,
    ).toEqual("basicMat")

    setType("MeshStandardMaterial")
    await settled()

    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material
        .type,
    ).toEqual("MeshStandardMaterial")
    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material
        .name,
    ).toEqual("standardMat")
  })

  it("should forward ref three object", async () => {
    // Note: Passing directly should be less strict, and assigning current should be more strict
    let immutableRef!: THREE.Mesh
    let mutableRef!: THREE.Mesh
    let mutableRefSpecific!: THREE.Mesh

    const RefTest = () => {
      return (
        <>
          <T.Mesh ref={immutableRef} />
          <T.Mesh ref={mutableRef} />
          <T.Mesh ref={r => (mutableRefSpecific = r)} />
        </>
      )
    }

    test(() => <RefTest />)

    expect(immutableRef).toBeTruthy()
    expect(mutableRef).toBeTruthy()
    expect(mutableRefSpecific).toBeTruthy()
  })

  it("attaches Object3D children that use attach", async () => {
    const scene = (await test(() => (
      <T.HasObject3dMember>
        <T.Mesh attach="attachment" />
      </T.HasObject3dMember>
    ))).scene

    const attachedMesh = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedMesh).toBeDefined()
    expect(attachedMesh?.type).toBe("Mesh")
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  it("can attach a Scene", async () => {
    const scene = (await test(() => (
      <T.HasObject3dMember>
        <T.Scene attach="attachment" />
      </T.HasObject3dMember>
    ))).scene

    const attachedScene = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedScene).toBeDefined()
    expect(attachedScene?.type).toBe("Scene")
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  describe("attaches Object3D children that use attachFns", () => {
    it("attachFns with cleanup", async () => {
      const [visible, setVisible] = createSignal(true)

      const scene = (await test(() => (
        <T.HasObject3dMethods>
          <Show when={visible()}>
            <T.Mesh
              attach={(parent, self) => (
                (parent as any).customAttach(self), () => (parent as any).detach(self)
              )}
            />
          </Show>
        </T.HasObject3dMethods>
      ))).scene

      const attachedMesh = (scene.children[0] as HasObject3dMethods).attachedObj3d

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe("Mesh")
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      // and now detach ..
      expect((scene.children[0] as HasObject3dMethods).detachedObj3d).toBeUndefined()

      setVisible(false)
      await settled()

      const detachedMesh = (scene.children[0] as HasObject3dMethods).detachedObj3d
      expect(detachedMesh).toBe(attachedMesh)
    })

    it("attachFns as functions", async () => {
      let attachedMesh: THREE.Object3D = null!
      let detachedMesh: THREE.Object3D = null!

      const [visible, setVisible] = createSignal(true)

      const scene = (await test(() => (
        <T.HasObject3dMethods>
          <Show when={visible()}>
            <T.Mesh
              attach={parent => {
                attachedMesh = parent as THREE.Object3D
                return () => (detachedMesh = parent as THREE.Object3D)
              }}
            />
          </Show>
        </T.HasObject3dMethods>
      ))).scene

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe("Object3D")
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      setVisible(false)
      await settled()

      expect(detachedMesh).toBe(attachedMesh)
    })
  })

  it("does the full lifecycle", async () => {
    const log: string[] = []
    // @ts-expect-error TODO: fix type-error
    const Log = props => {
      onSettled(() => { log.push("mount " + props.name) })
      onCleanup(() => log.push("unmount " + props.name))
      log.push("render " + props.name)
      return <T.Group />
    }

    const { unmount: dispose } = await test(() => <Log name="Foo" />)

    await settled()
    dispose()

    expect(log).toEqual(["render Foo", "mount Foo", "unmount Foo"])
  })

  // it("will mount/unmount event handlers correctly", async () => {
  //   let [mounted, setMounted] = createSignal(false);
  //   let [attachEvents, setAttachEvents] = createSignal(false);

  //   // NOTE:  this test fails when using ternary operators
  //   const EventfulComponent = () => (
  //     <Show when={mounted()}>
  //       <T.Group onClick={attachEvents() ? () => {} : undefined} />
  //     </Show>
  //   );

  //   const { eventRegistry, waitTillNextFrame } = await test(() => <EventfulComponent />);

  //   // Test initial mount without events
  //   setMounted(true);
  //   expect(eventRegistry.onClick.length).toBe(0);

  //   // Test initial mount with events
  //   setAttachEvents(true);

  //   expect(eventRegistry.onClick.length).not.toBe(0);

  //   // Test events update
  //   setAttachEvents(false);

  //   expect(eventRegistry.onClick.length).toBe(0);

  //   setAttachEvents(true);
  //   expect(eventRegistry.onClick.length).not.toBe(0);

  //   // Test unmount with events
  //   setMounted(false);
  //   expect(eventRegistry.onClick.length).toBe(0);
  // });

  it("will create an identical instance when reconstructing", async () => {
    const [first, setFirst] = createSignal(true)

    const instances: { uuid: string; parentUUID?: string; childUUID?: string }[] = []

    const object1 = new THREE.Group()
    const object2 = new THREE.Group()

    const Test = (props: { first?: boolean }) => (
      <Entity from={props.first ? object1 : object2} onPointerMove={() => null}>
        <T.Group />
      </Entity>
    )

    const state = await test(() => <Test first={first()} />)

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })
    expect(state.scene.children[0]).toBe(object1)
    expect(state.scene.children[0].children[0]).toBeDefined()

    setFirst(false)
    await settled()

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })

    const [oldInstance, newInstance] = instances

    // Swapped to new instance
    expect(state.scene.children[0]).toBe(object2)

    // Preserves scene hierarchy
    expect(oldInstance.parentUUID).toBe(newInstance.parentUUID)
    expect(oldInstance.childUUID).toBe(newInstance.childUUID)

    // Rebinds events
    // expect(state.eventRegistry.onPointerMove.length).not.toBe(0);
  })

  it("can swap Entitys", async () => {
    const [n, setN] = createSignal(1)
    const o1 = new THREE.Group()
    o1.add(new THREE.Group())
    const o2 = new THREE.Group()

    const Test = (props: { n: number }) => (
      <Entity from={props.n === 1 ? o1 : o2}>
        <T.Group attach="test" />
      </Entity>
    )

    const state = await test(() => <Test n={n()} />)

    // Initial object is added with children and attachments
    expect(state.scene.children[0]).toBe(o1)
    expect(state.scene.children[0].children.length).toBe(1)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)

    setN(2)
    await settled()

    // Swapped to object 2, does not copy old children, copies attachments
    expect(state.scene.children[0]).toBe(o2)
    expect(state.scene.children[0].children.length).toBe(0)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)
  })

  it("can swap 4 array Entitys", async () => {
    const a = new THREE.Group()
    const b = new THREE.Group()
    const c = new THREE.Group()
    const d = new THREE.Group()
    const [array, setArray] = createSignal([a, b, c, d])

    const Test = (props: { array: THREE.Group[] }) => (
      <>
        <For each={props.array}>{group => <Entity from={group} />}</For>
      </>
    )

    const state = await test(() => <Test array={array()} />)

    expect(state.scene.children[0]).toBe(a)
    expect(state.scene.children[1]).toBe(b)
    expect(state.scene.children[2]).toBe(c)
    expect(state.scene.children[3]).toBe(d)

    const reversedArray = [...array().reverse()]

    setArray(reversedArray)
    await settled()

    expect(state.scene.children[0]).toBe(d)
    expect(state.scene.children[1]).toBe(c)
    expect(state.scene.children[2]).toBe(b)
    expect(state.scene.children[3]).toBe(a)

    const mixedArray = [b, a, d, c]

    setArray(mixedArray)
    await settled()

    expect(state.scene.children[0]).toBe(b)
    expect(state.scene.children[1]).toBe(a)
    expect(state.scene.children[2]).toBe(d)
    expect(state.scene.children[3]).toBe(c)
  })

  it("will make an Orthographic Camera & set the position", async () => {
    let camera: THREE.Camera = null!

    camera = (await test(() => <T.Group />, {
      orthographic: true,
      defaultCamera: { position: [0, 0, 5] },
    })).camera

    expect(camera.type).toEqual("OrthographicCamera")
    expect(camera.position.z).toEqual(5)
  })

  // TODO:  implement performance configuration

  // it("should handle an performance changing functions", async () => {
  //   let state = await test(() => <T.Group />, { dpr: [1, 2], performance: { min: 0.2 } });

  //   expect(state.viewport.initialDpr).toEqual(2);
  //   expect(state.performance.min).toEqual(0.2);
  //   expect(state.performance.current).toEqual(1);

  //   state.setDpr(0.1);

  //   expect(state.viewport.dpr).toEqual(0.1);

  //   vi.useFakeTimers();

  //   state.performance.regress();
  //   vi.advanceTimersByTime(100);

  //   expect(state.performance.current).toEqual(0.2);

  //   vi.advanceTimersByTime(200);

  //   expect(state.performance.current).toEqual(1);

  //   vi.useRealTimers();
  // });

  it("should set PCFSoftShadowMap as the default shadow map", async () => {
    let state = await test(() => <T.Group />, { shadows: true })
    expect(state.gl.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
  })

  it("should set tonemapping to ACESFilmicToneMapping and outputColorSpace to sRGB if linear is false", async () => {
    let state = await test(() => <T.Group />, { linear: false })

    expect(state.gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect((state.gl as unknown as { outputColorSpace: string }).outputColorSpace).toBe("srgb")
  })

  it("should toggle render mode in xr", async () => {
    const state = await test(() => <T.Group />)

    state.gl.xr.isPresenting = true
    state.gl.xr.dispatchEvent({ type: "sessionstart" })

    expect(state.gl.xr.enabled).toEqual(true)

    state.gl.xr.isPresenting = false
    state.gl.xr.dispatchEvent({ type: "sessionend" })

    expect(state.gl.xr.enabled).toEqual(false)
  })

  it('should respect frameloop="never" in xr', async () => {
    let respected = true

    const TestGroup = () => {
      useFrame(() => {
        respected = false
      })
      return <T.Group />
    }
    const state = await test(() => <TestGroup />, { frameloop: "never" })
    state.gl.xr.isPresenting = true
    state.gl.xr.dispatchEvent({ type: "sessionstart" })

    await new Promise(resolve => requestAnimationFrame(resolve))

    expect(respected).toEqual(true)
  })

  it("will render components that are extended", async () => {
    const testExtend = async () => {
      const T = createT({ MyColor })
      test(() => <T.MyColor args={[0x0000ff]} attach="color" />)
    }

    expect(() => testExtend()).not.toThrow()
  })

  it("should set renderer props via gl prop", async () => {
    // @ts-expect-error TODO: fix type-error
    const gl = (await test(() => <T.Group />, { gl: { physicallyCorrectLights: true } })).gl
    // @ts-expect-error TODO: fix type-error
    expect(gl.physicallyCorrectLights).toBe(true)
  })

  it("should update scene via scene prop", async () => {
    const scene = (await test(() => <T.Group />, { scene: { name: "test" } })).scene

    expect(scene.name).toBe("test")
  })

  it("should set a custom scene via scene prop", async () => {
    const prop = new THREE.Scene()

    const scene = (await test(() => <T.Group />, { scene: prop })).scene

    expect(prop).toBe(scene)
  })

  it("should set a renderer via gl callback", async () => {
    class Renderer extends THREE.WebGLRenderer {}

    const gl = (await test(() => <T.Group />, { gl: canvas => new Renderer({ canvas }) })).gl

    expect(gl instanceof Renderer).toBe(true)
  })

  it("should respect color management preferences via gl", async () => {
    const texture = new THREE.Texture() as THREE.Texture & { colorSpace?: string }
    function Test() {
      return <T.MeshBasicMaterial map={texture} />
    }

    const LinearEncoding = 3000
    const sRGBEncoding = 3001

    const [linear, setLinear] = createSignal(false)
    const [flat, setFlat] = createSignal(false)

    const gl = (await test(() => <Test />, {
      get linear() {
        return linear()
      },
      get flat() {
        return flat()
      },
    })).gl as unknown as THREE.WebGLRenderer & { outputColorSpace: string }

    const SRGBColorSpace = "srgb"
    const LinearSRGBColorSpace = "srgb-linear"

    expect(gl.outputColorSpace).toBe(SRGBColorSpace)
    expect(gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(texture.colorSpace).toBe(SRGBColorSpace)

    setLinear(true)
    setFlat(true)
    await settled()

    expect(gl.outputColorSpace).toBe(LinearSRGBColorSpace)
    expect(gl.toneMapping).toBe(THREE.NoToneMapping)
    expect(texture.colorSpace).toBe(LinearSRGBColorSpace)

    // @ts-expect-error TODO: fix type-error
    gl.outputColorSpace = "test"
    texture.colorSpace = ""

    setLinear(false)
    await settled()
    expect(gl.outputColorSpace).toBe(SRGBColorSpace)
    expect(texture.colorSpace).toBe(SRGBColorSpace)

    setLinear(true)
    await settled()
    expect(gl.outputColorSpace).toBe(LinearSRGBColorSpace)
    expect(texture.colorSpace).toBe(LinearSRGBColorSpace)
  })

  // NOTE:  Maybe we can keep legacy mode out of solid-three

  // it("should respect legacy prop", async () => {
  //   // <= r138 internal fallback
  //   const material = React.createRef<THREE.MeshBasicMaterial>();
  //   extend({ ColorManagement: null });
  //   render(() => <T.MeshBasicMaterial ref={material} color="#111111" />);
  //   expect((THREE as any).ColorManagement.legacyMode).toBe(false);
  //   expect(material.current!.color.toArray()).toStrictEqual(
  //     new THREE.Color("#111111").convertSRGBToLinear().toArray(),
  //   );
  //   extend({ ColorManagement: (THREE as any).ColorManagement });

  //   // r139 legacyMode
  //   root.configure({ legacy: true }).render(<T.Group />);
  //   expect((THREE as any).ColorManagement.legacyMode).toBe(true);

  //   root.configure({ legacy: false }).render(<T.Group />);
  //   expect((THREE as any).ColorManagement.legacyMode).toBe(false);

  //   // r150 !enabled
  //   (THREE as any).ColorManagement.enabled = true;

  //   root.configure({ legacy: true }).render(<T.Group />);
  //   expect((THREE as any).ColorManagement.enabled).toBe(false);

  //   root.configure({ legacy: false }).render(<T.Group />);
  //   expect((THREE as any).ColorManagement.enabled).toBe(true);
  // });

  it("can handle createPortal", async () => {
    const scene = new THREE.Scene()

    let state: Context = null!
    let portalState: Context = null!

    const Normal = () => {
      const three = useThree()
      state = three

      return <T.Group />
    }

    const Group = () => {
      const three = useThree()
      portalState = three

      return <T.Group />
    }

    test(() => (
      <>
        <Normal />
        <Portal element={scene}>
          <Group />
        </Portal>
      </>
    ))

    // Renders into portal target
    expect(scene.children.length).not.toBe(0)

    // Creates an isolated state enclave
    expect(state.scene).not.toBe(scene)
    expect(portalState.scene).toBe(scene)
  })

  it("can handle createPortal on unmounted container", async () => {
    const [group, setGroup] = createSignal<Meta<THREE.Group> | null>(null)
    const [key, setKey] = createSignal(1)

    function Test(props: any) {
      return (
        <T.Group {...props} ref={setGroup}>
          <Show when={group()}>
            {group => {
              return (
                <Portal element={group()}>
                  <T.Mesh />
                </Portal>
              )
            }}
          </Show>
        </T.Group>
      )
    }

    await test(() => (key() ? <Test /> : undefined))

    expect(group()).toBeDefined()
    const prevUUID = group()!.uuid

    setKey(key => key + 1)
    await settled()

    expect(group()).toBeDefined()
    expect(prevUUID).not.toBe(group()!.uuid)
  })

  it("invalidates pierced props when root is changed", async () => {
    const [signal, setSignal] = createSignal(1)
    let material: THREE.MeshBasicMaterial
    const texture1 = { needsUpdate: false, name: "" } as THREE.Texture
    const texture2 = { needsUpdate: false, name: "" } as THREE.Texture

    test(() => (
      <T.MeshBasicMaterial
        // @ts-ignore TODO: fix type-error
        ref={material}
        map={signal() === 1 ? texture1 : texture2}
        map-needsUpdate
        map-name="test"
      />
    ))

    expect(material!.map).toBe(texture1)
    expect(texture1.needsUpdate).toBe(true)
    expect(texture1.name).toBe("test")

    setSignal(2)
    await settled()

    expect(material!.map).toBe(texture2)
    expect(texture2.needsUpdate).toBe(true)
    expect(texture2.name).toBe("test")
  })

  // https://github.com/mrdoob/three.js/issues/21209
  it("can handle HMR default where three.js isn't reliable", async () => {
    let ref: THREE.Mesh

    function Test() {
      const [scale] = createSignal(false)
      // @ts-ignore TODO: fix type-error
      return <T.Mesh ref={ref} scale={scale() ? 0.5 : undefined} />
    }

    test(() => <Test />)

    expect(ref!.scale.toArray()).toStrictEqual(new THREE.Object3D().scale.toArray())
  })

  it("onUpdate shouldn't update itself", async () => {
    const one = vi.fn()
    const two = vi.fn()

    const Test = (props: ComponentProps<typeof T.Mesh>) => <T.Mesh {...props} />

    const [updateType, setUpdateType] = createSignal<"one" | "two">("one")

    test(() => <Test onUpdate={updateType() === "one" ? one : two} />)

    setUpdateType("two")
    await settled()

    expect(one).toBeCalledTimes(1)
    expect(two).toBeCalledTimes(0)
  })

  // TODO:  Unsure if we should implement this.
  //        I was thinking of doing the opposite: useThree is readonly and if you want to take control you use props.

  // it("camera props shouldn't overwrite state", async () => {
  //   const camera = new THREE.OrthographicCamera();

  //   function Test() {
  //     // const set = useThree(state => state.set);
  //     // React.useMemo(() => set({ camera }), [set]);
  //     return null;
  //   }

  //   const [cameraName, setCameraName] = createSignal<string | undefined>(undefined);

  //   const store = await test(() => <Test />, {
  //     camera: {
  //       get name() {
  //         return cameraName();
  //       },
  //     },
  //   });
  //   expect(store.camera).toBe(camera);

  //   setCameraName("test");

  //   expect(store.camera).toBe(camera);
  //   expect(camera.name).not.toBe("test");
  // });

  it("should safely handle updates to the object prop", async () => {
    let ref: THREE.Object3D = null!
    let child: THREE.Object3D = null!
    let attachedChild: THREE.Object3D = null!

    const Test = (props: ComponentProps<typeof Entity>) => (
      <Entity {...props} ref={ref}>
        <T.Object3D ref={child} />
        <T.Object3D ref={attachedChild} attach="userData-attach" />
      </Entity>
    )

    const object1 = new THREE.Object3D()
    const child1 = new THREE.Object3D()
    object1.add(child1)

    const object2 = new THREE.Object3D()
    const child2 = new THREE.Object3D()
    object2.add(child2)

    const [object, setObject] = createSignal(object1)

    // Initial
    test(() => <Test from={object()} />)

    expect(ref).toBe(object1)

    expect(ref!.children).toStrictEqual([child1, child])
    expect(ref!.userData.attach).toBe(attachedChild)

    // Update
    setObject(object2)
    await settled()
    expect(ref).toBe(object2)
    expect(ref!.children).toStrictEqual([child2, child])
    expect(ref!.userData.attach).toBe(attachedChild)

    // Revert
    setObject(object1)
    await settled()
    expect(ref).toBe(object1)
    expect(ref!.children).toStrictEqual([child1, child])
    expect(ref!.userData.attach).toBe(attachedChild)
  })
})
