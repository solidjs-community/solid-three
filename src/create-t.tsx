import { createResizeObserver } from "@solid-primitives/resize-observer"
import {
  createMemo,
  onMount,
  type Component,
  type JSX,
  type JSXElement,
  type MergeProps,
  type ParentProps,
} from "solid-js"
import { OrthographicCamera, Scene } from "three"
import { $S3C } from "./constants.ts"
import { createThree } from "./create-three.tsx"
import { useProps } from "./props.ts"
import type { CanvasProps, Plugin, PluginPropsOf, Props } from "./types.ts"
import { meta } from "./utils.ts"

/**********************************************************************************/
/*                                                                                */
/*                                    Create T                                    */
/*                                                                                */
/**********************************************************************************/

export type InferPluginsFromT<T extends object> = T extends { [$S3C]: infer U } ? U : never

export function createT<
  const TCatalogue extends Record<string, unknown>,
  const TCataloguePlugins extends Plugin[],
>(catalogue: TCatalogue, plugins?: TCataloguePlugins) {
  const cache = new Map<string, Component<any>>()
  return {
    Canvas(props: ParentProps<CanvasProps> & Partial<PluginPropsOf<Scene, TCataloguePlugins>>) {
      let canvas: HTMLCanvasElement = null!
      let container: HTMLDivElement = null!

      onMount(() => {
        const context = createThree(canvas, props, plugins)

        // Resize observer for the canvas to adjust camera and renderer on size change
        createResizeObserver(container, function onResize() {
          const { width, height } = container.getBoundingClientRect()
          context.gl.setSize(width, height)
          context.gl.setPixelRatio(globalThis.devicePixelRatio)

          if (context.currentCamera instanceof OrthographicCamera) {
            context.currentCamera.left = width / -2
            context.currentCamera.right = width / 2
            context.currentCamera.top = height / 2
            context.currentCamera.bottom = height / -2
          } else {
            context.currentCamera.aspect = width / height
          }

          context.currentCamera.updateProjectionMatrix()
          context.render(performance.now())
        })
      })

      return (
        <div
          ref={container!}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            contain: "strict",
            display: "flex",
            ...props.style,
          }}
          class={props.class}
        >
          <canvas ref={canvas!} />
        </div>
      )
    },
    T: new Proxy(
      {} as {
        [K in keyof TCatalogue]: <const TPlugins extends Plugin[] | undefined>(
          props: { plugins?: TPlugins } & Partial<
            TPlugins extends Plugin[]
              ? Props<TCatalogue[K], [...TCataloguePlugins, ...TPlugins]>
              : Props<TCatalogue[K], TCataloguePlugins>
          >,
        ) => JSXElement
      } & { [$S3C]: TCataloguePlugins },
      {
        get: (_, name: string) => {
          /* Create and memoize a wrapper component for the specified property. */
          if (!cache.has(name)) {
            /* Try and find a constructor within the THREE namespace. */
            const constructor = catalogue[name]

            /* If no constructor is found, return undefined. */
            if (!constructor) return undefined

            /* Otherwise, create and memoize a component for that constructor. */
            cache.set(name, createEntity(constructor, plugins ?? []))
          }

          return cache.get(name)
        },
      },
    ),
  }
}

/**
 * Creates an Entity-instance from a given source constructor.
 *
 * @template TConstructor The source constructor type.
 * @param Constructor - The constructor from which the component will be created.
 * @returns The created component.
 */
export function createEntity<TConstructor, TEntityPlugins extends Plugin[] = Plugin[]>(
  Constructor: TConstructor,
  plugins: TEntityPlugins,
) {
  return function <TPlugins extends Plugin[] = Plugin[]>(
    props: MergeProps<[InferPluginsFromT<TEntityPlugins>, Props<TConstructor, TPlugins>]>,
  ) {
    const entity = createMemo(() => {
      // listen to key changes
      // @ts-expect-error TODO: fix type error
      props.key
      try {
        return meta(
          new (Constructor as any)(
            ...// @ts-expect-error TODO: fix type error
            (props.args ?? []),
          ),
          { props, plugins },
        )
      } catch (e) {
        console.error(e)
        throw new Error("")
      }
    })
    useProps(entity, props, plugins)
    return entity as unknown as JSX.Element
  }
}
