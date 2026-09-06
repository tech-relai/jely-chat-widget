/*
 * HAND-MIRROR OF THE JELY API CONTRACT — keep this file in sync by hand.
 *
 * Mirrors: `jelyv2-frontend/contract/endpoints/widgetPublic.contract.ts`
 *          (the canonical contract; `jelyv2-backend/contract/` is a byte-identical
 *          copy of it, so either path shows the same file)
 * Plus the widget-relevant error codes from `contract/shared/common.ts`
 *          (`ApiErrorCodeSchema`, `ApiErrorSchema`).
 *
 * Mirrored on: 2026-09-06
 * Source sha256: ee6d118b123c8084aa2a98f2577563ae99c83779e8bb83f9f12bf096c965a284
 *                (of `widgetPublic.contract.ts`, 385 lines, at mirror time)
 *
 * WHY THIS FILE EXISTS (decision F7). This package must not depend on either Jely
 * repo: it is published to npm and installed on customer websites, and the contract
 * folder is not a package. So the shapes are restated here as plain TypeScript — no
 * zod, no runtime validation. That makes this THE file in the package that can rot
 * silently: nothing here breaks when the server changes, the widget just starts
 * mis-reading responses at runtime.
 *
 * HOW TO RE-CHECK IT (do this whenever you touch this package):
 *
 *   1. From the workspace root, compare the checksum above:
 *        shasum -a 256 jelyv2-frontend/contract/endpoints/widgetPublic.contract.ts
 *      Same hash  → this mirror is current; nothing to do.
 *      Different  → step 2.
 *   2. Read the contract's ledger for what moved and why:
 *        grep -n "widgetPublic" jelyv2-frontend/contract/CHANGELOG.md
 *      Every API change is required to append an entry there before it is implemented.
 *   3. Diff by section. This file is laid out in the SAME ORDER as the contract, with
 *      the same section banners, so the two read side by side. Update the types, then
 *      update BOTH the date and the sha256 above in the same commit.
 *
 * WHAT IS DELIBERATELY NOT MIRRORED: the `defineEndpoint(...)` declarations (paths and
 * methods live in `api.ts`, which is the only file that talks to the network), the
 * console-only avatar bounds (`WIDGET_AVATAR_*` — the dashboard enforces those, the
 * widget never uploads), and the zod refinements themselves. Validation is the server's
 * job; the widget trusts the response shape and fails loudly if a fetch rejects.
 */

// ---------------------------------------------------------------------------
// Limits and formats (source of truth for backend middleware, console + widget)
// ---------------------------------------------------------------------------

/** Maximum characters in a single widget message body, either direction. */
export const WIDGET_MESSAGE_MAX_CHARS = 2000;

/** Maximum entries in an org's widget origin allowlist. */
export const WIDGET_MAX_ALLOWED_ORIGINS = 20;

/**
 * Fixed-window rate limits for the widget channel, enforced server-side and
 * process-local. Mirrored so the widget can explain a 429 in the visitor's terms and
 * so `usePolling`'s intervals can be checked against them: the 3s open poll is exactly
 * 20 requests/minute, which is why `messagesPerSessionPerMinute` is applied to the
 * message POST only and never to the poll — a widget left open would otherwise rate-limit
 * itself simply by staying open.
 */
export const WIDGET_RATE_LIMITS = {
    /** New conversations per client IP per hour (`POST /conversations`). */
    newConversationsPerIpPerHour: 10,
    /** Messages per widget session per minute (`POST /conversation/messages`). */
    messagesPerSessionPerMinute: 20,
    /** Requests per widget key per minute, across every widget route. */
    requestsPerKeyPerMinute: 600,
} as const;

/**
 * The public widget key: `jely_wk_` + 32 lowercase hex characters. Plaintext at rest
 * on the server and embedded in the customer's website bundle by design; its blast
 * radius is bounded by the org's origin allowlist and the rate limits above.
 */
export const WIDGET_KEY_PATTERN = /^jely_wk_[0-9a-f]{32}$/;
export type WidgetKey = string;

/**
 * An allowed origin, in the exact shape a browser puts in the `Origin` header:
 * scheme + host + optional port, nothing else. No path, no trailing slash, no
 * wildcard. Mirrored for the README and any local sanity check — the widget never
 * evaluates it, the server does.
 */
export const WIDGET_ORIGIN_PATTERN =
    /^https?:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;
export type WidgetAllowedOrigin = string;

/**
 * A conversation's public reference — 6 characters of the RFC 4648 base32 alphabet
 * (A-Z and 2-7, so the ambiguous 0/1/8/9 never appear), uppercase, globally unique.
 * It labels the conversation in Slack and on the Support page while the visitor is
 * anonymous, and it is the code carried by the WhatsApp handoff message.
 */
