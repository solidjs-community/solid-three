# Contributing to Solid Three

Thanks for your interest in contributing!

## Code Style

### No non-null assertions (`!`)

Don't use the `!` non-null assertion operator. It lies to the type system
without giving the runtime any safety. If a value might be `undefined`, narrow
it with a runtime check (`if`, `?.`, early return) so both TypeScript and the
runtime agree.

```ts
// ❌ Bad
context.gl.xr!.enabled = true

// ✅ Good
if (context.gl.xr) {
  context.gl.xr.enabled = true
}
```

### No abbreviated variable names

Use full names: `raycaster`, not `rc`. When a name shadows an outer scope,
prefix with `_` to disambiguate (`_raycaster`).

## Architecture

### Factories (`create*`) vs. classes

The rule: `create*` functions are the Solid-facing glue; classes are the
framework-agnostic core. They never overlap — a `create*` function holds Solid
reactivity, a class holds none.

- **`create*` factories** (`createThree`, `createEvents`, `createXR`, `createT`)
  follow Solid's `createSignal`/`createStore` convention: they run synchronously
  inside a reactive owner and wire up `onCleanup`, effects, and context. Reach for
  one whenever setup must bind to the reactive scope.
- **Classes** (`Pointer`, `DOMPointerManager`, the `*Raycaster`s, the data
  structures) carry no Solid reactivity. Use a class for long-lived,
  identity-bearing state behind a method API — especially when it must subclass a
  three.js type (`extends Raycaster`), swap behind an interface
  (`implements ScreenRaycaster`), or be `new`'d many times.

Keep the core in classes so it stays unit-testable without a reactive runtime:
tests `new Pointer(...)` with a fake raycaster — no `Canvas`, no owner. The
`create*` layer is the thin seam that instantiates those classes inside Solid.

(`createThreeEvent` is the lone lowercase "value factory": it returns a plain,
spreadable event object, not a reactive primitive.)

## Tooling

### Package Management

This repository uses [**pnpm**](https://pnpm.io/installation). Install with
`npm install -g pnpm`, then run `pnpm install`.

### Formatting and Linting

[**eslint**](https://eslint.org/) and [**prettier**](https://prettier.io/) —
`pnpm lint` to check, `pnpm format` to fix.

## Acknowledgements

Deeply inspired by:

- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Solid Primitives](https://github.com/solidjs-community/solid-primitives)
