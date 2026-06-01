# vite-plugin-solid-three

Build-time tree-shaking for [`solid-three`](https://github.com/solidjs-community/solid-three). Rewrites `createT(THREE)` into a curated catalogue containing only the classes your app actually reaches through `T`, so your bundler can drop the rest.

## Install

```bash
pnpm add -D vite-plugin-solid-three
```

## Usage

```ts
// vite.config.ts
import solidThree from "vite-plugin-solid-three"
import solid from "vite-plugin-solid"

export default {
  plugins: [solidThree(), solid()],
}
```

That's the whole setup. You keep writing the concise `const T = createT(THREE)`; the plugin handles the rest on production builds. Dev is untouched — the runtime proxy is used as normal.

## How it works

The plugin lets the bundler do the analysis. On a production build it runs two passes:

1. **Measure.** It temporarily turns your catalogue into a namespace and runs a throwaway build. The bundler's own tree-shaking reports exactly which keys (`T.Mesh`, `T.BoxGeometry`, …) survive — across files, dynamic imports, and code-split chunks.
2. **Emit.** It rewrites `createT(THREE)` to `createT({ Mesh: THREE.Mesh, … })` containing only the measured keys. `createT` stays in your output, so runtime behaviour and debugging are unchanged; the unused three classes are now unreferenced and the bundler shakes them out.

Because the bundler measures real usage, this is exact rather than over-approximate, and it is sound by construction: any access the bundler can't resolve statically deopts to keeping the whole catalogue.

## What it narrows

It narrows catalogues whose keys it can read statically:

- `createT(THREE)` — and any other namespace import (e.g. `createT(WEBGPU)`).
- `createT({ MyMesh, ...THREE })` — object literals, spreads (last writer wins on key collisions), and verbatim getters. Custom classes are kept by their provider; unused ones drop.

## What it leaves alone

When narrowing isn't statically safe, the plugin leaves `createT(...)` completely untouched — full catalogue, full runtime dynamism. That happens for:

- A non-enumerable catalogue source: `createT(store)`, `createT(someVariable)`, a computed key, or a spread of a runtime object.
- Dynamic *usage*: if any code accesses `T[someExpression]` or passes `T` around as a value, the bundler keeps the whole catalogue for that build. Sound, just not optimized.

So you never have to opt in or annotate anything — the plugin optimizes what it can prove and gets out of the way otherwise.

## Requirements

- Vite (build step). The mechanism is Rollup-native; other bundlers aren't supported.
- `typescript` is used to parse your catalogue module (a peer dependency).
