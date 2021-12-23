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
export const DEFAULT = "__default";
export const isDiffSet = (def) => def && !!def.changes;
export function calculateDpr(dpr) {
    return Array.isArray(dpr)
        ? Math.min(Math.max(dpr[0], window.devicePixelRatio), dpr[1])
        : dpr;
}
/**
 * Picks or omits keys from an object
 * `omit` will filter out keys, and otherwise cherry-pick them.
 */
export function filterKeys(obj, omit, ...keys) {
    const keysToSelect = new Set(keys);
    return Object.entries(obj).reduce((acc, [key, value]) => {
        const shouldInclude = !omit;
        if (keysToSelect.has(key) === shouldInclude) {
            acc[key] = value;
        }
        return acc;
    }, {});
}
/**
 * Clones an object and cherry-picks keys.
 */
export const pick = (obj, keys) => filterKeys(obj, false, ...keys);
/**
 * Clones an object and prunes or omits keys.
 */
export const omit = (obj, keys) => filterKeys(obj, true, ...keys);
// A collection of compare functions
export const is = {
    obj: (a) => a === Object(a) && !is.arr(a) && typeof a !== "function",
    fun: (a) => typeof a === "function",
    str: (a) => typeof a === "string",
    num: (a) => typeof a === "number",
    und: (a) => a === void 0,
    arr: (a) => Array.isArray(a),
    equ(a, b) {
        // Wrong type or one of the two undefined, doesn't match
        if (typeof a !== typeof b || !!a !== !!b)
            return false;
        // Atomic, just compare a against b
        if (is.str(a) || is.num(a) || is.obj(a))
            return a === b;
        // Array, shallow compare first to see if it's a match
        if (is.arr(a) && a == b)
            return true;
        // Last resort, go through keys
        let i;
        for (i in a)
            if (!(i in b))
                return false;
        for (i in b)
            if (a[i] !== b[i])
                return false;
        return is.und(i) ? a === b : true;
    },
};
// Collects nodes and materials from a THREE.Object3D
export function buildGraph(object) {
    const data = { nodes: {}, materials: {} };
    if (object) {
        object.traverse((obj) => {
            if (obj.name)
                data.nodes[obj.name] = obj;
            if (obj.material && !data.materials[obj.material.name])
                data.materials[obj.material.name] = obj.material;
        });
    }
    return data;
}
// Disposes an object and all its properties
export function dispose(obj) {
    var _a, _b;
    if (obj.dispose && obj.type !== "Scene")
        obj.dispose();
    for (const p in obj) {
        (_b = (_a = p).dispose) === null || _b === void 0 ? void 0 : _b.call(_a);
        delete obj[p];
    }
}
// Each object in the scene carries a small LocalState descriptor
export function prepare(object, state) {
    const instance = object;
    if ((state === null || state === void 0 ? void 0 : state.primitive) || !instance.__r3f) {
        instance.__r3f = Object.assign({ root: null, memoizedProps: {}, eventCount: 0, handlers: {}, objects: [], parent: null }, state);
    }
    return object;
}
function resolve(instance, key) {
    let target = instance;
    if (key.includes("-")) {
        const entries = key.split("-");
        const last = entries.pop();
        target = entries.reduce((acc, key) => acc[key], instance);
        return { target, key: last };
    }
    else
        return { target, key };
}
export function attach(parent, child, type) {
    if (is.str(type)) {
        const { target, key } = resolve(parent, type);
        parent.__r3f.previousAttach = target[key];
        target[key] = child;
    }
    else if (is.arr(type)) {
        const [attach] = type;
        if (is.str(attach))
            parent[attach](child);
        else if (is.fun(attach))
            attach(parent, child);
    }
}
export function detach(parent, child, type) {
    if (is.str(type)) {
        const { target, key } = resolve(parent, type);
        target[key] = parent.__r3f.previousAttach;
    }
    else if (is.arr(type)) {
        const [, detach] = type;
        if (is.str(detach))
            parent[detach](child);
        else if (is.fun(detach))
            detach(parent, child);
    }
}
// Shallow check arrays, but check objects atomically
function checkShallow(a, b) {
    if (is.arr(a) && is.equ(a, b))
        return true;
    if (a === b)
        return true;
    return false;
}
// This function prepares a set of changes to be applied to the instance
export function diffProps(instance, _a, _b = {}, remove = false) {
    var _c;
    var { children: cN, key: kN, ref: rN } = _a, props = __rest(_a, ["children", "key", "ref"]);
    var { children: cP, key: kP, ref: rP } = _b, previous = __rest(_b, ["children", "key", "ref"]);
    const localState = ((_c = instance === null || instance === void 0 ? void 0 : instance.__r3f) !== null && _c !== void 0 ? _c : {});
    const entries = Object.entries(props);
    const changes = [];
    // Catch removed props, prepend them so they can be reset or removed
    if (remove) {
        const previousKeys = Object.keys(previous);
        for (let i = 0; i < previousKeys.length; i++) {
            if (!props.hasOwnProperty(previousKeys[i]))
                entries.unshift([previousKeys[i], DEFAULT + "remove"]);
        }
    }
    entries.forEach(([key, value]) => {
        var _a;
        // Bail out on primitive object
        if (((_a = instance.__r3f) === null || _a === void 0 ? void 0 : _a.primitive) && key === "object")
            return;
        // When props match bail out
        if (checkShallow(value, previous[key]))
            return;
        // Collect handlers and bail out
        if (/^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(key))
            return changes.push([key, value, true, []]);
        // Split dashed props
        let entries = [];
        if (key.includes("-"))
            entries = key.split("-");
        changes.push([key, value, false, entries]);
    });
    // const memoized: { [key: string]: any } = { ...props };
    // if (localState.memoizedProps && localState.memoizedProps.args)
    //   memoized.args = localState.memoizedProps.args;
    // if (localState.memoizedProps && localState.memoizedProps.attach)
    //   memoized.attach = localState.memoizedProps.attach;
    return { changes };
}
// This function applies a set of changes to the instance
export function applyProps(instance, data) {
    var _a, _b;
    // Filter equals, events and reserved props
    const localState = ((_a = instance === null || instance === void 0 ? void 0 : instance.__r3f) !== null && _a !== void 0 ? _a : {});
    const root = localState.root;
    const rootState = (_b = root === null || root === void 0 ? void 0 : root.getState()) !== null && _b !== void 0 ? _b : {};
    const { changes } = isDiffSet(data) ? data : diffProps(instance, data);
    const prevHandlers = localState.eventCount;
    // Prepare memoized props
    // if (instance.__r3f) instance.__r3f.memoizedProps = memoized;
    changes.forEach((change) => {
        applyProp(instance, change, localState, rootState);
    });
    if (localState.parent &&
        rootState.internal &&
        instance.raycast &&
        prevHandlers !== localState.eventCount) {
        // Pre-emptively remove the instance from the interaction manager
        const index = rootState.internal.interaction.indexOf(instance);
        if (index > -1)
            rootState.internal.interaction.splice(index, 1);
        // Add the instance to the interaction manager only when it has handlers
        if (localState.eventCount)
            rootState.internal.interaction.push(instance);
    }
    // Call the update lifecycle when it is being updated, but only when it is part of the scene
    if (changes.length && instance.parent)
        updateInstance(instance);
}
export function applyProp(instance, _a, localState, rootState) {
    var _b, _c;
    var [key, value, isEvent, keys] = _a;
    if (localState === void 0) { localState = (_b = instance === null || instance === void 0 ? void 0 : instance.__r3f) !== null && _b !== void 0 ? _b : {}; }
    if (rootState === void 0) { rootState = (_c = localState.root) === null || _c === void 0 ? void 0 : _c.getState(); }
    let currentInstance = instance;
    let targetProp = currentInstance[key];
    // Revolve dashed props
    if (keys.length) {
        targetProp = keys.reduce((acc, key) => acc[key], instance);
        // If the target is atomic, it forces us to switch the root
        if (!(targetProp && targetProp.set)) {
            const [name, ...reverseEntries] = keys.reverse();
            currentInstance = reverseEntries
                .reverse()
                .reduce((acc, key) => acc[key], instance);
            key = name;
        }
    }
    // https://github.com/mrdoob/three.js/issues/21209
    // HMR/fast-refresh relies on the ability to cancel out props, but threejs
    // has no means to do this. Hence we curate a small collection of value-classes
    // with their respective constructor/set arguments
    // For removed props, try to set default values, if possible
    if (value === DEFAULT + "remove") {
        if (targetProp && targetProp.constructor) {
            // use the prop constructor to find the default it should be
            value = new targetProp.constructor();
        }
        else if (currentInstance.constructor) {
            // create a blank slate of the instance and copy the particular parameter.
            // @ts-ignore
            const defaultClassCall = new currentInstance.constructor(currentInstance.__r3f.memoizedProps.args);
            value = defaultClassCall[targetProp];
            // destory the instance
            if (defaultClassCall.dispose)
                defaultClassCall.dispose();
            // instance does not have constructor, just set it to 0
        }
        else {
            value = 0;
        }
    }
    // Deal with pointer events ...
    if (isEvent) {
        if (value)
            localState.handlers[key] = value;
        else
            delete localState.handlers[key];
        localState.eventCount = Object.keys(localState.handlers).length;
    }
    // Special treatment for objects with support for set/copy, and layers
    else if (targetProp &&
        targetProp.set &&
        (targetProp.copy || targetProp instanceof THREE.Layers)) {
        // If value is an array
        if (Array.isArray(value)) {
            if (targetProp.fromArray)
                targetProp.fromArray(value);
            else
                targetProp.set(...value);
        }
        // Test again target.copy(class) next ...
        else if (targetProp.copy &&
            value &&
            value.constructor &&
            targetProp.constructor.name ===
                value.constructor.name) {
            targetProp.copy(value);
        }
        // If nothing else fits, just set the single value, ignore undefined
        // https://github.com/pmndrs/react-three-fiber/issues/274
        else if (value !== undefined) {
            const isColor = targetProp instanceof THREE.Color;
            // Allow setting array scalars
            if (!isColor && targetProp.setScalar)
                targetProp.setScalar(value);
            // Layers have no copy function, we must therefore copy the mask property
            else if (targetProp instanceof THREE.Layers &&
                value instanceof THREE.Layers)
                targetProp.mask = value.mask;
            // Otherwise just set ...
            else
                targetProp.set(value);
            // Auto-convert sRGB colors, for now ...
            // https://github.com/pmndrs/react-three-fiber/issues/344
            if (!rootState.linear && isColor)
                targetProp.convertSRGBToLinear();
        }
        // Else, just overwrite the value
    }
    else {
        currentInstance[key] = value;
        // Auto-convert sRGB textures, for now ...
        // https://github.com/pmndrs/react-three-fiber/issues/344
        if (!rootState.linear && currentInstance[key] instanceof THREE.Texture) {
            currentInstance[key].encoding = THREE.sRGBEncoding;
        }
    }
    if (
    // localState.parent &&
    rootState.internal &&
        instance.raycast
    // prevHandlers !== localState.eventCount
    ) {
        // Pre-emptively remove the instance from the interaction manager
        const index = rootState.internal.interaction.indexOf(instance);
        if (index > -1)
            rootState.internal.interaction.splice(index, 1);
        // Add the instance to the interaction manager only when it has handlers
        if (localState.eventCount)
            rootState.internal.interaction.push(instance);
    }
    invalidateInstance(instance);
    return { __return: instance, key, value };
}
export function invalidateInstance(instance) {
    var _a, _b, _c;
    const state = (_c = (_b = (_a = instance.__r3f) === null || _a === void 0 ? void 0 : _a.root) === null || _b === void 0 ? void 0 : _b.getState) === null || _c === void 0 ? void 0 : _c.call(_b);
    if (state && state.internal.frames === 0)
        state.invalidate();
}
export function updateInstance(instance) {
    var _a;
    (_a = instance.onUpdate) === null || _a === void 0 ? void 0 : _a.call(instance, instance);
}
export function toFirstUpper(string) {
    return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
}
