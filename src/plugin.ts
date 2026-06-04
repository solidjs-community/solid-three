import { runWithOwner } from "solid-js"
import type { Context, Plugin } from "./types.ts"

/**
 * Run each plugin's `setup` once per context, in the Canvas owner.
 *
 * Called from element creation (`createEntity` / `<Entity>`) — gated by a cheap
 * `plugins.length` check there — NOT from the per-attach scene-graph path, so a
 * no-plugin app pays nothing. Dedup is per-context (`context.initializedPlugins`),
 * so the first element carrying a plugin runs its setup and later ones skip it.
 * `runWithOwner(context.owner, …)` ties the setup's lifetime to the Canvas, so its
 * `onCleanup` fires on Canvas unmount, not when the triggering element unmounts.
 */
export function initPlugins(context: Context, plugins: Plugin[]) {
  for (const plugin of plugins) {
    if (context.initializedPlugins.has(plugin)) continue
    context.initializedPlugins.add(plugin)
    runWithOwner(context.owner, () => plugin.setup?.(context))
  }
}
