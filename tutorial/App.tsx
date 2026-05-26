import Hello, { frontmatter } from "./chapters/00-hello.mdx"

export function App() {
  return (
    <main>
      <p>Frontmatter: {JSON.stringify(frontmatter)}</p>
      <Hello />
    </main>
  )
}
