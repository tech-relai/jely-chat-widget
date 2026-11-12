# @jely/chat-widget

An embeddable web-chat widget for Jely. Visitors chat anonymously from
your site; your team answers from the Jely dashboard or from Slack; the visitor can
optionally continue the same conversation on WhatsApp.

React 18+ and React 19. Next.js App Router and Pages Router. There is no `<script>` embed.
To build your own chat UI — in React or any other framework — see **Build your own UI**.

---

## Before you install

The widget will not render until three things are true in the Jely developer console
(**Developer → Widget**):

1. The org has a **developer sender** (the WhatsApp number the widget hands off to). The
   Widget section is unavailable without one.
2. The widget is **enabled** and you have copied its **widget key** — `jely_wk_` followed
   by 32 hex characters.
3. Your site's origin is on the widget's **allowed-origins** list, spelled exactly as the
   browser sends it: `https://example.com`, `https://www.example.com`,
   `http://localhost:3000`. Scheme + host + optional port. No path, no trailing slash, no
   wildcards — `https://example.com` does **not** cover `https://www.example.com`, and both
   need their own entry. Add your dev origins too; there is no implicit localhost allowance.

The widget key is public by design. It ships in your client bundle, and it is safe there:
it can only start a conversation and post text from an origin you have allowlisted, under
per-key, per-IP and per-session rate limits.

---

## Install

```bash
npm install @jely/chat-widget
# or: pnpm add @jely/chat-widget / yarn add @jely/chat-widget
```

`react` and `react-dom` (>= 18) are peer dependencies — the package never bundles its own
copy. They are marked optional because `@jely/chat-widget/headless` does not use them; the
widget and `@jely/chat-widget/react` need React 18+. `qrcode` is bundled; you do not need to
install it.

---

## Next.js — App Router

The package ships with the `"use client"` directive already at the top of both bundles, so
a Server Component may import and render it directly. You do **not** need
`dynamic(..., { ssr: false })`, and there is no hydration mismatch to work around: the
widget renders `null` until an effect runs in the browser.

```tsx
// app/layout.tsx
import { JelyChatWidget } from "@jely/chat-widget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                {children}
                <JelyChatWidget widgetKey={process.env.NEXT_PUBLIC_JELY_WIDGET_KEY!} />
            </body>
        </html>
    );
}
```

```dotenv
# .env.local
NEXT_PUBLIC_JELY_WIDGET_KEY=jely_wk_0123456789abcdef0123456789abcdef
```

## Next.js — Pages Router

```tsx
// pages/_app.tsx
import type { AppProps } from "next/app";
import { JelyChatWidget } from "@jely/chat-widget";

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Component {...pageProps} />
            <JelyChatWidget widgetKey={process.env.NEXT_PUBLIC_JELY_WIDGET_KEY!} />
        </>
    );
}
```

Mounting it in `_app.tsx` (or `app/layout.tsx`) rather than per page is what keeps an open
conversation alive across client-side navigations.

---

## Props

```ts
import { JelyChatWidget, type JelyChatWidgetProps } from "@jely/chat-widget";
```

| Prop          | Type                              | Default                | What it does                                                                                                                                    |
| ------------- | --------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `widgetKey`   | `string` (**required**)           | —                      | The org's public widget key from the console.                                                                                                   |
| `apiBaseUrl`  | `string`                          | Jely's production API  | Point the widget at another Jely API origin. A trailing slash is stripped.                                                                      |
| `routes`      | `string[]`                        | every page             | Which paths the widget appears on. See below.                                                                                                   |
| `position`    | `"bottom-right" \| "bottom-left"` | `"bottom-right"`       | Which corner the launcher sits in.                                                                                                              |
| `appearance`  | `Partial<WidgetAppearance>`       | the console's settings | Locally override individual appearance fields.                                                                                                  |
| `defaultOpen` | `boolean`                         | `false`                | Open the panel instead of the launcher on first load. Ignored once the visitor has minimised the panel themselves — their choice is remembered. |
| `identity`    | `JelyChatIdentity`                | —                      | Who the visitor is on your site: `{ name?, email?, workspace? }`. Display-only and not verified. Can change at any time. See below.             |

Changing `widgetKey` remounts the widget with a clean session. Changing `position` moves
the launcher without discarding an open panel or a half-typed message.

### `routes`

