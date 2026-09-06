# Example — Next.js App Router

The smallest app that mounts `@jely/chat-widget`: a root layout, one page, and the widget.

It is **not** part of the published package (`files: ["dist"]`), it is not a workspace
member, and it has its own `package.json`, `tsconfig.json` and `node_modules`. Nothing here
can affect `npm run build` or `npm run typecheck` in the package root.

## Run it

```bash
# 1. From the package root — the example resolves the package's dist/, so build first.
npm install && npm run build

# 2. Then here.
cd examples/next-app
npm install
cp .env.local.example .env.local     # put your real widget key in it
npm run dev                          # http://localhost:3000
```

`@jely/chat-widget` is installed as `file:../..`, so npm symlinks the package folder and
Next.js resolves the **built** `dist/` through the package's `exports` map — exactly what a
customer installing from npm gets. Rebuild the package (`npm run build` at the root) after
changing its source; `next dev` picks the new bundle up on the next reload.

## Before the widget will appear

Two things must be true in the Jely developer console, or the widget renders nothing at all
(by design — see the package README):

1. The widget is enabled and you are using its real key.
2. `http://localhost:3000` is on the org's **allowed-origins** list.

To walk the flow without a backend or a real key, use the mock API and smoke page in
`smoke/` at the package root instead.
