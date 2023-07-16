export * from './core'
export { createEvents } from './core/events'
export type { ComputeFunction, EventManager, Events, Intersection, ThreeEvent } from './core/events'
export { addAfterEffect, addEffect, addTail } from './core/loop'
export { FixedStage, Stage, Stages } from './core/stages'
export type { Dpr, Performance, RenderCallback, RootState, Size, Subscription, Viewport } from './core/store'
export { applyProps, dispose, getRootState } from './core/utils'
export type { Camera, ObjectMap } from './core/utils'

export * from './solid'
export * from './solid/components'
export { defaultProxy as T } from './solid/components'
export * from './solid/hooks'
export * from './solid/useHelper'
export * from './solid/web/Canvas'
export { createPointerEvents as events } from './web/events'

export type { ThreeTypes }
import * as ThreeTypes from './three-types'