Patterns are matched against `window.location.pathname` only — no query string, no hash,
no origin — and they are case-sensitive, because URL paths are. A trailing slash is
insignificant: `/pricing` and `/pricing/` are the same page.

- **Omit the prop** and the widget appears on every page.
- `"/pricing"` — exact match, that page only.
- `"/docs/*"` — the whole section: `/docs/install`, `/docs/a/b`, **and `/docs` itself**. It
  does not match `/docsearch`; the prefix keeps its slash.
- Nothing else is supported. No `?`, no `**`, no mid-pattern wildcards, no regex.

```tsx
<JelyChatWidget widgetKey={key} routes={["/pricing", "/docs/*"]} />
```

> **`routes={[]}` matches nothing and the widget never appears.** An omitted prop means
> "every page"; an empty array is read literally as a list of patterns containing no
> patterns. If you compute the list and it can come out empty, pass `undefined` instead.

Route changes are picked up on `popstate`, on `hashchange`, and on a 3-second timer — a
Next.js client-side navigation fires none of the first two, and the package will not
monkey-patch `history.pushState` on your site to avoid the poll.

### `appearance`

Appearance is configured per org in the console and fetched at load. This prop overrides
individual fields locally, for the pages this instance renders on:

```tsx
<JelyChatWidget widgetKey={key} appearance={{ accentColor: "#00A870", theme: "light" }} />
```

| Field           | Type                | Notes                                                                        |
| --------------- | ------------------- | ---------------------------------------------------------------------------- |
| `displayName`   | `string`            | The persona name on the greeting card and above agent replies. Max 60 chars. |
| `greeting`      | `string`            | Greeting headline. Max 200 chars.                                            |
| `tagline`       | `string`            | One supporting line under the greeting. Max 200 chars.                       |
| `avatarUrl`     | `string`            | Public URL of the persona avatar.                                            |
| `accentColor`   | `string`            | Six-digit hex, e.g. `"#FFD400"`. Anything else falls back to the default.    |
| `theme`         | `"dark" \| "light"` |                                                                              |
| `replyTimeText` | `string`            | Expectation-setting line. Max 120 chars.                                     |
| `ctaLabel`      | `string`            | Optional button on the greeting card; set together with `ctaUrl`.            |
| `ctaUrl`        | `string`            |                                                                              |

Precedence is **package defaults → console config → this prop**. Only keys you actually
pass override; passing `{ ctaLabel: undefined }` is the same as not passing it, and does
not clear a CTA configured in the console. Blank strings are treated as absent.

The package's neutral defaults are exported as `WIDGET_APPEARANCE_DEFAULTS` if you want to
render them somewhere yourself.

### `identity`

For a visitor who is logged in to your site, pass what you know and their conversation is
labelled with it on Jely's Support page and in Slack instead of its six-character reference.

```tsx
<JelyChatWidget
    widgetKey="jely_wk_…"
    identity={user ? { name: user.name, email: user.email, workspace: user.teamName } : undefined}
/>
```

- **Every field is optional.** Fields are trimmed and blank ones are ignored; a field you
  leave out is cleared on the conversation. A field the API would refuse — longer than 120
  characters (254 for `email`), or an `email` the API's validator rejects (it accepts ASCII
  addresses only) — is left out.
- **It can change at any time.** When a visitor logs in mid-chat, the conversation they
  already started is updated rather than a new one begun. It is sent once per distinct
  value, so passing a new object literal on every render costs nothing.
- **It is not verified.** Anyone can put anything in a browser; Jely shows it to your team
  marked as provided by your site, and never treats it as proof of who someone is.
- **It stays on the conversation after logout.** A custom UI can call `startNewChat()` at
  logout so the next person on that browser starts fresh (see **Build your own UI**).
- **Best-effort.** Sending it never shows the visitor an error and never interrupts the chat;
  a failure is retried on the next change or page load.

### Everything else the package exports

`JelyApiError` (the error class the widget's own network layer throws — exported so it can
be recognised by `code` in your error reporting rather than by message),
`DEFAULT_API_BASE_URL`, `WIDGET_MESSAGE_MAX_CHARS`, `JelyChatIdentity`, and the response/appearance types
(`WidgetAppearance`, `WidgetConversationView`, `WidgetMessageView`, `WidgetTheme`,
`WidgetConversationStatus`, `WidgetMessageDirection`, `WidgetApiErrorCode`, `ApiErrorBody`).

