import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/**
 * Library build: one entry, ESM + CJS + `.d.ts`.
 *
 * THE `"use client"` BANNER is the load-bearing detail. This package is a client
 * component: it uses hooks, `localStorage` and the DOM. Without the directive at the very
 * top of the bundle, a Next.js App Router page that imports it fails at build time
 * ("useState only works in a Client Component"). Rollup's `output.banner` puts it above
 * everything — including the CJS `"use strict"` — and it is applied after esbuild's
 * transform, so nothing downstream can move it. The build is verified by reading the two
 * emitted files, not by trusting this.
 *
 * REACT IS NEVER BUNDLED. It is a peer dependency (>=18); bundling a second copy would
 * break hooks in the host app. Vite's library mode does NOT externalize peer dependencies
 * on its own, so the pattern below does it explicitly — subpaths included, because JSX
 * compiles to an import of `react/jsx-runtime`.
 *
 * `qrcode` IS bundled (it is a real dependency, §4.9): a customer installing this package
 * should not have to add a transitive dep of ours to their own package.json.
 *
 * The output is NOT minified. This is a library, not an app — every consumer's bundler
 * minifies it anyway, and unminified output keeps stack traces from a customer's site
 * readable and keeps the banner check above honest.
 */
export default defineConfig({
    plugins: [
        dts({
            include: ["src"],
            insertTypesEntry: true,
            // The .d.ts files carry no runtime code, so they need no "use client".
        }),
    ],
    build: {
        target: "es2020",
        minify: false,
        sourcemap: true,
        emptyOutDir: true,
        lib: {
            entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
            name: "JelyChatWidget",
            formats: ["es", "cjs"],
            fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
        },
        rollupOptions: {
            external: [/^react($|\/)/, /^react-dom($|\/)/],
            output: {
                banner: '"use client";',
            },
        },
    },
});
