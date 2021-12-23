import * as THREE from "three";
import { AttachType, Instance, InstanceProps, LocalState } from "./renderer";
import { Dpr, RootState } from "./store";
export declare const DEFAULT = "__default";
export declare type DiffSet = {
    changes: [key: string, value: unknown, isEvent: boolean, keys: string[]][];
};
export declare const isDiffSet: (def: any) => def is DiffSet;
export declare type ClassConstructor = {
    new (): void;
};
export declare type ObjectMap = {
    nodes: {
        [name: string]: THREE.Object3D;
    };
    materials: {
        [name: string]: THREE.Material;
    };
};
export declare function calculateDpr(dpr: Dpr): number;
/**
 * Picks or omits keys from an object
 * `omit` will filter out keys, and otherwise cherry-pick them.
 */
export declare function filterKeys<TObj extends {
    [key: string]: any;
}, TOmit extends boolean, TKey extends keyof TObj>(obj: TObj, omit: TOmit, ...keys: TKey[]): TOmit extends true ? Omit<TObj, TKey> : Pick<TObj, TKey>;
/**
 * Clones an object and cherry-picks keys.
 */
export declare const pick: <TObj>(obj: Partial<TObj>, keys: (keyof TObj)[]) => Pick<Partial<TObj>, keyof TObj>;
/**
 * Clones an object and prunes or omits keys.
 */
export declare const omit: <TObj>(obj: Partial<TObj>, keys: (keyof TObj)[]) => Omit<Partial<TObj>, keyof TObj>;
export declare const is: {
    obj: (a: any) => boolean;
    fun: (a: any) => a is Function;
    str: (a: any) => a is string;
    num: (a: any) => a is number;
    und: (a: any) => boolean;
    arr: (a: any) => boolean;
    equ(a: any, b: any): boolean;
};
export declare function buildGraph(object: THREE.Object3D): ObjectMap;
export declare function dispose<TObj extends {
    dispose?: () => void;
    type?: string;
    [key: string]: any;
}>(obj: TObj): void;
export declare function prepare<T = THREE.Object3D>(object: T, state?: Partial<LocalState>): T;
export declare function attach(parent: Instance, child: Instance, type: AttachType): void;
export declare function detach(parent: Instance, child: Instance, type: AttachType): void;
export declare function diffProps(instance: Instance, { children: cN, key: kN, ref: rN, ...props }: InstanceProps, { children: cP, key: kP, ref: rP, ...previous }?: InstanceProps, remove?: boolean): DiffSet;
export declare function applyProps(instance: Instance, data: InstanceProps | DiffSet): void;
export declare function applyProp(instance: Instance, [key, value, isEvent, keys]: [
    key: string,
    value: unknown,
    isEvent: boolean,
    keys: string[]
], localState?: LocalState, rootState?: RootState): {
    __return: Instance;
    key: string;
    value: unknown;
};
export declare function invalidateInstance(instance: Instance): void;
export declare function updateInstance(instance: Instance): void;
export declare function toFirstUpper(string: string): string;
//# sourceMappingURL=utils.d.ts.map