export const SUPPORT_REF_PATTERN = /^[A-Z2-7]{6}$/;
export type SupportRef = string;

/**
 * The per-session secret issued ONCE by `POST /conversations` and kept in the widget's
 * localStorage. Opaque to the client: only its sha256 is stored server-side, bound to
 * exactly one conversation in one org. Lose it and the visitor starts a new
 * conversation — there is no way to ask the server for it again.
 */
export type WidgetSessionToken = string;

/** The request header the session token travels in. */
export const WIDGET_SESSION_HEADER = "x-jely-session";

// ---------------------------------------------------------------------------
// Shared views
// ---------------------------------------------------------------------------

/** Widget colour scheme. The accent colour is applied on top of the chosen palette. */
export type WidgetTheme = "dark" | "light";

/**
 * How the widget presents itself: the persona the visitor talks to, not the operators
 * behind it (every agent reply renders under this persona — decision R3). Configured in
 * the developer console's Widget section and served by `GET /config`; the package's
 * `appearance` prop may override individual fields locally.
 */
export interface WidgetAppearance {
    /** Persona name shown on the greeting card and above agent bubbles, e.g. "Support". Max 60 chars. */
    displayName: string;
    /** Greeting headline, e.g. "Hi — how can we help?". Max 200 chars. */
    greeting: string;
    /** One-line supporting text under the greeting. Max 200 chars. */
    tagline: string;
    /** Public URL of the persona avatar. Omitted when none is uploaded. */
    avatarUrl?: string;
    /** Accent colour as a 6-digit hex triplet, e.g. "#FFCC00". */
    accentColor: string;
    theme: WidgetTheme;
    /** Expectation-setting line, e.g. "Typically replies in a few minutes". Max 120 chars. */
    replyTimeText: string;
    /** Optional call-to-action button on the greeting card. Both fields are set together. */
    ctaLabel?: string;
    ctaUrl?: string;
}

/** Conversation lifecycle as the visitor sees it. */
export type WidgetConversationStatus = "open" | "closed";

/**
 * The visitor's view of their own conversation. `linked` becomes true once the visitor
 * has continued on WhatsApp — the widget then locks into its "WhatsApp connected" state
 * and every write route answers 409 `CONVERSATION_LOCKED`. Deliberately minimal: no
 * contact, no operator, no org internals.
 */
export interface WidgetConversationView {
    ref: SupportRef;
    status: WidgetConversationStatus;
    linked: boolean;
    /** ISO-8601 timestamp string. */
    createdAt: string;
}

/** Who wrote a widget message. `agent` covers dashboard and Slack replies alike. */
export type WidgetMessageDirection = "visitor" | "agent";

/**
 * One message in a widget conversation. Text only in phase 1 (both directions). Agent
 * messages carry NO per-operator identity. `id` doubles as the polling cursor
 * (`?after=`) and is a 24-char hex ObjectId.
 */
export interface WidgetMessageView {
    id: string;
    direction: WidgetMessageDirection;
    body: string;
    /** ISO-8601 timestamp string. */
    createdAt: string;
}

// ---------------------------------------------------------------------------
// GET /api/widget/v1/:widgetKey/config — bootstrap the widget
// ---------------------------------------------------------------------------

export interface WidgetPublicConfigResponse {
    organization: { name: string };
    appearance: WidgetAppearance;
    handoffEnabled: boolean;
    whatsapp: {
        /** True when the handoff is enabled AND the org's developer sender is usable. */
        available: boolean;
    };
}

// ---------------------------------------------------------------------------
// POST /api/widget/v1/:widgetKey/conversations — first message starts a session
// ---------------------------------------------------------------------------

export interface StartWidgetConversationRequest {
    /** The visitor's first message. 1..WIDGET_MESSAGE_MAX_CHARS. */
    body: string;
    /** `window.location.href` of the page the chat started on. Must be a URL, max 2000 chars. */
    pageUrl?: string;
    /** `document.referrer`, when the browser provided a non-empty one. Must be a URL, max 2000 chars. */
    referrer?: string;
}

export interface StartWidgetConversationResponse {
    /** The per-session secret, returned ONCE. Store it and send it as `x-jely-session`. */
    sessionToken: WidgetSessionToken;
    conversation: WidgetConversationView;
    message: WidgetMessageView;
}

// ---------------------------------------------------------------------------
// GET /api/widget/v1/:widgetKey/conversation — state on mount / after refresh
// ---------------------------------------------------------------------------

export interface GetWidgetConversationResponse {
    conversation: WidgetConversationView;
}

// ---------------------------------------------------------------------------
// GET /api/widget/v1/:widgetKey/conversation/messages — the poll
// ---------------------------------------------------------------------------

