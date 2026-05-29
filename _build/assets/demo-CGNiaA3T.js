const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_build/assets/solid-CKm8pzFo.js","_build/assets/web-CuRbvrvW.js","_build/assets/solid-dARbfd6B.css"])))=>i.map(i=>d[i]);
import{B as e,G as t,L as n,M as r,P as i,Q as a,R as o,U as s,V as c,Z as l,b as u,c as d,d as f,f as p,h as ee,it as m,k as h,l as g,m as _,o as v,rt as te,x as ne,z as y}from"./web-CuRbvrvW.js";import{r as b,t as x}from"./preload-helper-B2NzPDZj.js";var S=Object.defineProperty,C=(e,t,n)=>t in e?S(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,w=(e,t,n)=>(C(e,typeof t==`symbol`?t:t+``,n),n),T=(e,t,n)=>{if(!t.has(e))throw TypeError(`Cannot `+n)},E=(e,t,n)=>(T(e,t,`read from private field`),n?n.call(e):t.get(e)),D=(e,t,n)=>{if(t.has(e))throw TypeError(`Cannot add the same private member more than once`);t instanceof WeakSet?t.add(e):t.set(e,n)},O=(e,t,n,r)=>(T(e,t,`write to private field`),r?r.call(e,n):t.set(e,n),n),k,A,j;function M(e){return typeof e==`function`?e():e}var N=(e,t,n)=>{let r=M(e);return r?t(r):n?n():void 0},P=(e,t,n)=>(...r)=>N(e,e=>t(e,...r),n?()=>n(...r):void 0);function F(e){return e.split(`/`).slice(-1)[0]?.split(`.`)[1]||``}function I(e){let t=e.split(`/`);return t[t.length-1]||``}function L(e){return e.split(`/`).slice(0,-1).join(`/`)}function R(e){return e.replace(/^\/+/,``)}function z(e,t){if(B(e))try{return R(new URL(t,e).href)}catch{return`${e.substring(0,e.lastIndexOf(`/`))}/${t.replace(/^\.\//,``)}`}let n=e.split(`/`).slice(0,-1),r=t.split(`/`).filter(e=>e!==``&&e!==`.`),i=e.startsWith(`../`)||e.startsWith(`./`),a=[...n];for(let e of r)e===`..`?a.length>0&&a[a.length-1]!==`..`?a[a.length-1]===`.`?a[a.length-1]=`..`:a.pop():i&&a.push(`..`):a.push(e);if(a.length===0)return r[r.length-1]||``;let o=a.join(`/`);return o.startsWith(`./`)&&!o.includes(`../`)&&(o=o.substring(2)),o}function B(e){return e.startsWith(`blob:`)||e.startsWith(`http:`)||e.startsWith(`https:`)}var V=Object.freeze(Object.defineProperty({__proto__:null,getExtension:F,getName:I,getParentPath:L,isUrl:B,normalizePath:R,resolvePath:z},Symbol.toStringTag,{value:`Module`})),re={equals:!1},H=class{constructor(e=Map){D(this,k,void 0),O(this,k,new e)}dirty(e){var t;(t=E(this,k).get(e))==null||t.$$()}dirtyAll(){for(let e of E(this,k).values())e.$$()}track(e){if(!t())return;let n=E(this,k).get(e);if(n)n.n++;else{let[t,r]=s(void 0,re);E(this,k).set(e,n={$:t,$$:r,n:1})}l(()=>{--n.n===0&&queueMicrotask(()=>n.n===0&&E(this,k).delete(e))}),n.$()}};k=new WeakMap;var U=Symbol(`track-object`),ie=class extends Map{constructor(e){if(super(),D(this,A,new H),D(this,j,new H),e)for(let t of e)super.set(...t)}[Symbol.iterator](){return this.entries()}get size(){return E(this,A).track(U),super.size}*keys(){E(this,A).track(U);for(let e of super.keys())yield e}*values(){E(this,j).track(U);for(let e of super.values())yield e}*entries(){E(this,A).track(U),E(this,j).track(U);for(let e of super.entries())yield e}forEach(e,t){E(this,A).track(U),E(this,j).track(U),super.forEach(e,t)}has(e){return E(this,A).track(e),super.has(e)}get(e){return E(this,j).track(e),super.get(e)}set(e,t){let n=!super.has(e),i=super.get(e)!==t,a=super.set(e,t);return(i||n)&&r(()=>{n&&(E(this,A).dirty(U),E(this,A).dirty(e)),i&&(E(this,j).dirty(U),E(this,j).dirty(e))}),a}delete(e){let t=super.get(e)!==void 0,n=super.delete(e);return n&&r(()=>{E(this,A).dirty(U),E(this,j).dirty(U),E(this,A).dirty(e),t&&E(this,j).dirty(e)}),n}clear(){super.size!==0&&r(()=>{E(this,A).dirty(U),E(this,j).dirty(U);for(let e of super.keys())E(this,A).dirty(e),E(this,j).dirty(e);super.clear()})}};A=new WeakMap,j=new WeakMap;function ae(e){return se(e)?e():e}function oe(t,n){let r=null,i=()=>!r||r.state===`unresolved`?void 0:r.latest;r=e(()=>t(m(i)),e=>e,n)[0];let a=()=>r();return Object.defineProperty(a,`latest`,{get(){return r.latest}}),a}function se(e){return typeof e==`function`}var ce=class{constructor(e){w(this,`map`,new ie),this.cb=e}get(e){return this.map.get(e)?.value}isNull(e){return this.map.get(e)?.count===0}delete(e){var t;return(t=this.map.get(e))==null||t.dispose(),this.map.delete(e)}track(e){let n=t(),r=m(()=>this.map.get(e));return n&&l(()=>{queueMicrotask(()=>{let t=this.map.get(e);t&&t.count--})}),r?(n&&r.count++,r.value):c(t=>{let r=this.cb(e);return this.map.set(e,{count:+!!n,value:r,dispose:t}),r})}memo(e,t){return o(n=>m(()=>this.map.get(e)?.count)===0&&n?n:t(n))}};function le(e,t){let n=new Blob([e],{type:`text/${t||`plain`}`});return URL.createObjectURL(n)}function W({readFile:e,extensions:t}){let r=new ce(a=>{let c=oe(()=>{try{let t=e(a);return t===void 0?0:t instanceof Promise?t.catch(()=>0):t}catch{return 0}}),u=F(a);return n(()=>{r.isNull(a)&&c()===0&&r.delete(a)}),o(P(c,()=>{let[e,n]=s(null,{equals:!1}),r=o(P(c,e=>e&&t[u]?.transform?t[u].transform({path:a,source:e,fileUrls:i}):e)),d=P(o(()=>ae(r())),e=>le(e,t[u]?.type));return{get:o(()=>{e();let t=d();return t&&l(()=>URL.revokeObjectURL(t)),t}),create:d,invalidate:n}}))}),i={get(e,{cached:t=!0}={cached:!0}){let n=r.track(e)();return t?n?.get():n?.create()},invalidate(e){return(r.get(e)?.())?.invalidate()}};return i}var G=typeof DOMParser<`u`?new DOMParser:void 0,K=typeof XMLSerializer<`u`?new XMLSerializer:void 0;function ue({path:e,source:t,fileUrls:n,transformModule:r}){if(!G||!K)throw"`parseHtml` can only be used in environments where DOMParser and XMLSerializer are available. Please use `parseHtmlWorker` for a worker-friendly alternative.";let i=G.parseFromString(t,`text/html`),a=q(i,`link[href]`,t=>{let r=t.getAttribute(`href`);if(!B(r))return()=>{let i=n.get(z(e,r));i&&t.setAttribute(`href`,i)}}),o=q(i,`script[src]`,t=>{let r=t.getAttribute(`src`);if(!B(r))return()=>{let i=n.get(z(e,r));i&&t.setAttribute(`src`,i)}}),s=q(i,`script[type="module"]`,t=>{let i=t.textContent;if(t.type!==`module`||!i)return;let a=r({path:e,fileUrls:n,source:i});return()=>t.textContent=a()});return()=>(a(),o(),s(),K.serializeToString(i))}function q(e,t,n){let r=Array.from(e.querySelectorAll(t)).map(e=>n(e));return()=>r.forEach(e=>e?.())}function de(e){return{type:`html`,transform(t){return ue({...e,...t})}}}function fe({ts:e,source:t,include:n={imports:!0,exports:!0,dynamicImports:!0}}){let r=e.createSourceFile(``,t,e.ScriptTarget.Latest,!0,e.ScriptKind.TS),i=[];function a(t){if((e.isImportDeclaration(t)||e.isExportDeclaration(t))&&t.moduleSpecifier&&e.isStringLiteral(t.moduleSpecifier)){let o=e.isImportDeclaration(t);if(o&&!n.imports||!o&&!n.exports){e.forEachChild(t,a);return}let s=t.moduleSpecifier.text,c=t.moduleSpecifier.getStart(r)+1,l=t.moduleSpecifier.getEnd()-1;i.push({start:c,end:l,path:s,isImport:o,isDynamic:!1})}if(e.isCallExpression(t)&&t.expression.kind===e.SyntaxKind.ImportKeyword){if(!n.dynamicImports){e.forEachChild(t,a);return}let o=t.arguments[0];if(o&&e.isStringLiteral(o)){let e=o.text,t=o.getStart(r)+1,n=o.getEnd()-1;i.push({start:t,end:n,path:e,isImport:!0,isDynamic:!0})}}e.forEachChild(t,a)}return a(r),i}function pe({ts:e,source:t,transform:n}){let r=fe({source:t,ts:e});return()=>{let e=!1,i=[];for(let{start:t,end:a,path:o,isImport:s}of r){let r=n(o,s);r!==o&&(i.push({start:t,end:a,replacement:r}),e=!0)}if(!e)return t;let a=t;for(let e=i.length-1;e>=0;e--){let{start:t,end:n,replacement:r}=i[e];a=a.slice(0,t)+r+a.slice(n)}return a}}function J({cdn:e,babel:t,items:n,type:r}){if(!n)return Promise.resolve([]);let i=r===`plugins`?t.availablePlugins:t.availablePresets;return Promise.all(n.map(async function(t){let n,r;if(typeof t==`string`)n=t;else if(Array.isArray(t)&&typeof t[0]==`string`)[n,r]=t;else return t;if(n in i)return r===void 0?i[n]:[i[n],r];{let t=await x(()=>import(`${e}/${n}`).then(e=>e.default),[]);return r===void 0?t:[t,r]}}))}async function me(e){let t=e.cdn||`https://esm.sh`,n=await(e.babel||x(()=>import(`${t}/@babel/standalone`),[])),[r,i]=await Promise.all([J({cdn:t,babel:n,items:e.presets,type:`presets`}),J({cdn:t,babel:n,items:e.plugins,type:`plugins`})]);return(e,t)=>{let a=n.transform(e,{presets:r,plugins:i}).code;if(!a)throw`Babel transform failed for file ${t} with source: 

 ${e}`;return a}}var he=new URL(`snippet-runtime-B63iNz1b.js`,import.meta.url).href,ge=u(`<div class=demo-tabs><button type=button>Canvas</button><button type=button>Editor`),_e=u(`<button type=button class=demo-reset>reset`),ve=u(`<div class=demo-editor-wrapper><!$><!/><!$><!/>`),ye=u(`<div class=demo-loading-bar role=progressbar aria-label="Loading preview">`),be=u(`<div class=demo-canvas-wrapper><iframe class=demo-canvas sandbox="allow-scripts allow-same-origin"></iframe><!$><!/>`),xe=u(`<div class=demo><!$><!/><div class=demo-panes><!$><!/><!$><!/>`),Y;function Se(){return Y||=x(()=>import(`https://esm.sh/typescript@5.9`).then(e=>e.default??e),[]),Y}var X;function Ce(){return X||=me({presets:[[`babel-preset-solid`,{generate:`dom`,hydratable:!1}]]}),X}var we=b(async()=>({default:(await x(()=>import(`./solid-CKm8pzFo.js`),__vite__mapDeps([0,1,2]))).TmTextarea}));function Z(){return typeof document>`u`?!1:(document.documentElement.dataset.theme??``).includes(`dark`)}function Te(){let[e,t]=s(Z());return a(()=>{let e=document.documentElement,n=new MutationObserver(()=>t(Z()));n.observe(e,{attributes:!0,attributeFilter:[`data-theme`]}),l(()=>n.disconnect())}),()=>e()?`dark`:`light`}var Ee=`https://esm.sh`,De=`external=solid-js,three&deps=solid-js@1.8,three@0.181,cannon-es@0.20`;function Oe(){let e=`/solid-three/@tutorial/solid-three.js`;return typeof window>`u`?e:new URL(e,window.location.href).toString()}function Q(e){return e===`solid-js`||e===`three`||e===`three/webgpu`||e===`three/tsl`?e:e===`solid-three`?Oe():(e.startsWith(`solid-js/`),`${Ee}/${e}?${De}`)}function ke(e,t){return e.transpile(t,{jsx:e.JsxEmit.Preserve,target:e.ScriptTarget.ESNext,module:e.ModuleKind.ESNext})}function $({tsModule:e,source:t,path:n,fileUrls:r}){return pe({ts:e,source:t,transform:e=>e.startsWith(`.`)||e.startsWith(`/`)?r.get(V.resolvePath(n,e))??e:V.isUrl(e)?e:Q(e)})()}function Ae(e){return`export default function CompileError() {
  const node = document.createElement("pre")
  node.style.cssText = "color:#ff8080;background:#0a0c12;font-family:ui-monospace,monospace;font-size:0.85rem;padding:1rem;margin:0;height:100%;white-space:pre-wrap;overflow:auto;"
  node.textContent = ${JSON.stringify(e)}
  return node
}
`}function je(e){return`<!doctype html>
<html style="color-scheme: ${e}">
  <head>
    <meta charset="utf-8" />
    <base href="${window.location.origin}/solid-three/" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
      canvas { display: block; }
    </style>
    <script>
      window.addEventListener("message", function (event) {
        var data = event.data
        if (!data) return
        if (data.type !== "theme") return
        document.documentElement.style.colorScheme = data.value
      })
    <\/script>
    <script type="importmap">
      {
        "imports": {
          "solid-js": "https://esm.sh/solid-js@1.8",
          "solid-js/web": "https://esm.sh/solid-js@1.8/web?external=solid-js",
          "solid-js/jsx-runtime": "https://esm.sh/solid-js@1.8/jsx-runtime?external=solid-js",
          "solid-js/jsx-dev-runtime": "https://esm.sh/solid-js@1.8/jsx-dev-runtime?external=solid-js",
          "three": "https://esm.sh/three@0.181",
          "three/webgpu": "https://esm.sh/three@0.181/webgpu?external=three",
          "three/tsl": "https://esm.sh/three@0.181/tsl?external=three",
          "three/": "https://esm.sh/three@0.181/"
        }
      }
    <\/script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"><\/script>
  </body>
</html>
`}var Me=`import { render } from "solid-js/web"
import Component from "./snippet.tsx"

const root = document.getElementById("root")
if (root) {
  render(() => <Component />, root)
}
`;function Ne(e,t){let n=window.location.origin,r=new URL(he,n).toString(),i=new URL(e,n).toString(),a=`<!doctype html>
<html style="color-scheme: ${t}">
  <head>
    <meta charset="utf-8" />
    <base href="${n}/solid-three/" />
    <style>
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: transparent; }
      canvas { display: block; }
    </style>
    <script>
      window.addEventListener("message", function (event) {
        if (!event.data || event.data.type !== "theme") return
        document.documentElement.style.colorScheme = event.data.value
      })
    <\/script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import { mount } from ${JSON.stringify(r)}
      import Snippet from ${JSON.stringify(i)}
      mount(Snippet, document.getElementById("root"))
    <\/script>
  </body>
</html>`;return URL.createObjectURL(new Blob([a],{type:`text/html`}))}function Pe(e){return e.replace(/^\n+|\n+$/g,``)}function Fe(e){return i(Ie,e)}function Ie(t){let n=Pe(t.code),[r,c]=s(n),[u,v]=s(!1),[b,x]=s(`canvas`),[S,C]=s(!1),[w,T]=s(!0),[E,D]=s(!1),O=Te();a(()=>{let e=window.matchMedia(`(max-width: 900px)`);C(e.matches);let t=e=>C(e.matches);e.addEventListener(`change`,t),l(()=>e.removeEventListener(`change`,t))});let k,A=o(()=>(k&&URL.revokeObjectURL(k),k=Ne(t.url,m(O)),k));l(()=>{k&&URL.revokeObjectURL(k)});let[j]=e(()=>u()?!0:void 0,async()=>{let[e,t]=await Promise.all([Ce(),Se()]);return{babelTransform:e,tsModule:t}}),M={type:`javascript`,transform:({source:e,path:t,fileUrls:n})=>()=>{let r=j();if(!r)return`export default function Placeholder() { return null }
`;try{let i=ke(r.tsModule,e),a=r.babelTransform(i,t);return $({tsModule:r.tsModule,source:a,path:t,fileUrls:n})}catch(e){return Ae(`Compile error:

`+(e instanceof Error?e.message:String(e)))}}},N=W({readFile:e=>{if(e===`/snippet.tsx`)return r();if(e===`/index.html`)return je(m(O));if(e===`/main.tsx`)return Me},extensions:{tsx:M,ts:M,html:de({transformModule:({source:e,path:t,fileUrls:n})=>()=>{let r=j();return r?$({tsModule:r.tsModule,source:e,path:t,fileUrls:n}):e}})}}),P=o(()=>N.get(`/index.html`)),F=o(()=>u()?P()??`about:blank`:A()),I;function L(){I?.contentWindow?.postMessage({type:`theme`,value:O()},`*`)}y(()=>{O(),L()}),y(()=>{F(),T(!0)});function R(){c(n)}return(()=>{var e=d(xe),a=e.firstChild,[o,s]=g(a.nextSibling),l=o.nextSibling,u=l.firstChild,[m,C]=g(u.nextSibling),k=m.nextSibling,[A,j]=g(k.nextSibling);return f(e,i(h,{get when(){return p(()=>!!S())()&&!t.editorHidden},get children(){var e=d(ge),t=e.firstChild,n=t.nextSibling;return t.$$click=()=>x(`canvas`),n.$$click=()=>x(`editor`),y(e=>{var r=b()===`canvas`,i=b()===`editor`;return r!==e.e&&t.classList.toggle(`active`,e.e=r),i!==e.t&&n.classList.toggle(`active`,e.t=i),e},{e:void 0,t:void 0}),_(),e}}),o,s),f(l,i(h,{get when(){return p(()=>!t.editorHidden)()&&(!S()||b()===`editor`)},get children(){var e=d(ve),t=e.firstChild,[a,o]=g(t.nextSibling),s=a.nextSibling,[l,u]=g(s.nextSibling);return f(e,i(we,{class:`demo-editor`,grammar:`tsx`,get theme(){return O()===`dark`?`github-dark`:`github-light`},get value(){return r()},editable:!0,onInput:e=>{c(e.currentTarget.value),D(!0),te(()=>v(!0))}}),a,o),f(e,i(h,{get when(){return r()!==n},get children(){var e=d(_e);return e.$$click=R,_(),e}}),l,u),e}}),m,C),f(l,i(h,{get when(){return t.editorHidden||!S()||b()===`canvas`},get children(){var e=d(be),n=e.firstChild,r=n.nextSibling,[a,o]=g(r.nextSibling);n.addEventListener(`load`,()=>{T(!1),D(!1),L(),t.onReady?.()});var s=I;return typeof s==`function`?ne(s,n):I=n,f(e,i(h,{get when(){return E()||w()},get children(){return d(ye)}}),a,o),y(()=>ee(n,`src`,F())),e}}),A,j),y(n=>{var r=!!S(),i=!!t.editorHidden;return r!==n.e&&e.classList.toggle(`demo-narrow`,n.e=r),i!==n.t&&e.classList.toggle(`demo-editor-hidden`,n.t=i),n},{e:void 0,t:void 0}),e})()}v([`click`]);export{Fe as default};