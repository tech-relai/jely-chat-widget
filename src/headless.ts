/**
 * `@jely/chat-widget/headless` — the conversation without the widget: no React, no CSS,
 * no visitor copy. For a team building its own chat UI in any framework.
 *
 *   import { createJelyChat } from "@jely/chat-widget/headless";
 *
 * The controller owns everything the shipped widget does — config, session restore and its
 * 5-minute TTL, polling, unread counts, the WhatsApp handoff, linked and closed states —
 * and a UI only renders `getState()` and calls its methods. React users can import the
 * same names, plus `useJelyChat`, from `@jely/chat-widget/react`.
 *
 * THE SURFACE IS SMALL ON PURPOSE, as on the root entry: the controller, the few pure
 * helpers a custom UI needs to match the widget (appearance, CTA, QR), and types. The API
 * client, the reducer, the polling and the storage helpers stay private so they can change
 * without a major version. Errors arrive as codes; the wording is the UI's.
 */

export { createJelyChat } from "./core/createJelyChat";
export type { JelyChat, JelyChatOptions, JelyChatState } from "./core/types";
export type { WidgetError, WidgetErrorCode } from "./core/errors";
export type { WidgetPhase } from "./state";

export { buildHandoffQr, type HandoffQr } from "./qr";
export { WIDGET_APPEARANCE_DEFAULTS, resolveAppearance, resolveCta } from "./appearance";
export { DEFAULT_API_BASE_URL } from "./api";

// The shapes the controller exposes (hand-mirrored from the contract, F7).
export {
    WIDGET_MESSAGE_MAX_CHARS,
    type ApiErrorBody,
    type RequestWidgetHandoffResponse,
    type WidgetApiErrorCode,
    type WidgetAppearance,
    type WidgetConversationStatus,
    type WidgetConversationView,
    type WidgetMessageDirection,
    type WidgetMessageView,
    type WidgetPublicConfigResponse,
    type WidgetTheme,
} from "./types";
