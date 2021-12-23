import * as THREE from "three";
import { StoreApi as UseStore } from "zustand/vanilla";
import { prepare, applyProps, applyProp } from "./utils";
import { RootState } from "./store";
import { EventHandlers } from "./events";
export declare type Root = {
    store: UseStore<RootState>;
};
export declare type LocalState = {
    root: UseStore<RootState>;
    objects: Instance[];
    parent: Instance | null;
    primitive?: boolean;
    eventCount: number;
    handlers: Partial<EventHandlers>;
    attach?: AttachType;
    previousAttach?: any;
    memoizedProps: {
        [key: string]: any;
    };
};
export declare type AttachFnType = (parent: Instance, self: Instance) => void;
export declare type AttachType = string | [attach: string | AttachFnType, detach: string | AttachFnType];
export declare type BaseInstance = Omit<THREE.Object3D, "children" | "attach" | "add" | "remove" | "raycast"> & {
    __r3f: LocalState;
    children: Instance[];
    remove: (...object: Instance[]) => Instance;
    add: (...object: Instance[]) => Instance;
    raycast?: (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => void;
};
export declare type Instance = BaseInstance & {
    [key: string]: any;
};
export declare type InstanceProps = {
    [key: string]: unknown;
} & {
    args?: any[];
    object?: object;
    visible?: boolean;
    dispose?: null;
    attach?: AttachType;
};
interface Catalogue {
    [name: string]: {
        new (...args: any): Instance;
    };
}
export declare let catalogue: Catalogue;
declare let extend: (objects: object) => void;
declare function createThreeRenderer<TCanvas>(roots: Map<TCanvas, Root>, getEventPriority?: () => any): {
    applyProps: typeof applyProps;
    applyProp: typeof applyProp;
    appendChild: (parentInstance: Instance, child: Instance) => void;
    createInstance: (type: string, { args, attach, ...props }: InstanceProps, root: UseStore<RootState> | Instance) => Instance;
    switchInstance: (instance: Instance, type: string, newProps: InstanceProps) => void;
    insertBefore: (parentInstance: Instance, child: Instance, beforeChild: Instance) => void;
    removeChild: (parentInstance: Instance, child: Instance, dispose?: boolean | undefined) => void;
    removeRecursive: (array: Instance[], parent: Instance, dispose?: boolean) => void;
};
export declare type ThreeRenderer = ReturnType<typeof createThreeRenderer>;
export { prepare, createThreeRenderer, extend };
//# sourceMappingURL=renderer.d.ts.map