Nothing else is public from this entry. The two subpaths, `@jely/chat-widget/headless` and
`@jely/chat-widget/react`, are documented under **Build your own UI**. The API client,
storage helpers, polling, reducer, stylesheet and views are implementation details and
change without a major version.

---

## Content-Security-Policy

If your site sends a CSP, this is the whole of what the widget needs. These directives were
**measured** against a page served with `default-src 'self'; style-src 'self'` in Blink,
Gecko and WebKit — they are not a guess.

**Required, always**

```
connect-src https://jely-v2-api-9qirj.ondigitalocean.app
```

That is the API origin the widget polls and posts to. If you pass `apiBaseUrl`, use that
origin instead.

**Optional: `img-src` for an uploaded persona avatar**

```
img-src <the origin serving the avatar>
```

Only if you want the picture. **Without it the widget does not break** — a blocked avatar
falls back to the persona's initial, which is what a persona with no uploaded picture shows
anyway. The widget cannot lift your `img-src`, so it degrades instead of asking you to.

The handoff QR code is drawn as inline SVG paths, not a `data:` URI and not through a
canvas, so `img-src data:` is never needed.

**Not required: `style-src 'unsafe-inline'`**

The widget's stylesheet is adopted into its shadow root as a constructable stylesheet
(`new CSSStyleSheet()` + `replaceSync()` + `adoptedStyleSheets`). That path goes through
CSSOM, which CSP has no hook into, so it is unaffected by `style-src` in every browser
shipping today: **Chrome/Edge 73+, Firefox 101+, Safari 16.4+**. Dynamic values (the accent
colour) are set through React's `style` prop, which is also CSSOM, and never as a `style`
attribute string.

**The caveat, stated honestly.** On **Safari ≤ 16.3 (including iOS ≤ 16.3) and Firefox
≤ 100** there are no constructable stylesheets, so the widget falls back to a `<style>`
element in the shadow root — and a strict `style-src` **blocks** that element outright (its
`.sheet` is `null`). In that case the widget deliberately **renders nothing** and logs one
line to the console explaining why, rather than painting an unstyled column of text over
your page. If those visitors matter to you, add `style-src 'unsafe-inline'`; otherwise
accept that they will not see the widget. Nothing else is affected either way.

> A `<style>` element inside a shadow root is **not** exempt from `style-src`. Shadow DOM
> isolates the cascade, not CSP. This is counter-intuitive, which is exactly why it was
> measured rather than assumed.

**`script-src` is never involved.** The widget injects no script, no iframe and no external
resource of any kind. It is the code you already installed from npm.

---

## Behaviour worth knowing before you ship it

- **Text only, both directions, in this release.** No images, files or attachments — from
  the visitor or from your team.
- **A linked or closed conversation locks the composer.** When a visitor continues on
  WhatsApp, or an operator closes the conversation, the panel switches to a short
  explanatory state with a **"Start a new chat"** button. The transcript stays readable;
  only writing is refused. The button clears the local session and returns to the greeting.
- **The session lives in `localStorage`**, under `jely.widget.<widgetKey>` — the session
  token, the last message the visitor saw, whether the panel was minimised, and a short
  fingerprint (not the values) of the `identity` already sent. In a
  browser with site data blocked (Safari private mode, a sandboxed iframe, a strict privacy
  setting) every read and write fails silently: the widget still works, but a page refresh
  starts a **new** conversation instead of resuming the old one. Nothing errors, and the
  visitor sees no warning.
- **Nothing renders if the install is wrong.** An unknown or disabled key, an origin that is
  not on the allowlist, or an org with no developer sender means the widget renders nothing
  at all rather than an error box on your page. Check the console's Widget section, and your
  browser's network tab, if it does not appear.
- **Delivery is by polling**, not a socket: every 3 seconds while the panel is open, every
  15 seconds while minimised, every 30 seconds while the tab is hidden (browsers may slow a
  background tab further; coming back polls at once), and stopped once the conversation is
  linked or closed.
- **The launcher shows an unread count** when the panel is minimised and an agent replies.
  A reply that arrives while the tab is hidden stays unread until the visitor comes back.
- **A conversation is kept for 30 minutes** after the last message in either direction; the
  next page load after that starts a new one.
- **The widget mounts itself on `document.body`**, in a shadow root, at a very high
  `z-index` — high enough to clear any real stacking context, low enough that a cookie
  banner can still cover it. It is not rendered where you put the element, so your layout's
  `overflow: hidden` cannot clip it.
