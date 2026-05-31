# unplugin-solid-three

Build-time tree-shaking for [`solid-three`](https://github.com/solidjs-community/solid-three).
Rewrites `createT(THREE)` into a curated catalogue containing only the classes
your app actually reaches through `T`, so your bundler can drop the rest.

## Install

```bash
pnpm add -D unplugin-solid-three
```

## Vite

```ts
// vite.config.ts
import { vitePlugin as solidThree } from "unplugin-solid-three"
import solid from "vite-plugin-solid"

export default {
  plugins: [solidThree(), solid()],
}
```

Other bundlers: `rollupPlugin`, `webpackPlugin`, `esbuildPlugin`, `rspackPlugin`.

## How it works

You keep writing the concise `const T = createT(THREE)`. On production builds the
plugin follows every `T.Foo` access across your project and rewrites the call to
`createT({ Foo: THREE.Foo, … })`. Dev is untouched (the runtime proxy is used).

Narrowing happens only when it is provably sound. When a catalogue can't be
narrowed (a dynamic `T[expr]`, or `T` escaping into a function), the plugin keeps
the full catalogue and warns. Pass `{ strict: true }` to turn those warnings into
build errors. The fix is always the same: pass an explicit catalogue.

## Options

```ts
solidThree({
  strict: false, // warnings → build errors
  tsconfig: undefined, // path to tsconfig (auto-detected)
})
```

## Limitations

The analyzer follows `T` across files using your `tsconfig` — including `.js`
and `.jsx`, **provided those files are part of the TypeScript Program**. That
means a mixed JS/TS project must enable `allowJs` (TypeScript's default is off)
and `include` its JS files. If a file that uses `T` is *outside* the Program
(e.g. `allowJs` off, or excluded by `include`), its accesses are invisible to
the analyzer, and the catalogue could be narrowed without accounting for them.

Until the planned bundler-module-graph cross-check lands (which will bail +
warn whenever the bundler processes a `createT`/`T` module the analysis didn't
see), make sure every file that uses `T` is covered by your `tsconfig`, or use
`{ strict: true }` and an explicit catalogue for anything the analyzer can't
reach.
