import { render } from "solid-js/web"
import { MDXProvider } from "solid-mdx"
import { App } from "./App"
import { mdxComponents } from "./mdx-components"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("#root not found")
render(
  () => (
    <MDXProvider components={mdxComponents}>
      <App />
    </MDXProvider>
  ),
  root,
)