- **It does not trap focus and does not swallow your keyboard shortcuts.** Escape closes
  the panel only when the keystroke came from inside the widget.
- **No cookies and no credentials** are sent with any request.

---

## Build your own UI

The drop-in widget is the right choice almost always: one component, the console's
appearance, nothing else to maintain. If you need the chat to look or sit differently than
the widget allows — inline in a help page, in your own design system, in a framework other
than React — the package also exports the conversation without the widget. You render
everything; the package keeps the session, the polling and the rules.

Same prerequisites as the widget (see **Before you install**): the widget **enabled** in the
console, its **widget key**, and your site's origin on **allowed-origins**. The CSP is the
same too — `connect-src` to the API origin. Nothing else: no stylesheet is injected.

| Import                       | What it is                                                                        | Needs React |
| ---------------------------- | --------------------------------------------------------------------------------- | ----------- |
| `@jely/chat-widget/headless` | `createJelyChat` — a framework-free controller — plus helpers and types           | no          |
| `@jely/chat-widget/react`    | `useJelyChat`, plus everything `./headless` exports, so you import from one place | yes (18+)   |

`<JelyChatWidget>` is built on the same controller, so a custom UI gets exactly the
widget's behaviour. Custom UIs need not show the widget's "Powered by" line.

### React

```tsx
"use client";
import { useJelyChat } from "@jely/chat-widget/react";

export function SupportChat() {
    const { chat, state } = useJelyChat({ widgetKey: process.env.NEXT_PUBLIC_JELY_WIDGET_KEY! });

    // Null on the first render, while GET /config is in flight, and forever if the install
    // is wrong. Render nothing in all three cases — exactly what the widget does.
    if (chat === null || state === null || state.config === null || state.unavailable) return null;

    if (!state.open) return <button onClick={chat.open}>Chat ({state.unreadCount})</button>;
    if (state.phase === "greeting") return <Composer sending={state.sending} onSend={chat.start} />;

    return (
        <div>
            {state.messages.map((m) => (
                <p key={m.id} className={m.direction}>
                    {m.body}
                </p>
            ))}
            {state.phase === "chat" && <Composer sending={state.sending} onSend={chat.send} />}
            {(state.phase === "linked" || state.phase === "closed") && (
                <button onClick={chat.startNewChat}>Start a new chat</button>
            )}
        </div>
    );
}
```

`useJelyChat(options)` returns `{ chat, state }`. The controller is created in an effect —
never during a server render — and destroyed on unmount. It is recreated only when
`widgetKey` or `apiBaseUrl` changes; `defaultOpen` only seeds a new one. `identity` is
passed on to the live controller whenever its value changes (compared field by field, so an
inline object is fine).

### Any other framework

```js
import { createJelyChat } from "@jely/chat-widget/headless";

const chat = createJelyChat({ widgetKey: "jely_wk_…" });
const unsubscribe = chat.subscribe(() => render(chat.getState()));
render(chat.getState());

// when the chat leaves the page:
unsubscribe();
chat.destroy();
```

Creating the controller starts it: it reads `localStorage`, fetches the config and, if a
recent session is stored, restores it. Create it in the browser only. Importing the module
on a server is safe; nothing runs at import time.

Options, for both: `widgetKey` (required), `apiBaseUrl` (as the widget prop),
`defaultOpen` (open on first visit; the visitor's own open/minimised choice wins after
that), and `identity` (as the widget prop).

**Logged-in visitors.** Pass `identity` up front, or call `identify()` once you know who the
visitor is — after login, say. It follows the same rules as the widget's `identity` prop.

```js
const chat = createJelyChat({ widgetKey: "jely_wk_…" });
// …after your user logs in:
chat.identify({ name: user.name, email: user.email, workspace: user.teamName });
// …and at logout, if the next person on this browser should start fresh:
chat.startNewChat();
```

`getState()` returns the same object until something changes, so it works directly with
`useSyncExternalStore`, Svelte stores, signals and the like. Listeners take no arguments.

### State

