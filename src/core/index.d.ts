import * as THREE from "three";
import { UseBoundStore as UseStore } from "zustand/vanilla";
import { dispose, applyProps } from "./utils";
import { Renderer, StoreProps, ThreeContext, RootState, Size } from "./store";
import { extend, Root } from "./renderer";
import { addEffect, addAfterEffect, addTail } from "./loop";
import { EventManager } from "./events";
export declare const roots: Map<Element, Root>;
declare const invalidate: (state?: RootState | undefined) => void, advance: (timestamp: number, runGlobalEffects?: boolean, state?: RootState | undefined) => void;
declare type Properties<T> = Pick<T, {
    [K in keyof T]: T[K] extends (_: any) => any ? never : K;
}[keyof T]>;
declare type GLProps = Renderer | ((canvas: HTMLCanvasElement) => Renderer) | Partial<Properties<THREE.WebGLRenderer> | THREE.WebGLRendererParameters> | undefined;
export declare type RenderProps<TCanvas extends Element> = Omit<StoreProps, "gl" | "events" | "size"> & {
    gl?: GLProps;
    events?: (store: UseStore<RootState>) => EventManager<TCanvas>;
    size?: Size;
    onCreated?: (state: RootState) => void;
};
declare function createThreeRoot<TCanvas extends HTMLElement>(canvas: TCanvas, config?: RenderProps<TCanvas>): import("zustand/vanilla").StoreApi<RootState>;
declare function unmountComponentAtNode<TElement extends Element>(canvas: TElement, callback?: (canvas: TElement) => void): void;
export { ThreeContext as context, createThreeRoot, unmountComponentAtNode, applyProps, dispose, invalidate, advance, extend, addEffect, addAfterEffect, addTail, roots as _roots, };
//# sourceMappingURL=index.d.ts.map