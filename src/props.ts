import {
  type Accessor,
  children,
  createMemo,
  createRenderEffect,
  type JSXElement,
  mapArray,
  omit,
  onCleanup,
  runWithOwner,
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
import { SHOULD_DEBUG } from "./constants.ts"
import { isEventType } from "./create-events.ts"
import { useThree } from "./hooks.ts"
import { addToEventListeners } from "./internal-context.ts"
import type { AccessorMaybe, Context, Meta } from "./types.ts"
import { createDebug, getMeta, hasColorSpace, hasMeta, resolve } from "./utils.ts"

const debugSceneGraph = createDebug("props:useSceneGraph", SHOULD_DEBUG)
const debugAttach = createDebug("props:applySceneGraph", SHOULD_DEBUG)
const debugApplyProp = createDebug("props:applyProp", SHOULD_DEBUG)
const debugUseProps = createDebug("props:useProps", SHOULD_DEBUG)

function isWritable(object: object, propertyName: string) {
  return Object.getOwnPropertyDescriptor(object, propertyName)?.writable
}

function applySceneGraph(parent: object, child: object) {
  const parentType = (parent as any).type ?? (parent as any).constructor?.name
  const childType = (child as any).type ?? (child as any).constructor?.name

  const parentMeta = getMeta(parent)
  if (parentMeta) {
    debugAttach("track-child", { action: "add to parent children", parentType, childType })
    // Update parent's augmented children-property.
    parentMeta.children.add(child)
    onCleanup(() => {
      debugAttach("cleanup", { action: "remove from parent children", parentType, childType })
      parentMeta.children.delete(child)
    })
  } else {
    debugAttach("no-parent-meta", { parentType })
  }

  const childMeta = getMeta(child)
  if (childMeta) {
    debugAttach("track-parent", { action: "set child parent", childType, parentType })
    // Update parent's augmented children-property.
    childMeta.parent = parent
    onCleanup(() => {
      debugAttach("cleanup", { action: "unset child parent", childType })
      childMeta.parent = undefined
    })
  } else {
    debugAttach("no-child-meta", { childType })
  }

  let attachProp = childMeta?.props.attach

  // Attach-prop can be a callback. It returns a cleanup-function.
  if (typeof attachProp === "function") {
    debugAttach("attached", { via: "callback", parentType, childType })
    const cleanup = attachProp(parent, child as Meta<object>)
    onCleanup(cleanup)
    return
  }

  // Defaults for Material, BufferGeometry and Fog.
  let defaultedFrom: string | undefined
  if (!attachProp) {
    debugAttach("check-defaults", { childType })
    if (child instanceof Material) {
      debugAttach("default", { type: "Material", childType })
      attachProp = "material"
      defaultedFrom = "Material"
    } else if (child instanceof BufferGeometry) {
      debugAttach("default", { type: "BufferGeometry", childType })
      attachProp = "geometry"
      defaultedFrom = "BufferGeometry"
    } else if (child instanceof Fog) {
      debugAttach("default", { type: "Fog", childType })
      attachProp = "fog"
      defaultedFrom = "Fog"
    } else {
      debugAttach("no-default", { childType })
    }
  }

  // If an attachProp is defined, attach the child to the parent.
  if (attachProp) {
    debugAttach("attached", {
      via: defaultedFrom ? `default:${defaultedFrom}` : "prop",
      attachProp,
      parentType,
      childType,
    })
    let target = parent
    let property: string | undefined

    const path = attachProp.split("-")

    while ((property = path.shift())) {
      if (path.length === 0) {
        debugAttach("attach-assign", { property, parentType, childType })
        // @ts-expect-error TODO: fix type-error
        target[property] = child
        onCleanup(() => {
          debugAttach("cleanup", { action: "unset attach prop", property, parentType, childType })
          // @ts-expect-error TODO: fix type-error
          target[property] = undefined
        })
        break
      } else {
        debugAttach("attach-traverse", { property, parentType })
        // @ts-expect-error TODO: fix type-error
        target = target[property]
      }
    }

    return
  }

  // If no attach-prop is defined, add the child to the parent.
  if (child instanceof Object3D && parent instanceof Object3D) {
    debugAttach("check-add", { parentType, childType })
    if (!parent.children.includes(child)) {
      debugAttach("attached", { via: "add", parentType, childType })
      parent.add(child)
      onCleanup(() => {
        debugAttach("cleanup", { action: "remove Object3D", parentType, childType })
        parent.remove(child)
      })
      return child
    }
    debugAttach("skipped", { reason: "already-attached", parentType, childType }, { trace: true })
    return
  }

  debugAttach("failed", { reason: "not-Object3D, no attach prop", childType })
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
  const kids = children(() => props.children)
  const filteredKids = createMemo(() =>
    kids
      .toArray()
      .map(kid => resolve(kid))
      .filter(kid => kid instanceof Object3D),
  )

  createRenderEffect(
    mapArray(
      () => kids.toArray() as unknown as (Meta<object> | undefined)[],
      _child => {
        debugSceneGraph("child-added", {
          child: (_child as any)?.type ?? (_child as any)?.constructor?.name ?? "unknown",
        })
        createRenderEffect(
          () => ({ parent: resolve(_parent), child: resolve(_child) }),
          ({ parent, child }) => {
            if (!parent || !child) {
              debugSceneGraph("skipped", { reason: !parent ? "no parent" : "no child" })
              return
            }
            applySceneGraph(parent, child)
            if (props.onUpdate) {
              debugSceneGraph("onUpdate", {
                parentType: (parent as any).type ?? (parent as any).constructor?.name,
              })
              untrack(() => props.onUpdate)?.(parent)
            } else {
              debugSceneGraph("onUpdate-skipped", { reason: "no onUpdate" })
            }
          },
        )
      },
    ),
    () => {},
  )

  // mapArray(...) is created once and passed directly as the compute to createRenderEffect.
  // In Solid 2.x the compute fn is called on each re-run; passing the mapArray accessor
  // (not a lambda that calls mapArray) means the same instance persists across updates,
  // so item lifecycle (add/remove) is managed by mapArray's internal owners — not recreated.
  createRenderEffect(
    () => [filteredKids(), resolve(_parent)] as const,
    ([kids, parent]) => {
      if (!kids.length) {
        debugSceneGraph("reorder-skipped", { reason: "no kids" })
        return
      }
      if (!(parent instanceof Object3D)) {
        debugSceneGraph("reorder-skipped", { reason: "parent not Object3D" })
        return
      }

      // Only reorder when managed children exist and their relative order differs
      const indices = kids.map(c => parent.children.indexOf(c)).filter(i => i !== -1)
      if (indices.length < 2) {
        debugSceneGraph("reorder-skipped", { reason: "fewer than 2 indexed children" })
        return
      }
      let ordered = true
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] <= indices[i - 1]) {
          ordered = false
          break
        }
      }
      if (ordered) {
        debugSceneGraph("reorder-skipped", { reason: "already ordered" })
        return
      }
      debugSceneGraph("reorder", {
        parentType: (parent as any).type ?? parent.constructor.name,
        count: kids.length,
      })
      // Reorder: splice each managed child into its expected position
      let insertPos = 0
      for (const child of kids) {
        const currentPos = parent.children.indexOf(child)
        if (currentPos === -1) {
          debugSceneGraph("reorder-child-not-found", {
            childType: (child as any).type ?? child.constructor.name,
          })
          continue
        }
        if (currentPos !== insertPos) {
          debugSceneGraph("reorder-move", { from: currentPos, to: insertPos })
          parent.children.splice(currentPos, 1)
          parent.children.splice(insertPos, 0, child)
        } else {
          debugSceneGraph("reorder-in-place", { pos: currentPos })
        }
        insertPos++
      }
    },
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
 * @param key - The property name, which can include nested paths indicated by hyphens.
 * @param value - The value to be assigned to the property; can be of any appropriate type.
 */
