# TypeScript version matrix

ts-morph rides the TypeScript compiler, so symbol/reference resolution and
namespace-type enumeration can shift across versions. Before a release, run the
typecheck + Node suite against the lowest supported and the latest TypeScript:

```bash
pnpm -C packages/unplugin-solid-three add -D typescript@5.4.5 && pnpm -C packages/unplugin-solid-three test:ts
pnpm -C packages/unplugin-solid-three add -D typescript@latest && pnpm -C packages/unplugin-solid-three test:ts
```

Both must pass. (`test:ts` runs `tsc --noEmit` then the Node suite.) CI
automation of this matrix is a follow-up.
