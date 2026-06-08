import{P as e,Y as t}from"./web-Ca0kQsEY.js";import{n}from"./mdx-BDAsXIzm.js";var r=`import * as THREE from "three"
import { createSignal, Show } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

export default () => {
  const [visible, setVisible] = createSignal(true)

  return (
    <>
      <button
        onClick={() => setVisible(value => !value)}
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
        {visible() ? "remove cube" : "add cube"}
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Show when={visible()}>
          <T.Mesh>
            <T.BoxGeometry />
            <T.MeshNormalMaterial />
          </T.Mesh>
        </Show>
      </Canvas>
    </>
  )
}
`,i=new URL(`03-show-ZG0VTtVu.js`,import.meta.url).href,a=`import * as THREE from "three"
import { createSignal, Match, Switch } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

type State = "idle" | "loading" | "ready"
const next: Record<State, State> = { idle: "loading", loading: "ready", ready: "idle" }

export default () => {
  const [state, setState] = createSignal<State>("idle")
  return (
    <>
      <button
        onClick={() => setState(value => next[value])}
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
        state: {state()} → cycle
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Switch>
          <Match when={state() === "idle"}>
            <T.Mesh>
              <T.BoxGeometry />
              <T.MeshStandardMaterial color="#666" />
            </T.Mesh>
          </Match>
          <Match when={state() === "loading"}>
            <T.Mesh>
              <T.TorusGeometry args={[0.6, 0.18, 16, 64]} />
              <T.MeshStandardMaterial color="cornflowerblue" />
            </T.Mesh>
          </Match>
          <Match when={state() === "ready"}>
            <T.Mesh>
              <T.SphereGeometry args={[0.7, 32, 16]} />
              <T.MeshStandardMaterial color="mediumseagreen" />
            </T.Mesh>
          </Match>
        </Switch>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,o=new URL(`03-switch-B5kBzKIw.js`,import.meta.url).href,s=`import * as THREE from "three"
import { createSignal, For } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const colors = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

