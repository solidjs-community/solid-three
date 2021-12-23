import { createEvents } from "../core/events";
const DOM_EVENTS = {
    onClick: ["click", false],
    onContextMenu: ["contextmenu", false],
    onDoubleClick: ["dblclick", false],
    onWheel: ["wheel", true],
    onPointerDown: ["pointerdown", true],
    onPointerUp: ["pointerup", true],
    onPointerLeave: ["pointerleave", true],
    onPointerMove: ["pointermove", true],
    onPointerCancel: ["pointercancel", true],
    onLostPointerCapture: ["lostpointercapture", true],
};
export function createPointerEvents(store) {
    const { handlePointer } = createEvents(store);
    return {
        connected: false,
        handlers: Object.keys(DOM_EVENTS).reduce((acc, key) => (Object.assign(Object.assign({}, acc), { [key]: handlePointer(key) })), {}),
        connect: (target) => {
            var _a, _b;
            const { set, events } = store.getState();
            (_a = events.disconnect) === null || _a === void 0 ? void 0 : _a.call(events);
            set((state) => ({ events: Object.assign(Object.assign({}, state.events), { connected: target }) }));
            Object.entries((_b = events === null || events === void 0 ? void 0 : events.handlers) !== null && _b !== void 0 ? _b : []).forEach(([name, event]) => {
                const [eventName, passive] = DOM_EVENTS[name];
                target.addEventListener(eventName, event, { passive });
            });
        },
        disconnect: () => {
            var _a;
            const { set, events } = store.getState();
            if (events.connected) {
                Object.entries((_a = events.handlers) !== null && _a !== void 0 ? _a : []).forEach(([name, event]) => {
                    if (events && events.connected instanceof HTMLElement) {
                        const [eventName] = DOM_EVENTS[name];
                        events.connected.removeEventListener(eventName, event);
                    }
                });
                set((state) => ({ events: Object.assign(Object.assign({}, state.events), { connected: false }) }));
            }
        },
    };
}
