import { For } from "solid-js"
import { chapters } from "./chapter-loader"
import { Sidebar } from "./sidebar"

export function App() {
  return (
    <div class="tutorial-layout">
      <Sidebar />
      <main class="tutorial-body">
        <For each={chapters}>
          {chapter => {
            const Chapter = chapter.default
            return (
              <section id={chapter.frontmatter.id} class="tutorial-chapter">
                <Chapter />
              </section>
            )
          }}
        </For>
      </main>
    </div>
  )
}
