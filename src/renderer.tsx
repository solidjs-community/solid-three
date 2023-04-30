import { Accessor, Component, createMemo, JSX, splitProps, untrack } from "solid-js";
import { createThreeRenderer } from "./core/renderer";
import { roots } from "./core";
import { createSolidRenderer } from "./solid";

export const threeReconciler = createThreeRenderer(roots);
export const threeRenderer = createSolidRenderer(threeReconciler);

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use
} = threeRenderer;

export * from "solid-js";

type DynamicProps<T> = T & {
  children?: any;
  component?: Component<T> | string | keyof JSX.IntrinsicElements;
};

/**
 * renders an arbitrary custom or native component and passes the other props
 * ```typescript
 * <Dynamic component={multiline() ? 'textarea' : 'input'} value={value()} />
 * ```
 * @description https://www.solidjs.com/docs/latest/api#%3Cdynamic%3E
 */
export function Dynamic<T>(props: DynamicProps<T>): Accessor<JSX.Element> {
  const [p, others] = splitProps(props, ["component"]);
  return createMemo(() => {
    const component = p.component as Function | string;
    switch (typeof component) {
      case "function":
        return untrack(() => component(others));

      case "string":
        // const isSvg = SVGElements.has(component);
        // const el = sharedConfig.context
        //   ? getNextElement()
        let el = createElement(component);

        spread(el, others, true);
        return el;

      default:
        break;
    }
  });
}
