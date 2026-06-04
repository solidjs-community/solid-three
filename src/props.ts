import {
  type Accessor,
  children,
  createComputed,
  createRenderEffect,
  type JSXElement,
  mapArray,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js"
import {
  type BufferGeometry,
  Color,
  type Fog,
  type Material,
  type Object3D,
  RGBAFormat,
  Texture,
  UnsignedByteType,
} from "three"
import { isEventType } from "./create-events.ts"
import { useThree } from "./hooks.ts"
import { addToEventListeners } from "./internal-context.ts"
import { resolvePluginMethods } from "./plugin.ts"
import type { AccessorMaybe, Context, Meta, Plugin } from "./types.ts"
import {
  getMeta,
  hasColorSpace,
  hasMeta,
  isBufferGeometry,
  isFog,
  isMaterial,
  isObject3D,
  isWritable,
  resolve,
} from "./utils.ts"

function applySceneGraph(parent: object, child: object) {
  const parentMeta = getMeta(parent)
  if (parentMeta) {
    parentMeta.children.add(child)
    onCleanup(() => parentMeta.children.delete(child))
  }

  const childMeta = getMeta(child)
  if (childMeta) {
    childMeta.parent = parent
    onCleanup(() => (childMeta.parent = undefined))
  }

  let attachProp = childMeta?.props.attach

  if (typeof attachProp === "function") {
    const cleanup = attachProp(parent, child as Meta<object>)
    onCleanup(cleanup)
    return
  }

  if (!attachProp) {
    // Duck-type instead of `instanceof` so that classes from a separate
    // module instance of three (e.g. `MeshBasicNodeMaterial` from
    // `three/webgpu` when imported alongside `three`'s own `Material`)
    // still get attached to the correct slot. Three.js itself uses these
    // `is*` flags as the canonical cross-version test.
    if (isMaterial(child)) attachProp = "material"
    else if (isBufferGeometry(child)) attachProp = "geometry"
    else if (isFog(child)) attachProp = "fog"
  }

  if (attachProp) {
    let target = parent
    let property: string | undefined

    const path = attachProp.split("-")

    while ((property = path.shift())) {
      if (path.length === 0) {
        // @ts-expect-error TODO: fix type-error
        target[property] = child
        // @ts-expect-error TODO: fix type-error
        onCleanup(() => (target[property] = undefined))
        break
      } else {
        // @ts-expect-error TODO: fix type-error
        target = target[property]
      }
    }

    return
  }

  // Object3D children are managed by the ordering loop in useSceneGraph
  if (isObject3D(child) && isObject3D(parent)) return

  console.error(
    "Error while connecting/attaching child: child does not have attach-props defined and is not an Object3D",
    parent,
    child,
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                   Scene Graph                                  */
/*                                                                                */
/**********************************************************************************/

/**
 * Dynamically attaches/connects child elements to a parent within a scene graph based on specified attachment properties.
 * The function supports different attachment behaviors:
 * - Direct assignment for standard properties like material, geometry, or fog.
 * - Custom attachment logic through a callback function provided in the attach property of the child.
 * - Default behavior for Three.js Object3D instances where children are added to the parent's children array if no specific attach property is provided.
 *
 * @template T The type parameter for the elements in the scene graph.
 * @param parent - The parent element to which children will be attached.
 * @param childAccessor - A function returning the child or children to be managed.
 */
export const useSceneGraph = <T extends object>(
  _parent: AccessorMaybe<T | undefined>,
  props: { children?: JSXElement | JSXElement[]; onUpdate?(event: T): void },
) => {
  const c = children(() => props.children)

  // Per-item: metadata, attach props, events
  createComputed(
    mapArray(
      () => c.toArray() as unknown as (Meta<object> | undefined)[],
      _child =>
        createComputed(() => {
          const parent = resolve(_parent)
          if (!parent) return
          const child = resolve(_child)
          if (!child) return
          applySceneGraph(parent, child)
          props.onUpdate?.(parent)
        }),
    ),
  )

  // Object3D scene graph sync: add, remove, reorder
  createComputed((previousManagedChildren: Set<Object3D>) => {
    const parent = resolve(_parent)
    if (!isObject3D(parent)) {
      return previousManagedChildren
    }

    const childArray = c.toArray() as unknown as Array<object | undefined>
    const managedChildren = new Set<Object3D>()

    for (const child of childArray) {
      if (!isObject3D(child) || getMeta(child)?.props.attach) continue
      managedChildren.add(child)
      if (child.parent !== parent) {
        parent.add(child)
      }
    }

    for (const child of previousManagedChildren) {
      if (!managedChildren.has(child)) {
        parent.remove(child)
      }
    }

    // Reorder: walk parent.children, assign desired order at managed slots
    let childArrayIndex = 0
    for (let i = 0; i < parent.children.length; i++) {
      if (!managedChildren.has(parent.children[i]!)) {
        continue
      }
      while (childArrayIndex < childArray.length) {
        const child = childArray[childArrayIndex++]
        if (isObject3D(child) && !getMeta(child)?.props.attach) {
          parent.children[i] = child
          break
        }
      }
    }

    return managedChildren
  }, new Set<Object3D>())
}

/**********************************************************************************/
/*                                                                                */
/*                                   Apply Prop                                   */
/*                                                                                */
/**********************************************************************************/

const NEEDS_UPDATE = [
  "map",
  "envMap",
  "bumpMap",
  "normalMap",
  "transparent",
  "morphTargets",
  "skinning",
  "alphaTest",
  "useVertexColors",
  "flatShading",
]

/**
 * Applies a specified property value to an `AugmentedElement`. This function handles nested properties,
 * automatic updates of the `needsUpdate` flag, color space conversions, and event listener management.
 * It efficiently manages property assignments with appropriate handling for different data types and structures.
 *
 * @param source - The target object for property application.
 * @param type - The property name, which can include nested paths indicated by hyphens.
 * @param value - The value to be assigned to the property; can be of any appropriate type.
 */
function applyProp<T extends Record<string, any>>(
  context: Pick<Context, "requestRender" | "gl" | "props">,
  source: T,
  type: string,
  value: any,
  pluginMethods: Record<string, (value: any) => void>,
) {
  // A plugin-contributed prop: invoke its method instead of assigning to the instance.
  if (type in pluginMethods) {
    pluginMethods[type](value)
    return
  }

  if (!source) {
    console.error("error while applying prop", source, type, value)
    return
  }

  // Ignore setting undefined props
  if (value === undefined) return

  /* If the key contains a hyphen, we're setting a sub property. */
  if (type.indexOf("-") > -1) {
    const [property, ...rest] = type.split("-")

    applyProp(context, source[property], rest.join("-"), value, pluginMethods)
    return
  }

  if (NEEDS_UPDATE.includes(type) && ((!source[type] && value) || (source[type] && !value))) {
    // @ts-expect-error
    source.needsUpdate = true
  }

  // Alias (output)encoding => (output)colorSpace (since r152)
  // https://github.com/pmndrs/react-three-fiber/pull/2829
  if (hasColorSpace(source)) {
    const sRGBEncoding = 3001
    const SRGBColorSpace = "srgb"
    const LinearSRGBColorSpace = "srgb-linear"

    if (type === "encoding") {
      type = "colorSpace"
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace
    } else if (type === "outputEncoding") {
      type = "outputColorSpace"
      value = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace
    }
  }

  if (isEventType(type)) {
    if (isObject3D(source) && hasMeta(source)) {
      const cleanup = addToEventListeners(source, type)
      onCleanup(cleanup)
    } else {
      console.error(
        "Event handlers can only be added to Three elements extending from Object3D. Ignored event-type:",
        type,
        "from element",
        source,
      )
    }
    return
  }

  const target = source[type]

  try {
    // Copy if properties match signatures
    if (target?.copy && target?.constructor === value?.constructor && !isWritable(source, type)) {
      target.copy(value)
    } else if (target?.set && Array.isArray(value)) {
      if (target.fromArray) target.fromArray(value)
      else target.set(...value)
    }
    // Set literal types, ignore undefined
    // https://github.com/pmndrs/react-three-fiber/issues/274
    else if (target?.set && typeof value !== "object") {
      const isColor = target instanceof Color

      // Allow setting array scalars
      if (!isColor && target.setScalar && typeof value === "number") {
        target.setScalar(value)
      }
      // Otherwise just set ...
      else if (value !== undefined) {
        target.set(value)
      }
    }
    // Else, just overwrite the value
    else {
      // @ts-expect-error TODO: fix type-error
      source[type] = value

      // Auto-convert sRGB textures, for now ...
      // https://github.com/pmndrs/react-three-fiber/issues/344
      if (
        source[type] instanceof Texture &&
        // sRGB textures must be RGBA8 since r137 https://github.com/mrdoob/three.js/pull/23129
        source[type].format === RGBAFormat &&
        source[type].type === UnsignedByteType
      ) {
        createRenderEffect(() => {
          // Subscribe manually to linear and flat-prop.
          context.props.linear
          context.props.flat

          const texture = source[type] as Texture

          if (hasColorSpace(texture) && hasColorSpace(context.gl)) {
            texture.colorSpace = context.gl.outputColorSpace as typeof texture.colorSpace
          } else {
            // @ts-expect-error TODO: fix type-error
            texture.encoding = context.gl.outputEncoding
          }
        })
      }
    }
  } finally {
    if ("needsUpdate" in source) {
      // @ts-expect-error
      source.needsUpdate = true
    }
    if (context.props.frameloop === "demand") {
      context.requestRender()
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                    Use Props                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Manages and applies `solid-three` props to its Three.js object. This function sets up reactive effects
 * to ensure that properties are correctly applied and updated in response to changes. It also manages the
 * attachment of children and the disposal of the object.
 *
 * @template T - The type of the augmented element.
 * @param accessor - An accessor function that returns the target object to which properties will be applied.
 * @param props - An object containing the props to apply. This includes both direct properties
 *                and special properties like `ref` and `children`.
 */
const EMPTY_METHODS: Record<string, (value: any) => void> = {}

export function useProps<T extends Record<string, any>>(
  accessor: T | undefined | Accessor<T | undefined>,
  props: any,
  context: Pick<Context, "requestRender" | "gl" | "props"> = useThree(),
  plugins: Plugin[] = [],
) {
  const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"])

  useSceneGraph(accessor, props)

  createRenderEffect(() => {
    const object = resolve(accessor)

    if (!object) return

    // Gated: a no-plugin element does one length check and resolves nothing —
    // keeps plugin resolution off the per-element hot path (see plugin-system spec).
    const pluginMethods = plugins.length ? resolvePluginMethods(object, plugins) : EMPTY_METHODS

    // Assign ref
    createRenderEffect(() => {
      if (local.ref instanceof Function) local.ref(object)
      else local.ref = object
    })

    // Apply the props to THREE-instance
    createRenderEffect(() => {
      const keys = Object.keys(instanceProps)
      for (const key of keys) {
        // An array of sub-property-keys:
        // p.ex in <T.Mesh position={} position-x={}/> position's subKeys will be ['position-x']
        const subKeys = keys.filter(_key => key !== _key && _key.includes(key))
        createRenderEffect(() => {
          applyProp(context, object, key, props[key], pluginMethods)
          // If property updates, apply its sub-properties immediately after.
          // NOTE:  Discuss - is this expected behavior? Feature or a bug?
          //        Should it be according to order of update instead?
          for (const subKey of subKeys) {
            applyProp(context, object, subKey, props[subKey], pluginMethods)
          }
        })
      }

      // NOTE: see "onUpdate should not update itself"-test
      untrack(() => props.onUpdate)?.(object)
    })
  })
}
