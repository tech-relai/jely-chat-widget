/*
 * The widget's entire stylesheet, hand-written (F5: no Tailwind, no CSS-in-JS runtime),
 * injected once into the shadow root through `applyWidgetStyles`.
 *
 * IT IS A CONSTANT, NOT A FUNCTION OF THE APPEARANCE — and that is load-bearing.
 * `applyWidgetStyles` APPENDS to `adoptedStyleSheets`, so rebuilding the text whenever the
 * accent or theme changed would stack a new sheet on every change. Everything dynamic is
 * therefore expressed as a CSS custom property that the mounted tree sets through React's
 * `style` prop (CSSOM — permitted under a strict `style-src`; see the measured table in
 * `styles.ts`), and both palettes live here behind `.j-root--dark` / `.j-root--light`.
 *
 * The properties the tree must supply are exactly those from `accentCssVariables()`:
 * `--jely-accent`, `--jely-accent-ink`, `--jely-accent-soft`, `--jely-accent-line`,
 * `--jely-accent-glow`. Every one has a fallback in `var(…, …)` so a tree that somehow
 * renders without them is still legible rather than transparent.
 *
 * DESIGN NOTES (`Planning-docs/memory/ui-direction.md` + `widget-samples/`):
 *   - Dark, near-black surfaces with a single thin border; the accent appears on ONE
 *     filled control per view and as a low-opacity tint on the visitor's own bubbles.
 *     Never a gradient, never a full-bleed accent panel.
 *   - Dense, small type: 13px body, 11.5px secondary, 15px headline. Buttons are not
 *     bigger than body text.
 *   - The neutral palette is the dashboard's own widget preview palette
 *     (`jelyv2-frontend/src/pages/developer/widget/WidgetPreview.tsx`), so the console
 *     preview and the real widget are the same object in two places.
 *   - Explicitly avoided (ui-direction's anti-patterns): oversized rounded cards, hero
 *     sections, centred marketing copy, purple gradients, decorative emoji.
 */

