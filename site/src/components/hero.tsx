import { clientOnly } from "@solidjs/start"
import { createResource, createSignal, onCleanup, onMount, Show, startTransition } from "solid-js"
import { pickRandomDemo, type Demo } from "../snippets/gallery"

const LazyDemo = clientOnly(() => import("./demo"))

function PickDemo(props: { onPick: (demo: Demo) => void }) {
  props.onPick(pickRandomDemo())
  return null
}

const LazyPicker = clientOnly(() => Promise.resolve({ default: PickDemo as any }))

export function Hero() {
  const [editorOpen, setEditorOpen] = createSignal(false)
  const [chosen, setChosen] = createSignal<Demo | undefined>()
  const [source] = createResource(chosen, demo => demo.loadSource())
  let root: HTMLDivElement | undefined

  // SolidBase wraps page content in <article> with side margins + a centered
  // max-width content column. Flag our containing article so CSS can drop
  // those constraints — Hero needs the full main-pane area.
  onMount(() => {
    const article = root?.closest("article")
    article?.classList.add("article-fullbleed")
    onCleanup(() => article?.classList.remove("article-fullbleed"))
  })

  return (
    <div class="hero" ref={root}>
      <LazyPicker onPick={setChosen} />
      <Show when={chosen() && source()}>
        {sourceText => (
          <div class="hero-canvas">
            <LazyDemo code={sourceText()} url={chosen()?.url ?? ""} editorHidden={!editorOpen()} />
          </div>
        )}
      </Show>
      <Show when={chosen()}>
        <button
          type="button"
          class="hero-edit-toggle"
          onClick={() => startTransition(() => setEditorOpen(value => !value))}
        >
          {editorOpen() ? "close editor" : "edit"}
        </button>
      </Show>
    </div>
  )
}
