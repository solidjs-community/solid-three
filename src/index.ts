export { Canvas, type CanvasProps } from "./canvas.tsx"
export { Entity, Portal, Resource } from "./components.tsx"
export { $S3C } from "./constants.ts"
export { createEntity, createT } from "./create-t.tsx"
export { createXR, useXR } from "./create-xr.tsx"
export type { XRContext, XRState } from "./create-xr.tsx"
export { useFrame, useLoader, useThree } from "./hooks.ts"
export { plugin } from "./plugin.ts"
export { useProps } from "./props.ts"
export * as S3 from "./types.ts"
// Direct re-exports of types that users commonly need at the top level.
// `Context`, `Plugin`, `PluginStatics` and `FrameListener` are the plugin contract: every
// `install(context)` / `canvas(context)` signature an engine author writes names `Context`,
// and a frame-driven engine names `FrameListener`. `Register` is augmentable from
// `declare module "solid-three"` (see its JSDoc); `SupportedRenderer` and
// `ResolvedRenderer` show up in advanced typings.
export type {
  Context,
  FrameListener,
  Plugin,
  PluginStatics,
  Register,
  ResolvedRenderer,
  SupportedRenderer,
} from "./types.ts"
export { autodispose, getMeta, hasMeta, load, meta } from "./utils.ts"
