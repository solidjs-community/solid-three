# Contributing to Solid Three

:+1::tada: Thank you for checking out the project and wanting to contribute! :tada::+1:

## Contribution Process

Solid Three strives to provide idiomatic Solid principles but also allow room for innovation and experimentation using modern ThreeJS and WebGL tools. In a growing community many opinions and patterns merge together to produce a de facto standard. Managing opinions and expectations can be difficult. As a result this project will inherit the Solid standard set out by `Solid Primitives` in November 2021, Solid Primitives implemented a ratification/approval tracking process roughly modelled on [TC39 Proposal Stage Process](https://tc39.es/process-document/). The following summarizes these stages briefly:

| Stage | Description                 |
| ----- | --------------------------- |
| X     | Deprecated or rejected      |
| 0     | Initial submission          |
| 1     | Demonstrations and examples |
| 2     | General use (experimental)  |
| 3     | Pre-shipping (final effort) |
| 4     | Accepted/shipped            |

Any feature Stage 0-1 should be used with caution and with the understanding that the design or implementation may change. Beyond Stage 2 we make an effort to mitigate changes. If a feature reaches Stage 2 it's likely to remain an official package with additional approvement until fully accepted and shipped.

## Design Maxims

Other frameworks have large and extremely well established ecosystems. Notably React which has a vast array of component and hooks, such as `React Three Fiber` and `React Drie`. The amount of choice within the ecosystem is great but often these tools are built as one-offs resulting in often un-tested logic or are designed with narrow needs. Over time the less concise these building blocks are the more they tend to repeat themselves. Our goal with Solid Three is to bring the community together to contribute, evolve and utilize a powerful centralized ThreeJS library for SolidJS.

All our work is meant to be consistent and sustain a level of quality. We guarantee that each is created with the utmost care. We strive to follow these design maxims:

1. Documented and follow a consistent style guide
2. Be well tested
3. Small, concise and practical as possible
4. A single Component for a single purpose
5. No dependencies or as few as possible
6. Wrap base level Browser APIs
7. Should be progressively improved for future features
8. Be focused on composition vs. isolation of logic
9. Community voice and needs guide road map and planning
10. Strong TypeScript support
11. Support for both CJS and ESM
12. Solid performance!

### Managing ThreeJS Complexity

Solid Three is mostly about supplying 80-90% of the common-use cases of vanilla `ThreeJS` for the end-user. We prefer to be less prescriptive. The remaining 10-20% of complex use cases are likely not to be covered with this library. This is on purpose to limit the potential of bloat and extended complexity. This project strives to provide foundations and not cumulative solutions. We expect the broader ecosystem will fill the remaining need as further composition to this projects effort. This allows for just the right amount of prescription and opinion.

## NPM Release and Repository Structure

Solid Three is a large and growing project and the way we manage and release updates has been setup to suit the projects scope.

To that end we are currently using [`semantic-release`](https://github.com/semantic-release/semantic-release) to manage our packages and releases.

There are a number of benefits to this including small download sizes, reducing bloat and not shipping experimental/unnecessary changes that users don't need or want locally. This also allows us to ship updates to individual packages as needed.

## Tooling

### Package Management

This repository is a monorepo managed by [**pnpm workspaces**](https://pnpm.io/workspaces) which means that you need to install [**pnpm**](https://pnpm.io/installation) to work on it. If you don't have it installed, you can install it with `npm install -g pnpm`.

If this is your first time pulling the repository onto a local branch, then run `pnpm install` to install all the dependencies and build all the local packages — this is important because all of the workspace packages are linked together. Furthermore, you should run `pnpm install` whenever you pull from the main branch. If you experience any further issues, try removing the `node_modules` folder (`rm -Force -Recurse .\node_modules\` or `rm -rf node_modules/`) and reinstalling the dependencies.

### Formatting and Linting

We use [**eslint**](https://eslint.org/) and [**prettier**](https://prettier.io/) to lint and format the code. You can run `pnpm lint` to check for linting errors and `pnpm format` to format the code.

Having them installed and enabled in your editor is not required but should help you in the development process.

### Operating System

This repository should work on any operating system, but if any issues arise, you might try using [**Gitpod**](https://gitpod.io) to quickly spin up a fresh remote development environment.

### CLI Helpers

> **Note**: Coming Soon

## Planned Features

> **Note**: Coming Soon

## Acknowledgements

Deeply inspired by the following projects:

- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [Solid Primitives](https://github.com/solidjs-community/solid-primitives)
