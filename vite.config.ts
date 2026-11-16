// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      // React Email pulls htmlparser2, which needs entities v4.5.0 — a nested v7 copy
      // drops ./lib/decode.js and breaks SSR. Pin those imports to the hoisted v4 copy.
      // Only bare "entities" and its lib/ paths are pinned: parse5 (chat markdown) imports
      // "entities/decode", which exists only in its own nested newer copy.
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: path.resolve(rootDir, "node_modules/entities/lib/decode.js") },
        { find: /^entities\/lib\/encode\.js$/, replacement: path.resolve(rootDir, "node_modules/entities/lib/encode.js") },
        { find: /^entities$/, replacement: path.resolve(rootDir, "node_modules/entities") },
      ],
    },
  },
});
