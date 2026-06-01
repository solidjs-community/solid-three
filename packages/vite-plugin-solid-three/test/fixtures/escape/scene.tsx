import { T } from "./catalog.ts"
// T escapes as a whole value into a function — the bundler can't see which keys
// are used, so it must keep the entire catalogue (sound deopt).
function sink(value: unknown) {
  return value
}
export const leaked = sink(T)
