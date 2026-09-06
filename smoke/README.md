# Smoke page

A page that mounts the **built** widget against a **local mock API**, so the whole flow can
be walked without a backend, an org, or a real widget key.

Nothing here ships: `files: ["dist"]` keeps it out of the tarball, it has its own Vite
config rooted in this folder, and the package's `tsconfig.json` does not include it.

## Run it

Two terminals, from the package root:

```bash
# terminal 1 — the mock API on http://localhost:8787
npm run smoke:api

# terminal 2 — build the package, build the page, serve it on http://localhost:4173
npm run build
npm run smoke
```

Then open **http://localhost:4173/** (no CSP) or **http://localhost:4173/csp.html** (strict
CSP). `npm run smoke:dev` is the same page with hot reload on http://localhost:5173, if you
are changing the page itself.

Rebuild the package (`npm run build`) after touching `src/` — the page imports
`../dist/index.js` through an alias, which is the point: it exercises the bundle npm would
install, not the source.

## What to walk

1. **Greeting** — open the launcher, read the persona card.
2. **First message** — sends `POST /conversations`; the mock replies as an agent about four
   seconds later, delivered by the 3-second poll.
3. **Minimise** — the launcher shows an unread count when the agent replies while closed.
4. **Refresh the page** — the session is restored from `localStorage` and the transcript
   comes back.
5. **Continue on WhatsApp** — the handoff modal renders the QR from the mock's `wa.me` link.
6. **"Link to WhatsApp"** (page button) — flips the conversation to linked; the composer
   locks and the panel explains why.
7. **"Close conversation"** (page button) — the closed state, with **Start a new chat**.
8. **Start a new chat** — clears the stored session and returns to the greeting.

The four buttons on the page hit `/mock/reply`, `/mock/link`, `/mock/close` and
`/mock/reset`. Those routes exist only in the mock; they stand in for an operator in the
dashboard, or for the visitor actually sending the WhatsApp message.

## The CSP page

`csp.html` is the same page under
`default-src 'self'; connect-src 'self' http://localhost:8787; style-src 'self'; script-src 'self'` —
no `style-src 'unsafe-inline'`. That is the exact claim the package README makes: on
Chrome/Edge 73+, Firefox 101+ and Safari 16.4+ the widget adopts a constructable stylesheet
and renders identically to the unrestricted page. On an older engine it will render nothing
and log one line to the console, which is the documented fallback behaviour rather than a
bug.

## Limits of the mock

It holds one conversation in memory, allows any origin, enforces no rate limits, and accepts
any `jely_wk_` + 32-hex key. It imitates only what the widget can observe: the response
shapes from `src/types.ts`, the CORS headers, the `x-jely-session` check, and the 409 on a
locked or closed conversation. It is not a second implementation of the backend and must not
become one.
