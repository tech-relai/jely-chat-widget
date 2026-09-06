# @jely/chat-widget

An embeddable web-chat widget for Jely. Visitors chat anonymously from
your site; your team answers from the Jely dashboard or from Slack; the visitor can
optionally continue the same conversation on WhatsApp.

React 18+ and React 19. Next.js App Router and Pages Router. No other framework is
supported, and there is no `<script>` embed.

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
copy. `qrcode` is bundled; you do not need to install it.

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

### Everything else the package exports

`JelyApiError` (the error class the widget's own network layer throws — exported so it can
be recognised by `code` in your error reporting rather than by message),
`DEFAULT_API_BASE_URL`, `WIDGET_MESSAGE_MAX_CHARS`, and the response/appearance types
(`WidgetAppearance`, `WidgetConversationView`, `WidgetMessageView`, `WidgetTheme`,
`WidgetConversationStatus`, `WidgetMessageDirection`, `WidgetApiErrorCode`, `ApiErrorBody`).

Nothing else is public. The API client, storage helpers, polling hook, reducer, stylesheet
and views are implementation details and change without a major version.

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

**Required if your persona has an uploaded avatar**

```
img-src <the origin serving the avatar>
```

The avatar is the only image the widget loads from the network. The handoff QR code is
drawn as inline SVG elements — no `data:` URI, no canvas — so `img-src data:` is **not**
needed.

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
  token, the last message the visitor saw, and whether the panel was minimised. In a
  browser with site data blocked (Safari private mode, a sandboxed iframe, a strict privacy
  setting) every read and write fails silently: the widget still works, but a page refresh
  starts a **new** conversation instead of resuming the old one. Nothing errors, and the
  visitor sees no warning.
- **Nothing renders if the install is wrong.** An unknown or disabled key, an origin that is
  not on the allowlist, or an org with no developer sender means the widget renders nothing
  at all rather than an error box on your page. Check the console's Widget section, and your
  browser's network tab, if it does not appear.
- **Delivery is by polling**, not a socket: every 3 seconds while the panel is open, every
  15 seconds while minimised, paused entirely while the tab is hidden, and stopped once the
  conversation is linked or closed.
- **The launcher shows an unread count** when the panel is minimised and an agent replies.
- **The widget mounts itself on `document.body`**, in a shadow root, at a very high
  `z-index` — high enough to clear any real stacking context, low enough that a cookie
  banner can still cover it. It is not rendered where you put the element, so your layout's
  `overflow: hidden` cannot clip it.
- **It does not trap focus and does not swallow your keyboard shortcuts.** Escape closes
  the panel only when the keystroke came from inside the widget.
- **No cookies and no credentials** are sent with any request.

---

## Example

`examples/next-app/` in this repository is a minimal Next.js App Router app that mounts the
widget and nothing else. `examples/next-app/README.md` says how to run it.

## Local development against a mock API

`smoke/` contains a dependency-free mock of the six widget endpoints and a page that mounts
the built widget against it, so the whole flow — greeting, chat, agent reply, WhatsApp
handoff, linked and closed states — can be walked without a backend. See `smoke/README.md`.

---

## Requirements

- React >= 18, React DOM >= 18
- A browser with Shadow DOM (every browser since 2018). Without it the widget renders
  nothing rather than leaking styles into your page.
- Node >= 18 to build against.

## License

MIT
