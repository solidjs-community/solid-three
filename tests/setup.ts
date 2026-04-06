// jsdom does not include ResizeObserver — provide a mock that immediately invokes the callback
// on observe() so that useMeasure picks up the canvas dimensions.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe(target: Element) {
      // Immediately fire the callback so useMeasure calls forceRefresh() synchronously.
      this.callback([] as unknown as ResizeObserverEntry[], this)
    }

    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
