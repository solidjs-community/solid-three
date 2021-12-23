import { Accessor, Component, JSX } from "solid-js";
import { Instance } from "./core/renderer";
export declare const threeRenderer: import("solid-js/universal/types/universal").Renderer<Instance>;
export declare const render: (code: () => unknown, node: unknown) => () => void, effect: <T>(fn: (prev?: T | undefined) => T, init?: T | undefined) => void, memo: <T>(fn: () => T, equal: boolean) => () => T, createComponent: <T>(Comp: (props: T) => unknown, props: T) => unknown, createElement: (tag: string) => unknown, createTextNode: (value: string) => unknown, insertNode: (parent: unknown, node: unknown, anchor?: unknown) => void, insert: <T>(parent: any, accessor: T | (() => T), marker?: any) => unknown, spread: <T>(node: any, accessor: T | (() => T), skipChildren?: Boolean | undefined) => void, setProp: <T>(node: unknown, name: string, value: T, prev?: T | undefined) => T, mergeProps: (...sources: unknown[]) => unknown;
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