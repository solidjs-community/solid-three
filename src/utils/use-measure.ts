import { createMemo, createRenderEffect, createSignal, merge } from "solid-js"
import { debounce as createDebounce } from "./debounce.ts"

declare type ResizeObserverCallback = (entries: any[], observer: ResizeObserver) => void
declare class ResizeObserver {
  constructor(callback: ResizeObserverCallback)
  observe(target: Element, options?: any): void
  unobserve(target: Element): void
  disconnect(): void
  static toString(): string
}

export interface Measure {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

type HTMLOrSVGElement = HTMLElement | SVGElement

export type UseMeasureOptions = {
  debounce?: number | { scroll: number; resize: number }
  scroll?: boolean
  polyfill?: { new (cb: ResizeObserverCallback): ResizeObserver }
  offsetSize?: boolean
}

export function useMeasure(options?: UseMeasureOptions) {
  const config = merge(
    {
      debounce: 0,
      scroll: false,
      offsetSize: false,
    },
    options ?? {},
  )

  const ResizeObserver =
    config.polyfill ||
    (typeof globalThis === "undefined"
      ? class ResizeObserver {}
      : (globalThis as any).ResizeObserver)

  if (!ResizeObserver) {
    throw new Error(
      "This browser does not support ResizeObserver out of the box. See: https://github.com/react-spring/react-use-measure/#resize-observer-polyfills",
    )
  }

  const [element, setElement] = createSignal<HTMLOrSVGElement | null>(null)
  const [bounds, setBounds] = createSignal<Measure>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
  })
  const scrollContainers = createMemo(() => findScrollContainers(element()))
  let lastBounds: Measure | undefined

  const getDebounce = (type: "scroll" | "resize") => {
    const debounce = config.debounce
      ? typeof config.debounce === "number"
        ? config.debounce
        : config.debounce[type]
      : null
    if (debounce) return createDebounce(forceRefresh, debounce)
    return forceRefresh
  }

  function forceRefresh() {
    const el = element()
    if (!el) return

    const { left, top, width, height, bottom, right, x, y } =
      el.getBoundingClientRect() as unknown as Measure

    const bounds = {
      left,
      top,
      width,
      height,
      bottom,
      right,
      x,
      y,
    }

    if (el instanceof HTMLElement && config.offsetSize) {
      bounds.height = el.offsetHeight
      bounds.width = el.offsetWidth
    }

    Object.freeze(bounds)

    if (!lastBounds || !areBoundsEqual(lastBounds, bounds)) {
      lastBounds = bounds
      setBounds(bounds)
    }
  }

  createRenderEffect(
    () => {
      const onScroll = getDebounce("scroll")

      // Global scroll listener — child created in compute phase ✓
      createRenderEffect(
        () => config.scroll,
        scroll => {
          if (!scroll) return
          globalThis.addEventListener("scroll", onScroll, { capture: true, passive: true })
          return () => globalThis.removeEventListener("scroll", onScroll, true)
        },
      )

      // Per-container scroll listeners — child created in compute phase ✓
      createRenderEffect(
        () => scrollContainers(),
        containers => {
          if (!config.scroll || !containers) return
          containers.forEach(c =>
            c.addEventListener("scroll", onScroll, { capture: true, passive: true }),
          )
          return () => containers.forEach(c => c.removeEventListener("scroll", onScroll, true))
        },
      )
    },
    () => {},
  )

  // Global resize listener — tracks debounce config changes
  createRenderEffect(
    () => getDebounce("resize"),
    onResize => {
      globalThis.addEventListener("resize", onResize)
      return () => globalThis.removeEventListener("resize", onResize)
    },
  )

  // Element resize observer — re-runs when element or debounce config changes
  createRenderEffect(
    () => ({ el: element(), onResize: getDebounce("resize") }),
    ({ el, onResize }) => {
      if (!el) return
      const observer = new ResizeObserver(onResize)
      observer.observe(el)
      return () => observer.disconnect()
    },
  )

  return {
    setElement: (source: HTMLOrSVGElement | null) => {
      if (!source || source === element()) return
      setElement(source)
    },
    bounds,
    forceRefresh,
  }
}

// Returns a list of scroll offsets
function findScrollContainers(element: HTMLOrSVGElement | null): HTMLOrSVGElement[] {
  const result: HTMLOrSVGElement[] = []
  if (!element || element === document.body) return result
  const { overflow, overflowX, overflowY } = globalThis.getComputedStyle(element)
  if ([overflow, overflowX, overflowY].some(prop => prop === "auto" || prop === "scroll"))
    result.push(element)
  return [...result, ...findScrollContainers(element.parentElement)]
}

// Checks if element boundaries are equal
const keys: (keyof Measure)[] = ["x", "y", "top", "bottom", "left", "right", "width", "height"]
const areBoundsEqual = (a: Measure, b: Measure): boolean => keys.every(key => a[key] === b[key])
