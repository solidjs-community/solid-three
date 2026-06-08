import{P as e,Y as t}from"./web-Ca0kQsEY.js";import{n}from"./mdx-BDAsXIzm.js";var r=`import { createSignal } from "solid-js"
import { Canvas, createT, Portal } from "solid-three"
import * as THREE from "three"

const T = createT(THREE)

export default function App() {
  const [shifted, setShifted] = createSignal(false)
  return (
    <>
      <button
        onClick={() => setShifted(value => !value)}
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          border: "0",
          "border-radius": "4px",
          cursor: "pointer",
        }}
      >
        move parent group
      </button>

      <Canvas camera={{ position: [0, 0, 3] }}>
        {/* Parent group shifts horizontally when you click the button. */}
        <T.Group position={[shifted() ? 1 : -1, 0, 0]}>
          {/* Normal child — moves with the group. */}
          <T.Mesh>
            <T.BoxGeometry args={[0.6, 0.6, 0.6]} />
            <T.MeshStandardMaterial color="cornflowerblue" />
          </T.Mesh>

          {/* Same JSX nesting, but Portal sends this one to the scene
              root. It doesn't inherit the group's translation. */}
          <Portal>
            <T.Mesh position={[0, 0.8, 0]}>
              <T.BoxGeometry args={[0.6, 0.6, 0.6]} />
              <T.MeshStandardMaterial color="tomato" />
            </T.Mesh>
          </Portal>
        </T.Group>

        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,i=new URL(`07-portal-escape-Dt-TiDI7.js`,import.meta.url).href,a=`import * as THREE from "three"
import { Canvas, createT, Portal, useFrame, useThree } from "solid-three"

const T = createT(THREE)

// Off-screen scene + camera + render target. Each frame we render the
// off-screen scene into the target; the target's texture is then used as
// the \`map\` on a material in the main scene.
const offscreenScene = new THREE.Scene()
const offscreenCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
offscreenCamera.position.z = 2.5
const renderTarget = new THREE.WebGLRenderTarget(512, 512)

function CopyOffscreenToTexture() {
  const context = useThree()
  useFrame(() => {
    const gl = context.gl as THREE.WebGLRenderer
    gl.setRenderTarget(renderTarget)
    gl.render(offscreenScene, offscreenCamera)
    gl.setRenderTarget(null)
  })
  return null
}

function SpinningKnot() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.6
    mesh.rotation.y += delta * 0.9
  })
  return (
    <T.Mesh ref={mesh}>
      <T.TorusKnotGeometry args={[0.6, 0.22, 128, 32]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  )
}

