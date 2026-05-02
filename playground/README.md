# solid-three Tutorials Playground

A local Vite app for exploring `solid-three` API demos and examples interactively.

## Running

```bash
pnpm install
pnpm dev
```

## Structure

```
src/
  api/          # Per-feature API demos, one folder per concept
  examples/     # Larger composed examples (solar system, environment, …)
controls/       # Shared orbit-controls and other helpers
```

The sidebar groups **API** demos by category and lists **Examples** separately. Each API category maps to a folder under `src/api/`; each folder typically contains a `usage.tsx` entry point plus additional focused demo files.

## Adding a Demo

**API demo** — create a `.tsx` file under `src/api/<category>/`. It is picked up automatically via Vite glob import and appears in the sidebar.

**Example** — create a `.tsx` file under `src/examples/`. Same auto-discovery applies.

Each file should export a default component that renders the demo (with its own `<Canvas>` if needed).
