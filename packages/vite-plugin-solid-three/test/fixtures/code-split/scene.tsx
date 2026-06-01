import { lazy } from "solid-js"
const Heavy = lazy(() => import("./Heavy.tsx"))
export function Scene() {
  return Heavy
}
