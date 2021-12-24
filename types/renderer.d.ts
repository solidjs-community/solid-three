import { Accessor, Component, JSX } from "solid-js";
export declare const threeRenderer: import("solid-js/universal/types/universal").Renderer<import("./core/renderer").Instance>;
export declare const render: (code: () => import("./core/renderer").Instance, node: import("./core/renderer").Instance) => () => void, effect: <T>(fn: (prev?: T | undefined) => T, init?: T | undefined) => void, memo: <T>(fn: () => T, equal: boolean) => () => T, createComponent: <T>(Comp: (props: T) => import("./core/renderer").Instance, props: T) => import("./core/renderer").Instance, createElement: (tag: string) => import("./core/renderer").Instance, createTextNode: (value: string) => import("./core/renderer").Instance, insertNode: (parent: import("./core/renderer").Instance, node: import("./core/renderer").Instance, anchor?: import("./core/renderer").Instance | undefined) => void, insert: <T>(parent: any, accessor: T | (() => T), marker?: any) => import("./core/renderer").Instance, spread: <T>(node: any, accessor: T | (() => T), skipChildren?: Boolean | undefined) => void, setProp: <T>(node: import("./core/renderer").Instance, name: string, value: T, prev?: T | undefined) => T, mergeProps: (...sources: unknown[]) => unknown;
export * from "solid-js";
declare type DynamicProps<T> = T & {
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
export declare function Dynamic<T>(props: DynamicProps<T>): Accessor<JSX.Element>;
//# sourceMappingURL=renderer.d.ts.map