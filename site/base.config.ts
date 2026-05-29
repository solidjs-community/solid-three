// Deploy base path. GitHub Pages serves this project under /<repo>/, so the
// built site lives at this subpath. Must start and end with a slash ("/" for
// root). Consumed by vite.config.ts (Vite base + nitro baseURL) and by
// scripts/rewrite-base.ts (post-build HTML rewrite).
export const BASE: string = "/solid-three/"
