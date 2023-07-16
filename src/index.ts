export { createEvents } from './core/events'
export { addAfterEffect, addEffect, addTail } from './core/loop'
export { FixedStage, Stage, Stages } from './core/stages'
export { applyProps, dispose, getRootState } from './core/utils'

export type { ComputeFunction, EventManager, Events, Intersection, ThreeEvent } from './core/events'
export type { Camera, ObjectMap } from './core/utils'
export type { Dpr, Performance, RenderCallback, RootState, Size, Subscription, Viewport } from './solid/store'

export * from './solid'

export { createPointerEvents as events } from './web/events'

export type { ThreeTypes }
import * as ThreeTypes from './three-types'
