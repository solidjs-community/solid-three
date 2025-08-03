import { S3 } from "../index.ts"
import { $S3C } from "../augment.ts"

export const isInstance = (element: any): element is S3.Instance =>
  typeof element === "object" && $S3C in element
