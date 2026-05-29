import{P as e,Y as t}from"./web-CuRbvrvW.js";import{n}from"./mdx-DOtePSgk.js";var r=`import * as THREE from "three"
import { createSignal } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

// Counts how many times the App body itself runs. In React this would tick
// up with every click. In Solid it runs once: only the reactive expression
// reading \`hot()\` re-evaluates.
let setupRuns = 0

export default () => {
  setupRuns++
  const [hot, setHot] = createSignal(false)

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          padding: "0.5rem 0.75rem",
          background: "rgba(20,23,31,0.9)",
          color: "#e8e8e8",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.8rem",
          "border-radius": "6px",
        }}
      >
        <div>App body has run: {setupRuns} time{setupRuns === 1 ? "" : "s"}</div>
        <button
          onClick={() => setHot(value => !value)}
          style={{
            "margin-top": "0.5rem",
            padding: "0.3rem 0.75rem",
            background: "tomato",
            color: "#fff",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
            "font-size": "0.8rem",
          }}
        >
          Toggle colour
        </button>
      </div>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshStandardMaterial color={hot() ? "tomato" : "cornflowerblue"} />
        </T.Mesh>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,i=new URL(`02-button-toggle-CSUK6QSq.js`,import.meta.url).href,a=`import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 5] }}>
    <T.Mesh position={[-1.5, 0, 0]}>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
    <T.Mesh position={[1.5, 0, 0]} rotation={[0, 0.6, 0]} scale={0.6}>
      <T.BoxGeometry />
      <T.MeshNormalMaterial />
    </T.Mesh>
  </Canvas>
)
`,o=new URL(`02-transforms-y93AYnVe.js`,import.meta.url).href,s=`import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 5] }}>
    <T.Group rotation={[0, 0.6, 0]}>
      <T.Mesh position={[-1.2, 0, 0]}>
        <T.BoxGeometry />
        <T.MeshNormalMaterial />
      </T.Mesh>
      <T.Mesh position={[1.2, 0, 0]}>
        <T.BoxGeometry />
        <T.MeshNormalMaterial />
      </T.Mesh>
    </T.Group>
  </Canvas>
)
`,c=new URL(`02-group-CBA03bhS.js`,import.meta.url).href,l=`import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 4] }}>
    <T.Mesh
      position={[-1.5, 0, 0]}
      scale={1.2}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial color="cornflowerblue" />
    </T.Mesh>
    <T.Mesh
      position={[1.5, 0, 0]}
      scale={0.8}
    >
      <T.BoxGeometry />
      <T.MeshStandardMaterial color={[1, 0.4, 0.2]} />
    </T.Mesh>
    <T.AmbientLight intensity={0.3} />
    <T.DirectionalLight position={[2, 2, 2]} />
  </Canvas>
)
`,u=new URL(`02-shorthands-7bBdWUiV.js`,import.meta.url).href,d=`import * as THREE from "three"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => (
  <Canvas camera={{ position: [0, 0, 4] }}>
    <T.Mesh>
      <T.BoxGeometry args={[2, 1, 1]} />
      <T.MeshNormalMaterial />
    </T.Mesh>
  </Canvas>
)
`,f=new URL(`02-args-hSMlVOZq.js`,import.meta.url).href,p=[{title:`Props and children`,href:`#props-and-children`,children:[{title:`Transforms`,href:`#transforms`,children:[]},{title:`Composing transforms`,href:`#composing-transforms`,children:[]},{title:`Constructor arguments: args`,href:`#constructor-arguments-args`,children:[]},{title:`Why arrays work on a Vector3`,href:`#why-arrays-work-on-a-vector3`,children:[]}]}],m={title:`Props and children`};function h(t){let p={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,ul:`ul`,...n(),...t.components},{Demo:m}=p;return m||_(`Demo`,!0),[e(p.h1,{id:`props-and-children`,get children(){return e(p.a,{"data-auto-heading":``,href:`#props-and-children`,children:`Props and children`})}}),`
`,e(p.p,{get children(){return[`A scene in `,e(p.code,{children:`solid-three`}),` is a reactive view over a `,e(p.code,{children:`three.js`}),` graph.
Anything that drives a Solid component also drives the scene — and the
easiest way to see that is to hand a prop a signal.`]}}),`
`,e(m,{code:r,url:i}),`
`,e(p.p,{get children(){return[`Click the button repeatedly. The counter at the top says "App body has
run: 1 time" — and it stays at 1, no matter how often you click. The
component's body runs once. Only the small reactive expression that
reads `,e(p.code,{children:`hot()`}),` re-runs, and all it does is hand a new value to
`,e(p.code,{children:`material.color.set(...)`}),`. The mesh stays mounted, the canvas keeps the
same renderer, nothing else moves.`]}}),`
`,e(p.p,{get children(){return[`That's the through-line. The rest of this chapter is just `,e(p.em,{children:`what props
you can pass`}),`.`]}}),`
`,e(p.h2,{id:`transforms`,get children(){return e(p.a,{"data-auto-heading":``,href:`#transforms`,children:`Transforms`})}}),`
`,e(p.p,{get children(){return[`A `,e(p.code,{children:`three.js`}),` scene is a tree. Every object has a parent and a (possibly
empty) list of children — in `,e(p.code,{children:`solid-three`}),`, that tree `,e(p.em,{children:`is`}),` your JSX.
Nest one element inside another and you've made a parent-child
relationship in the scene.`]}}),`
`,e(p.p,{children:`Every object accepts three transform props:`}),`
`,e(p.ul,{get children(){return[`
`,e(p.li,{get children(){return e(p.code,{children:`position={[x, y, z]}`})}}),`
`,e(p.li,{get children(){return[e(p.code,{children:`rotation={[x, y, z]}`}),` (radians)`]}}),`
`,e(p.li,{get children(){return[e(p.code,{children:`scale={[x, y, z]}`}),` (or a single number — `,e(p.code,{children:`scale={2}`}),` doubles every axis)`]}}),`
`]}}),`
`,e(m,{code:a,url:o}),`
`,e(p.h2,{id:`composing-transforms`,get children(){return e(p.a,{"data-auto-heading":``,href:`#composing-transforms`,children:`Composing transforms`})}}),`
`,e(p.p,{children:`When you nest, transforms compose. A child sits in its parent's frame:
the parent's position, rotation, and scale all apply first, then the
child's on top.`}),`
`,e(p.p,{get children(){return[e(p.code,{children:`T.Group`}),` is the empty container you reach for when you want to move
several things together without a visible mesh of their own.`]}}),`
`,e(m,{code:s,url:c}),`
`,e(p.p,{get children(){return[`Same two cubes, but now they sit inside a `,e(p.code,{children:`<T.Group>`}),` that's rotated.
The rotation applies to the group's frame, so both cubes tilt together
— including their positions, which now swing slightly toward and away
from the camera.`]}}),`
`,e(p.p,{get children(){return[`Rotate the group instead of the cubes any time you want the
`,e(p.em,{children:`arrangement`}),` to move, not just the individual shapes. Almost every
scene you'll build is some tree of groups holding meshes.`]}}),`
`,e(p.h2,{id:`constructor-arguments-args`,get children(){return e(p.a,{"data-auto-heading":``,href:`#constructor-arguments-args`,get children(){return[`Constructor arguments: `,e(p.code,{children:`args`})]}})}}),`
`,e(p.p,{get children(){return[`Not everything has a setter. `,e(p.code,{children:`BoxGeometry`}),`'s width, height, and depth
are constructor parameters — you set them when the geometry is born.
For cases like this, pass an `,e(p.code,{children:`args`}),` array:`]}}),`
`,e(m,{code:d,url:f}),`
`,e(p.p,{get children(){return[e(p.code,{children:`args`}),` is spread into the constructor: `,e(p.code,{children:`new BoxGeometry(...args)`}),`.
Change `,e(p.code,{children:`args`}),` and the geometry is rebuilt — which is what you want,
since geometries and materials don't have setters for these
fundamentals.`]}}),`
`,e(p.h2,{id:`why-arrays-work-on-a-vector3`,get children(){return e(p.a,{"data-auto-heading":``,href:`#why-arrays-work-on-a-vector3`,get children(){return[`Why arrays work on a `,e(p.code,{children:`Vector3`})]}})}}),`
`,e(p.p,{get children(){return[`You've been writing `,e(p.code,{children:`position={[0, 0, 3]}`}),` — but `,e(p.code,{children:`Mesh.position`}),` isn't
an array, it's a `,e(p.code,{children:`Vector3`}),`. `,e(p.code,{children:`solid-three`}),` is forgiving about the shape
of what you hand it: arrays unpack into `,e(p.code,{children:`.set(...)`}),`, single numbers
broadcast via `,e(p.code,{children:`.setScalar(...)`}),`, strings and hex go through `,e(p.code,{children:`.set(...)`}),`
on a `,e(p.code,{children:`Color`}),`, and so on.`]}}),`
`,e(m,{code:l,url:u}),`
`,e(p.p,{get children(){return[`The principle: pass whatever's most ergonomic for the shape of data
you have. `,e(p.code,{children:`solid-three`}),` checks which setter the target supports —
`,e(p.code,{children:`.set(...)`}),`, `,e(p.code,{children:`.setScalar(...)`}),`, or `,e(p.code,{children:`.copy(...)`}),` — and uses the first
one that fits. The full conversion table — plus how `,e(p.code,{children:`attach`}),`, dashed
paths like `,e(p.code,{children:`shadow-mapSize-width={1024}`}),`, and refs work — lives on
`,e(p.a,{href:`/api/hooks/use-props`,get children(){return e(p.code,{children:`useProps`})}}),`.`]}}),`
`,e(p.p,{get children(){return[`Next: every Solid control-flow primitive you already know — `,e(p.code,{children:`<Show>`}),`,
`,e(p.code,{children:`<For>`}),`, `,e(p.code,{children:`<Switch>`}),`, `,e(p.code,{children:`<Index>`}),`, `,e(p.code,{children:`<Suspense>`}),` — works inside the scene
the same way it works inside a `,e(p.code,{children:`<div>`}),`.`]}})]}function g(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(h,r)}})):h(r)}function _(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var v={frontmatter:m===void 0?{}:m??{},toc:p===void 0?void 0:p,editLink:``,lastUpdated:1780083166e3};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/02-props-and-children.mdx`]=v);var y=v;export{y as $$SolidBase_page_data,g as default,m as frontmatter};