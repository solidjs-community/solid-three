import {
  type ComponentProps,
  createRenderEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js"
import * as THREE from "three"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { pointerEvents } from "../../src/events/index.ts"
import { createT, Entity, Portal, useFrame, useThree } from "../../src/index.ts"
import { test } from "../../src/testing/index.tsx"
import type { Context, Meta, RendererLike } from "../../src/types.ts"
import { getPendingInit } from "../../src/utils.ts"

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

const nextFrames = (n: number) =>
  new Promise<void>(resolve => {
    let i = 0
    const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })

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
    const scene = test(() => <Mesh />).scene

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
    const scene = test(() => <Empty />).scene

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

    const scene = test(() => <Parent />).scene

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
      const [state, setState] = createSignal(3)

      setState(7)

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

    const scene = test(() => <Component />).scene

    expect(scene.children[0].position.x).toEqual(7)
    expect(renders).toBe(3)
  })

  it("updates types & names", async () => {
    const [type, setType] = createSignal<"MeshBasicMaterial" | "MeshStandardMaterial">(
      "MeshBasicMaterial",
    )

    const scene = test(() => (
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
    )).scene

    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.type,
    ).toEqual("MeshBasicMaterial")
    expect(
      (scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.name,
    ).toEqual("basicMat")

    setType("MeshStandardMaterial")

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
    const scene = test(() => (
      <T.HasObject3dMember>
        <T.Mesh attach="attachment" />
      </T.HasObject3dMember>
    )).scene

    const attachedMesh = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedMesh).toBeDefined()
    expect(attachedMesh?.type).toBe("Mesh")
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  it("can attach a Scene", async () => {
    const scene = test(() => (
      <T.HasObject3dMember>
        <T.Scene attach="attachment" />
      </T.HasObject3dMember>
    )).scene

    const attachedScene = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedScene).toBeDefined()
    expect(attachedScene?.type).toBe("Scene")
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  it("attaches a foreign Material (duck-typed isMaterial: true)", async () => {
    // Reproduces the failure mode hit by `three/webgpu`'s
    // `MeshBasicNodeMaterial` (and any other Material from a separate
    // module instance of three): the class doesn't share the `Material`
    // prototype that solid-three imports from "three", so the
    // `child instanceof Material` check in `applySceneGraph` fails and the
    // material is never wired up as `mesh.material`. Duck-typing on
    // `isMaterial` should handle this case.
    class ForeignMaterial {
      isMaterial = true
      type = "ForeignMaterial"
      // three's Material API surface that solid-three may touch
      dispose() {}
      copy(_other: ForeignMaterial) {
        return this
      }
    }
    const TF = createT({ ...THREE, ForeignMaterial })

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const scene = test(() => (
      <TF.Mesh>
        <TF.BoxGeometry />
        <TF.ForeignMaterial />
      </TF.Mesh>
    )).scene

    const mesh = scene.children[0] as THREE.Mesh
    expect(mesh.type).toBe("Mesh")
    expect((mesh.material as ForeignMaterial).type).toBe("ForeignMaterial")
    expect(errorSpy).not.toHaveBeenCalled()

    errorSpy.mockRestore()
  })

  describe("attaches Object3D children that use attachFns", () => {
    it("attachFns with cleanup", async () => {
      const [visible, setVisible] = createSignal(true)

      const scene = test(() => (
        <T.HasObject3dMethods>
          <Show when={visible()}>
            <T.Mesh
              attach={(parent, self) => (
                (parent as any).customAttach(self),
                () => (parent as any).detach(self)
              )}
            />
          </Show>
        </T.HasObject3dMethods>
      )).scene

      const attachedMesh = (scene.children[0] as HasObject3dMethods).attachedObj3d

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe("Mesh")
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      // and now detach ..
      expect((scene.children[0] as HasObject3dMethods).detachedObj3d).toBeUndefined()

      setVisible(false)

      const detachedMesh = (scene.children[0] as HasObject3dMethods).detachedObj3d
      expect(detachedMesh).toBe(attachedMesh)
    })

    it("attachFns as functions", async () => {
      let attachedMesh: THREE.Object3D = null!
      let detachedMesh: THREE.Object3D = null!

      const [visible, setVisible] = createSignal(true)

      const scene = test(() => (
        <T.HasObject3dMethods>
          <Show when={visible()}>
            <T.Mesh
              attach={parent => (
                (attachedMesh = parent as THREE.Object3D),
                () => (detachedMesh = parent as THREE.Object3D)
              )}
            />
          </Show>
        </T.HasObject3dMethods>
      )).scene

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh.type).toBe("Object3D")
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      setVisible(false)

      expect(detachedMesh).toBe(attachedMesh)
    })
  })

  it("does the full lifecycle", async () => {
    const log: string[] = []
    // @ts-expect-error TODO: fix type-error
    const Log = props => {
      onMount(() => log.push("mount " + props.name))
      onCleanup(() => log.push("unmount " + props.name))
      log.push("render " + props.name)
      return <T.Group />
    }

    const { unmount: dispose } = test(() => <Log name="Foo" />)

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

  //   const { eventRegistry, waitTillNextFrame } = test(() => <EventfulComponent />);

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
      // The pointer engine is what gives this Entity an `onPointerMove` prop at all —
      // the handler is here so the swap happens on an event-registered object.
      <Entity
        from={props.first ? object1 : object2}
        plugins={[pointerEvents()]}
        onPointerMove={() => null}
      >
        <T.Group />
      </Entity>
    )

    const state = test(() => <Test first={first()} />)

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })
    expect(state.scene.children[0]).toBe(object1)
    expect(state.scene.children[0].children[0]).toBeDefined()

    setFirst(false)

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

    const state = test(() => <Test n={n()} />)

    // Initial object is added with children and attachments
    expect(state.scene.children[0]).toBe(o1)
    expect(state.scene.children[0].children.length).toBe(1)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)

    setN(2)

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

    const state = test(() => <Test array={array()} />)

    expect(state.scene.children[0]).toBe(a)
    expect(state.scene.children[1]).toBe(b)
    expect(state.scene.children[2]).toBe(c)
    expect(state.scene.children[3]).toBe(d)

    const reversedArray = [...array().reverse()]

    setArray(reversedArray)

    expect(state.scene.children[0]).toBe(d)
    expect(state.scene.children[1]).toBe(c)
    expect(state.scene.children[2]).toBe(b)
    expect(state.scene.children[3]).toBe(a)

    const mixedArray = [b, a, d, c]

    setArray(mixedArray)

    expect(state.scene.children[0]).toBe(b)
    expect(state.scene.children[1]).toBe(a)
    expect(state.scene.children[2]).toBe(d)
    expect(state.scene.children[3]).toBe(c)
  })

  it("will make an Orthographic Camera & set the position", async () => {
    let camera: THREE.Camera = null!

    camera = test(() => <T.Group />, {
      orthographic: true,
      camera: { position: [0, 0, 5] },
    }).camera

    expect(camera.type).toEqual("OrthographicCamera")
    expect(camera.position.z).toEqual(5)
  })

  // TODO:  implement performance configuration

  // it("should handle an performance changing functions", async () => {
  //   let state = test(() => <T.Group />, { dpr: [1, 2], performance: { min: 0.2 } });

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
    const state = test(() => <T.Group />, { shadows: true })
    const gl = state.gl as unknown as THREE.WebGLRenderer
    expect(gl.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
  })

  it("should set tonemapping to ACESFilmicToneMapping and outputColorSpace to SRGBColorSpace if linear is false", async () => {
    const state = test(() => <T.Group />, { linear: false })
    const gl = state.gl as unknown as THREE.WebGLRenderer

    expect(gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(gl.outputColorSpace).toBe(THREE.SRGBColorSpace)
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
    const gl = test(() => <T.Group />, { gl: { physicallyCorrectLights: true } }).gl
    // @ts-expect-error TODO: fix type-error
    expect(gl.physicallyCorrectLights).toBe(true)
  })

  it("should accept a flat gl prop mixing ctor args and instance props", async () => {
    // `antialias` is a ctor arg → baked into WebGLRenderer({...}).
    // `toneMapping` is an instance prop → applied via useProps after construction.
    // The split is internal; users pass one flat object.
    const gl = test(() => <T.Group />, {
      gl: { antialias: false, toneMapping: THREE.NoToneMapping },
    }).gl as unknown as THREE.WebGLRenderer
    expect(gl).toBeInstanceOf(THREE.WebGLRenderer)
    expect(gl.toneMapping).toBe(THREE.NoToneMapping)
  })

  it("should reactively update instance props in the flat gl prop", async () => {
    const [tone, setTone] = createSignal<THREE.ToneMapping>(THREE.NoToneMapping)
    const state = test(() => <T.Group />, {
      get gl() {
        return { antialias: false, toneMapping: tone() }
      },
    })
    const renderer = state.gl as unknown as THREE.WebGLRenderer
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping)
    setTone(THREE.ACESFilmicToneMapping)
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
  })

  it("should warn (and not recreate) when a ctor-arg key is changed reactively", async () => {
    // WebGL bakes ctor args (antialias etc.) into the context at creation —
    // they can't be changed without a new canvas. solid-three keeps the
    // existing renderer and warns once instead of silently ignoring.
    const [aa, setAa] = createSignal(true)
    const state = test(() => <T.Group />, {
      get gl() {
        return { antialias: aa() }
      },
    })
    const initial = state.gl
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    setAa(false)

    expect(state.gl).toBe(initial)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/antialias/)
    expect(warn.mock.calls[0][0]).toMatch(/unmount and remount/)

    warn.mockRestore()
  })

  it("should update scene via scene prop", async () => {
    const scene = test(() => <T.Group />, { scene: { name: "test" } }).scene

    expect(scene.name).toBe("test")
  })

  it("should set a custom scene via scene prop", async () => {
    const prop = new THREE.Scene()

    const scene = test(() => <T.Group />, { scene: prop }).scene

    expect(prop).toBe(scene)
  })

  it("should set a renderer via gl callback", async () => {
    class SupportedRenderer extends THREE.WebGLRenderer {}

    const gl = test(() => <T.Group />, { gl: canvas => new SupportedRenderer({ canvas }) }).gl

    expect(gl instanceof SupportedRenderer).toBe(true)
  })

  /**
   * External-renderer (RendererLike) tests — cover the structural-typed `gl`
   * prop that lets users pass any renderer (WebGPURenderer, SVGRenderer,
   * custom). Mirrors r3f's external-renderer.test.tsx.
   */
  function makeFakeRenderer(overrides: Partial<RendererLike> = {}) {
    const fake = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      getPixelRatio: vi.fn(() => 1),
      domElement: document.createElement("canvas"),
      ...overrides,
    }
    return fake as typeof fake & RendererLike
  }

  it("should accept a RendererLike instance as the gl prop", async () => {
    const fake = makeFakeRenderer()
    const state = test(() => <T.Group />, { gl: fake })
    expect(state.gl).toBe(fake)
  })

  it("should accept a RendererLike instance returned from the gl factory", async () => {
    const fake = makeFakeRenderer()
    const state = test(() => <T.Group />, { gl: () => fake })
    expect(state.gl).toBe(fake)
  })

  it("should await renderer.init() before the first render", async () => {
    let resolveInit!: () => void
    const initPromise = new Promise<void>(resolve => {
      resolveInit = resolve
    })
    const fake = makeFakeRenderer({ init: vi.fn(() => initPromise) })

    const state = test(() => <T.Group />, { gl: fake })

    // Loop is spinning, but render() must early-return until init resolves.
    await new Promise(resolve => requestAnimationFrame(resolve))
    expect(fake.init).toHaveBeenCalledTimes(1)
    expect(fake.render).not.toHaveBeenCalled()

    resolveInit()
    await initPromise
    await state.waitTillNextFrame()

    expect(fake.render).toHaveBeenCalled()
  })

  it("should skip init() when hasInitialized() returns true", async () => {
    const fake = makeFakeRenderer({
      init: vi.fn(async () => {}),
      hasInitialized: vi.fn(() => true),
    })

    const state = test(() => <T.Group />, { gl: fake })
    await state.waitTillNextFrame()

    expect(fake.init).not.toHaveBeenCalled()
    expect(fake.render).toHaveBeenCalled()
  })

  it("should render immediately for a RendererLike without init()", async () => {
    const fake = makeFakeRenderer()
    const state = test(() => <T.Group />, { gl: fake })

    await state.waitTillNextFrame()
    expect(fake.render).toHaveBeenCalled()
  })

  it("should skip color-management props on a renderer that lacks them", async () => {
    // SVGRenderer / custom renderers don't have outputColorSpace or toneMapping.
    const fake = makeFakeRenderer() as RendererLike & {
      outputColorSpace?: unknown
      toneMapping?: unknown
    }
    test(() => <T.Group />, { gl: fake, linear: false, flat: false })

    expect(fake.outputColorSpace).toBeUndefined()
    expect(fake.toneMapping).toBeUndefined()
  })

  it("should apply color-management props to a renderer that exposes them", async () => {
    const fake = Object.assign(makeFakeRenderer(), {
      outputColorSpace: "",
      toneMapping: 0,
    })
    test(() => <T.Group />, { gl: fake, linear: false, flat: false })

    expect(fake.outputColorSpace).toBe(THREE.SRGBColorSpace)
    expect(fake.toneMapping).toBe(THREE.ACESFilmicToneMapping)
  })

  it("should accept a renderer without setPixelRatio/getPixelRatio (CSS/SVG-style)", async () => {
    // DOM-based renderers (CSS2DRenderer, CSS3DRenderer, SVGRenderer) have no
    // pixel-ratio API. They must still work — `context.dpr` falls back to `1`
    // (the renderer didn't scale anything, so reporting any other value
    // would be fabricating).
    const fake: RendererLike = {
      render: vi.fn(),
      setSize: vi.fn(),
      domElement: document.createElement("div"),
    }
    const state = test(() => <T.Group />, { gl: fake })

    expect(() => state.gl.setSize(100, 100)).not.toThrow()
    expect(state.dpr).toBe(1)
  })

  it("should apply shadowMap.enabled/type but not needsUpdate on non-WebGL shadow maps", async () => {
    // WebGPURenderer's `shadowMap` is `{ enabled, type }` — no `needsUpdate`.
    // The shared `enabled`/`type` writes should still happen; only the
    // WebGL-specific `needsUpdate = true` write is gated.
    const fake = Object.assign(makeFakeRenderer(), {
      shadowMap: { enabled: false, type: 0 },
    })
    test(() => <T.Group />, { gl: fake, shadows: true })

    expect(fake.shadowMap.enabled).toBe(true)
    expect(fake.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
    expect("needsUpdate" in fake.shadowMap).toBe(false)
  })

  describe("getPendingInit", () => {
    it("returns undefined when the renderer has no init", () => {
      const fake = makeFakeRenderer()
      expect(getPendingInit(fake)).toBeUndefined()
    })

    it("returns undefined when hasInitialized() reports true", () => {
      const init = vi.fn(async () => {})
      const fake = makeFakeRenderer({ init, hasInitialized: () => true })
      expect(getPendingInit(fake)).toBeUndefined()
      expect(init).not.toHaveBeenCalled()
    })

    it("returns a function that invokes init() with the renderer as `this`", async () => {
      let capturedThis: unknown
      const init = vi.fn(async function (this: unknown) {
        capturedThis = this
      })
      const fake = makeFakeRenderer({ init })

      const pending = getPendingInit(fake)
      expect(typeof pending).toBe("function")
      await pending!()
      expect(init).toHaveBeenCalledTimes(1)
      expect(capturedThis).toBe(fake)
    })
  })

  /**
   * Construction firewall — see `cameraInput`/`sceneInput`/`raycasterInput`/
   * `glInput` memos in `create-three.tsx`. Each prop is read through a
   * `createMemo({equals: shallowEqual})` so reactive config-objects with
   * fresh references but identical *shape* don't re-allocate three.js
   * objects (which would break held refs).
   */
  describe("construction firewall", () => {
    it("camera memo doesn't recreate when prop reference changes but shape is equal", () => {
      const [tick, setTick] = createSignal(0)
      const state = test(() => <T.Group />, {
        get camera() {
          tick() // track signal
          return { position: [0, 0, 5] as [number, number, number] }
        },
      })

      const initial = state.camera
      setTick(1)
      setTick(2)
      expect(state.camera).toBe(initial)
    })

    it("camera memo does recreate when orthographic flag flips", () => {
      const [ortho, setOrtho] = createSignal(false)
      const state = test(() => <T.Group />, {
        get orthographic() {
          return ortho()
        },
      })

      const initial = state.camera
      expect(initial).toBeInstanceOf(THREE.PerspectiveCamera)
      setOrtho(true)
      expect(state.camera).not.toBe(initial)
      expect(state.camera).toBeInstanceOf(THREE.OrthographicCamera)
    })

    it("scene memo doesn't recreate when prop reference changes but shape is equal", () => {
      const [tick, setTick] = createSignal(0)
      const state = test(() => <T.Group />, {
        get scene() {
          tick()
          return { name: "main" }
        },
      })

      const initial = state.scene
      setTick(1)
      expect(state.scene).toBe(initial)
    })

    it("raycaster memo doesn't recreate when prop reference changes but shape is equal", () => {
      const [tick, setTick] = createSignal(0)
      const state = test(() => <T.Group />, {
        get raycaster() {
          tick()
          return { near: 0.1, far: 1000 }
        },
      })

      const initial = state.raycaster
      setTick(1)
      expect(state.raycaster).toBe(initial)
    })

    it("gl memo doesn't recreate when prop reference changes but shape is equal", () => {
      const [tick, setTick] = createSignal(0)
      const state = test(() => <T.Group />, {
        get gl() {
          tick()
          return { toneMappingExposure: 1 }
        },
      })

      const initial = state.gl
      setTick(1)
      expect(state.gl).toBe(initial)
    })
  })

  it("should respect color management preferences via gl", async () => {
    const texture = new THREE.Texture() as THREE.Texture & { colorSpace?: string }
    function Test() {
      return <T.MeshBasicMaterial map={texture} />
    }

    const [linear, setLinear] = createSignal(false)
    const [flat, setFlat] = createSignal(false)

    const gl = test(() => <Test />, {
      get linear() {
        return linear()
      },
      get flat() {
        return flat()
      },
    }).gl as unknown as THREE.WebGLRenderer & { outputColorSpace: string }

    const SRGBColorSpace = "srgb"
    const LinearSRGBColorSpace = "srgb-linear"

    expect(gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(gl.outputColorSpace).toBe(SRGBColorSpace)
    expect(texture.colorSpace).toBe(SRGBColorSpace)

    setLinear(true)
    setFlat(true)

    expect(gl.toneMapping).toBe(THREE.NoToneMapping)
    expect(gl.outputColorSpace).toBe(LinearSRGBColorSpace)
    expect(texture.colorSpace).toBe(LinearSRGBColorSpace)

    // Pick a valid-but-wrong value as a sentinel; setting an unregistered
    // color space crashes three 0.181's renderer on the next frame.
    gl.outputColorSpace = LinearSRGBColorSpace
    texture.colorSpace = ""

    setLinear(false)
    expect(gl.outputColorSpace).toBe(SRGBColorSpace)
    expect(texture.colorSpace).toBe(SRGBColorSpace)

    setLinear(true)
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

    test(() => (key() ? <Test /> : undefined))

    expect(group()).toBeDefined()
    const prevUUID = group()!.uuid

    setKey(key => key + 1)

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

    expect(material!.map).toBe(texture2)
    expect(texture2.needsUpdate).toBe(true)
    expect(texture2.name).toBe("test")
  })

  // https://github.com/mrdoob/three.js/issues/21209
  it("can handle HMR default where three.js isn't reliable", async () => {
    let ref: THREE.Mesh

    function Test() {
      const [scale, setScale] = createSignal(true)
      createRenderEffect(() => void setScale(false), [])
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

  //   const store = test(() => <Test />, {
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
    let ref!: THREE.Object3D
    let child!: THREE.Object3D
    let attachedChild!: THREE.Object3D

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

    expect(ref.children).toStrictEqual([child1, child])
    expect(ref.userData.attach).toBe(attachedChild)

    // Update
    setObject(object2)
    expect(ref).toBe(object2)
    expect(ref.children).toStrictEqual([child2, child])
    expect(ref.userData.attach).toBe(attachedChild)

    // Revert
    setObject(object1)
    expect(ref).toBe(object1)
    expect(ref.children).toStrictEqual([child1, child])
    expect(ref.userData.attach).toBe(attachedChild)
  })

  it("yields the window render loop while an XR session is presenting, resumes after", async () => {
    const state = test(() => <T.Group />, { frameloop: "always" })
    const gl = state.gl as unknown as THREE.WebGLRenderer
    await state.waitTillNextFrame() // ensure the loop is running normally

    const renderSpy = vi.spyOn(gl, "render")

    // Enter "presenting": the session now owns frames; the window loop must go quiet.
    gl.xr.isPresenting = true
    gl.xr.dispatchEvent({ type: "sessionstart" })
    await nextFrames(3)
    expect(renderSpy).not.toHaveBeenCalled()

    // Exit: window loop resumes.
    gl.xr.isPresenting = false
    gl.xr.dispatchEvent({ type: "sessionend" })
    await state.waitTillNextFrame()
    expect(renderSpy).toHaveBeenCalled()

    renderSpy.mockRestore()
  })

  it("does not touch gl.xr.enabled — the consumer owns it", async () => {
    const state = test(() => <T.Group />, { frameloop: "always" })
    const gl = state.gl as unknown as THREE.WebGLRenderer

    expect(gl.xr.enabled).toBe(false)
    gl.xr.isPresenting = true
    gl.xr.dispatchEvent({ type: "sessionstart" })
    // Core must leave enabled alone; the consumer sets it before setSession.
    expect(gl.xr.enabled).toBe(false)
  })

  it("forwards the XRFrame argument through to useFrame listeners", async () => {
    let received: XRFrame | undefined
    const fakeFrame = {} as XRFrame
    const state = test(() => {
      useFrame((_ctx, _delta, frame) => {
        received = frame
      })
      return <T.Group />
    })

    state.render(performance.now(), fakeFrame)
    expect(received).toBe(fakeFrame)
  })

  it("detaches the sessionend listener when the renderer swaps", async () => {
    const first = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
    const second = new THREE.WebGLRenderer({ canvas: document.createElement("canvas") })
    const removeSpy = vi.spyOn(first.xr, "removeEventListener")

    const [glAccessor, setGl] = createSignal<THREE.WebGLRenderer>(first)
    const state = test(() => <T.Group />, {
      get gl() {
        return glAccessor()
      },
    })
    expect(state.gl).toBe(first)

    setGl(second)
    await state.waitTillNextFrame()

    expect(removeSpy).toHaveBeenCalledWith("sessionend", expect.any(Function))

    first.dispose()
    first.forceContextLoss()
    second.dispose()
    second.forceContextLoss()
    removeSpy.mockRestore()
  })

  it("does not crash for a renderer whose xr manager lacks addEventListener (WebGPU-style stub)", async () => {
    // WebGPURenderer's XRManager has `enabled` but is not an event target in
    // older builds. The sessionend effect must skip it, not call a missing
    // addEventListener.
    const fake = Object.assign(makeFakeRenderer(), { xr: { enabled: false } })
    const state = test(() => <T.Group />, { gl: fake })

    await state.waitTillNextFrame()

    expect(state.gl).toBe(fake)
    expect(fake.render).toHaveBeenCalled()
  })
})
