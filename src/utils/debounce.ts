// Interpolated from https://github.com/sindresorhus/debounce

type DebouncedFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => ReturnType<T> & { clear: () => void; flush: () => void; trigger: () => void }

/**
Creates a debounced function that delays execution until `wait` milliseconds have passed since its last invocation.

Set the `immediate` option to `true` to execute the function immediately at the start of the `wait` interval, preventing issues such as double-clicks on a button.

The returned function has the following methods:

- `.clear()` cancels any scheduled executions.
- `.flush()` if an execution is scheduled then it will be immediately executed and the timer will be cleared.
- `.trigger()` executes the function immediately and clears the timer if it was previously set.
*/
export function debounce<T extends () => any>(
  callback: T,
  wait = 100,
  options = {} as { immediate?: boolean },
): DebouncedFunction<T> {
  if (typeof callback !== "function") {
    throw new TypeError(
      `Expected the first parameter to be a function, got \`${typeof callback}\`.`,
    )
  }

  if (wait < 0) {
    throw new RangeError("`wait` must not be negative.")
  }

  const { immediate } = options

  let storedContext: any
  let storedArguments: Parameters<T>
  let timeoutId: ReturnType<typeof setTimeout>
  let timestamp: number
  let result: ReturnType<T>

  function run() {
    const callContext = storedContext
    const callArguments = storedArguments
    storedContext = undefined
    // @ts-expect-error TODO: fix type-error
    storedArguments = undefined
    result = callback.apply(callContext, callArguments)
    return result
  }

  function later() {
    const last = Date.now() - timestamp

    if (last < wait && last >= 0) {
      timeoutId = setTimeout(later, wait - last)
    } else {
      // @ts-expect-error TODO: fix type-error
      timeoutId = undefined

      if (!immediate) {
        result = run()
      }
    }
  }

  function debounced(...args: Parameters<T>) {
    // @ts-expect-error TODO: fix type-error
    if (storedContext && this !== storedContext) {
      throw new Error("Debounced method called with different contexts.")
    }

    // @ts-expect-error TODO: fix type-error
    storedContext = this
    storedArguments = args
    timestamp = Date.now()

    const callNow = immediate && !timeoutId

    // eslint-disable-next-line
    if (!timeoutId) {
      timeoutId = setTimeout(later, wait)
    }

    // eslint-disable-next-line
    if (callNow) {
      result = run()
    }

    return result
  }

  debounced.clear = () => {
    // eslint-disable-next-line
    if (!timeoutId) return
    clearTimeout(timeoutId)
    // @ts-expect-error TODO: fix type-error
    timeoutId = undefined
  }

  debounced.flush = () => {
    // eslint-disable-next-line
    if (!timeoutId) return
    debounced.trigger()
  }

  debounced.trigger = () => {
    result = run()
    debounced.clear()
  }

  return debounced
}
