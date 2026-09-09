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

/* Every gap in this stylesheet is a \`gap\` or an explicit margin. The user-agent margin on
 * a paragraph or a heading is neither, and \`all: initial\` on :host does not reach
 * descendants -- so the bullets, the recap footer and the timestamps were each carrying an
 * invisible 1em that no rule here asked for. */
h2,
p {
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
    --jely-scrim: rgba(0, 0, 0, 0.66);
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
    --jely-scrim: rgba(15, 23, 42, 0.44);
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

@keyframes j-fade-in {
    from {
        opacity: 0;
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

/* Pulls the close button back from the header's 11px gap so the two controls read as one
 * cluster — but not so close that "start a new chat", which discards the transcript the
 * visitor is looking at, becomes a mis-click on the way to closing the panel. */
.j-iconbutton--close {
    margin-left: -5px;
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

/* The label never wraps: it is the row's subject, and at the panel's 372px it was breaking
 * across two lines while the hint beside it still ellipsised. The hint yields instead --
 * it is the expendable half of the row. */
.j-wafooter__label {
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
    white-space: nowrap;
}

.j-wafooter__hint {
    flex: 0 1 auto;
    min-width: 0;
    margin-left: auto;
    padding-left: 8px;
    font-size: 11px;
    text-align: right;
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
   Powered-by badge
   --------------------------------------------------------------------------- */

.j-powered {
    padding: 6px 15px 7px;
    border-top: 1px solid var(--jely-line-soft);
    background: var(--jely-surface-header);
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.01em;
    color: var(--jely-faint);
}

.j-powered a {
    font-weight: 600;
    color: var(--jely-muted);
    text-decoration: none;
    transition: color 120ms ease;
}

.j-powered a:hover {
    color: var(--jely-fg);
    text-decoration: underline;
    text-underline-offset: 2px;
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

/* One message: the avatar row, and the timestamp under it when the run ends. A column,
 * so the timestamp cannot participate in the row's vertical alignment. */
.j-msg {
    display: flex;
    flex-direction: column;
    max-width: 100%;
}

/* The avatar (or its spacer) beside the bubble.
 *
 * align-items: flex-start puts the avatar level with the TOP of the bubble, which is where
 * widget-samples/ draws it and where it belongs now that it opens the run. It used to be
 * flex-end against a column of bubble + timestamp, which pushed the avatar a whole line
 * below the bubble it names. */
.j-msg__row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    max-width: 100%;
}

.j-msg--agent .j-msg__row {
    justify-content: flex-start;
}

.j-msg--visitor .j-msg__row {
    justify-content: flex-end;
}

/* Keeps a run's later bubbles aligned with the one that carries the avatar. */
.j-msg__spacer {
    flex: 0 0 auto;
}

/* The width cap sits HERE, on the flex item, and its percentage resolves against
 * .j-msg__row -- a full-width flex row.
 *
 * It must never resolve against a shrink-to-fit ancestor: when it did, the bubble's width
 * depended on the wrapper's and the wrapper's on the bubble's, and with overflow-wrap:
 * anywhere below (min-content width = one character) that circularity resolved by
 * collapsing the column to a single character: "hi" rendered as "h" over "i".
 *
 * min-width: 0 because a flex item defaults to min-width: auto and would otherwise refuse
 * to shrink below its content, pushing a long unbroken word out of the panel. */
.j-bubble {
    max-width: 84%;
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

/* Indented past the avatar column (24px + the row's 8px gap) so it starts where the
 * bubbles above it do, rather than under the avatar. */
.j-msg--agent .j-msg__time {
    margin-left: 32px;
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
   Handoff modal (the fourth sample is this view)

   position: fixed inside the shadow root, NOT absolute inside the panel. :host is fixed
   but carries no transform, filter or containment, so a fixed descendant of it resolves
   against the VIEWPORT -- which is how one shadow host still yields a page-centred modal
   without a second element on the customer's page. It is also why the modal must not be
   nested in .j-panel: that box is overflow: hidden and animates a transform on open.
   --------------------------------------------------------------------------- */

.j-modal {
    position: fixed;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: var(--jely-scrim);
    animation: j-fade-in 140ms ease-out;
}

.j-modal__card {
    display: flex;
    flex-direction: column;
    width: min(640px, 100%);
    max-height: 100%;
    border: 1px solid var(--jely-line);
    border-radius: var(--jely-radius-panel);
    background: var(--jely-surface);
    box-shadow: var(--jely-shadow);
    overflow: hidden;
    animation: j-panel-in 160ms ease-out;
}

/* The card takes focus on open so a screen reader announces the dialog, but it is not a
 * control and must not wear a control's ring -- that belongs to the close button, the link
 * and "Not now" inside it. */
.j-modal__card:focus-visible {
    outline: none;
}

.j-modal__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 0 0 auto;
    padding: 16px 15px 15px 18px;
    border-bottom: 1px solid var(--jely-line-soft);
    background: var(--jely-surface-header);
}

.j-modal__tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    border-radius: 10px;
    background: rgba(37, 211, 102, 0.14);
    color: var(--jely-whatsapp);
}

.j-modal__heading {
    flex: 1 1 auto;
    min-width: 0;
}

.j-modal__title {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    letter-spacing: -0.012em;
    line-height: 1.3;
}

.j-modal__subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--jely-muted);
}

/* Two columns, as the sample draws them: everything the visitor reads and acts on at the
 * left, the QR at the right. overflow-y is a floor, not the layout -- at the card's own
 * size nothing scrolls; it exists so a 500px-tall laptop window degrades to a scroll
 * instead of clipping the consent line. */
.j-modal__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    align-items: flex-start;
    gap: 20px;
    padding: 16px 18px;
    scrollbar-width: thin;
}

.j-modal__main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.j-modal__side {
    flex: 0 0 188px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
}

.j-modal__actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* The two steps. An <ol> with a CSS counter, not hardcoded numerals: when the QR cannot be
 * drawn, step 1 is replaced rather than dropped, and the counter keeps the pair reading 1
 * and 2 whatever ends up in them.
 *
 * Full-strength text at 13px, not the 12px muted grey the bullets here used to be. These
 * are the only two things the visitor has to do; they are the content of the view, not a
 * footnote to it. */
.j-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    counter-reset: j-step;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.j-step {
    counter-increment: j-step;
    display: flex;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--jely-fg);
}

.j-step::before {
    content: counter(j-step);
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 21px;
    height: 21px;
    margin-top: 1px;
    border-radius: 999px;
    background: var(--jely-raised-strong);
    font-size: 11px;
    font-weight: 650;
    line-height: 1;
}

/* What the recap card used to say, in one line. */
.j-assurance {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--jely-muted);
}

