import { createSignal, onCleanup, onMount } from "solid-js"

export function useActiveSection(selector: string) {
  const [activeId, setActiveId] = createSignal<string | null>(null)

  onMount(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)
        if (visible[0]) {
          const id = visible[0].target.id
          setActiveId(id)
          if (id && history.replaceState) {
            history.replaceState(null, "", `#${id}`)
          }
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0 },
    )

    for (const element of elements) observer.observe(element)
    onCleanup(() => observer.disconnect())
  })

  return activeId
}
