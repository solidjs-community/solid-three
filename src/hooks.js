import { ThreeContext } from "./core/store";
import { buildGraph } from "./core/utils";
import { createComputed, createMemo, createSignal, onCleanup, untrack, useContext, } from "solid-js";
export function useStore() {
    const store = useContext(ThreeContext);
    if (!store)
        throw `R3F hooks can only be used within the Canvas component!`;
    return store;
}
export function useThree(selector = (state) => state, equalityFn) {
    let store = useStore();
    const [signal, setSignal] = createSignal(selector(store.getState()));
    createComputed(() => {
        let cleanup = useStore().subscribe(
        // @ts-expect-error
        selector, (v) => {
            // @ts-expect-error
            setSignal(() => v);
        }, equalityFn);
        onCleanup(cleanup);
    });
    return signal;
}
export function useFrame(callback, renderPriority = 0) {
    const subscribe = useStore().getState().internal.subscribe;
    let cleanup = subscribe((t, delta) => untrack(() => callback(t, delta)), renderPriority);
    onCleanup(cleanup);
    return null;
}
export function useGraph(object) {
    return createMemo(() => buildGraph(object));
}
export function loadingFn(extensions, onProgress) {
    return function (Proto, ...input) {
        // Construct new loader and run extensions
        const loader = new Proto();
        if (extensions)
            extensions(loader);
        // Go through the urls and load them
        return Promise.all(input.map((input) => new Promise((res, reject) => loader.load(input, (data) => {
            if (data.scene)
                Object.assign(data, buildGraph(data.scene));
            res(data);
        }, onProgress, (error) => reject(`Could not load ${input}: ${error.message}`)))));
    };
}
// export function useLoader<T, U extends string | string[]>(
//   Proto: new () => LoaderResult<T>,
//   input: U,
//   extensions?: Extensions,
//   onProgress?: (event: ProgressEvent<EventTarget>) => void
// ): U extends any[]
//   ? BranchingReturn<T, GLTF, GLTF & ObjectMap>[]
//   : BranchingReturn<T, GLTF, GLTF & ObjectMap> {
//   // Use suspense to load async assets
//   const keys = (Array.isArray(input) ? input : [input]) as string[];
//   const results = suspend(
//     loadingFn<T>(extensions, onProgress),
//     [Proto, ...keys],
//     { equal: is.equ }
//   );
//   // Return the object/s
//   return (Array.isArray(input) ? results : results[0]) as U extends any[]
//     ? BranchingReturn<T, GLTF, GLTF & ObjectMap>[]
//     : BranchingReturn<T, GLTF, GLTF & ObjectMap>;
// }
// useLoader.preload = function <T, U extends string | string[]>(
//   Proto: new () => LoaderResult<T>,
//   input: U,
//   extensions?: Extensions
// ) {
//   const keys = (Array.isArray(input) ? input : [input]) as string[];
//   return preload(loadingFn<T>(extensions), [Proto, ...keys]);
// };
// useLoader.clear = function <T, U extends string | string[]>(
//   Proto: new () => LoaderResult<T>,
//   input: U
// ) {
//   const keys = (Array.isArray(input) ? input : [input]) as string[];
//   return clear([Proto, ...keys]);
// };