function applyProp<T extends Record<string, any>>(
  context: Pick<Context, "requestRender" | "gl" | "props">,
  source: T,
  key: string,
  value: any,
) {
  if (!source) {
    console.error("error while applying prop", source, key, value)
    return
  }

  // Ignore setting undefined props
  if (value === undefined) {
    debugApplyProp("skipped", { reason: "undefined value", key })

    return
  }

  /* If the key contains a hyphen, we're setting a sub property. */
  if (key.indexOf("-") > -1) {
    const [property, ...rest] = key.split("-")

    debugApplyProp("nested", { key, property, rest })

    applyProp(context, source[property], rest.join("-"), value)
    return
  }

  if (NEEDS_UPDATE.includes(key)) {
    if ((!source[key] && value) || (source[key] && !value)) {
      debugApplyProp("needsUpdate", { key })
      // @ts-expect-error
      source.needsUpdate = true
    } else {
      debugApplyProp("needsUpdate-skipped", { key, reason: "no transition" })
    }
  } else {
    debugApplyProp("needsUpdate-not-applicable", { key })
  }

  // Alias (output)encoding => (output)colorSpace (since r152)
  // https://github.com/pmndrs/react-three-fiber/pull/2829
  if (hasColorSpace(source)) {
    const sRGBEncoding = 3001
    const SRGBColorSpace = "srgb"
    const LinearSRGBColorSpace = "srgb-linear"

    if (key === "encoding") {
      const remapped = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace
      debugApplyProp("remapped", { from: "encoding", to: "colorSpace", value: remapped })

      key = "colorSpace"
      value = remapped
    } else if (key === "outputEncoding") {
      const remapped = value === sRGBEncoding ? SRGBColorSpace : LinearSRGBColorSpace

      debugApplyProp("remapped", {
        from: "outputEncoding",
        to: "outputColorSpace",
        value: remapped,
      })

      key = "outputColorSpace"
      value = remapped
    } else {
      debugApplyProp("colorspace-check", { action: "no remap needed", key })
    }
  } else {
    debugApplyProp("colorspace-check", { action: "skip", reason: "no colorSpace on source", key })
  }

  // Event registration is handled in useProps compute phase (needs reactive owner for useContext).
  // applyProp just skips event types — no work needed here.
  if (isEventType(key)) {
    debugApplyProp("skipped", { reason: "event type (registered in useProps)", key })
    return
  }

  const target = source[key]
  const sourceType = (source as any).type ?? source.constructor.name

  try {
    // Copy if properties match signatures
    if (target?.copy && target?.constructor === value?.constructor && !isWritable(source, key)) {
      debugApplyProp("applied", { via: "copy", sourceType, key })

      target.copy(value)
    } else if (target?.set && Array.isArray(value)) {
      if (target.fromArray) {
        debugApplyProp("apply-fromArray", { sourceType, key })

        target.fromArray(value)
      } else {
        debugApplyProp("apply-set-spread", { sourceType, key })

        target.set(...value)
      }
    }
    // Set literal types, ignore undefined
    // https://github.com/pmndrs/react-three-fiber/issues/274
    else if (target?.set && typeof value !== "object") {
      const isColor = target instanceof Color
      debugApplyProp("set-literal", { isColor, sourceType, key })

      // Allow setting array scalars
      if (!isColor && target.setScalar && typeof value === "number") {
        debugApplyProp("applied", { via: "setScalar", sourceType, key })

        target.setScalar(value)
      }
      // Otherwise just set ...
      else if (value !== undefined) {
        debugApplyProp("applied", { via: "set", sourceType, key })

        target.set(value)
      }
    }
    // Else, just overwrite the value
    else {
      debugApplyProp("applied", { via: "assign", sourceType, key })

      // @ts-expect-error TODO: fix type-error
      source[key] = value
    }
  } finally {
    if ("needsUpdate" in source) {
      debugApplyProp("needsUpdate-set", { key })

      // @ts-expect-error
      source.needsUpdate = true
    } else {
      debugApplyProp("needsUpdate-set-skipped", { key, reason: "no needsUpdate on source" })
    }
    if (context.props.frameloop === "demand") {
      debugApplyProp("requestRender", { key })

      context.requestRender()
    } else {
      debugApplyProp("requestRender-skipped", { key, frameloop: context.props.frameloop })
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
  options?: { skipSceneGraph?: boolean },
) {
  const instanceProps = omit(props, "ref", "args", "object", "attach", "children")
  debugUseProps("call", {
    keys: Object.keys(instanceProps),
    sceneGraph: options?.skipSceneGraph ? "skipped" : "managed",
  })

  if (!options?.skipSceneGraph) {
    useSceneGraph(accessor, props)
  }

  createRenderEffect(
    () => {
      const object = resolve(accessor)
      if (!object) {
        debugUseProps("skipped", { reason: "no object resolved" })
        return undefined
      }

      debugUseProps("resolved", { objectType: object.constructor.name })

      // Ref effect — created in compute phase ✓
      // runWithOwner(null) sets context=null so signal writes (ref(object) / props.ref=object)
      // don't trigger "signal written in owned scope" warnings from the synchronous first-run.
      createRenderEffect(
        () => props.ref,
        ref => {
          runWithOwner(null, () => {
            if (ref instanceof Function) {
              debugUseProps("ref", { via: "callback" })
              ref(object)
            } else {
              debugUseProps("ref", { via: "assign" })
              props.ref = object
            }
          })
        },
      )

      // Event handler registration — must be in compute phase to access eventContext ✓
      // (useContext requires an active owner, which is only available during compute)
      createRenderEffect(
        () => {
          const keys = Object.keys(instanceProps)
          for (const key of keys) {
            if (isEventType(key) && object instanceof Object3D && hasMeta(object)) {
              debugUseProps("event registered", { key, objectType: object.constructor.name })
              const cleanup = addToEventListeners(object, key)
              onCleanup(() => {
                debugUseProps("event cleanup", { key, objectType: object.constructor.name })
                cleanup()
              })
            } else if (isEventType(key)) {
              debugUseProps("event skipped", {
                key,
                reason: !(object instanceof Object3D) ? "not Object3D" : "no meta",
              })
            } else {
              debugUseProps("non-event key", { key })
            }
          }
        },
        () => {},
      )

      // Per-key prop effects — created in compute phase ✓
      createRenderEffect(
        () => {
          const keys = Object.keys(instanceProps)
          for (const key of keys) {
            // An array of sub-property-keys:
            // p.ex in <T.Mesh position={} position-x={}/> position's subKeys will be ['position-x']
            const subKeys = keys.filter(_key => key !== _key && _key.includes(key))
            createRenderEffect(
              () => props[key],
              value => {
                applyProp(context, object, key, value)
                // If property updates, apply its sub-properties immediately after.
                // NOTE:  Discuss - is this expected behavior? Feature or a bug?
                //        Should it be according to order of update instead?
                for (const subKey of subKeys) {
                  debugUseProps("sub-key apply", { key, subKey })
                  applyProp(context, object, subKey, props[subKey])
                }
              },
            )

            // Texture color space tracking — created in compute phase ✓
            // (was previously created inside applyProp's effectFn — invalid in Solid 2.0)
            createRenderEffect(
              () => {
                const value = props[key]
                if (
                  value instanceof Texture &&
                  value.format === RGBAFormat &&
                  value.type === UnsignedByteType
                ) {
                  return { texture: value, linear: context.props.linear, gl: context.gl }
                }
                return null
              },
              result => {
                if (!result) {
                  debugUseProps("texture color space", {
                    action: "skip",
                    reason: "not a matching texture",
                  })
                  return
                }
                const { texture, gl } = result
                if (hasColorSpace(texture) && hasColorSpace(gl)) {
                  debugUseProps("texture color space", {
                    via: "colorSpace",
                    value: gl.outputColorSpace,
                  })
                  texture.colorSpace = gl.outputColorSpace
                } else {
                  debugUseProps("texture color space", {
                    via: "encoding (legacy)",
                    value: (gl as any).outputEncoding,
                  })
                  // @ts-expect-error TODO: fix type-error
                  texture.encoding = gl.outputEncoding
                }
              },
            )
          }
        },
        () => {},
      )

      return object
    },
    object => {
      // NOTE: see "onUpdate should not update itself"-test
      if (object) {
        debugUseProps("onUpdate", { objectType: object.constructor.name })
        untrack(() => props.onUpdate)?.(object)
      } else {
        debugUseProps("onUpdate-skipped", { reason: "no object" })
      }
    },
  )
}
