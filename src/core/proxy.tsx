import {
  Component,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  JSXElement,
  mapArray,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from 'solid-js'
import * as THREE from 'three'

import { useThree } from './hooks'
import { getRootState, prepare, useHelper } from './utils'

import { produce } from 'solid-js/store'
import type { Instance, ThreeElement } from '../three-types'

export const ParentContext = createContext<() => Instance>()

export type Constructor<Instance = any> = { new (...args: any[]): Instance }

export type ThreeComponent<Source extends Constructor> = Component<ThreeElement<Source>>
type ThreeComponentProxy<Source> = {
  [K in keyof Source]: Source[K] extends Constructor ? ThreeComponent<Source[K]> : undefined
}

export const makeThreeComponent = <TSource extends Constructor>(source: TSource): ThreeComponent<TSource> => {
  const Component = (props: any) => {
    const store = useThree()

    /* Create instance */
    const getInstance = createMemo(() => {
      try {
        const el = prepare(new source(...(props.args ?? []))) as Instance
        el.__r3f.root = store
        return el
      } catch (e) {
        console.error(e)
        throw new Error('')
      }
    })

    useInstance(getInstance, props)

    return <ParentContext.Provider value={getInstance}>{props.children}</ParentContext.Provider>
  }

  return Component
}

export function useInstance(getInstance: () => Instance, props: any) {
  const getParent = useContext(ParentContext)
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])

  /* Assign ref */
  createRenderEffect(() => props.ref instanceof Function && local.ref(getInstance()))

  /* Apply the props to THREE-instance */
  createRenderEffect(() => applyProps(getInstance(), instanceProps))

  /* Connect to parent */
  createRenderEffect(() => {
    const child = getInstance()
    const parent = getParent!()
    if (child instanceof THREE.Object3D && parent instanceof THREE.Object3D) {
      parent.add(child)
      onCleanup(() => parent.remove(child))
    }
    child.__r3f.parent = parent
    if (!parent.__r3f.objects.includes(child)) parent.__r3f.objects.push(child)

    onCleanup(() => {
      const index = parent.__r3f.objects.indexOf(child)
      if (index > -1) {
        parent.__r3f.objects.splice(index, 1)
      }
    })
  })

  /* Attach */
  createRenderEffect(() => {
    const child = getInstance()
    let attach: string | undefined = local.attach
    if (!attach) {
      if (child instanceof THREE.Material) attach = 'material'
      else if (child instanceof THREE.BufferGeometry) attach = 'geometry'
      else if (child instanceof THREE.Fog) attach = 'fog'
    }

    const parent = getParent!()

    /* If the instance has an "attach" property, attach it to the parent */
    if (attach) {
      if (attach in parent) {
        parent[attach] = child
        onCleanup(() => void (parent[attach!] = undefined))
      } else {
        console.error(`Property "${attach}" does not exist on parent "${parent.constructor.name}"`)
      }
    }
  })

  /* Automatically dispose */
  if ('dispose' in getInstance()) onCleanup(() => getInstance().dispose?.())

  createEffect(() => props.helper && useHelper(getInstance, props.helper))
}

export function Primitive<T extends Instance>(props: { object: T; children?: JSXElement }) {
  const store = useThree()

  /* Prepare instance */
  const instance = createMemo(() => {
    const obj = prepare(props.object)
    obj.__r3f.root = store
    return obj
  })

  useInstance(instance, props)

  return <ParentContext.Provider value={instance}>{props.children}</ParentContext.Provider>
}

/**
 * Convenience method for setting (potentially nested) properties on an object.
 */
export const applyProp = (object: Instance, props: { [key: string]: any }, key: string) => {
  const rootState = getRootState(object as any as THREE.Object3D)
  /* If the key contains a hyphen, we're setting a sub property. */
  if (key.indexOf('-') > -1) {
    const [property, ...rest] = key.split('-')
    applyProps(object[property], { [rest.join('-')]: props[key] })
    return
  }

  /* If the property exposes a `setScalar` function, we'll use that */
  if (object[key]?.setScalar && typeof props[key] === 'number') {
    object[key].setScalar(props[key])
    return
  }

  /* If the property exposes a `copy` function and the value is of the same type,
     we'll use that. (Vectors, Eulers, Quaternions, ...) */
  if (object[key]?.copy && object[key].constructor === props[key]?.constructor) {
    object[key].copy(props[key])
    return
  }

  /* If the property exposes a `set` function, we'll use that. */
  if (object[key]?.set) {
    Array.isArray(props[key]) ? object[key].set(...props[key]) : object[key].set(props[key])
    return
  }

  /* If we got here, we couldn't do anything special, so let's just check if the
     target property exists and assign it directly. */
  if (key in object) {
    object[key] = props[key]
  }

  if (!rootState) return

  /* If prop is an event-handler */
  if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key)) {
    object.__r3f.handlers[key] = props[key]
    object.__r3f.eventCount = Object.keys(object.__r3f.handlers).length

    if (rootState.internal && object.raycast) {
      const index = untrack(() => rootState.internal.interaction.indexOf(object as unknown as THREE.Object3D))
      if (object.__r3f.eventCount && index === -1) {
        rootState.set('internal', 'interaction', (arr) => [...arr, object as unknown as THREE.Object3D])
      } else if (!object.__r3f.eventCount && index !== -1) {
        rootState.set(
          'internal',
          'interaction',
          produce((arr) => arr.splice(index, 1)),
        )
      }
    }
  }
}

export const applyProps = (object: Instance, props: { [key: string]: any }) =>
  createRenderEffect(
    mapArray(
      () => Object.keys(props),
      (key) => {
        /* We wrap it in an effect only if a prop is a getter or a function */
        const descriptors = Object.getOwnPropertyDescriptor(props, key)
        const isDynamic = descriptors?.get || typeof descriptors?.value === 'function'
        const update = () => applyProp(object, props, key)
        isDynamic ? createRenderEffect(update) : update()
      },
    ),
  )

const cache = {} as Record<string, ThreeComponent<any>>

export function makeThreeComponentProxy<Source extends Record<string, any>>(
  source: Source,
): ThreeComponentProxy<Source> {
  return new Proxy<ThreeComponentProxy<Source>>({} as ThreeComponentProxy<Source>, {
    get: (_, name: string) => {
      /* Create and memoize a wrapper component for the specified property. */
      if (!cache[name]) {
        /* Try and find a constructor within the THREE namespace. */
        const constructor = source[name as keyof Source]

        /* If nothing could be found, bail. */
        if (!constructor) return undefined

        /* Otherwise, create and memoize a component for that constructor. */
        cache[name] = makeThreeComponent(constructor)
      }

      return cache[name]
    },
  })
}

/**
 * The `solid-three` reactor. For every class exposed by `THREE`, this object contains a
 * `solid-three` component that wraps the class.
 */
export const T = /*#__PURE__*/ makeThreeComponentProxy(THREE)
