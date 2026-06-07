import{P as e,Y as t}from"./web-Ca0kQsEY.js";import{n}from"./mdx-BDAsXIzm.js";var r=`import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

function SpinningCube() {
  const [angle, setAngle] = createSignal(0)
  useFrame((_context, delta) => setAngle(value => value + delta))
  return (
    <T.Mesh rotation={[angle(), angle(), 0]}>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <SpinningCube />
    </Canvas>
  )
}
`,i=new URL(`05-use-frame-signal-BeyD9q61.js`,import.meta.url).href,a=`import * as THREE from "three"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

function SpinningCube() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta
    mesh.rotation.y += delta
  })
  return (
    <T.Mesh ref={mesh}>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <SpinningCube />
    </Canvas>
  )
}
`,o=new URL(`05-use-frame-imperative-Cy5T6Xn3.js`,import.meta.url).href,s=`import * as THREE from "three"
import { Canvas, createT, useFrame } from "solid-three"

const T = createT(THREE)

// Two useFrame callbacks coordinated via \`priority\`: the cube updates first
// (priority 0), then the camera reads the cube's *new* position to follow it
// (priority 1). Without the explicit ordering, the camera would see the cube
// one frame behind.

function MovingCube(props: { meshRef: (mesh: THREE.Mesh) => void }) {
  let mesh: THREE.Mesh | undefined
  useFrame(
    context => {
      if (!mesh) return
      mesh.position.x = Math.sin(context.clock.elapsedTime) * 1.5
    },
    { priority: 0 },
  )
  return (
    <T.Mesh ref={node => { mesh = node; props.meshRef(node) }}>
      <T.BoxGeometry args={[0.5, 0.5, 0.5]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

function CameraFollow(props: { target: () => THREE.Mesh | undefined }) {
  useFrame(
    context => {
      const target = props.target()
      if (!target) return
      context.camera.position.x = target.position.x
      context.camera.lookAt(target.position)
    },
    { priority: 1 },
  )
  return null
}

export default function App() {
  let cubeMesh: THREE.Mesh | undefined
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <MovingCube meshRef={node => (cubeMesh = node)} />
      <CameraFollow target={() => cubeMesh} />
    </Canvas>
  )
}
`,c=new URL(`05-use-frame-options-ZVeiAMsF.js`,import.meta.url).href,l=[{title:`useFrame`,href:`#useframe`,children:[{title:`Imperative: skip the signal`,href:`#imperative-skip-the-signal`,children:[]},{title:`What else is in context?`,href:`#what-else-is-in-context`,children:[]},{title:`Options: ordering with priority`,href:`#options-ordering-with-priority`,children:[]}]}],u={title:`useFrame`};function d(t){let l={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,p:`p`,...n(),...t.components},{Demo:u}=l;return u||p(`Demo`,!0),[e(l.h1,{id:`useframe`,get children(){return e(l.a,{"data-auto-heading":``,href:`#useframe`,children:`useFrame`})}}),`
`,e(l.p,{get children(){return[e(l.a,{href:`/api/components/canvas`,get children(){return e(l.code,{children:`<Canvas>`})}}),` is already running an animation loop to render each frame.
`,e(l.code,{children:`useFrame`}),` is the hook that lets you plug a callback into that loop — no
extra `,e(l.code,{children:`requestAnimationFrame`}),`, and the callback gets a proper delta time
in seconds.`]}}),`
`,e(u,{code:r,url:i}),`
`,e(l.p,{get children(){return[e(l.code,{children:`useFrame((context, delta) => ...)`}),` runs once per rendered frame. Here we
drive a signal forward by `,e(l.code,{children:`delta`}),` each frame and read it back into
`,e(l.code,{children:`rotation`}),`. The cube spins at one radian per second on each axis,
regardless of monitor refresh rate.`]}}),`
`,e(l.h2,{id:`imperative-skip-the-signal`,get children(){return e(l.a,{"data-auto-heading":``,href:`#imperative-skip-the-signal`,children:`Imperative: skip the signal`})}}),`
`,e(l.p,{get children(){return[`Driving a signal each frame is cheap in Solid — only the expressions that
read it re-run — but you can shave even that off by mutating the `,e(l.code,{children:`three.js`}),`
object directly. Get a ref to the mesh and write to its properties from
inside `,e(l.code,{children:`useFrame`}),`.`]}}),`
`,e(u,{code:a,url:o}),`
`,e(l.p,{get children(){return[`No signal, no reactive prop update, no allocation per frame — just a
property assignment. This is the pattern to reach for in hot paths
(per-particle animations, big `,e(l.code,{children:`InstancedMesh`}),` swarms — three's
single-draw-call primitive for many copies of one mesh), where even a
handful of property assignments per frame might add up.`]}}),`
`,e(l.p,{children:`The reactive version is usually fine. Reach for the imperative one when the
profiler tells you to.`}),`
`,e(l.h2,{id:`what-else-is-in-context`,get children(){return e(l.a,{"data-auto-heading":``,href:`#what-else-is-in-context`,get children(){return[`What else is in `,e(l.code,{children:`context`}),`?`]}})}}),`
`,e(l.p,{get children(){return[`The first argument to your callback is the same scene context exposed by
`,e(l.a,{href:`/api/hooks/use-three`,get children(){return e(l.code,{children:`useThree`})}}),` — `,e(l.code,{children:`gl`}),`, `,e(l.code,{children:`scene`}),`, `,e(l.code,{children:`camera`}),`, `,e(l.code,{children:`clock`}),`,
`,e(l.code,{children:`size`}),`. Useful when your animation depends on more than just elapsed time.`]}}),`
`,e(l.h2,{id:`options-ordering-with-priority`,get children(){return e(l.a,{"data-auto-heading":``,href:`#options-ordering-with-priority`,get children(){return[`Options: ordering with `,e(l.code,{children:`priority`})]}})}}),`
`,e(l.p,{get children(){return[`When two `,e(l.code,{children:`useFrame`}),` callbacks depend on each other, the order they run in
matters. Pass `,e(l.code,{children:`priority`}),` to make the order explicit — lower numbers run
first within the same stage.`]}}),`
`,e(u,{code:s,url:c}),`
`,e(l.p,{get children(){return[`The cube updates its position first (priority 0); the camera then reads
that `,e(l.em,{children:`new`}),` position and follows it (priority 1). Swap the priorities and
the camera will lag the cube by one frame.`]}}),`
`,e(l.p,{get children(){return[e(l.code,{children:`useFrame`}),` also accepts a `,e(l.code,{children:`stage`}),` option for running callbacks before
or after the render pass, plus a couple of other knobs you'll rarely
touch — see `,e(l.a,{href:`/api/hooks/use-frame`,get children(){return[e(l.code,{children:`useFrame`}),` in the API reference`]}}),`.`]}}),`
`,e(l.p,{get children(){return[`The scenes so far have been hand-built — cubes, lights, geometry from
constructors. The next chapter brings in `,e(l.em,{children:`outside`}),` data: textures,
models, anything you load from a URL.`]}})]}function f(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(d,r)}})):d(r)}function p(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var m={frontmatter:u===void 0?{}:u??{},toc:l===void 0?void 0:l,editLink:``,lastUpdated:178079489e4};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/05-use-frame.mdx`]=m);var h=m;export{h as $$SolidBase_page_data,f as default,u as frontmatter};