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
