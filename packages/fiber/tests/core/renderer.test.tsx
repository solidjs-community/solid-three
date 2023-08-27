import * as THREE from 'three'
// import { createCanvas } from '@rewaitTick-three/test-renderer/src/createTestCanvas'
import { asyncUtils } from '../../../shared/asyncUtils'

import {
  createPortal,
  createRoot,
  extend,
  ReconcilerRoot,
  SolidThreeFiber,
  T,
  ThreeProps,
  useFrame,
  useThree,
} from '../../src/index'
// import { UseBoundStore } from 'zustand'
import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { Instance } from '../../src'
import { privateKeys, RootState } from '../../src/core/store'

const resolvers: (() => void)[] = []
const { waitTick } = asyncUtils((resolver: () => void) => {
  resolvers.push(resolver)
})

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

extend({ HasObject3dMember, HasObject3dMethods })

declare global {
  namespace SolidThree {
    interface IntrinsicElements {
      HasObject3dMember: SolidThreeFiber.Node<HasObject3dMember>
      HasObject3dMethods: SolidThreeFiber.Node<HasObject3dMethods>
      MyColor: SolidThreeFiber.Node<MyColor>
    }
  }
}

beforeAll(() => {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 2,
  })
})

describe('renderer', () => {
  let root: ReconcilerRoot<HTMLCanvasElement> = null!

  beforeEach(() => {
    const canvas = createCanvas()
    root = createRoot(canvas)
  })

  afterEach(() => {
    root.unmount()
  })

  it('renders a simple component', async () => {
    const Mesh = () => {
      return (
        <T.Mesh>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      )
    }
    let scene = root.render(() => <Mesh />).scene

    expect(scene.children[0].type).toEqual('Mesh')
    expect((scene.children[0] as ComponentMesh).geometry.type).toEqual('BoxGeometry')
    expect((scene.children[0] as ComponentMesh).material.type).toEqual('MeshBasicMaterial')
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type).toEqual(
      'MeshBasicMaterial',
    )
  })

  it('renders an empty scene', async () => {
    const Empty = () => null
    let scene = root.render(() => <Empty />).scene

    expect(scene.type).toEqual('Scene')
    expect(scene.children).toEqual([])
  })

  it('can render a composite component', async () => {
    const Parent = () => (
      <T.Group>
        <T.Color attach="background" args={[0, 0, 0]} />
        <Child />
      </T.Group>
    )

    const Child = () => {
      return (
        <T.Mesh>
          <T.BoxGeometry args={[2, 2]} />
          <T.MeshBasicMaterial />
        </T.Mesh>
      )
    }

    const scene = await waitTick(async () => root.render(() => <Parent />).scene)

    expect(scene.children[0].type).toEqual('Group')
    expect((scene.children[0] as ObjectWithBackground).background.getStyle()).toEqual('rgb(0,0,0)')
    expect(scene.children[0].children[0].type).toEqual('Mesh')
    expect((scene.children[0].children[0] as ComponentMesh).geometry.type).toEqual('BoxGeometry')
    expect((scene.children[0].children[0] as ComponentMesh).material.type).toEqual('MeshBasicMaterial')
    expect(
      (scene.children[0].children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type,
    ).toEqual('MeshBasicMaterial')
  })

  it('renders some basics with an update', async () => {
    const Component = () => {
      const [pos, setPos] = createSignal(3)
      return (
        <T.Group position-x={pos()}>
          <Child />
          <Null />
        </T.Group>
      )
    }

    const Child = () => {
      return <T.Color attach="background" args={[0, 0, 0]} />
    }

    const Null = () => {
      return null
    }

    const scene = await waitTick(async () => root.render(() => <Component />).scene)

    expect(scene.children[0].position.x).toEqual(7)
    // expect(renders).toBe(6)
  })

  it('updates types & names', async () => {
    let scene = await waitTick(
      async () =>
        root.render(() => (
          <T.Mesh>
            <T.MeshBasicMaterial name="basicMat">
              <T.Color attach="color" args={[0, 0, 0]} />
            </T.MeshBasicMaterial>
          </T.Mesh>
        )).scene,
    )

    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.type).toEqual(
      'MeshBasicMaterial',
    )
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.name).toEqual(
      'basicMat',
    )

    scene = root.render(() => (
      <T.Mesh>
        <T.MeshStandardMaterial name="standardMat">
          <T.Color attach="color" args={[255, 255, 255]} />
        </T.MeshStandardMaterial>
      </T.Mesh>
    )).scene

    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type).toEqual(
      'MeshStandardMaterial',
    )
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.name).toEqual(
      'standardMat',
    )
  })

  it('should forward ref three object', async () => {
    // Note: Passing directly should be less strict, and assigning current should be more strict
    let immutableRef!: THREE.Mesh
    let mutableRef!: THREE.Mesh | null
    let mutableRefSpecific!: THREE.Mesh | null

    const RefTest = () => {
      return (
        <>
          <T.Mesh ref={immutableRef} />
          <T.Mesh ref={mutableRef!} />
          <T.Mesh ref={(r) => (mutableRefSpecific = r)} />
        </>
      )
    }

    await waitTick(() => root.render(() => <RefTest />))

    expect(immutableRef).toBeTruthy()
    expect(mutableRef).toBeTruthy()
    expect(mutableRefSpecific).toBeTruthy()
  })

  it('attaches Object3D children that use attach', async () => {
    let scene = await waitTick(
      () =>
        root.render(() => (
          <T.HasObject3dMember>
            <T.Mesh attach="attachment" />
          </T.HasObject3dMember>
        )).scene,
    )

    const attachedMesh = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedMesh).toBeDefined()
    expect(attachedMesh?.type).toBe('Mesh')
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  it('can attach a Scene', async () => {
    let scene = await waitTick(
      () =>
        root.render(() => (
          <T.HasObject3dMember>
            <T.Scene attach="attachment" />
          </T.HasObject3dMember>
        )).scene,
    )

    const attachedScene = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedScene).toBeDefined()
    expect(attachedScene?.type).toBe('Scene')
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  describe('attaches Object3D children that use attachFns', () => {
    it('attachFns with cleanup', async () => {
      let scene = await waitTick(
        () =>
          root.render(() => (
            <T.HasObject3dMethods>
              <T.Mesh attach={(parent, self) => (parent.customAttach(self), () => parent.detach(self))} />
            </T.HasObject3dMethods>
          )).scene,
      )

      const attachedMesh = (scene.children[0] as HasObject3dMethods).attachedObj3d
      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe('Mesh')
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      // and now detach ..
      expect((scene.children[0] as HasObject3dMethods).detachedObj3d).toBeUndefined()

      await waitTick(() => root.render(() => <T.HasObject3dMethods />))

      const detachedMesh = (scene.children[0] as HasObject3dMethods).detachedObj3d
      expect(detachedMesh).toBe(attachedMesh)
    })

    it('attachFns as functions', async () => {
      let scene: THREE.Scene = null!
      let attachedMesh: Instance = null!
      let detachedMesh: Instance = null!

      scene = await waitTick(
        () =>
          root.render(() => (
            <T.HasObject3dMethods>
              <T.Mesh attach={(parent) => ((attachedMesh = parent), () => (detachedMesh = parent))} />
            </T.HasObject3dMethods>
          )).scene,
      )

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe('Object3D')
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      await waitTick(() => root.render(() => <T.HasObject3dMethods />))

      expect(detachedMesh).toBe(attachedMesh)
    })
  })

  it('does the full lifecycle', async () => {
    const log: string[] = []

    const Log = (props: { name: string }) => {
      log.push('initial ' + props.name)
      onMount(() => log.push('mount ' + props.name))
      onCleanup(() => log.push('unmount ' + props.name))

      return <T.Group />
    }

    await waitTick(() => root.render(() => <Log name="Foo" />))

    root.unmount()

    expect(log).toEqual(['initial Foo', 'mount Foo', 'unmount Foo'])
  })

  it('will mount/unmount event handlers correctly', async () => {
    let state: RootState = null!
    let mounted = false
    let attachEvents = false

    const EventfulComponent = () => (mounted ? <T.Group onClick={attachEvents ? () => void 0 : undefined} /> : null)

    // Test initial mount without events
    mounted = true
    state = await waitTick(() => root.render(() => <EventfulComponent />))

    expect(state.internal.interaction.length).toBe(0)

    // Test initial mount with events
    attachEvents = true
    state = await waitTick(() => root.render(() => <EventfulComponent />))
    expect(state.internal.interaction.length).not.toBe(0)

    // Test events update
    attachEvents = false
    state = await waitTick(() => root.render(() => <EventfulComponent />))

    expect(state.internal.interaction.length).toBe(0)

    attachEvents = true

    state = await waitTick(() => root.render(() => <EventfulComponent />))

    expect(state.internal.interaction.length).not.toBe(0)

    // Test unmount with events
    mounted = false

    state = await waitTick(() => root.render(() => <EventfulComponent />))

    expect(state.internal.interaction.length).toBe(0)
  })

  it('will create an identical instance when reconstructing', async () => {
    let state: RootState = null!
    const instances: { uuid: string; parentUUID?: string; childUUID?: string }[] = []

    const object1 = new THREE.Group()
    const object2 = new THREE.Group()

    const Test = ({ first }: { first?: boolean }) => (
      <T.Primitive object={first ? object1 : object2} onPointerOver={() => null}>
        <T.Group />
      </T.Primitive>
    )

    state = await waitTick(() => root.render(() => <Test first />))

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })
    expect(state.scene.children[0]).toBe(object1)

    state = await waitTick(() => root.render(() => <Test />))

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
    expect(state.internal.interaction.length).not.toBe(0)
  })

  it('can swap primitives', async () => {
    let state: RootState = null!

    const o1 = new THREE.Group()
    o1.add(new THREE.Group())
    const o2 = new THREE.Group()

    const Test = ({ n }: { n: number }) => (
      <T.Primitive object={n === 1 ? o1 : o2}>
        <T.Group attach="test" />
      </T.Primitive>
    )

    state = await waitTick(() => root.render(() => <Test n={1} />))

    // Initial object is added with children and attachments
    expect(state.scene.children[0]).toBe(o1)
    expect(state.scene.children[0].children.length).toBe(1)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)

    state = await waitTick(() => root.render(() => <Test n={2} />))

    // Swapped to object 2, does not copy old children, copies attachments
    expect(state.scene.children[0]).toBe(o2)
    expect(state.scene.children[0].children.length).toBe(0)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)
  })

  it('can swap 4 array primitives', async () => {
    let state: RootState = null!
    const a = new THREE.Group()
    const b = new THREE.Group()
    const c = new THREE.Group()
    const d = new THREE.Group()
    const array = [a, b, c, d]

    const Test = ({ array }: { array: THREE.Group[] }) => (
      <>
        {array.map((group, i) => (
          <T.Primitive object={group} />
        ))}
      </>
    )

    state = await waitTick(() => root.render(() => <Test array={array} />))

    expect(state.scene.children[0]).toBe(a)
    expect(state.scene.children[1]).toBe(b)
    expect(state.scene.children[2]).toBe(c)
    expect(state.scene.children[3]).toBe(d)

    const reversedArray = [...array.reverse()]

    state = await waitTick(() => root.render(() => <Test array={reversedArray} />))

    expect(state.scene.children[0]).toBe(d)
    expect(state.scene.children[1]).toBe(c)
    expect(state.scene.children[2]).toBe(b)
    expect(state.scene.children[3]).toBe(a)

    const mixedArray = [b, a, d, c]

    state = await waitTick(() => root.render(() => <Test array={mixedArray} />))

    expect(state.scene.children[0]).toBe(b)
    expect(state.scene.children[1]).toBe(a)
    expect(state.scene.children[2]).toBe(d)
    expect(state.scene.children[3]).toBe(c)
  })

  it('will make an Orthographic Camera & set the position', async () => {
    let camera: THREE.Camera = null!

    camera = root.configure({ orthographic: true, camera: { position: [0, 0, 5] } }).render(() => <T.Group />).camera

    expect(camera.type).toEqual('OrthographicCamera')
    expect(camera.position.z).toEqual(5)
  })

  it('should handle an performance changing functions', async () => {
    let state: RootState = null!

    state = root.configure({ dpr: [1, 2], performance: { min: 0.2 } }).render(() => <T.Group />)

    expect(state.viewport.initialDpr).toEqual(2)
    expect(state.performance.min).toEqual(0.2)
    expect(state.performance).toEqual(1)

    state.setDpr(0.1)

    expect(state.viewport.dpr).toEqual(0.1)

    jest.useFakeTimers()

    state.performance.regress()
    jest.advanceTimersByTime(100)

    expect(state.performance).toEqual(0.2)

    jest.advanceTimersByTime(200)

    expect(state.performance).toEqual(1)

    jest.useRealTimers()
  })

  it('should set PCFSoftShadowMap as the default shadow map', async () => {
    let state = root.configure({ shadows: true }).render(() => <T.Group />)

    expect(state.gl.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
  })

  it('should set tonemapping to ACESFilmicToneMapping and outputEncoding to sRGBEncoding if linear is false', async () => {
    let state = root.configure({ linear: false }).render(() => <T.Group />)

    expect(state.gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(state.gl.outputEncoding).toBe(THREE.sRGBEncoding)
  })

  it('should toggle render mode in xr', async () => {
    let state = await waitTick(() => root.render(() => <T.Group />))
    state.gl.xr.isPresenting = true
    state.gl.xr.dispatchEvent({ type: 'sessionstart' })

    expect(state.gl.xr.enabled).toEqual(true)

    state.gl.xr.isPresenting = false
    state.gl.xr.dispatchEvent({ type: 'sessionend' })

    expect(state.gl.xr.enabled).toEqual(false)
  })

  it('should respect frameloop="never" in xr', async () => {
    let respected = true

    const TestGroup = () => {
      useFrame(() => (respected = false))
      return <T.Group />
    }
    const state = root.configure({ frameloop: 'never' }).render(() => <TestGroup />)

    state.gl.xr.isPresenting = true
    state.gl.xr.dispatchEvent({ type: 'sessionstart' })

    expect(respected).toEqual(true)
  })

  it('will render components that are extended', async () => {
    const testExtend = async () => {
      extend({ MyColor })
      await waitTick(() => root.render(() => <T.MyColor args={[0x0000ff]} />))
    }

    expect(() => testExtend()).not.toThrow()
  })

  it('should set renderer props via gl prop', async () => {
    let gl = root.configure({ gl: { physicallyCorrectLights: true } }).render(() => <T.Group />).gl

    expect(gl.physicallyCorrectLights).toBe(true)
  })

  it('should update scene via scene prop', async () => {
    let scene = root.configure({ scene: { name: 'test' } }).render(() => <T.Group />).scene

    expect(scene.name).toBe('test')
  })

  it('should set a custom scene via scene prop', async () => {
    let scene: THREE.Scene = null!

    const prop = new THREE.Scene()

    scene = root.configure({ scene: prop }).render(() => <T.Group />).scene

    expect(prop).toBe(scene)
  })

  it('should set a renderer via gl callback', async () => {
    class Renderer extends THREE.WebGLRenderer {}

    let gl = root.configure({ gl: (canvas) => new Renderer({ canvas }) }).render(() => <T.Group />).gl

    expect(gl instanceof Renderer).toBe(true)
  })

  it('should respect color management preferences via gl', async () => {
    const texture = new THREE.Texture() as THREE.Texture & { colorSpace?: string }

    function Test() {
      return <T.MeshBasicMaterial map={texture} />
    }

    const LinearEncoding = 3000
    const sRGBEncoding = 3001

    let gl = root.render(() => <Test />).gl
    expect(gl.outputEncoding).toBe(sRGBEncoding)
    expect(gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(texture.encoding).toBe(sRGBEncoding)

    root.configure({ linear: true, flat: true }).render(() => <Test />)
    expect(gl.outputEncoding).toBe(LinearEncoding)
    expect(gl.toneMapping).toBe(THREE.NoToneMapping)
    expect(texture.encoding).toBe(LinearEncoding)

    // Sets outputColorSpace since r152
    const SRGBColorSpace = 'srgb'
    const LinearSRGBColorSpace = 'srgb-linear'

    gl.outputColorSpace ??= ''
    texture.colorSpace ??= ''

    root.configure({ linear: true }).render(() => <Test />)
    expect(gl.outputColorSpace).toBe(LinearSRGBColorSpace)
    expect(texture.colorSpace).toBe(LinearSRGBColorSpace)

    root.configure({ linear: false }).render(() => <Test />)
    expect(gl.outputColorSpace).toBe(SRGBColorSpace)
    expect(texture.colorSpace).toBe(SRGBColorSpace)
  })

  it('should respect legacy prop', async () => {
    // <= r138 internal fallback
    let material: THREE.MeshBasicMaterial
    extend({ ColorManagement: null })
    await waitTick(() => root.render(() => <T.MeshBasicMaterial ref={material} color="#111111" />))
    expect((THREE as any).ColorManagement.legacyMode).toBe(false)
    expect(material!.color.toArray()).toStrictEqual(new THREE.Color('#111111').convertSRGBToLinear().toArray())
    extend({ ColorManagement: (THREE as any).ColorManagement })

    // r139 legacyMode

    root.configure({ legacy: true }).render(() => <T.Group />)

    expect((THREE as any).ColorManagement.legacyMode).toBe(true)

    root.configure({ legacy: false }).render(() => <T.Group />)

    expect((THREE as any).ColorManagement.legacyMode).toBe(false)

    // r150 !enabled
    ;(THREE as any).ColorManagement.enabled = true

    root.configure({ legacy: true }).render(() => <T.Group />)

    expect((THREE as any).ColorManagement.enabled).toBe(false)

    root.configure({ legacy: false }).render(() => <T.Group />)

    expect((THREE as any).ColorManagement.enabled).toBe(true)
  })

  it('can handle createPortal', async () => {
    const scene = new THREE.Scene()

    let state: RootState = null!
    let portalState: RootState = null!

    const Normal = () => {
      const three = useThree()
      state = three

      return <T.Group />
    }

    const Portal = () => {
      const three = useThree()
      portalState = three

      return <T.Group />
    }

    await waitTick(() =>
      root.render(() => (
        <>
          <Normal />
          {createPortal(<Portal />, scene, { scene })}
        </>
      )),
    )

    // Renders into portal target
    expect(scene.children.length).not.toBe(0)

    // Creates an isolated state enclave
    expect(state.scene).not.toBe(scene)
    expect(portalState.scene).toBe(scene)

    // Preserves internal keys
    const overwrittenKeys = ['get', 'set', 'events', 'size', 'viewport']
    const respectedKeys = privateKeys.filter((key) => overwrittenKeys.includes(key) || state[key] === portalState[key])
    expect(respectedKeys).toStrictEqual(privateKeys)
  })

  it('can handle createPortal on unmounted container', async () => {
    let groupHandle!: THREE.Group | null
    function Test(props: any) {
      const [group, setGroup] = createSignal<THREE.Group>()

      createEffect(() => {
        groupHandle = group()!
      })

      return (
        <T.Group {...props} ref={setGroup}>
          {group && createPortal(<T.Mesh />, group()!)}
        </T.Group>
      )
    }

    await waitTick(() => root.render(() => <Test key={0} />))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(groupHandle).toBeDefined()
    const prevUUID = groupHandle!.uuid

    await waitTick(() => root.render(() => <Test key={1} />))

    expect(groupHandle).toBeDefined()
    expect(prevUUID).not.toBe(groupHandle!.uuid)
  })

  it('invalidates pierced props when root is changed', async () => {
    let material: THREE.MeshBasicMaterial
    const texture1 = { needsUpdate: false, name: '' } as THREE.Texture
    const texture2 = { needsUpdate: false, name: '' } as THREE.Texture

    await waitTick(() =>
      root.render(() => <T.MeshBasicMaterial ref={material} map={texture1} map-needsUpdate={true} map-name="test" />),
    )

    expect(material!.map).toBe(texture1)
    expect(texture1.needsUpdate).toBe(true)
    expect(texture1.name).toBe('test')

    await waitTick(() =>
      root.render(() => <T.MeshBasicMaterial ref={material} map={texture2} map-needsUpdate={true} map-name="test" />),
    )
    expect(material!.map).toBe(texture2)
    expect(texture2.needsUpdate).toBe(true)
    expect(texture2.name).toBe('test')
  })

  // https://github.com/mrdoob/three.js/issues/21209
  it("can handle HMR default where three.js isn't reliable", async () => {
    let ref: THREE.Mesh

    function Test() {
      const [scale, setScale] = createSignal(true)
      const props: any = {}
      if (scale()) props.scale = 0.5
      createEffect(() => void setScale(false))
      return <T.Mesh ref={ref} {...props} />
    }

    await waitTick(() => root.render(() => <Test />))

    expect(ref!.scale.toArray()).toStrictEqual(new THREE.Object3D().scale.toArray())
  })

  it("onUpdate shouldn't update itself", async () => {
    const one = jest.fn()
    const two = jest.fn()

    const Test = (props: Partial<ThreeProps<'Mesh'>>) => <T.Mesh {...props} />
    await waitTick(() => root.render(() => <Test onUpdate={one} />))
    await waitTick(() => root.render(() => <Test onUpdate={two} />))

    expect(one).toBeCalledTimes(1)
    expect(two).toBeCalledTimes(0)
  })

  it("camera props shouldn't overwrite state", async () => {
    const camera = new THREE.OrthographicCamera()

    function Test() {
      const set = useThree((state) => state.set)
      createMemo(() => set()({ camera }))
      return null
    }

    const store = root.render(() => <Test />)
    expect(store.camera).toBe(camera)

    root.configure({ camera: { name: 'test' } })

    await waitTick(() => root.render(() => <Test />))

    expect(store.camera).toBe(camera)
    expect(camera.name).not.toBe('test')
  })

  it('should safely handle updates to the object prop', async () => {
    let ref: THREE.Object3D
    let child: THREE.Object3D
    let attachedChild: THREE.Object3D

    const Test = (props: ThreeProps<'Primitive'>) => (
      <T.Primitive {...props} ref={ref}>
        <T.Object3D ref={child} />
        <T.Object3D ref={attachedChild} attach="userData-attach" />
      </T.Primitive>
    )

    const object1 = new THREE.Object3D()
    const child1 = new THREE.Object3D()
    object1.add(child1)

    const object2 = new THREE.Object3D()
    const child2 = new THREE.Object3D()
    object2.add(child2)

    // Initial
    await waitTick(async () => root.render(() => <Test object={object1} />))

    expect(ref!).toBe(object1)
    expect(ref!.children).toStrictEqual([child1, child])
    expect(ref!.userData.attach).toBe(attachedChild)

    // Update
    await waitTick(async () => root.render(() => <Test object={object2} />))
    expect(ref!).toBe(object2)
    expect(ref!.children).toStrictEqual([child2, child])
    expect(ref!.userData.attach).toBe(attachedChild)

    // Revert
    await waitTick(async () => root.render(() => <Test object={object1} />))
    expect(ref!).toBe(object1)
    expect(ref!.children).toStrictEqual([child1, child])
    expect(ref!.userData.attach).toBe(attachedChild)
  })
})
