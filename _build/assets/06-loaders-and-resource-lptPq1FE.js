import{P as e,Y as t}from"./web-Ca0kQsEY.js";import{n}from"./mdx-BDAsXIzm.js";var r=`import * as THREE from "three"
import { Suspense } from "solid-js"
import { Canvas, createT, useLoader } from "solid-three"

const T = createT(THREE)

function TexturedCube() {
  const texture = useLoader(THREE.TextureLoader, "https://picsum.photos/seed/solid-three/256")
  return (
    <T.Mesh>
      <T.BoxGeometry />
      <T.MeshBasicMaterial map={texture()} />
    </T.Mesh>
  )
}

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <Suspense>
        <TexturedCube />
      </Suspense>
    </Canvas>
  )
}
`,i=new URL(`06-use-loader-BA6i5aXU.js`,import.meta.url).href,a=`import * as THREE from "three"
import { Suspense } from "solid-js"
import { Canvas, createT, Resource } from "solid-three"

const T = createT(THREE)

export default function App() {
  return (
    <Canvas camera={{ position: [0, 0, 3] }}>
      <Suspense>
        <T.Mesh>
          <T.BoxGeometry />
          <T.MeshBasicMaterial>
            <Resource
              loader={THREE.TextureLoader}
              url="https://picsum.photos/seed/solid-three/256"
              attach="map"
            />
          </T.MeshBasicMaterial>
        </T.Mesh>
      </Suspense>
    </Canvas>
  )
}
`,o=new URL(`06-resource-DA-XIkI7.js`,import.meta.url).href,s=[{title:`Loaders & Resource`,href:`#loaders--resource`,children:[{title:`useLoader: the hook`,href:`#useloader-the-hook`,children:[]},{title:`Resource: the component`,href:`#resource-the-component`,children:[]}]}],c={title:`Loaders & Resource`};function l(t){let s={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...n(),...t.components},{Demo:c}=s;return c||d(`Demo`,!0),[e(s.h1,{id:`loaders--resource`,get children(){return e(s.a,{"data-auto-heading":``,href:`#loaders--resource`,children:`Loaders & Resource`})}}),`
`,e(s.p,{get children(){return[`Textures, models, audio — `,e(s.code,{children:`three.js`}),` ships a loader class for each kind.
`,e(s.code,{children:`solid-three`}),` exposes two ways to use them that both plug into Solid's
`,e(s.code,{children:`<Suspense>`}),` so the rest of the scene keeps rendering while the asset is
fetching.`]}}),`
`,e(s.h2,{id:`useloader-the-hook`,get children(){return e(s.a,{"data-auto-heading":``,href:`#useloader-the-hook`,get children(){return[e(s.code,{children:`useLoader`}),`: the hook`]}})}}),`
`,e(s.p,{get children(){return[e(s.a,{href:`/api/hooks/use-loader`,get children(){return e(s.code,{children:`useLoader(loaderClass, url)`})}}),` returns an
`,e(s.code,{children:`Accessor`}),` that resolves to the
loaded asset. Wrap the consumer in a `,e(s.code,{children:`<Suspense>`}),` so Solid knows what to
do while it's pending.`]}}),`
`,e(c,{code:r,url:i}),`
`,e(s.p,{get children(){return[`A cube with a random photo from `,e(s.code,{children:`picsum.photos`}),` mapped onto every face.
While the image is loading, `,e(s.code,{children:`<Suspense>`}),` shows nothing (you can give it a
`,e(s.code,{children:`fallback`}),` if you want a placeholder).`]}}),`
`,e(s.p,{get children(){return[e(s.code,{children:`useLoader`}),` caches by URL across the whole app, so two components
asking for the same texture share one load and one GPU upload. The
`,e(s.a,{href:`/api/utilities/loader-cache`,get children(){return e(s.code,{children:`LoaderCache`})}}),` is configurable per call
when you need different scoping.`]}}),`
`,e(s.h2,{id:`resource-the-component`,get children(){return e(s.a,{"data-auto-heading":``,href:`#resource-the-component`,get children(){return[e(s.code,{children:`Resource`}),`: the component`]}})}}),`
`,e(s.p,{get children(){return[`The declarative version. `,e(s.a,{href:`/api/components/resource`,get children(){return e(s.code,{children:`<Resource loader={...} url="...">`})}}),` does the same
fetching, but you write it as JSX inside the scene tree. When the
attachment is obvious — a `,e(s.code,{children:`TextureLoader`}),` result going into `,e(s.code,{children:`.map`}),` of the
parent material — `,e(s.code,{children:`attach`}),` does the wiring for you.`]}}),`
`,e(c,{code:a,url:o}),`
`,e(s.p,{children:`Same outcome, different shape. Use whichever reads better in context:`}),`
`,e(s.ul,{get children(){return[`
`,e(s.li,{get children(){return[e(s.strong,{get children(){return e(s.code,{children:`useLoader`})}}),` when you need the value as a Solid signal — to derive
other signals from it, pass it to a function, or do something
programmatic.`]}}),`
`,e(s.li,{get children(){return[e(s.strong,{get children(){return e(s.code,{children:`<Resource>`})}}),` when you just want to drop a loaded asset into the tree
and forget about it.`]}}),`
`]}}),`
`,e(s.p,{get children(){return[`Both forms return Solid resources, so the usual reactivity rules apply:
read them inside `,e(s.code,{children:`createMemo`}),`/`,e(s.code,{children:`createEffect`}),` to track loading state,
or inside `,e(s.code,{children:`<Suspense>`}),` to render a fallback. Cache behaviour, base URLs,
array/record URL shapes, error handling — see
`,e(s.a,{href:`/api/hooks/use-loader`,get children(){return e(s.code,{children:`useLoader`})}}),` for the full surface.`]}}),`
`,e(s.p,{get children(){return[`That's the everyday tree: components, props, signals, events, frames,
loaders. The next chapter is a deliberate break from the mapping — a
way to send children somewhere `,e(s.em,{children:`other`}),` than where their JSX would
suggest.`]}})]}function u(r={}){let{wrapper:i}={...n(),...r.components};return i?e(i,t(r,{get children(){return e(l,r)}})):l(r)}function d(e,t){throw Error(`Expected `+(t?`component`:`object`)+" `"+e+"` to be defined: you likely forgot to import, pass, or provide it.")}var f={frontmatter:c===void 0?{}:c??{},toc:s===void 0?void 0:s,editLink:``,lastUpdated:1780917603e3};typeof window<`u`&&(window.$$SolidBase_page_data??={},window.$$SolidBase_page_data[`/home/runner/work/solid-three/solid-three/site/src/routes/tour/06-loaders-and-resource.mdx`]=f);var p=f;export{p as $$SolidBase_page_data,u as default,c as frontmatter};