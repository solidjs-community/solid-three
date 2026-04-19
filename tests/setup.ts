// Patch console.warn to include a stack trace for "Signal was written to in an owned scope"
const _warn = console.warn.bind(console)
console.warn = (...args: any[]) => {
  _warn(...args)
  if (typeof args[0] === "string" && args[0].includes("Signal was written")) {
    console.trace("↑ stack trace for above warning")
  }
}

// jsdom does not include ResizeObserver — provide a mock that immediately invokes the callback
// on observe() so that useMeasure picks up the canvas dimensions.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      // Defer to match real browser behaviour — ResizeObserver callbacks are never synchronous.
      // Firing synchronously here writes a signal inside a reactive effect, triggering a warning.
      queueMicrotask(() => this.callback([] as unknown as ResizeObserverEntry[], this))
    }

    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
