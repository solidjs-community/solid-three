import { A, useLocation } from "@solidjs/router"
import { createEffect } from "solid-js"

import styles from "./SidebarTabs.module.css"

// SolidBase only opens a sidebar section when its `collapsed` flag is false
// (Collapsible defaultOpen) — it never expands the section that holds the
// active page. So after each navigation, find the active link and click open
// its section if it's still collapsed. Kobalte marks a closed trigger with
// `data-closed`; solid-router marks the exact-active link `aria-current=page`.
function expandActiveSection() {
  const actives = document.querySelectorAll('[class*="sidenav-link"][aria-current="page"]')
  actives.forEach(active => {
    const section = active.closest('[class*="section-content"]')?.closest("li")
    const trigger = section?.querySelector<HTMLElement>('[class*="section-trigger"]')
    if (trigger?.hasAttribute("data-closed")) trigger.click()
  })
}

export default function SidebarTabs() {
  const location = useLocation()
  // The home page falls back to the tour sidebar, so anything that isn't
  // under /reference counts as the Tour tab.
  const isReference = () => location.pathname.startsWith("/reference")

  createEffect(() => {
    location.pathname // re-run on navigation
    // Defer past the reactive DOM update so aria-current / data-closed reflect
    // the new route before we read them.
    requestAnimationFrame(expandActiveSection)
  })

  return (
    <div class={styles.tabs}>
      <A
        class={styles.tab}
        href="/tour/00-getting-started"
        aria-current={isReference() ? undefined : "page"}
      >
        Tour
      </A>
      <A
        class={styles.tab}
        href="/reference/components/canvas"
        aria-current={isReference() ? "page" : undefined}
      >
        Reference
      </A>
    </div>
  )
}