function TexturedCube() {
  let mesh: THREE.Mesh | undefined
  useFrame((_context, delta) => {
    if (!mesh) return
    mesh.rotation.x += delta * 0.4
    mesh.rotation.y += delta * 0.6
  })
  return (
    <T.Mesh ref={mesh}>
      <T.BoxGeometry />
      <T.MeshBasicMaterial map={renderTarget.texture} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }} scene={{ background: new THREE.Color("#101218") }}>
      {/* Portal sends the knot into the off-screen scene instead of the
          canvas's main scene. */}
      <Portal element={offscreenScene}>
        <SpinningKnot />
        <T.AmbientLight intensity={0.3} />
        <T.DirectionalLight position={[2, 2, 2]} intensity={2} />
      </Portal>

      {/* Each frame, render off-screen → target. */}
      <CopyOffscreenToTexture />

      {/* The cube in the main scene wears the target's texture on every
          face — and rotates so all six are visible over time. */}
      <TexturedCube />
    </Canvas>
  )
}
`,o=new URL(`07-portal-render-target-BM7eUbuW.js`,import.meta.url).href,s=[{title:`Portal`,href:`#portal`,children:[{title:`Escaping a parent's transform`,href:`#escaping-a-parents-transform`,children:[]},{title:`Rendering into a separate scene`,href:`#rendering-into-a-separate-scene`,children:[]}]}],c={title:`Portal`};function l(t){let s={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,ul:`ul`,...n(),...t.components},{Demo:c}=s;return c||d(`Demo`,!0),[e(s.h1,{id:`portal`,get children(){return e(s.a,{"data-auto-heading":``,href:`#portal`,children:`Portal`})}}),`
`,e(s.p,{get children(){return[`So far the scene graph has been a faithful mirror of your JSX: nest
`,e(s.code,{children:`<A>`}),` inside `,e(s.code,{children:`<B>`}),` and A becomes a child of B. `,e(s.code,{children:`Portal`}),` is the escape
hatch — it sends a component's children into `,e(s.em,{children:`somewhere else`}),` in the
scene graph, while keeping the JSX parent-child relationship for
reactivity, ownership, and lifecycle.`]}}),`
`,e(s.h2,{id:`escaping-a-parents-transform`,get children(){return e(s.a,{"data-auto-heading":``,href:`#escaping-a-parents-transform`,children:`Escaping a parent's transform`})}}),`
`,e(s.p,{get children(){return[`The simplest use: no `,e(s.code,{children:`element`}),` prop. `,e(s.code,{children:`Portal`}),` defaults to the canvas's
scene root, so the children render `,e(s.em,{children:`as if`}),` they were top-level — they
don't inherit any transform their JSX parent imposes.`]}}),`
`,e(c,{code:r,url:i}),`
`,e(s.p,{get children(){return[`Click the button. The blue cube — a normal child of the group — slides
with it. The red cube doesn't: it's portaled to the scene root, so the
group's translation never touches it. Both cubes are still children of
the group in JSX, sharing lifecycle, signals, refs, all of it — only
one of them `,e(s.em,{children:`lives`}),` there in the scene tree.`]}}),`
`,e(s.h2,{id:`rendering-into-a-separate-scene`,get children(){return e(s.a,{"data-auto-heading":``,href:`#rendering-into-a-separate-scene`,children:`Rendering into a separate scene`})}}),`
`,e(s.p,{get children(){return[e(s.code,{children:`Portal`}),` accepts an `,e(s.code,{children:`element`}),` prop — any `,e(s.code,{children:`Object3D`}),` you want the
children attached to. Pass it a fresh `,e(s.code,{children:`THREE.Scene`}),` and you've made a
detached world: physics-free, lighting-isolated, whatever you want.`]}}),`
`,e(s.p,{get children(){return[`The really interesting thing is what you can do with that detached
world: render it into a `,e(s.code,{children:`WebGLRenderTarget`}),` each frame, then use the
target's texture as a `,e(s.code,{children:`map`}),` on a material back in the main scene.`]}}),`
`,e(c,{code:a,url:o}),`
`,e(s.p,{get children(){return[`A cube whose faces are `,e(s.em,{children:`each frame's render`}),` of a spinning torus knot
in a separate scene. The two pieces that make it work:`]}}),`
`,e(s.ul,{get children(){return[`
`,e(s.li,{get children(){return[e(s.code,{children:`<Portal element={offscreenScene}>`}),` sends the knot into a
free-standing `,e(s.code,{children:`Scene`}),` instead of the canvas's main one.`]}}),`
`,e(s.li,{get children(){return[`A small helper grabs the renderer via
`,e(s.a,{href:`/api/hooks/use-three`,get children(){return e(s.code,{children:`useThree()`})}}),` and copies the off-screen scene
into a `,e(s.code,{children:`WebGLRenderTarget`}),` each frame; that target's texture is what
the outer cube wears as its `,e(s.code,{children:`map`}),`.`]}}),`
`]}}),`
`,e(s.p,{get children(){return[`The knot still spins reactively from inside the portal — same
`,e(s.a,{href:`/api/hooks/use-frame`,get children(){return e(s.code,{children:`useFrame`})}}),`, same ref, same lifecycle. The portaled subtree is still
owned by its JSX parent, so cleanup, refs, and signals behave the same
way as if you'd never reached for a portal.`]}}),`
`,e(s.p,{get children(){return[e(s.a,{href:`/api/components/portal`,get children(){return[e(s.code,{children:`<Portal>`}),` in the API reference`]}}),` has the rest
— the `,e(s.code,{children:`onUpdate`}),` hook, the lifetime rules for `,e(s.code,{children:`element`}),`, and how it
composes with multiple cameras.`]}}),`
`,e(s.p,{children:`The next chapter pulls all of this together into a small game.`})]}function u(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(l,r)}})):l(r)}function d(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var f={frontmatter:c===void 0?{}:c??{},toc:s===void 0?void 0:s,editLink:``,lastUpdated:1780917478e3};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/07-portal.mdx`]=f);var p=f;export{p as $$SolidBase_page_data,u as default,c as frontmatter};