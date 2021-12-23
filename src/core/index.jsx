var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import * as THREE from "three";
import { dispose, applyProps } from "./utils";
import { createThreeStore, isRenderer, ThreeContext, } from "./store";
import { extend } from "./renderer";
import { createLoop, addEffect, addAfterEffect, addTail } from "./loop";
import { createEffect } from "solid-js";
export const roots = new Map();
const { invalidate, advance } = createLoop(roots);
const createRendererInstance = (gl, canvas) => {
    const customRenderer = (typeof gl === "function" ? gl(canvas) : gl);
    if (isRenderer(customRenderer))
        return customRenderer;
    const renderer = new THREE.WebGLRenderer(Object.assign({ powerPreference: "high-performance", canvas: canvas, antialias: true, alpha: true }, gl));
    // Set color management
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Set gl props
    if (gl)
        applyProps(renderer, gl);
    return renderer;
};
function createThreeRoot(canvas, config) {
    var _a, _b;
    let _c = config || {}, { gl, size, events, onCreated } = _c, props = __rest(_c, ["gl", "size", "events", "onCreated"]);
    // Allow size to take on container bounds initially
    if (!size) {
        size = (_b = (_a = canvas.parentElement) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect()) !== null && _b !== void 0 ? _b : {
            width: 0,
            height: 0,
        };
    }
    // if (fiber && state) {
    //   // When a root was found, see if any fundamental props must be changed or exchanged
    //   // Check pixelratio
    //   if (
    //     props.dpr !== undefined &&
    //     state.viewport.dpr !== calculateDpr(props.dpr)
    //   )
    //     state.setDpr(props.dpr);
    //   // Check size
    //   if (
    //     state.size.width !== size.width ||
    //     state.size.height !== size.height
    //   )
    //     state.setSize(size.width, size.height);
    //   // Check frameloop
    //   if (state.frameloop !== props.frameloop)
    //     state.setFrameloop(props.frameloop);
    //   // For some props we want to reset the entire root
    //   // Changes to the color-space
    //   const linearChanged = props.linear !== state.internal.lastProps.linear;
    //   if (linearChanged) {
    //     unmountComponentAtNode(canvas);
    //     fiber = undefined;
    //   }
    // }
    // Create gl
    const glRenderer = createRendererInstance(gl, canvas);
    // Create store
    const store = createThreeStore(applyProps, invalidate, advance, Object.assign({ gl: glRenderer, size }, props));
    const state = store.getState();
    // Map it
    roots.set(canvas, { store });
    // Store events internally
    if (events)
        state.set({ events: events(store) });
    createEffect(() => {
        var _a, _b;
        const state = store.getState();
        // Flag the canvas active, rendering will now begin
        state.set((state) => ({ internal: Object.assign(Object.assign({}, state.internal), { active: true }) }));
        // Connect events
        (_b = (_a = state.events).connect) === null || _b === void 0 ? void 0 : _b.call(_a, canvas);
        // Notifiy that init is completed, the scene graph exists, but nothing has yet rendered
        // onCreated?.(state);
        state.invalidate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    });
    return store;
}
function unmountComponentAtNode(canvas, callback) {
    const root = roots.get(canvas);
    // const fiber = root?.fiber;
    // if (fiber) {
    //   const state = root?.store.getState();
    //   if (state) state.internal.active = false;
    //   reconciler.updateContainer(null, fiber, null, () => {
    //     if (state) {
    //       setTimeout(() => {
    //         try {
    //           state.events.disconnect?.();
    //           state.gl?.renderLists?.dispose?.();
    //           state.gl?.forceContextLoss?.();
    //           if (state.gl?.xr) state.internal.xr.disconnect();
    //           dispose(state);
    //           roots.delete(canvas);
    //           if (callback) callback(canvas);
    //         } catch (e) {
    //           /* ... */
    //         }
    //       }, 500);
    //     }
    //   });
    // }
}
// function createPortal(
//   children: React.ReactNode,
//   container: THREE.Object3D
// ): React.ReactNode {
//   return reconciler.createPortal(children, container, null, null);
// }
export { ThreeContext as context, 
// render,
createThreeRoot, unmountComponentAtNode, 
// createPortal,
applyProps, dispose, invalidate, advance, extend, addEffect, addAfterEffect, addTail, 
// act,
roots as _roots, };
