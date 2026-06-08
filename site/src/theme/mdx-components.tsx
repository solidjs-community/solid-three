/**
 * Components exported from this file are picked up by SolidBase's virtual
 * `mdx-components` module (see `componentsPath` in `vite.config.ts`) and made
 * globally available inside every `.mdx` route. The `<Demo>` REPL block is
 * referenced from every chapter, so we expose it here once.
 *
 * Demo is wrapped in `clientOnly` so the module — which pulls in
 * `@bigmistqke/repl` and dynamically loads TypeScript from a CDN — never
 * loads during SSR/prerender. SSR emits nothing for the slot and the real
 * component mounts after hydration.
 */
import { clientOnly } from "@solidjs/start"

import "./style.css"

export const Demo = clientOnly(() => import("../components/demo.tsx"))
