import { For } from "solid-js"
import { parts } from "./chapter-loader"
import { useActiveSection } from "./use-active-section"

export function Sidebar() {
  const activeId = useActiveSection(".tutorial-chapter")
  return (
    <nav class="sidebar">
      <For each={parts}>
        {part => (
          <div class="sidebar-part">
            <h3 class="sidebar-part-title">
              Part {part.part}: {part.title}
            </h3>
            <ul class="sidebar-chapter-list">
              <For each={part.chapters}>
                {chapter => (
                  <li>
                    <a
                      href={`#${chapter.frontmatter.id}`}
                      classList={{ active: activeId() === chapter.frontmatter.id }}
                    >
                      {chapter.frontmatter.title}
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </div>
        )}
      </For>
    </nav>
  )
}
