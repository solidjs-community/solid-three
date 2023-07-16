
import { createRoot } from 'solid-js'

import { addAfterEffect, addEffect, addTail } from '../core/loop'
import { applyProps, dispose, getRootState } from '../core/utils'

import { context } from './context'
export * from './hooks'
export * from "./renderer"

export {
  addAfterEffect, addEffect, addTail,
  // createPortal,
  applyProps, context, createRoot, dispose, getRootState
}

