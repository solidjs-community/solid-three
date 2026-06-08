import type { SupportedRenderer } from "solid-three"

// The site demos both WebGL and WebGPU renderers across different snippets.
// Widen ResolvedRenderer (which defaults to WebGLRenderer) to the open
// SupportedRenderer union so factory snippets like `gl={canvas => new
// WebGPURenderer({ canvas })}` type-check. WebGL-specific snippets that call
// WebGL-only methods narrow via a cast at the call site.
declare module "solid-three" {
  interface Register {
    renderer: SupportedRenderer
  }
}