.j-assurance svg {
    flex: 0 0 auto;
    color: var(--jely-whatsapp);
}

/* The border is invisible on the dark palette -- a dark line around a white tile on a
 * near-black card -- and is what keeps the tile readable as a tile on the light one, where
 * it is otherwise white on white. */
.j-qr__tile {
    width: 100%;
    aspect-ratio: 1;
    padding: 10px;
    border: 1px solid var(--jely-line-soft);
    border-radius: var(--jely-radius-card);
    background: var(--jely-qr-tile);
}

.j-qr__tile svg {
    display: block;
    width: 100%;
    height: 100%;
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

/* The one control in the widget that is NOT the org's accent colour. It opens WhatsApp,
 * and a visitor deciding whether to move there recognises the green faster than they read
 * the label. */
.j-primary--whatsapp {
    background: var(--jely-whatsapp);
    color: #06331b;
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
    flex: 0 0 auto;
    margin: 0;
    padding: 11px 18px 14px;
    border-top: 1px solid var(--jely-line-soft);
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

    .j-modal {
        padding: 12px;
    }
}

/* The two-column body needs about 560px to breathe. Below that the recap and the QR both
 * squeeze until neither reads, so the card becomes one column -- with the QR AFTER the
 * call to action, because scanning it with the phone already holding it is a no-op and it
 * must not push "Open WhatsApp" off the screen.
 *
 * Its own breakpoint, wider than the panel's: this is the card's layout giving way, which
 * happens well before a viewport is narrow enough for the panel to go full-bleed. */
@media (max-width: 620px) {
    .j-modal__body {
        flex-direction: column;
        gap: 14px;
    }

    .j-modal__side {
        flex: 0 0 auto;
        align-self: center;
        width: 100%;
        max-width: 220px;
    }
}

@media (prefers-reduced-motion: reduce) {
    .j-panel,
    .j-modal,
    .j-modal__card {
        animation: none;
    }

    .j-launcher,
    .j-launcher:hover {
        transition: none;
        transform: none;
    }
}
`;
