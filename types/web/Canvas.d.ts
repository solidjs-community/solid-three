import { RenderProps } from "../core";
import { RootState } from "../core/store";
import { JSX } from "solid-js";
import { StoreApi } from "zustand/vanilla";
import { EventManager } from "../core/events";
export interface Props extends Omit<RenderProps<HTMLCanvasElement>, "size" | "events"> {
    children: JSX.Element;
    fallback?: JSX.Element;
    events?: (store: StoreApi<RootState>) => EventManager<any>;
    id?: string;
    class?: string;
    height?: string;
    width?: string;
    tabIndex?: number;
}
export declare function Canvas(props: Props): JSX.Element;
//# sourceMappingURL=Canvas.d.ts.map