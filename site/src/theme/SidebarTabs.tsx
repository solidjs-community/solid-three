import { A, useLocation } from "@solidjs/router"
import { createEffect } from "solid-js"

import styles from "./SidebarTabs.module.css"

// SolidBase only opens a sidebar section when its `collapsed` flag is false
// (Collapsible defaultOpen) — it never expands the section holding the active
// page. We can't key off the active link: Kobalte unmounts a collapsed
// section's content, so that link isn't in the DOM until its section is open.
// Instead match on the URL — /api/<group>/<page>, where <group> capitalized is
// the section heading ("components" -> "Components") — and click open the
// matching still-collapsed trigger (Kobalte marks closed ones `data-closed`).
function expandActiveSection(pathname: string) {
  const segments = pathname.split("/")
  if (segments[1] !== "api" || segments.length < 4) return
  const group = segments[2]
  const heading = group.charAt(0).toUpperCase() + group.slice(1)
  document.querySelectorAll<HTMLElement>('[class*="section-trigger"]').forEach(trigger => {
    if (trigger.textContent?.trim() === heading && trigger.hasAttribute("data-closed")) {
      trigger.click()
    }
  })
}

// location.pathname carries the deploy base (e.g. /solid-three) under a
// subpath deploy, so strip it before matching app-relative routes.
const BASE_PREFIX = import.meta.env.BASE_URL.replace(/\/+$/, "")

export default function SidebarTabs() {
  const location = useLocation()
  const relativePath = () => {
    const path = location.pathname
    return BASE_PREFIX && path.startsWith(BASE_PREFIX) ? path.slice(BASE_PREFIX.length) || "/" : path
  }
  // The home page falls back to the tour sidebar, so anything that isn't
  // under /api counts as the Tour tab.
  const isApi = () => relativePath().startsWith("/api")

  createEffect(() => {
    const pathname = relativePath() // re-run on navigation
    // Defer a frame so the sidebar triggers for the new route are in the DOM.
    requestAnimationFrame(() => expandActiveSection(pathname))
  })

  return (
    <div class={styles.tabs}>
      <A
        class={styles.tab}
        href="/tour/00-getting-started"
        aria-current={isApi() ? undefined : "page"}
      >
        Tour
      </A>
      <A
        class={styles.tab}
        href="/api/components/canvas"
        aria-current={isApi() ? "page" : undefined}
      >
        API
      </A>
    </div>
  )
}
