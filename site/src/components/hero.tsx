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

  // Same-route navigation doesn't remount Hero, so clicking the title link in
  // the header (which points to "/") while already on "/" wouldn't normally
  // pick a new demo. Listen for clicks on any anchor to "/" and re-roll.
  onMount(() => {
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      const url = new URL(href, window.location.href)
      if (url.pathname !== "/") return
      setChosen(pickRandomDemo())
      setEditorOpen(false)
    }
    document.addEventListener("click", handler)
    onCleanup(() => document.removeEventListener("click", handler))
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
