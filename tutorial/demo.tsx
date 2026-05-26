import type { JSX } from "solid-js"

export interface DemoProps {
  code: string
  children?: JSX.Element
}

export function Demo(props: DemoProps) {
  return (
    <div class="demo demo-stub">
      <pre class="demo-code">
        <code>{props.code}</code>
      </pre>
      <div class="demo-canvas-placeholder">
        canvas placeholder (REPL integration pending — Task 7)
      </div>
    </div>
  )
}
