import { T } from "./catalog.ts"
// default export so `lazy(() => import("./Heavy.tsx"))` typechecks
export default function Heavy() {
  return <T.DodecahedronGeometry />
}
