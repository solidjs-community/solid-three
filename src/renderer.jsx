import { createMemo, splitProps, untrack, } from "solid-js";
import { createThreeRenderer } from "./core/renderer";
import { createRenderer } from "solid-js/universal";
import { roots } from "./core";
import { createSolidRenderer } from "./solid";
export const threeRenderer = createSolidRenderer(createThreeRenderer(roots));
export const { render, effect, memo, createComponent, createElement, createTextNode, insertNode, insert, spread, setProp, mergeProps, } = createRenderer(threeRenderer);
export * from "solid-js";
/**
 * renders an arbitrary custom or native component and passes the other props
 * ```typescript
 * <Dynamic component={multiline() ? 'textarea' : 'input'} value={value()} />
 * ```
 * @description https://www.solidjs.com/docs/latest/api#%3Cdynamic%3E
 */
export function Dynamic(props) {
    const [p, others] = splitProps(props, ["component"]);
    return createMemo(() => {
        const component = p.component;
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
