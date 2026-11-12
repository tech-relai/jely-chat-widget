import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/**
 * Library build: three entries — the root widget, `./headless` and `./react` — each as
 * ESM + CJS + `.d.ts`. What they share (the controller, `qrcode`, the hook) is split into
 * chunks by Rollup, so `qrcode` is bundled once per format, not once per entry.
 *
 * THE `"use client"` BANNER is the load-bearing detail. The root and `./react` entries are
 * client components: they use hooks, `localStorage` and the DOM. Without the directive at
 * the very top of those files, a Next.js App Router page that imports one fails at build time
 * ("useState only works in a Client Component"). Rollup's `output.banner` puts it above
 * everything — including the CJS `"use strict"` — and it is applied after esbuild's
 * transform, so nothing downstream can move it. `isClientChunk` below decides which files
 * get it; the build is verified by reading the emitted files, not by trusting this.
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
 *
 * SOURCEMAPS SHIP, THEIR SOURCE TEXT DOES NOT. Rollup's `sourcemapExcludeSources` drops the
 * maps' `sourcesContent` array, keeping the file-and-line mapping a stack trace from a
 * customer's site needs while leaving the embedded copy of every source file out of the
 * published tarball. That copy is not a neutral extra: it carried this repo's internal
 * paths and its prose, which is not something to hand to every consumer of a public
 * package for the sake of a convenience devtools only uses when someone has it open. The
 * bundles are unminified, so the mapped line is legible on its own. It also halves the
 * download: 269.0 kB packed became 130.8 kB (measured with `npm pack --dry-run`; the
 * remainder of the drop came from keeping this repo's internal paths out of the emitted
 * `.d.ts` files, which is why the figure is lower than the sourcemap strip alone gave).
 */
/**
 * Which output files get `"use client"`: the root and `./react` entries (what a Next.js
 * page imports), and any shared chunk that imports React. The `./headless` entry and the
 * shared core chunk get none — they are plain modules a Server Component may import.
 */
const REACT_IMPORT = /^react($|\/)|^react-dom($|\/)/;
function isClientChunk(chunk: { isEntry: boolean; name: string; imports: string[] }): boolean {
    if (chunk.isEntry && chunk.name !== "headless") return true;
    return chunk.imports.some((id) => REACT_IMPORT.test(id));
}

export default defineConfig({
    plugins: [
        dts({
            include: ["src"],
            // One self-contained `.d.ts` per entry (api-extractor). Unbundled declarations
            // import each other WITHOUT file extensions, which TypeScript's `node16` /
            // `nodenext` resolution rejects, so a consumer on those settings got `any`.
            rollupTypes: true,
            // `require` needs its own `.d.cts`: under `node16` a `.d.ts` in a
            // `"type": "module"` package describes an ES module, and a CommonJS consumer
            // would be told it cannot `require` the package at all. The content is
            // identical; only the extension tells TypeScript which module system it is.
            afterBuild: async (emitted) => {
                for (const [path, content] of emitted) {
                    if (path.endsWith(".d.ts")) await writeFile(path.replace(/\.d\.ts$/, ".d.cts"), content);
                }
            },
            // The .d.ts files carry no runtime code, so they need no "use client".
        }),
    ],
    build: {
        target: "es2020",
        minify: false,
        sourcemap: true,
        emptyOutDir: true,
        lib: {
            entry: {
                index: fileURLToPath(new URL("src/index.ts", import.meta.url)),
                headless: fileURLToPath(new URL("src/headless.ts", import.meta.url)),
                react: fileURLToPath(new URL("src/react.ts", import.meta.url)),
            },
            formats: ["es", "cjs"],
            fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
        },
        rollupOptions: {
            external: [/^react($|\/)/, /^react-dom($|\/)/],
            output: {
                banner: (chunk) => (isClientChunk(chunk) ? '"use client";' : ""),
                sourcemapExcludeSources: true,
            },
        },
    },
});
