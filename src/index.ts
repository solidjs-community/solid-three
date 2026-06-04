export { Canvas, type CanvasProps } from "./canvas.tsx"
export { Entity, Portal, Resource } from "./components.tsx"
export { $S3C } from "./constants.ts"
export { createEntity, createT } from "./create-t.tsx"
export { createXR, useXR } from "./create-xr.tsx"
export type { XRContext, XRState } from "./create-xr.tsx"
export { useFrame, useLoader, useThree } from "./hooks.ts"
export { Pointer, createThreeEvent, type PointerRaycaster } from "./pointers.ts"
export { useProps } from "./props.ts"
export * from "./raycasters.tsx"
export * as S3 from "./types.ts"
// Direct re-exports of types that users commonly need at the top level.
// `Register` is augmentable from `declare module "solid-three"` (see its
// JSDoc); `Renderer` and `ResolvedRenderer` show up in advanced typings.
export type { Plugin, Register, Renderer, ResolvedRenderer } from "./types.ts"
export { autodispose, getMeta, hasMeta, load, meta } from "./utils.ts"
