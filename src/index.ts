/**
 * `@jely/chat-widget` — the package entry.
 *
 * THE PUBLIC SURFACE IS SMALL ON PURPOSE. A host mounts one component; everything else it
 * gets is a type it might reasonably want to write down (an `appearance` override, an
 * error code it catches) or a constant it might want to display. The API client, the
 * storage helpers, the polling hook, the reducer, the stylesheet and the views are
 * implementation and are NOT exported: they change without a major version, and a package
 * that exports its internals cannot change them at all.
 *
 * A team building its own chat UI does not import from here: `@jely/chat-widget/headless`
 * (no React) and `@jely/chat-widget/react` (`useJelyChat`) expose the same conversation the
 * widget runs on. This entry stays exactly what it was, so existing installs are unaffected.
 *
 * Published to npm as `@jely/chat-widget`; publishing is a manual step by the user — see
 * `RELEASING.md`.
 */

export { JelyChatWidget, type JelyChatWidgetProps } from "./JelyChatWidget";

/** The `identity` prop's shape: who the visitor is on your site. */
export type { JelyChatIdentity } from "./core/identity";

/** The neutral placeholder persona (F6), used until `GET /config` answers. */
export { WIDGET_APPEARANCE_DEFAULTS } from "./appearance";

/**
 * Thrown by nothing the host calls directly today, but exported so an error surfaced in a
 * host's own error reporting can be recognised and read by `code` rather than by message.
 */
export { JelyApiError, DEFAULT_API_BASE_URL } from "./api";

// The shapes the widget exchanges with the Jely API (hand-mirrored from the contract, F7).
export {
    WIDGET_MESSAGE_MAX_CHARS,
    type ApiErrorBody,
    type WidgetApiErrorCode,
    type WidgetAppearance,
    type WidgetConversationStatus,
    type WidgetConversationView,
    type WidgetMessageDirection,
    type WidgetMessageView,
    type WidgetTheme,
} from "./types";
