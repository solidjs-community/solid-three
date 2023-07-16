import {
  Component,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  JSXElement,
  onCleanup,
  splitProps,
  untrack,
  useContext,
} from 'solid-js'
import * as THREE from 'three'

import { getRootState, prepare } from '../core/utils'
import { useThree } from './hooks'
import { useHelper } from './useHelper'

import { produce } from 'solid-js/store'
import type { Instance, ThreeElement } from '../three-types'

export const ParentContext = createContext<() => Instance>()

export type Constructor<Instance = any> = { new (...args: any[]): Instance }

export type ThreeComponent<Source extends Constructor> = Component<ThreeElement<Source>>
type ThreeComponentProxy<Source> = {
  [K in keyof Source]: Source[K] extends Constructor ? ThreeComponent<Source[K]> : undefined
}

let DEBUG = false
export const makeThreeComponent = <TSource extends Constructor>(source: TSource): ThreeComponent<TSource> => {
  let Component = (props: any) => {
    const getParent = useContext(ParentContext)
    const store = useThree()

    /* Create instance */
    const getInstance = createMemo(() => {
      try {
        DEBUG && console.log('three', 'createInstance', source, props.args, getParent)
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
  const store = useThree()
  const [local, instanceProps] = splitProps(props, ['ref', 'args', 'object', 'attach', 'children'])
  createRenderEffect(() => {
    /* Assign ref */
    if (props.ref instanceof Function) local.ref(getInstance())
  })

  createRenderEffect(() => {
    /* Apply props */
    applyProps(getInstance(), instanceProps)
  })

  /* Connect to parent */
  createRenderEffect(() => {
    let ins = getInstance()
    let par = getParent!()
    if (ins instanceof THREE.Object3D && par instanceof THREE.Object3D) {
      DEBUG && console.log('three', 'insertNode', ins, par)
      par.add(ins)
      onCleanup(() => {
        DEBUG && console.log('three', 'removeNode', ins, par)
        par.remove(ins)
      })
    }
    ins.__r3f.parent = par
    if (!par.__r3f.objects.includes(ins)) par.__r3f.objects.push(ins)

    onCleanup(() => {
      const index = par.__r3f.objects.indexOf(ins)
      if (index > -1) {
        par.__r3f.objects.splice(index, 1)
      }
    })
  })

  /* Attach */
  createRenderEffect(() => {
    let attach: string | undefined = local.attach
    let ins = getInstance()
    if (!attach) {
      if (ins instanceof THREE.Material) attach = 'material'
      else if (ins instanceof THREE.BufferGeometry) attach = 'geometry'
      else if (ins instanceof THREE.Fog) attach = 'fog'
    }

    let parentNode = getParent!()

    /* If the instance has an "attach" property, attach it to the parent */
    if (attach) {
      if (attach in parentNode) {
        DEBUG && console.log('three', 'attach', attach, ins, parentNode)
        parentNode[attach] = ins
        onCleanup(() => void (parentNode[attach!] = undefined))
      } else {
        console.error(`Property "${attach}" does not exist on parent "${parentNode.constructor.name}"`)
      }
    }
  })

  /* Automatically dispose */
  if ('dispose' in getInstance())
    onCleanup(() => {
      DEBUG && console.log('three', 'dispose', getInstance())
      getInstance().dispose?.()
    })

  createEffect(() => {
    if (props.helper) {
      useHelper(
        {
          get current() {
            return getInstance() as any
          },
        },
        props.helper,
      )
    }
  })
}

export function Primitive<T extends Instance>(props: { object: T; children?: JSXElement }) {
  const store = useThree()

  /* Prepare instance */
  const instance = createMemo(() => {
    let obj = prepare(props.object)
    obj.__r3f.root = store
    return obj
  })

  useInstance(instance, props)

  return <ParentContext.Provider value={instance}>{props.children}</ParentContext.Provider>
}

/**
 * Convenience method for setting (potentially nested) properties on an object.
 */
export const applyProps = (object: Instance, props: { [key: string]: any }) => {
  const rootState = getRootState(object as any as THREE.Object3D)

  for (const key in props) {
    /* If the key contains a hyphen, we're setting a sub property. */
    if (key.indexOf('-') > -1) {
      const [property, ...rest] = key.split('-')
      createRenderEffect(() => {
        applyProps(object[property], { [rest.join('-')]: props[key] })
      })
      continue
    }

    /* If the property exposes a `setScalar` function, we'll use that */
    if (object[key]?.setScalar && typeof props[key] === 'number') {
      createRenderEffect(() => object[key].setScalar(props[key]))
      continue
    }

    /* If the property exposes a `copy` function and the value is of the same type,
       we'll use that. (Vectors, Eulers, Quaternions, ...) */
    if (object[key]?.copy && object[key].constructor === props[key]?.constructor) {
      createRenderEffect(() => object[key].copy(props[key]))
      continue
    }

    /* If the property exposes a `set` function, we'll use that. */
    if (object[key]?.set) {
      Array.isArray(props[key])
        ? createRenderEffect(() => object[key].set(...props[key]))
        : createRenderEffect(() => {
            DEBUG && console.log('three', 'set', object, key, props[key])
            object[key].set(props[key])
          })
      continue
    }

    /* If we got here, we couldn't do anything special, so let's just check if the
       target property exists and assign it directly. */
    if (key in object) {
      createRenderEffect(() => (object[key] = props[key]))
    }

    if (!rootState) return
    if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key)) {
      createRenderEffect(() => {
        object.__r3f.handlers[key] = props[key]
        object.__r3f.eventCount = Object.keys(object.__r3f.handlers).length
      })
      if (rootState.internal && object.raycast) {
        const index = rootState.internal.interaction.indexOf(object as unknown as THREE.Object3D)
        if (object.__r3f.eventCount && index === -1) {
          untrack(() =>
            rootState.set('internal', 'interaction', (arr) => [...arr, object as unknown as THREE.Object3D]),
          )
        }
        if (!object.__r3f.eventCount && index !== -1) {
          rootState.set(
            'internal',
            'interaction',
            produce((arr) => arr.splice(index, 1)),
          )
        }
      }

      // Call the update lifecycle when it is being updated, but only when it is part of the scene
      // if (changes.length && instance.parent) updateInstance(instance);
    }
  }
}

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
