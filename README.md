<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=solid-three&background=tiles&project=%20" alt="solid-three">
</p>

# solid-three

[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=for-the-badge&logo=pnpm)](https://pnpm.io/)

Solid-three is a port of [React-three-fiber](https://github.com/pmndrs/react-three-fiber) to [SolidJS](https://www.solidjs.com/),
originally created by [Nikhil Saraf](https://github.com/nksaraf).
It allows you to declaratively construct a [Three.js](https://threejs.org/)
scene, with reactive primitives, just as you would construct a DOM tree in SolidJS.

> **Note** This library has just been published to NPM from this repo.
> It is still in early development, and is not yet ready for production use.
> Please feel free to try it out and report any issues you find!

## Quick start

Install it:

```bash
npm i solid-three
# or
yarn add solid-three
# or
pnpm add solid-three
```

Use it:

```tsx
import { Canvas } from 'solid-three'
```

### Dev Container

If you are using VSCode on windows (or just prefer to develope in a container), you can use the included dev container to get started quickly.

1. Clone this repo to a directory _inside of your wsl instance_ such as `~/Github`
2. Navigate to the `solid-three` directory and run `code .`
3. Open the workspace from the provided file.
4. Make sure the [DevContainers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension is installed Click the bottom left corner of the window and select `Reopen in Container` - if the extension is installed, vscode should prompt you to open the project in a dev container when you open the workspace file.

#### Dev Container Notes

- We clone into the wsl instance because the dev container is running a linux container, and the windows filesystem will cause extreme performance loss due to IO overhead.
- If you are using a different shell, you may need to modify the `devcontainer.json` file to use your shell of choice.

## Documentation

> **Note**: Coming Soon!

## Sample Applications

> **Note**: More Coming Soon!

### solid-three-template

This is a template for a SolidJS application that uses solid-three.

This project is a bare-bones `Vite` project that has been configured to use `SolidJS`, `solid-three`, and `ESLint` with `Prettier` for formatting.

[solid-three-template](https://github.com/ZanzyTHEbar/solid-three-template)

## Contributing

> **Note**: Coming Soon!