| Field               | Type                                   | Notes                                                                         |
| ------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `config`            | `WidgetPublicConfigResponse \| null`   | Org name, appearance, `whatsapp.available`. Null until `GET /config` answers. |
| `unavailable`       | `boolean`                              | `GET /config` failed: the install is wrong. Render nothing.                   |
| `phase`             | `WidgetPhase`                          | Where the conversation is — see below.                                        |
| `open`              | `boolean`                              | Whether your panel is showing. Independent of `phase`.                        |
| `conversation`      | `WidgetConversationView \| null`       | `ref`, `status`, `linked`, `createdAt`.                                       |
| `messages`          | `WidgetMessageView[]`                  | Oldest first, deduplicated. `direction` is `"visitor"` or `"agent"`.          |
| `unreadCount`       | `number`                               | Agent messages after the last one the visitor saw. For a launcher badge.      |
| `lastSeenMessageId` | `string \| null`                       | The unread cursor.                                                            |
| `handoff`           | `RequestWidgetHandoffResponse \| null` | Set in the `handoff` phase.                                                   |
| `sending`           | `boolean`                              | A write is in flight. Disable your send button.                               |
| `error`             | `WidgetError \| null`                  | `{ code, message? }` from the last failed write. See **Errors**.              |

| `phase`    | Means                                     | Render                                                                     |
| ---------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| `idle`     | No conversation, panel never opened       | A launcher. `open()` moves to `greeting`.                                  |
| `greeting` | No conversation yet, panel open           | The org's greeting and a first-message composer → `start(text)`.           |
| `chat`     | A live conversation                       | Transcript, composer → `send(text)`, and the WhatsApp option if available. |
| `handoff`  | The visitor asked to continue on WhatsApp | The transcript plus the handoff (QR, link) from `state.handoff`.           |
| `linked`   | The visitor continued on WhatsApp         | Read-only transcript, "continue on WhatsApp" message, "Start a new chat".  |
| `closed`   | An operator closed the conversation       | Read-only transcript, "this conversation was closed", "Start a new chat".  |

A conversation that is both linked and closed is `linked`. Only the server moves a
conversation into `linked` or `closed`; only `startNewChat()` moves out.

### Actions

None of them throw or reject; a failure lands in `state.error`.

| Action               | Valid when                                                 | Does                                                                                                                   |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `start(text)`        | `greeting`                                                 | Creates the conversation with the first message. Call it only without a conversation — it starts a new one regardless. |
| `send(text)`         | `chat`                                                     | Sends a message. Does nothing without a session.                                                                       |
| `requestHandoff()`   | `chat`, and only offer it when `config.whatsapp.available` | Fetches the WhatsApp handoff and moves to `handoff`. Does nothing in any other phase.                                  |
| `dismissHandoff()`   | `handoff`                                                  | Back to `chat`.                                                                                                        |
| `startNewChat()`     | `chat`, `handoff`, `linked`, `closed`                      | Forgets the stored session and returns to `greeting`. The old conversation stays open for your team.                   |
| `open()` / `close()` | any                                                        | Shows or minimises your panel; remembered across page loads. `close()` during `handoff` returns to `chat`.             |
| `markSeen()`         | panel open                                                 | Call when the visitor has seen the newest message (e.g. scrolled to the bottom). Clears `unreadCount`.                 |
| `identify(identity)` | any                                                        | Sets who the visitor is (see `identity`). Sent now if there is a conversation, else with the first message.            |
| `clearError()`       | any                                                        | Clears `error`.                                                                                                        |
| `destroy()`          | once                                                       | Stops polling and drops listeners. `useJelyChat` does it for you on unmount.                                           |

New messages are already marked seen while the panel is open and the tab is visible;
`markSeen()` is for a UI that lets the visitor scroll away from the bottom, or that wants to
mark them seen when the tab comes back into view.

**Your composer must** trim the text, refuse an empty message, and cap it at
`WIDGET_MESSAGE_MAX_CHARS` (2000) — the controller sends what you give it, and the server
answers anything else with `VALIDATION_ERROR`.

### Handoff

`state.handoff` carries `waLink` (a `https://wa.me/…` link), `ref` (the conversation's
reference), `prefilledText` (the message the visitor is about to send — show it) and
`phoneDisplay` (the number, formatted; may be empty). Render `waLink` as a link, and the QR
for visitors on a desktop:

```tsx
import { buildHandoffQr } from "@jely/chat-widget/react"; // or /headless

const qr = buildHandoffQr(handoff.waLink); // null if it cannot be encoded — show the link alone
{
    qr && (
        <svg
            viewBox={`0 0 ${qr.viewBoxSize} ${qr.viewBoxSize}`}
            width={192}
            height={192}
            role="img"
            aria-label="WhatsApp QR code"
        >
            <rect width={qr.viewBoxSize} height={qr.viewBoxSize} fill="#fff" />
            <path d={qr.path} fill="#000" />
        </svg>
    );
}
```