export interface GetWidgetMessagesQuery {
    /** Return only messages newer than this message id. Omit on the first load for the whole transcript. */
    after?: string;
    /** 1..100. */
    limit?: number;
}

export interface GetWidgetMessagesResponse {
    /** Echoed on every poll so the widget flips to the locked/closed state without a second request. */
    conversation: WidgetConversationView;
    /** Ascending (oldest → newest) after the cursor. */
    messages: WidgetMessageView[];
}

/** The upper bound the server accepts for `limit` on the poll. */
export const WIDGET_MESSAGES_MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// POST /api/widget/v1/:widgetKey/conversation/messages — visitor sends
// ---------------------------------------------------------------------------

export interface PostWidgetMessageRequest {
    body: string;
}

export interface PostWidgetMessageResponse {
    message: WidgetMessageView;
}

// ---------------------------------------------------------------------------
// POST /api/widget/v1/:widgetKey/conversation/handoff — continue on WhatsApp
// ---------------------------------------------------------------------------

/**
 * Read-only: nothing is linked until the visitor actually sends the WhatsApp message,
 * so this route may be called repeatedly and the widget stays usable if the visitor
 * changes their mind. The link targets the org's developer sender as it is at this
 * moment — a sender switched afterwards invalidates an already-rendered QR.
 */
export interface RequestWidgetHandoffResponse {
    /** The conversation's ref, also embedded in `prefilledText`. */
    ref: SupportRef;
    /** `https://wa.me/{e164 digits}?text={url-encoded prefilledText}` — the widget renders its QR client-side. */
    waLink: string;
    /** The exact message the visitor is about to send, so the widget can show it before they leave. */
    prefilledText: string;
    /** The developer sender in display form. */
    phoneDisplay: string;
}

// ---------------------------------------------------------------------------
// Errors (mirrored from `contract/shared/common.ts`)
// ---------------------------------------------------------------------------

/**
 * The subset of the project's `ApiErrorCode` enum that the widget channel can produce.
 * The server's enum is much larger; only these can reach a widget, and each one has a
 * distinct visitor-facing consequence:
 *
 * - `WIDGET_KEY_INVALID`   404 — unknown/disabled key, or the org has no developer
 *                                sender. The install is wrong; the widget must render
 *                                nothing rather than an error on the customer's page.
 * - `WIDGET_NOT_READY`     — reserved by the contract for a configured-but-incomplete
 *                                widget; treated exactly like `WIDGET_KEY_INVALID`.
 * - `ORIGIN_NOT_ALLOWED`   403 — this site's origin is not on the org's allowlist. In
 *                                practice the browser blocks the response first (the
 *                                server deliberately omits CORS headers on this path),
 *                                so the widget usually sees a network error instead.
 * - `SESSION_INVALID`      401 — the stored session token is unknown, belongs to
 *                                another org, or is not a webchat session. Drop the
 *                                stored token and start over.
 * - `CONVERSATION_LOCKED`  409 — the visitor continued on WhatsApp. Reads still work;
 *                                only writes are refused. Render the linked state.
 * - `CONVERSATION_CLOSED`  409 — an operator closed it. Reads still work. Render the
 *                                closed state with a "start a new chat" affordance.
 * - `CONVERSATION_NOT_FOUND` 404 — the conversation behind a valid-looking session is
 *                                gone. Treated like `SESSION_INVALID`.
 * - `HANDOFF_DISABLED`     422 — the org turned the WhatsApp handoff off or has no
 *                                usable developer sender. Hide the affordance.
 * - `RATE_LIMITED`         429 — one of `WIDGET_RATE_LIMITS` was hit. Back off; do not
 *                                retry in a tight loop.
 * - `VALIDATION_ERROR`     400 — empty body or over `WIDGET_MESSAGE_MAX_CHARS`. The
 *                                widget's own composer should make this unreachable.
 * - `INTERNAL_ERROR`       500 — includes a malformed or oversized request body, which
 *                                the app's body parser rejects before the widget's own
 *                                CORS layer runs (a known, documented server limitation).
 */
export type WidgetApiErrorCode =
    | "WIDGET_KEY_INVALID"
    | "WIDGET_NOT_READY"
    | "ORIGIN_NOT_ALLOWED"
    | "SESSION_INVALID"
    | "CONVERSATION_LOCKED"
    | "CONVERSATION_CLOSED"
    | "CONVERSATION_NOT_FOUND"
    | "HANDOFF_DISABLED"
    | "RATE_LIMITED"
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "INTERNAL_ERROR";

/**
 * The project-wide non-2xx response body. `code` is optional on the wire — an error
 * raised before a handler runs may carry only `error` — so callers must always cope
 * with it being absent and fall back to the HTTP status.
 */
export interface ApiErrorBody {
    error: string;
    code?: WidgetApiErrorCode | string;
    details?: unknown;
}
