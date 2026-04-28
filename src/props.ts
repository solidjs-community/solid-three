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
  BufferGeometry,
  Color,
  Fog,
  Material,
  Object3D,
  RGBAFormat,
  Texture,
  UnsignedByteType,
} from "three"
import { isEventType } from "./create-events.ts"
import { useThree } from "./hooks.ts"
import { addToEventListeners } from "./internal-context.ts"
import type { AccessorMaybe, Context, Meta } from "./types.ts"
import { getMeta, hasColorSpace, hasMeta, resolve } from "./utils.ts"

function isWritable(object: object, propertyName: string) {
  return Object.getOwnPropertyDescriptor(object, propertyName)?.writable
}

function applySceneGraph(parent: object, child: object) {
  const parentMeta = getMeta(parent)
  if (parentMeta) {
    // Update parent's augmented children-property.
    parentMeta.children.add(child)
    onCleanup(() => parentMeta.children.delete(child))
  }

  const childMeta = getMeta(child)
  if (childMeta) {
    // Update parent's augmented children-property.
    childMeta.parent = parent
    onCleanup(() => (childMeta.parent = undefined))
  }

  let attachProp = childMeta?.props.attach

  // Attach-prop can be a callback. It returns a cleanup-function.
  if (typeof attachProp === "function") {
    const cleanup = attachProp(parent, child as Meta<object>)
    onCleanup(cleanup)
    return
  }

  // Defaults for Material, BufferGeometry and Fog.
  if (!attachProp) {
    if (child instanceof Material) attachProp = "material"
    else if (child instanceof BufferGeometry) attachProp = "geometry"
    else if (child instanceof Fog) attachProp = "fog"
  }

  // If an attachProp is defined, attach the child to the parent.
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

  // If no attach-prop is defined, add the child to the parent.
  if (child instanceof Object3D && parent instanceof Object3D && !parent.children.includes(child)) {
    parent.add(child)
    onCleanup(() => parent.remove(child))
    return child
  }

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
) {
  if (!source) {
    console.error("error while applying prop", source, type, value)
    return
  }

  // Ignore setting undefined props
  if (value === undefined) return

  /* If the key contains a hyphen, we're setting a sub property. */
  if (type.indexOf("-") > -1) {
    const [property, ...rest] = type.split("-")

    applyProp(context, source[property], rest.join("-"), value)
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
    if (source instanceof Object3D && hasMeta(source)) {
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
            texture.colorSpace = context.gl.outputColorSpace
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
export function useProps<T extends Record<string, any>>(
  accessor: T | undefined | Accessor<T | undefined>,
  props: any,
  context: Pick<Context, "requestRender" | "gl" | "props"> = useThree(),
) {
  const [local, instanceProps] = splitProps(props, ["ref", "args", "object", "attach", "children"])

  useSceneGraph(accessor, props)

  createRenderEffect(() => {
    const object = resolve(accessor)

    if (!object) return

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
          applyProp(context, object, key, props[key])
          // If property updates, apply its sub-properties immediately after.
          // NOTE:  Discuss - is this expected behavior? Feature or a bug?
          //        Should it be according to order of update instead?
          for (const subKey of subKeys) {
            applyProp(context, object, subKey, props[subKey])
          }
        })
      }

      // NOTE: see "onUpdate should not update itself"-test
      untrack(() => props.onUpdate)?.(object)
    })
  })
}
