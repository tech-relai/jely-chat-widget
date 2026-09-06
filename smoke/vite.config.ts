import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

/**
 * The smoke page's own build — entirely separate from the library build in the repo root.
 *
 * `root` is this folder, so nothing here is reachable from `vite build` at the root, and
 * the package's `tsconfig.json` (`include: ["src/**\/*", "vite.config.ts"]`) does not see
 * it either. The smoke page cannot break the package.
 *
 * The alias is the point: `@jely/chat-widget` resolves to the BUILT ESM bundle, so the
 * page exercises what npm would install. Build the package first.
 */
export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
        alias: {
            "@jely/chat-widget": fileURLToPath(new URL("../dist/index.js", import.meta.url)),
        },
    },
    esbuild: {
        jsx: "automatic",
    },
    build: {
        outDir: fileURLToPath(new URL("./dist", import.meta.url)),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: fileURLToPath(new URL("./index.html", import.meta.url)),
                csp: fileURLToPath(new URL("./csp.html", import.meta.url)),
            },
        },
    },
    server: { port: 5173 },
    preview: { port: 4173 },
});
