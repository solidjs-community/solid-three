

import { addAfterEffect, addEffect, addTail } from '../core/loop'
import { applyProps, dispose, getRootState } from '../core/utils'

import { context } from './context'
import { createRoot } from './renderer'
export * from './hooks'
export * from "./renderer"

export {
  addAfterEffect, addEffect, addTail,
  // createPortal,
  applyProps, context, createRoot, dispose, getRootState
}