export default () => {
  const [cubes, setCubes] = createSignal<string[]>(["cornflowerblue"])

  function addCube() {
    setCubes(list => [...list, colors[list.length % colors.length]])
  }
  function removeCube() {
    setCubes(list => list.slice(0, -1))
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          "z-index": 1,
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button
          onClick={addCube}
          style={{
            padding: "0.5rem 0.75rem",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          add
        </button>
        <button
          onClick={removeCube}
          style={{
            padding: "0.5rem 0.75rem",
            border: "0",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          remove
        </button>
      </div>
      <Canvas camera={{ position: [0, 0, 6] }}>
        <For each={cubes()}>
          {(color, index) => (
            <T.Mesh position={[(index() - (cubes().length - 1) / 2) * 1.2, 0, 0]} scale={0.7}>
              <T.BoxGeometry />
              <T.MeshStandardMaterial color={color} />
            </T.Mesh>
          )}
        </For>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,c=new URL(`03-for-DMJ0YDpQ.js`,import.meta.url).href,l=`import * as THREE from "three"
import { createSignal, Index } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const palette = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

export default () => {
  const [colors, setColors] = createSignal(["cornflowerblue", "tomato", "mediumseagreen"])

  function shuffle() {
    setColors(current => current.map(() => palette[Math.floor(Math.random() * palette.length)]))
  }

  return (
    <>
      <button
        onClick={shuffle}
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
        shuffle colours
      </button>
      <Canvas camera={{ position: [0, 0, 4] }}>
        <Index each={colors()}>
          {(color, index) => (
            <T.Mesh position={[(index - 1) * 1.2, 0, 0]} scale={0.7}>
              <T.BoxGeometry />
              <T.MeshStandardMaterial color={color()} />
            </T.Mesh>
          )}
        </Index>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,u=new URL(`03-index-CaFy0MlY.js`,import.meta.url).href,d=`import * as THREE from "three"
import { createResource, createSignal, Suspense } from "solid-js"
import { Canvas, createT } from "solid-three"

const T = createT(THREE)

const palette = ["cornflowerblue", "tomato", "mediumseagreen", "gold", "hotpink"]

function pickRandomColor(): Promise<string> {
  return new Promise(resolve =>
    setTimeout(() => resolve(palette[Math.floor(Math.random() * palette.length)]), 800),
  )
}

export default () => {
  const [nonce, setNonce] = createSignal(0)
  // The resource refetches whenever \`nonce\` changes — that's what suspends.
  const [color] = createResource(nonce, pickRandomColor)

  function Cube() {
    return (
      <T.Mesh>
        <T.BoxGeometry />
        <T.MeshStandardMaterial color={color()} />
      </T.Mesh>
    )
  }

  function Spinner() {
    return (
      <T.Mesh>
        <T.TorusGeometry args={[0.6, 0.06, 16, 48]} />
        <T.MeshBasicMaterial color="#888" />
      </T.Mesh>
    )
  }

  return (
    <>
      <button
        onClick={() => setNonce(value => value + 1)}
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
        new colour
      </button>
      <Canvas camera={{ position: [0, 0, 3] }}>
        <Suspense fallback={<Spinner />}>
          <Cube />
        </Suspense>
        <T.AmbientLight intensity={0.4} />
        <T.DirectionalLight position={[2, 2, 2]} />
      </Canvas>
    </>
  )
}
`,f=new URL(`03-suspense-CkzwLaR6.js`,import.meta.url).href,p=[{title:`Control flow`,href:`#control-flow`,children:[{title:`<Show>`,href:`#show`,children:[]},{title:`<Switch> / <Match>`,href:`#switch--match`,children:[]},{title:`<For>`,href:`#for`,children:[]},{title:`<Index>`,href:`#index`,children:[]},{title:`<Suspense>`,href:`#suspense`,children:[]},{title:`What about clicking the cube itself?`,href:`#what-about-clicking-the-cube-itself`,children:[]}]}],m={title:`Control flow`};function h(t){let p={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,p:`p`,...n(),...t.components},{Demo:m}=p;return m||_(`Demo`,!0),[e(p.h1,{id:`control-flow`,get children(){return e(p.a,{"data-auto-heading":``,href:`#control-flow`,children:`Control flow`})}}),`
`,e(p.p,{get children(){return[`Solid's control-flow components — the ones you reach for in any
component tree — all work inside `,e(p.a,{href:`/api/components/canvas`,get children(){return e(p.code,{children:`<Canvas>`})}}),` exactly the way they work
inside a `,e(p.code,{children:`<div>`}),`. You don't learn a new vocabulary; you keep using
`,e(p.code,{children:`<Show>`}),`, `,e(p.code,{children:`<Switch>`}),`, `,e(p.code,{children:`<For>`}),`, `,e(p.code,{children:`<Index>`}),`, `,e(p.code,{children:`<Suspense>`}),`.`]}}),`
`,e(p.h2,{id:`show`,get children(){return e(p.a,{"data-auto-heading":``,href:`#show`,get children(){return e(p.code,{children:`<Show>`})}})}}),`
`,e(p.p,{children:`The conditional. Mount and unmount children based on a signal.`}),`
`,e(m,{code:r,url:i}),`
`,e(p.p,{get children(){return[`When the signal flips, `,e(p.code,{children:`<Show>`}),` `,e(p.em,{children:`mounts`}),` and `,e(p.em,{children:`unmounts`}),` its children —
not just hides them. The cube's `,e(p.code,{children:`BoxGeometry`}),` and `,e(p.code,{children:`MeshNormalMaterial`}),`
are constructed when it appears and disposed when it disappears (more
on disposal later).`]}}),`
`,e(p.h2,{id:`switch--match`,get children(){return e(p.a,{"data-auto-heading":``,href:`#switch--match`,get children(){return[e(p.code,{children:`<Switch>`}),` / `,e(p.code,{children:`<Match>`})]}})}}),`
`,e(p.p,{get children(){return[`The branching cousin. For more than two possible states, pick the first
matching `,e(p.code,{children:`<Match>`}),`.`]}}),`
`,e(m,{code:a,url:o}),`
`,e(p.p,{get children(){return[`Cycle through `,e(p.code,{children:`idle`}),`, `,e(p.code,{children:`loading`}),`, `,e(p.code,{children:`ready`}),`. Each state's scene is a
different mesh entirely — when you click the button, the previous
mesh's geometry and material are disposed and the next one mounts.`]}}),`
`,e(p.h2,{id:`for`,get children(){return e(p.a,{"data-auto-heading":``,href:`#for`,get children(){return e(p.code,{children:`<For>`})}})}}),`
`,e(p.p,{children:`The keyed list. Each item is tracked by identity — reordering an array
doesn't remount anything, push/pop is cheap.`}),`
`,e(m,{code:s,url:c}),`
`,e(p.p,{get children(){return[`Click "add" to push a new cube onto the signal array; the scene gains a
cube. Click "remove" to pop one; it disappears. The other cubes don't
move on the JSX level — they just update their `,e(p.code,{children:`position`}),` because the
expression `,e(p.code,{children:`(index() - (cubes().length - 1) / 2) * 1.2`}),` reads two
reactive values. One assignment per moved cube, per change. No diffing,
no remount.`]}}),`
`,e(p.h2,{id:`index`,get children(){return e(p.a,{"data-auto-heading":``,href:`#index`,get children(){return e(p.code,{children:`<Index>`})}})}}),`
`,e(p.p,{get children(){return[e(p.code,{children:`<For>`}),`'s positional cousin. Where `,e(p.code,{children:`<For>`}),` tracks items by identity,
`,e(p.code,{children:`<Index>`}),` tracks `,e(p.em,{children:`positions`}),` — the item at slot 0 is always the same
component, even if the value changes. Good for fixed-shape lists like
a row of slots.`]}}),`
`,e(m,{code:l,url:u}),`
`,e(p.p,{get children(){return[`Click "shuffle". The colours change, but each cube stays mounted —
only its `,e(p.code,{children:`color`}),` prop updates. With `,e(p.code,{children:`<For>`}),` you'd see the cubes
re-mount whenever the array's identity changed.`]}}),`
`,e(p.h2,{id:`suspense`,get children(){return e(p.a,{"data-auto-heading":``,href:`#suspense`,get children(){return e(p.code,{children:`<Suspense>`})}})}}),`
`,e(p.p,{get children(){return[`Wait for a `,e(p.code,{children:`createResource`}),` to resolve, falling back to something else
in the meantime. Both the fallback and the resolved content can be
`,e(p.code,{children:`<T.*>`}),`.`]}}),`
`,e(m,{code:d,url:f}),`
`,e(p.p,{get children(){return[`Click "new colour". The cube's colour comes from a `,e(p.code,{children:`createResource`}),`
that takes ~800ms to resolve. While it's pending, `,e(p.code,{children:`<Suspense>`}),` shows
the grey torus fallback. When it resolves, the cube mounts with the new
colour.`]}}),`
`,e(p.h2,{id:`what-about-clicking-the-cube-itself`,get children(){return e(p.a,{"data-auto-heading":``,href:`#what-about-clicking-the-cube-itself`,children:`What about clicking the cube itself?`})}}),`
`,e(p.p,{get children(){return[`So far the triggers have been DOM buttons. But what if you wanted to
click the cube — the actual `,e(p.code,{children:`<T.Mesh>`}),` — and have `,e(p.em,{children:`that`}),` be the
trigger? Same `,e(p.code,{children:`onClick`}),`, different target. That's the next chapter.`]}})]}function g(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(h,r)}})):h(r)}function _(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var v={frontmatter:m===void 0?{}:m??{},toc:p===void 0?void 0:p,editLink:``,lastUpdated:1780917478e3};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/03-control-flow.mdx`]=v);var y=v;export{y as $$SolidBase_page_data,g as default,m as frontmatter};