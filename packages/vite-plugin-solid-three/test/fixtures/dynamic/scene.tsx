import { T } from "./catalog.ts"
const key = (globalThis as Record<string, unknown>).key as string
export const used = (T as Record<string, unknown>)[key]
