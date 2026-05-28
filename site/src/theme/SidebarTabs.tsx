import { A, useLocation } from "@solidjs/router"

import styles from "./SidebarTabs.module.css"

export default function SidebarTabs() {
  const location = useLocation()
  // The home page falls back to the tour sidebar, so anything that isn't
  // under /reference counts as the Tour tab.
  const isReference = () => location.pathname.startsWith("/reference")

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
