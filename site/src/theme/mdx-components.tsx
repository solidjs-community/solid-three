/**
 * Components exported from this file are picked up by SolidBase's virtual
 * `mdx-components` module (see `componentsPath` in `vite.config.ts`) and made
 * globally available inside every `.mdx` route. The `<Demo>` REPL block is
 * referenced from every chapter, so we expose it here once.
 */
import "./style.css"

export { Demo } from "../components/demo"
