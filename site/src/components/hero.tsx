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
  // `loaded` snaps the fill bar to full width once the demo iframe is ready;
  // `barMounted` keeps it on screen for a beat afterwards before it vanishes.
  const [loaded, setLoaded] = createSignal(false)
  const [barMounted, setBarMounted] = createSignal(true)
  const [source] = createResource(chosen, demo => demo.loadSource())
  let root: HTMLDivElement | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function onDemoReady() {
    setLoaded(true)
    hideTimer = setTimeout(() => setBarMounted(false), 500)
  }
  function resetLoadingBar() {
    if (hideTimer) clearTimeout(hideTimer)
    setLoaded(false)
    setBarMounted(true)
  }
  onCleanup(() => {
    if (hideTimer) clearTimeout(hideTimer)
  })

  // SolidBase wraps page content in <article> with side margins + a centered
  // max-width content column. Flag our containing article so CSS can drop
  // those constraints — Hero needs the full main-pane area.
  onMount(() => {
    const article = root?.closest("article")
    article?.classList.add("article-fullbleed")
    onCleanup(() => article?.classList.remove("article-fullbleed"))
  })

  // Same-route navigation doesn't remount Hero, so clicking SolidBase's
  // title link (href="/") while already on "/" wouldn't normally pick a new
  // demo. Wire a click handler on that specific element.
  onMount(() => {
    const homeLink = document.querySelector<HTMLAnchorElement>('header a[href="/"]')
    if (!homeLink) return
    const handler = () => {
      resetLoadingBar()
      setChosen(pickRandomDemo())
      setEditorOpen(false)
    }
    homeLink.addEventListener("click", handler)
    onCleanup(() => homeLink.removeEventListener("click", handler))
  })

  return (
    <div class="hero" ref={root}>
      <LazyPicker onPick={setChosen} />
      <Show when={barMounted()}>
        <div
          class="hero-loading-bar"
          classList={{ "is-loaded": loaded() }}
          role="progressbar"
          aria-label="Loading demo"
        />
      </Show>
      <Show when={chosen() && source()}>
        {sourceText => (
          <div class="hero-canvas">
            <LazyDemo
              code={sourceText()}
              url={chosen()?.url ?? ""}
              editorHidden={!editorOpen()}
              onReady={onDemoReady}
            />
          </div>
        )}
      </Show>
      <Show when={chosen()}>
        <button
          type="button"
          class="hero-edit-toggle"
          onClick={() => startTransition(() => setEditorOpen(value => !value))}
        >
          {editorOpen() ? "close" : "edit"}
        </button>
      </Show>
    </div>
  )
}
