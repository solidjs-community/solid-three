import { For } from "solid-js"
import { chapters } from "./chapter-loader"

export function App() {
  return (
    <main>
      <For each={chapters}>
        {chapter => {
          const Chapter = chapter.default
          return (
            <section id={chapter.frontmatter.id}>
              <Chapter />
            </section>
          )
        }}
      </For>
    </main>
  )
}
