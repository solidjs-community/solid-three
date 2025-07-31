import { createMemo, JSX, mergeProps } from "solid-js";
import type * as THREE from "three";
import { S3 } from ".";
import { augment } from "./augment";
import { Portal, Primitive } from "./components";
import { manageProps } from "./props";
import { Constructor } from "./type-utils";

/**********************************************************************************/
/*                                                                                */
/*                                    Catalogue                                   */
/*                                                                                */
/**********************************************************************************/

/**
 * Global catalogue object storing mappings from names to constructor representations.
 */
const CATALOGUE = {};

/**
 * Predefined components that can be used directly within the system.
 */
const COMPONENTS: SolidThree.Components = {
  Primitive,
  Portal,
};

/**
 * Extends the global CATALOGUE with additional objects.
 *
 * @param objects - The objects to add to the catalogue.
 */
export const extend = (
  objects: Partial<
    | {
        [TKey in keyof SolidThree.Elements]: Constructor<SolidThree.Elements[TKey]>;
      }
    | typeof THREE
  >,
): void => void Object.assign(CATALOGUE, objects);

/**********************************************************************************/
/*                                                                                */
/*                                        T                                       */
/*                                                                                */
/**********************************************************************************/

/**
 * Cache for storing initialized components.
 */
const T_CACHE = new Map<string, S3.Component<any>>(Object.entries(COMPONENTS));

/** Map given type to `S3.Component` */
type MapToS3Components<Source> = {
  [K in keyof Source]: S3.Component<Source[K]>;
};

/**
 * A proxy that provides on-demand creation and caching of `solid-three` components.
 * It represents a dynamic layer over the predefined components and any added through extend function.
 */
export const T = new Proxy<
  MapToS3Components<typeof THREE & SolidThree.Elements> & SolidThree.Components
>({} as any, {
  get: (_, name: string) => {
    /* Create and memoize a wrapper component for the specified property. */
    if (!T_CACHE.has(name)) {
      /* Try and find a constructor within the THREE namespace. */
      const constructor = CATALOGUE[name];

      /* If no constructor is found, return undefined. */
      if (!constructor) return undefined;

      /* Otherwise, create and memoize a component for that constructor. */
      T_CACHE.set(name, createThreeComponent(constructor));
    }

    return T_CACHE.get(name);
  },
});

/**
 * Creates a ThreeComponent instance for a given source constructor.
 *
 * @template TSource The source constructor type.
 * @param source - The constructor from which the component will be created.
 * @returns The created component.
 */
function createThreeComponent<TSource>(
  source: TSource,
): S3.Component<TSource | SolidThree.Elements> {
  return (props: any) => {
    const merged = mergeProps({ args: [] }, props);
    const memo = createMemo(() => {
      try {
        return augment(new (source as any)(...merged.args), { props });
      } catch (e) {
        console.error(e);
        throw new Error("");
      }
    });
    manageProps(memo, props);
    return memo as unknown as JSX.Element;
  };
}
