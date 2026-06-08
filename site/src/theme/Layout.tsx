/**
 * SolidBase only lets a theme override the `Layout` and `mdx-components` files;
 * inner components (Header, the sidebar Navigation, etc.) are read from the
 * shared `defaultThemeComponents` object at render time. The sidebar renders a
 * `ProjectSelector` at the top of its content — inert here since we have a
 * single project — so we swap that slot for our Tutorial / API reference tabs.
 */
import { defaultThemeComponents } from "@kobalte/solidbase/default-theme/default-components.js"

import SidebarTabs from "./SidebarTabs.tsx"

defaultThemeComponents.ProjectSelector = SidebarTabs

export { default } from "@kobalte/solidbase/default-theme/Layout.jsx"