export const WIDGET_CSS = `
/* ---------------------------------------------------------------------------
   Host + reset
   The host is the only element the customer's page can see. \`all: initial\` stops the
   page's inherited font, colour and line-height reaching the shadow tree; the shadow
   boundary already blocks their selectors, but not inheritance.
   --------------------------------------------------------------------------- */

:host {
    all: initial;
    position: fixed;
    z-index: 2147483000;
    bottom: 20px;
    right: 20px;
    left: auto;
    display: block;
    width: auto;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue",
        Arial, "Noto Sans", sans-serif;
    font-size: 13px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
}

:host([data-jely-position="bottom-left"]) {
    right: auto;
    left: 20px;
}

:host([hidden]) {
    display: none;
}

*,
*::before,
*::after {
    box-sizing: border-box;
}

button,
input,
textarea {
    font: inherit;
    color: inherit;
    margin: 0;
}

button {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
}

a {
    color: inherit;
}

/* ---------------------------------------------------------------------------
   Palettes
   --------------------------------------------------------------------------- */

.j-root {
    --jely-radius-panel: 18px;
    --jely-radius-card: 12px;
    --jely-radius-control: 10px;
    --jely-whatsapp: #25d366;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    color: var(--jely-fg);
}

:host([data-jely-position="bottom-left"]) .j-root {
    align-items: flex-start;
}

.j-root--dark {
    color-scheme: dark;
    --jely-surface: #101114;
    --jely-surface-header: #16181d;
    --jely-raised: #1b1d23;
    --jely-raised-strong: #22252d;
    --jely-line: #2a2d35;
    --jely-line-soft: #21242b;
    --jely-fg: #f4f4f5;
    --jely-muted: #9ca0aa;
    --jely-faint: #6c7079;
    --jely-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.4);
    --jely-qr-tile: #ffffff;
    --jely-qr-ink: #0b0c0f;
}

.j-root--light {
    color-scheme: light;
    --jely-surface: #ffffff;
    --jely-surface-header: #fafafa;
    --jely-raised: #f4f4f5;
    --jely-raised-strong: #ebebed;
    --jely-line: #e4e4e7;
    --jely-line-soft: #eeeef0;
    --jely-fg: #18181b;
    --jely-muted: #71717a;
    --jely-faint: #a1a1aa;
    --jely-shadow: 0 20px 44px rgba(15, 23, 42, 0.16), 0 2px 6px rgba(15, 23, 42, 0.08);
    --jely-qr-tile: #ffffff;
    --jely-qr-ink: #0b0c0f;
}

:focus-visible {
    outline: 2px solid var(--jely-accent, #ffd400);
    outline-offset: 2px;
    border-radius: 4px;
}

/* ---------------------------------------------------------------------------
   Launcher (E6 carries the unread badge here)
   --------------------------------------------------------------------------- */

.j-launcher {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    max-width: min(280px, calc(100vw - 40px));
    padding: 7px 16px 7px 7px;
    border: 1px solid var(--jely-line);
    border-radius: 999px;
    background: var(--jely-surface);
    box-shadow: var(--jely-shadow);
    transition: transform 140ms ease, background-color 140ms ease;
}

.j-launcher:hover {
    background: var(--jely-surface-header);
    transform: translateY(-1px);
}

.j-launcher:active {
    transform: translateY(0);
}

.j-launcher__label {
    font-size: 13.5px;
    font-weight: 550;
    letter-spacing: -0.005em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.j-launcher__glyph {
    display: inline-flex;
    color: var(--jely-muted);
    flex: 0 0 auto;
}

.j-launcher__avatar {
    position: relative;
    flex: 0 0 auto;
}

.j-launcher__badge {
    position: absolute;
    top: -3px;
    right: -3px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 999px;
    border: 2px solid var(--jely-surface);
    background: var(--jely-accent, #ffd400);
    color: var(--jely-accent-ink, #18181b);
    font-size: 10px;
    font-weight: 700;
    line-height: 13px;
    text-align: center;
}

/* ---------------------------------------------------------------------------
   Panel shell
   --------------------------------------------------------------------------- */

.j-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 372px;
    max-width: calc(100vw - 32px);
    max-height: min(640px, calc(100vh - 40px));
    border: 1px solid var(--jely-line);
    border-radius: var(--jely-radius-panel);
    background: var(--jely-surface);
    box-shadow: var(--jely-shadow);
    overflow: hidden;
    animation: j-panel-in 160ms ease-out;
}

/* The CHAT panel gets a definite height. .j-panel alone sets only max-height, so the
 * window was sized by its content: a new conversation with one short message produced a
 * box barely taller than the composer, which then grew and shrank under the reader as
 * messages arrived. A messaging surface wants its composer anchored in one place from the
 * first message onward. Scoped to --chat deliberately: the greeting card is a short card
 * and must stay content-sized. */
.j-panel--chat {
    height: min(560px, calc(100vh - 40px));
}

@keyframes j-panel-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
}

.j-header {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 15px 14px 14px 15px;
    background: var(--jely-surface-header);
    border-bottom: 1px solid var(--jely-line-soft);
}

.j-header__text {
    min-width: 0;
    flex: 1 1 auto;
}

.j-header__title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.011em;
    line-height: 1.3;
}

.j-header__identity {
    margin: 3px 0 0;
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--jely-muted);
}

.j-tagline {
    margin: 6px 0 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--jely-muted);
}

.j-iconbutton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    flex: 0 0 auto;
    border-radius: 7px;
    color: var(--jely-faint);
    transition: background-color 120ms ease, color 120ms ease;
}

.j-iconbutton:hover {
    background: var(--jely-raised);
    color: var(--jely-fg);
}

.j-body {
    padding: 14px 15px 15px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* ---------------------------------------------------------------------------
   Avatar
   --------------------------------------------------------------------------- */

.j-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--jely-raised);
    color: var(--jely-fg);
    font-weight: 600;
    overflow: hidden;
    flex: 0 0 auto;
    user-select: none;
}

.j-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.j-avatar--lg {
    width: 38px;
    height: 38px;
    font-size: 14px;
}

.j-avatar--md {
    width: 34px;
    height: 34px;
    font-size: 13px;
}

.j-avatar--sm {
    width: 24px;
    height: 24px;
    font-size: 10.5px;
}

/* ---------------------------------------------------------------------------
   Reply-time line, CTA, composer, guest note
   --------------------------------------------------------------------------- */

.j-replytime {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--jely-muted);
}

.j-replytime__dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--jely-accent, #ffd400);
    box-shadow: 0 0 0 3px var(--jely-accent-glow, rgba(255, 212, 0, 0.22));
}

.j-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px;
    border-radius: var(--jely-radius-control);
    background: var(--jely-accent, #ffd400);
    color: var(--jely-accent-ink, #18181b);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    text-align: center;
    transition: filter 120ms ease;
}

.j-cta:hover {
    filter: brightness(0.94);
}

.j-composer {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 7px 7px 7px 12px;
    border: 1px solid var(--jely-line);
    border-radius: var(--jely-radius-card);
    background: var(--jely-raised);
    transition: border-color 120ms ease;
}

.j-composer:focus-within {
    border-color: var(--jely-accent-line, rgba(255, 212, 0, 0.38));
}

.j-composer__input {
    flex: 1 1 auto;
    min-width: 0;
    max-height: 96px;
    padding: 7px 0;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    font-size: 13px;
    line-height: 1.45;
    color: var(--jely-fg);
}

.j-composer__input::placeholder {
    color: var(--jely-faint);
}

.j-send {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--jely-accent, #ffd400);
    color: var(--jely-accent-ink, #18181b);
    transition: filter 120ms ease, opacity 120ms ease;
}

.j-send:hover {
    filter: brightness(0.94);
}

.j-send:disabled {
    cursor: default;
    opacity: 0.45;
    filter: none;
}

.j-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--jely-faint);
}

.j-note svg {
    flex: 0 0 auto;
    margin-top: 1px;
}

.j-error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--jely-line);
    border-radius: 9px;
    background: var(--jely-raised);
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--jely-muted);
}

.j-error button {
    margin-left: auto;
    color: var(--jely-faint);
    display: inline-flex;
}

/* ---------------------------------------------------------------------------
   WhatsApp footer row
   --------------------------------------------------------------------------- */

.j-wafooter {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 15px;
    border-top: 1px solid var(--jely-line-soft);
    background: var(--jely-surface);
    text-align: left;
    transition: background-color 120ms ease;
}

.j-wafooter:hover {
    background: var(--jely-surface-header);
}

.j-wafooter__label {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
}

.j-wafooter__hint {
    margin-left: auto;
    font-size: 11px;
    color: var(--jely-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.j-wa-glyph {
    color: var(--jely-whatsapp);
    display: inline-flex;
    flex: 0 0 auto;
}

/* ---------------------------------------------------------------------------
   Transcript
   --------------------------------------------------------------------------- */

.j-transcript {
    flex: 1 1 auto;
    /* 0, not a pixel floor: a flex child defaults to min-height: auto, which refuses to
     * shrink below its content and so never becomes a scroll container -- the transcript
     * would push the composer out of the panel instead of scrolling. */
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 14px 15px 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
}

.j-transcript::-webkit-scrollbar {
    width: 8px;
}

.j-transcript::-webkit-scrollbar-thumb {
    background: var(--jely-line);
    border-radius: 999px;
}

.j-daymark {
    align-self: center;
    padding: 2px 0;
    font-size: 11px;
    color: var(--jely-faint);
}

.j-msg {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    max-width: 100%;
}

.j-msg--agent {
    justify-content: flex-start;
}

.j-msg--visitor {
    justify-content: flex-end;
}

/* Keeps a run's later bubbles aligned with the one that carries the avatar. */
.j-msg__spacer {
    flex: 0 0 auto;
}

/* The bubble and its timestamp, stacked. THIS carries the width cap, not the bubble.
 *
 * The cap used to sit on .j-bubble, whose containing block is this wrapper -- which is
 * itself shrink-to-fit, so the bubble's width depended on the wrapper's and the wrapper's
 * on the bubble's. With overflow-wrap: anywhere below, whose min-content width is a single
 * character, that circularity resolved by collapsing the column to one character wide:
 * "hi" rendered as "h" over "i". Here the percentage resolves against .j-msg, a flex row
 * of known width, so there is nothing circular about it.
 *
 * min-width: 0 because a flex item defaults to min-width: auto and would otherwise refuse
 * to shrink below its content, pushing a long unbroken word out of the panel. */
.j-msg__stack {
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 84%;
}

.j-bubble {
    max-width: 100%;
    min-width: 0;
    padding: 9px 12px;
    border-radius: 13px;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.j-bubble--agent {
    background: var(--jely-raised);
    border: 1px solid var(--jely-line-soft);
    border-bottom-left-radius: 5px;
}

.j-bubble--visitor {
    background: var(--jely-accent-soft, rgba(255, 212, 0, 0.16));
    border: 1px solid var(--jely-accent-line, rgba(255, 212, 0, 0.38));
    border-bottom-right-radius: 5px;
}

.j-msg__time {
    margin-top: 3px;
    font-size: 10.5px;
    color: var(--jely-faint);
}

.j-msg--visitor .j-msg__time {
    text-align: right;
}

.j-jump {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 96px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px;
    border: 1px solid var(--jely-line);
    border-radius: 999px;
    background: var(--jely-raised-strong);
    color: var(--jely-fg);
    font-size: 11.5px;
    font-weight: 550;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}

.j-composerwrap {
    padding: 8px 15px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* ---------------------------------------------------------------------------
   Locked footers (linked / closed) — E5's "start a new chat" lives here
   --------------------------------------------------------------------------- */

.j-locked {
    display: flex;
    gap: 11px;
    padding: 13px 15px 15px;
    border-top: 1px solid var(--jely-line-soft);
    background: var(--jely-surface-header);
}

.j-locked__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    border-radius: 8px;
    background: var(--jely-raised);
}

.j-locked__title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
}

.j-locked__body {
    margin: 3px 0 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--jely-muted);
}

.j-textbutton {
    margin-top: 9px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 12px;
    border: 1px solid var(--jely-line);
    border-radius: 8px;
    background: var(--jely-surface);
    font-size: 12px;
    font-weight: 550;
    transition: background-color 120ms ease;
}

.j-textbutton:hover {
    background: var(--jely-raised);
}

/* ---------------------------------------------------------------------------
   Handoff (overlays the panel; the fourth sample is this view)
   --------------------------------------------------------------------------- */

.j-handoff {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    background: var(--jely-surface);
    animation: j-panel-in 140ms ease-out;
}

.j-handoff__head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 15px 14px 14px 15px;
    border-bottom: 1px solid var(--jely-line-soft);
    background: var(--jely-surface-header);
}

.j-handoff__tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    border-radius: 10px;
    background: rgba(37, 211, 102, 0.14);
    color: var(--jely-whatsapp);
}

.j-handoff__scroll {
    flex: 1 1 auto;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 14px 15px 16px;
    display: flex;
    flex-direction: column;
    gap: 13px;
    scrollbar-width: thin;
}

.j-recap {
    border: 1px solid var(--jely-line-soft);
    border-radius: var(--jely-radius-card);
    background: var(--jely-surface-header);
    padding: 11px 12px 10px;
}

.j-recap__label {
    margin: 0 0 9px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: var(--jely-faint);
}

.j-recap__line {
    display: flex;
    margin-bottom: 7px;
}

.j-recap__line--visitor {
    justify-content: flex-end;
}

.j-recap__bubble {
    max-width: 88%;
    padding: 7px 10px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--jely-muted);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.j-recap__foot {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px solid var(--jely-line-soft);
    font-size: 11.5px;
    color: var(--jely-muted);
}

.j-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
}

.j-qr__tile {
    width: 148px;
    height: 148px;
    padding: 8px;
    border-radius: var(--jely-radius-card);
    background: var(--jely-qr-tile);
}

.j-qr__tile svg {
    display: block;
    width: 100%;
    height: 100%;
}

.j-qr__caption {
    margin: 0;
    max-width: 250px;
    text-align: center;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--jely-muted);
}

.j-bullets {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.j-bullet {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--jely-muted);
}

.j-bullet svg {
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--jely-faint);
}

.j-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 16px;
    border-radius: var(--jely-radius-control);
    background: var(--jely-accent, #ffd400);
    color: var(--jely-accent-ink, #18181b);
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.005em;
    text-decoration: none;
    transition: filter 120ms ease;
}

.j-primary:hover {
    filter: brightness(0.94);
}

.j-subtle {
    align-self: center;
    padding: 4px 8px;
    font-size: 12.5px;
    font-weight: 550;
    color: var(--jely-muted);
}

.j-subtle:hover {
    color: var(--jely-fg);
}

.j-consent {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.5;
    color: var(--jely-faint);
}

.j-phoneline {
    margin: 0;
    text-align: center;
    font-size: 11.5px;
    color: var(--jely-muted);
}

/* ---------------------------------------------------------------------------
   Utilities + preferences
   --------------------------------------------------------------------------- */

.j-sronly {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

@media (max-width: 460px) {
    :host {
        bottom: 12px;
        right: 12px;
    }

    :host([data-jely-position="bottom-left"]) {
        left: 12px;
    }

    .j-panel {
        width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
    }
}

@media (prefers-reduced-motion: reduce) {
    .j-panel,
    .j-handoff {
        animation: none;
    }

    .j-launcher,
    .j-launcher:hover {
        transition: none;
        transform: none;
    }
}
`;
