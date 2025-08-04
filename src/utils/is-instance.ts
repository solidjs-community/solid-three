import type { Instance } from "src/types.ts"
import { $S3C } from "../constants.ts"

export const isInstance = (element: any): element is Instance =>
  typeof element === "object" && $S3C in element
