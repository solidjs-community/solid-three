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

## Git Workflow

The history on `main` is meant to be read by humans. We keep it that way by
letting branches be messy and merges be clean.

### Branch for every change

Never commit directly to `main` or to any shared `solidjs-community` branch.
Create a feature branch (`feat/xr-decoupling`, `fix/resize-render`) and open a
PR from it.

### Your branch is yours; shared branches are not

Commit as often as you like on your own branch — exploration, WIP, and
AI-assisted commits are all fine. Force-push your own PR branch freely to clean
it up (rebase, amend, reorder). **Never** force-push `main` or a shared branch.

The noise stays on the branch; it never has to reach `main` (see merge
strategy). So commit in whatever rhythm keeps you productive.

### One PR, one logical change

A PR should be one feature or one fix. If you're tempted to write "and" in the
title, it's probably two PRs. Smaller PRs squash into cleaner history and are
easier to review and revert.

### Merge strategy

- **Squash — the default.** Use it whenever the branch's commits are scratch
  work (the AI-per-prompt case). The whole branch collapses to one commit on
  `main`. The granular history isn't lost — GitHub keeps it on the PR page even
  after the branch is deleted.
- **Rebase — the exception.** Use it only when the branch's *own* commits are
  already clean and each is a meaningful, self-contained unit you want to keep
  on `main` (e.g. a multi-phase feature split into `core →` then `consumer`
  commits). This puts them on `main` linearly.
- **Never merge-commit.** Merge bubbles are the noise we're avoiding.

### The PR title and body are the changelog

Because we squash, **the PR title becomes the commit subject on `main` and the
PR description becomes the commit body.** They are the permanent, human-readable
record of the change — write them as such, not as a throwaway note.

- **Title — a [Conventional Commit](https://www.conventionalcommits.org):**
  `type(scope): summary`, where `type` is one of `feat`, `fix`, `docs`,
  `refactor`, `test`, `perf`, `chore`. This is what shows up in `git log main`,
  so it doubles as the changeset entry.
- **Body — what changed and why.** Enough that a reader six months out
  understands the change without the diff. Note breaking changes explicitly.

```
# ❌ Bad PR title (becomes a useless commit on main)
updates

# ✅ Good PR title
feat(xr): decouple the WebXR loop from core; add createXR
```

### Fixed points

We don't cut prerelease tags. Instead, every push publishes a preview package
via [pkg.pr.new](https://pkg.pr.new), each pinned to a commit SHA — so any
build you're running maps back to an exact commit. A clean, squashed `main` plus
per-commit previews give reliable points to compare against.

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
