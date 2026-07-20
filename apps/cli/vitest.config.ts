import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // index.test.ts dynamically re-imports index.ts per command, relying on
    // vi.resetModules() to get a fresh `commander` Command instance each time.
    // commander is CJS and gets externalized (and thus its module-level state
    // cached) by default, which resetModules() can't reach — inlining it
    // routes it through Vite's transform pipeline so resets actually work.
    server: {
      deps: {
        inline: ["commander"],
      },
    },
  },
});
