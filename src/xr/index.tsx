/**
 * `solid-three/xr` — everything WebXR, kept out of core so the base package
 * stays XR-free. Session entry/exit (`createXR` / `useXR`) plus the composable
 * controller-events plugin (`xrEvents`).
 */
export { createXR, useXR } from "./create-xr.tsx"
export type { XRContext, XRState } from "./create-xr.tsx"
export { XRControllerSource, xrEvents } from "./events.ts"
export type { XRThreeEvent } from "./events.ts"
