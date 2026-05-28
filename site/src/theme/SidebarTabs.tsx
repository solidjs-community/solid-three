import { A, useLocation } from "@solidjs/router"

import styles from "./SidebarTabs.module.css"

export default function SidebarTabs() {
  const location = useLocation()
  // The home page falls back to the tutorial sidebar, so anything that isn't
  // under /api counts as the Tutorial tab.
  const isApi = () => location.pathname.startsWith("/api")

  return (
    <div class={styles.tabs}>
      <A
        class={styles.tab}
        href="/tutorial/00-getting-started"
        aria-current={isApi() ? undefined : "page"}
      >
        Tour
      </A>
      <A
        class={styles.tab}
        href="/api/components/canvas"
        aria-current={isApi() ? "page" : undefined}
      >
        Reference
      </A>
    </div>
  )
}