The `viewBox` already includes the quiet zone scanners need; draw the code dark on light.
It is one SVG path — no `data:` URI, so no `img-src` change. Nothing is linked until the
visitor actually sends the WhatsApp message, so the visitor can dismiss and come back.

### Errors

`state.error.code` is one of these. `message` is the server's diagnostic text, for logs —
write your own copy for visitors. The widget's wording is shown for reference.

| `code`                                                         | Means                                                                                          | The widget shows                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `NETWORK_ERROR`                                                | No response: offline, the request timed out, your CSP blocked it, or the origin is not allowed | "We couldn't reach support just now. Try again in a moment."         |
| `RATE_LIMITED`                                                 | Too many requests. Let the visitor retry later; do not retry in a loop                         | "That's a lot of messages at once — give it a moment and try again." |
| `VALIDATION_ERROR`                                             | Empty or longer than `WIDGET_MESSAGE_MAX_CHARS`                                                | "Messages are limited to 2000 characters."                           |
| `CONVERSATION_LOCKED`                                          | Continued on WhatsApp; writes refused. `phase` turns `linked` straight after                   | "You're connected on WhatsApp"                                       |
| `CONVERSATION_CLOSED`                                          | Closed by an operator; writes refused. `phase` turns `closed` straight after                   | "This conversation was closed"                                       |
| `HANDOFF_DISABLED`                                             | The WhatsApp handoff is off for this org                                                       | "Moving to WhatsApp isn't available right now."                      |
| `SESSION_INVALID`, `CONVERSATION_NOT_FOUND`                    | Never in `state.error`: the session is dropped and `phase` returns to `greeting`               | —                                                                    |
| `WIDGET_KEY_INVALID`, `WIDGET_NOT_READY`, `ORIGIN_NOT_ALLOWED` | The install is wrong. On load this is `unavailable: true`, not an error                        | nothing (the widget does not render)                                 |
| `NOT_FOUND`, `INTERNAL_ERROR`, `UNKNOWN`                       | Anything else. `UNKNOWN` is a code this package does not recognise, or no code at all          | "That didn't send. Check your connection and try again."             |

`NETWORK_ERROR` and `UNKNOWN` are produced by the package, never sent by the server.

### Appearance

- `resolveAppearance(state.config.appearance, overrides?)` — the persona with the widget's
  precedence (package defaults → console → your overrides), blank strings treated as absent,
  and an invalid `accentColor` or `theme` replaced by the default.
- `resolveCta(appearance)` — `{ label, url }` when both are set, otherwise `null`.
- `WIDGET_APPEARANCE_DEFAULTS` — the neutral defaults.

### Fixed behaviour

None of this is configurable, and it is the same as the widget's:

- **One chat per widget key per page.** The session lives in `localStorage` under
  `jely.widget.<widgetKey>`, so two instances on one key — including a custom UI next to
  `<JelyChatWidget>` — would share and fight over it.
- **Sessions expire after 30 minutes** without a message in either direction (a sent
  identity counts too); the next page load starts fresh. Opening or minimising does not
  count.
- **Polling**: every 3 seconds while `open`, every 15 while minimised, every 30 while the tab
  is hidden, not before the config has loaded, and stopped once the conversation is linked
  or closed.
- **Starting a conversation sends the page URL and referrer**, as the widget does.

---

## Example

`examples/next-app/` in this repository is a minimal Next.js App Router app that mounts the
widget and nothing else. `examples/next-app/README.md` says how to run it.

## Local development against a mock API

`smoke/` contains a dependency-free mock of the seven widget endpoints and a page that mounts
the built widget against it, so the whole flow — greeting, chat, agent reply, WhatsApp
handoff, linked and closed states — can be walked without a backend. See `smoke/README.md`.

## Releasing

`RELEASING.md` in this repository is the checklist for shipping a change to npm — the checks,
the smoke walk, when to bump, and the rules that cannot be undone once a version is published.
It is a maintainer document and is not part of the published package.

---

## Requirements

- React >= 18, React DOM >= 18 (the widget and `./react`; not `./headless`)
- A browser with Shadow DOM (every browser since 2018). Without it the widget renders
  nothing rather than leaking styles into your page.
- Node >= 18 to build against.

## License

MIT
