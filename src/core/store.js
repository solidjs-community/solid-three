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
import create from "zustand/vanilla";
import { prepare } from "./renderer";
import { calculateDpr } from "./utils";
import { createContext } from "solid-js";
import { subscribeWithSelector } from "zustand/middleware";
export const isRenderer = (def) => !!(def === null || def === void 0 ? void 0 : def.render);
export const isOrthographicCamera = (def) => def && def.isOrthographicCamera;
const ThreeContext = createContext(null);
const createThreeStore = (applyProps, invalidate, advance, props) => {
    const { gl, size, shadows = false, linear = false, flat = false, orthographic = false, frameloop = "always", dpr = [1, 2], performance, clock = new THREE.Clock(), raycaster: raycastOptions, camera: cameraOptions, onPointerMissed, } = props;
    // Set shadowmap
    if (shadows) {
        gl.shadowMap.enabled = true;
        if (typeof shadows === "object")
            Object.assign(gl.shadowMap, shadows);
        else
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    // Set color preferences
    if (linear)
        gl.outputEncoding = THREE.LinearEncoding;
    if (flat)
        gl.toneMapping = THREE.NoToneMapping;
    // clock.elapsedTime is updated using advance(timestamp)
    if (frameloop === "never") {
        clock.stop();
        clock.elapsedTime = 0;
    }
    const rootState = create(subscribeWithSelector((set, get) => {
        // Create custom raycaster
        const raycaster = new THREE.Raycaster();
        const _a = raycastOptions || {}, { params } = _a, options = __rest(_a, ["params"]);
        applyProps(raycaster, Object.assign(Object.assign({ enabled: true }, options), { params: Object.assign(Object.assign({}, raycaster.params), params) }));
        // Create default camera
        const isCamera = cameraOptions instanceof THREE.Camera;
        const camera = isCamera
            ? cameraOptions
            : orthographic
                ? new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 1000)
                : new THREE.PerspectiveCamera(75, 0, 0.1, 1000);
        if (!isCamera) {
            camera.position.z = 5;
            if (cameraOptions)
                applyProps(camera, cameraOptions);
            // Always look at center by default
            if (!(cameraOptions === null || cameraOptions === void 0 ? void 0 : cameraOptions.rotation))
                camera.lookAt(0, 0, 0);
        }
        const initialDpr = calculateDpr(dpr);
        const position = new THREE.Vector3();
        const defaultTarget = new THREE.Vector3();
        const tempTarget = new THREE.Vector3();
        function getCurrentViewport(camera = get().camera, target = defaultTarget, size = get().size) {
            const { width, height } = size;
            const aspect = width / height;
            if (target instanceof THREE.Vector3)
                tempTarget.copy(target);
            else
                tempTarget.set(...target);
            const distance = camera
                .getWorldPosition(position)
                .distanceTo(tempTarget);
            if (isOrthographicCamera(camera)) {
                return {
                    width: width / camera.zoom,
                    height: height / camera.zoom,
                    factor: 1,
                    distance,
                    aspect,
                };
            }
            else {
                const fov = (camera.fov * Math.PI) / 180; // convert vertical fov to radians
                const h = 2 * Math.tan(fov / 2) * distance; // visible height
                const w = h * (width / height);
                return { width: w, height: h, factor: width / w, distance, aspect };
            }
        }
        let performanceTimeout = undefined;
        const setPerformanceCurrent = (current) => set((state) => ({ performance: Object.assign(Object.assign({}, state.performance), { current }) }));
        // Handle frame behavior in WebXR
        const handleXRFrame = (timestamp) => {
            const state = get();
            if (state.frameloop === "never")
                return;
            advance(timestamp, true);
        };
        // Toggle render switching on session
        const handleSessionChange = () => {
            gl.xr.enabled = gl.xr.isPresenting;
            gl.setAnimationLoop(gl.xr.isPresenting ? handleXRFrame : null);
            // If exiting session, request frame
            if (!gl.xr.isPresenting)
                invalidate(get());
        };
        // WebXR session manager
        const xr = {
            connect() {
                gl.xr.addEventListener("sessionstart", handleSessionChange);
                gl.xr.addEventListener("sessionend", handleSessionChange);
            },
            disconnect() {
                gl.xr.removeEventListener("sessionstart", handleSessionChange);
                gl.xr.removeEventListener("sessionend", handleSessionChange);
            },
        };
        // Subscribe to WebXR session events
        if (gl.xr)
            xr.connect();
        return {
            gl,
            set,
            get,
            invalidate: () => invalidate(get()),
            advance: (timestamp, runGlobalEffects) => advance(timestamp, runGlobalEffects, get()),
            linear,
            flat,
            scene: prepare(new THREE.Scene()),
            camera,
            controls: null,
            raycaster,
            clock,
            mouse: new THREE.Vector2(),
            frameloop,
            onPointerMissed,
            performance: Object.assign(Object.assign({ current: 1, min: 0.5, max: 1, debounce: 200 }, performance), { regress: () => {
                    const state = get();
                    // Clear timeout
                    if (performanceTimeout)
                        clearTimeout(performanceTimeout);
                    // Set lower bound performance
                    if (state.performance.current !== state.performance.min)
                        setPerformanceCurrent(state.performance.min);
                    // Go back to upper bound performance after a while unless something regresses meanwhile
                    performanceTimeout = setTimeout(() => setPerformanceCurrent(get().performance.max), state.performance.debounce);
                } }),
            size: { width: 800, height: 600 },
            viewport: {
                initialDpr,
                dpr: initialDpr,
                width: 0,
                height: 0,
                aspect: 0,
                distance: 0,
                factor: 0,
                getCurrentViewport,
            },
            setSize: (width, height) => {
                const size = { width, height };
                set((state) => ({
                    size,
                    viewport: Object.assign(Object.assign({}, state.viewport), getCurrentViewport(camera, defaultTarget, size)),
                }));
            },
            setDpr: (dpr) => set((state) => ({
                viewport: Object.assign(Object.assign({}, state.viewport), { dpr: calculateDpr(dpr) }),
            })),
            setFrameloop: (frameloop = "always") => set(() => ({ frameloop })),
            events: { connected: false },
            internal: {
                active: false,
                priority: 0,
                frames: 0,
                lastProps: props,
                lastEvent: { current: null },
                interaction: [],
                hovered: new Map(),
                subscribers: [],
                initialClick: [0, 0],
                initialHits: [],
                capturedMap: new Map(),
                xr,
                subscribe: (ref, priority = 0) => {
                    set(({ internal }) => ({
                        internal: Object.assign(Object.assign({}, internal), { 
                            // If this subscription was given a priority, it takes rendering into its own hands
                            // For that reason we switch off automatic rendering and increase the manual flag
                            // As long as this flag is positive there can be no internal rendering at all
                            // because there could be multiple render subscriptions
                            priority: internal.priority + (priority > 0 ? 1 : 0), 
                            // Register subscriber and sort layers from lowest to highest, meaning,
                            // highest priority renders last (on top of the other frames)
                            subscribers: [...internal.subscribers, { ref, priority }].sort((a, b) => a.priority - b.priority) }),
                    }));
                    return () => {
                        set(({ internal }) => ({
                            internal: Object.assign(Object.assign({}, internal), { 
                                // Decrease manual flag if this subscription had a priority
                                priority: internal.priority - (priority > 0 ? 1 : 0), 
                                // Remove subscriber from list
                                subscribers: internal.subscribers.filter((s) => s.ref !== ref) }),
                        }));
                    };
                },
            },
        };
    }));
    const state = rootState.getState();
    // Resize camera and renderer on changes to size and pixelratio
    let oldSize = state.size;
    let oldDpr = state.viewport.dpr;
    rootState.subscribe(() => {
        const { camera, size, viewport, internal } = rootState.getState();
        if (size !== oldSize || viewport.dpr !== oldDpr) {
            // https://github.com/pmndrs/react-three-fiber/issues/92
            // Do not mess with the camera if it belongs to the user
            if (!camera.manual &&
                !(internal.lastProps.camera instanceof THREE.Camera)) {
                if (isOrthographicCamera(camera)) {
                    camera.left = size.width / -2;
                    camera.right = size.width / 2;
                    camera.top = size.height / 2;
                    camera.bottom = size.height / -2;
                }
                else {
                    camera.aspect = size.width / size.height;
                }
                camera.updateProjectionMatrix();
                // https://github.com/pmndrs/react-three-fiber/issues/178
                // Update matrix world since the renderer is a frame late
                camera.updateMatrixWorld();
            }
            // Update renderer
            gl.setPixelRatio(viewport.dpr);
            gl.setSize(size.width, size.height);
            oldSize = size;
            oldDpr = viewport.dpr;
        }
    });
    // Update size
    if (size)
        state.setSize(size.width, size.height);
    // Invalidate on any change
    rootState.subscribe((state) => invalidate(state));
    // Return root state
    return rootState;
};
export { createThreeStore, ThreeContext };
