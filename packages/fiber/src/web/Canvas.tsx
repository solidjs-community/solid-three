import { ComponentProps, JSX, createComputed, onMount, splitProps } from 'solid-js'
import * as THREE from 'three'

import { createRoot, extend } from '../core/index'
import { createPointerEvents } from './events'

import type { DomEvent } from '../core/events'
import type { RenderProps } from '../core/index'
import { processProps } from '../utils/processProps'

export interface CanvasProps extends Omit<RenderProps<HTMLCanvasElement>, 'size'>, ComponentProps<'div'> {
  children: JSX.Element
  /** Canvas fallback content, similar to img's alt prop */
  fallback?: JSX.Element
  /**
   * Options to pass to useMeasure.
   * @see https://github.com/pmndrs/react-use-measure#api
   */
  resize?: any //ResizeOptions
  /** The target where events are being subscribed to, default: the div that wraps canvas */
  eventSource?: HTMLElement
  /** The event prefix that is cast into canvas pointer x/y events, default: "offset" */
  eventPrefix?: 'offset' | 'client' | 'page' | 'layer' | 'screen'

  style?: JSX.CSSProperties
}

export interface Props extends CanvasProps {}
/**
 * A DOM canvas which accepts threejs elements as children.
 * @see https://docs.pmnd.rs/react-three-fiber/api/canvas
 */
export function Canvas(props: Props) {
  const [_, rest] = splitProps(props, [
    'children',
    'fallback',
    'resize',
    'style',
    'gl',
    'events',
    'eventSource',
    'eventPrefix',
    'shadows',
    'linear',
    'flat',
    'legacy',
    'orthographic',
    'frameloop',
    'dpr',
    'performance',
    'raycaster',
    'camera',
    'onPointerMissed',
    'onCreated',
    'scene',
  ])

  // Create a known catalogue of Threejs-native elements
  // This will include the entire THREE namespace by default, users can extend
  // their own elements by using the createRoot API instead
  createComputed(() => extend(THREE as any), [])

  const [, threeProps] = processProps(
    props,
    {
      events: createPointerEvents,
    },
    ['children'],
  )
  // const [containerRef, containerRect] = useMeasure({ scroll: true, debounce: { scroll: 50, resize: 0 }, ...resize })
  let containerRef: HTMLDivElement = null!,
    canvasRef: HTMLCanvasElement = null!,
    divRef: HTMLDivElement = null!

  onMount(() => {
    let size = canvasRef.parentElement?.getBoundingClientRect() ?? {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
    }

    let root = createRoot<HTMLCanvasElement>(canvasRef)
    root.configure({
      ...threeProps,
      size,
      // Pass mutable reference to onPointerMissed so it's free to update
      onPointerMissed: (...args) => props.onPointerMissed?.(...args),
      onCreated: (state) => {
        // Connect to event source
        state.events.connect?.(props.eventSource ? props.eventSource : divRef)
        // Set up compute function
        if (props.eventPrefix) {
          state.setEvents({
            compute: (event, state) => {
              const x = event[(props.eventPrefix + 'X') as keyof DomEvent] as number
              const y = event[(props.eventPrefix + 'Y') as keyof DomEvent] as number
              state.pointer.set((x / state.size.width) * 2 - 1, -(y / state.size.height) * 2 + 1)
              state.raycaster.setFromCamera(state.pointer, state.camera)
            },
          })
        }
        // Call onCreated callback
        props.onCreated?.(state)
      },
    })

    root.render(() => props.children)
  })

  // When the event source is not this div, we need to set pointer-events to none
  // Or else the canvas will block events from reaching the event source
  const pointerEvents = props.eventSource ? 'none' : 'auto'

  return (
    <div
      ref={divRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        'pointer-events': pointerEvents,
        ...props.style,
      }}
      {...rest}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }}>
          {props.fallback}
        </canvas>
      </div>
    </div>
  )
}
