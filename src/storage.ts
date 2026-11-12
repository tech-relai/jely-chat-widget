/**
 * The widget's only persistence: one `localStorage` entry per widget key, holding the
 * session token, the last message the visitor has seen, and whether the panel was left
 * minimised.
 *
 * `localStorage["jely.widget.<widgetKey>"] = { sessionToken, lastSeenMessageId, minimized, sessionUpdatedAt, identitySent }`
 *
 * EVERY access is wrapped in try/catch, including the `window.localStorage` property
 * lookup itself — Safari in private mode and any browser with site data blocked throw a
 * `SecurityError` on that read, not on `getItem`. A browser with storage disabled must
 * not break the widget; it simply loses continuity, which means a page refresh starts a
 * new conversation. That is a degraded experience, never an error the visitor sees.
 *
 * The stored value is untrusted input: it can be edited by hand, left behind by an older
 * version of this package, or corrupted. `readWidgetStorage` therefore validates field by
 * field and drops anything of the wrong type instead of trusting the JSON.
 *
 * THE SESSION EXPIRES (user, 2026-09-08). Without a TTL the stored token was kept forever,
 * so a visitor -- or someone testing -- refreshed the page and got the same conversation
 * back weeks later. `expireStaleSession` drops it once `sessionUpdatedAt` is older than
 * `WIDGET_SESSION_TTL_MS`, and `minimized` survives because it is a UI preference rather
 * than conversation state. Nothing is deleted server-side: the conversation stays open for
 * the operator, the visitor simply starts a fresh one.
 */

/** What the widget keeps between page loads. Every field is optional — none is load-bearing. */
export interface WidgetStoredState {
    /** The per-session secret from `POST /conversations`. The server never re-issues it. */
    sessionToken?: string;
    /** Cursor for the unread badge (E6): the newest message id the visitor has actually seen. */
    lastSeenMessageId?: string;
    /** Whether the panel was minimised when the visitor left the page. */
    minimized?: boolean;
    /**
     * When the CONVERSATION last moved, in epoch milliseconds — a message sent, a message
     * received, or the session being created. Deliberately not touched by opening,
     * minimising or merely loading the page: a TTL that a refresh renews is not a TTL, and
     * "it keeps my same chat every time I refresh" is the thing this exists to stop. A
     * successful identify counts as the conversation moving.
     */
    sessionUpdatedAt?: number;
    /**
     * Fingerprint (`identityFingerprint`) of the visitor identity this SESSION's
     * conversation already has, so a reload does not send it again. A hash rather than the
     * identity itself, so the visitor's name and email are not stored twice. Goes with the
     * session.
     */
    identitySent?: string;
}

/**
 * How long a stored conversation survives without either side saying anything. Thirty
 * minutes (user, 2026-11-12; five before that) — long enough to survive a visitor logging
 * in on a site whose login and signup pages carry the widget.
 */
export const WIDGET_SESSION_TTL_MS = 30 * 60 * 1000;

const STORAGE_KEY_PREFIX = "jely.widget.";

/** The exact key used for a given widget key. Exported so a host can clear it if it must. */
export function widgetStorageKey(widgetKey: string): string {
    return `${STORAGE_KEY_PREFIX}${widgetKey}`;
}

/**
 * Reach `localStorage` or give up. Returns null on the server, in a sandboxed iframe
 * without `allow-same-origin`, and anywhere site data is blocked.
 */
function getLocalStorage(): Storage | null {
    try {
        if (typeof window === "undefined") return null;
        const storage = window.localStorage;
        return storage ?? null;
    } catch {
        return null;
    }
}

/** Always returns an object. Never throws. Unknown or mistyped fields are dropped. */
export function readWidgetStorage(widgetKey: string): WidgetStoredState {
    const storage = getLocalStorage();
    if (storage === null) return {};

    let raw: string | null;
    try {
        raw = storage.getItem(widgetStorageKey(widgetKey));
    } catch {
        return {};
    }
    if (raw === null || raw === "") return {};

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const candidate = parsed as Record<string, unknown>;
    const state: WidgetStoredState = {};
    if (typeof candidate.sessionToken === "string" && candidate.sessionToken !== "") {
        state.sessionToken = candidate.sessionToken;
    }
    if (typeof candidate.lastSeenMessageId === "string" && candidate.lastSeenMessageId !== "") {
        state.lastSeenMessageId = candidate.lastSeenMessageId;
    }
    if (typeof candidate.minimized === "boolean") {
        state.minimized = candidate.minimized;
    }
    if (typeof candidate.sessionUpdatedAt === "number" && Number.isFinite(candidate.sessionUpdatedAt)) {
        state.sessionUpdatedAt = candidate.sessionUpdatedAt;
    }
    if (typeof candidate.identitySent === "string" && candidate.identitySent !== "") {
        state.identitySent = candidate.identitySent;
    }
    return state;
}

/**
 * Whether a stored session is too old to resume. Pure, so it can be checked without a
 * browser or a clock.
 *
 * A session with NO `sessionUpdatedAt` is expired. That is the entry an older version of
 * this package wrote, and the safe reading of "no idea when this last moved" is "let it
 * go" — the cost is one dropped conversation at upgrade time, against resuming a
 * conversation from an unknown point in the past forever.
 *
 * A stamp in the FUTURE is expired too: it means the device clock moved backwards, and
 * treating it as fresh would pin the session open until the clock caught up.
 */
export function isStoredSessionExpired(state: WidgetStoredState, now: number, ttlMs = WIDGET_SESSION_TTL_MS): boolean {
    if (state.sessionToken === undefined) return false;
    if (state.sessionUpdatedAt === undefined) return true;
    const age = now - state.sessionUpdatedAt;
    return age < 0 || age > ttlMs;
}

/**
 * Read the stored state, dropping the session if it has gone stale. Returns what is left.
 *
 * IDEMPOTENT ON PURPOSE: it is called from a `useMemo`, which React may run more than once
 * for a single commit, and doing the pruning there rather than in an effect is what stops
 * the first render resuming a session the second render would throw away.
 */
export function expireStaleSession(widgetKey: string, now: number, ttlMs = WIDGET_SESSION_TTL_MS): WidgetStoredState {
    const state = readWidgetStorage(widgetKey);
    if (!isStoredSessionExpired(state, now, ttlMs)) return state;

    removeWidgetStorageFields(widgetKey, ["sessionToken", "lastSeenMessageId", "sessionUpdatedAt", "identitySent"]);
    const kept: WidgetStoredState = {};
    if (state.minimized !== undefined) kept.minimized = state.minimized;
    return kept;
}

/**
 * Merge a patch into the stored state. Never throws — a failed write (quota exceeded,
 * storage disabled) is silently the same as never having stored anything.
 *
 * Passing `undefined` for a field leaves it alone; use `clearWidgetStorage` or write
 * `null` through `patch` to remove one (see `removeWidgetStorageFields`).
 */
export function writeWidgetStorage(widgetKey: string, patch: WidgetStoredState): void {
    const storage = getLocalStorage();
    if (storage === null) return;

    const next: WidgetStoredState = { ...readWidgetStorage(widgetKey) };
    if (patch.sessionToken !== undefined) next.sessionToken = patch.sessionToken;
    if (patch.lastSeenMessageId !== undefined) next.lastSeenMessageId = patch.lastSeenMessageId;
    if (patch.minimized !== undefined) next.minimized = patch.minimized;
    if (patch.sessionUpdatedAt !== undefined) next.sessionUpdatedAt = patch.sessionUpdatedAt;
    if (patch.identitySent !== undefined) next.identitySent = patch.identitySent;

    try {
        storage.setItem(widgetStorageKey(widgetKey), JSON.stringify(next));
    } catch {
        // Quota exceeded or storage disabled mid-session: continuity is lost, nothing else.
    }
}

/**
 * Drop named fields, keeping the rest. Used when a session stops being usable
 * (`SESSION_INVALID`) but the visitor's minimised preference should survive.
 */
export function removeWidgetStorageFields(widgetKey: string, fields: (keyof WidgetStoredState)[]): void {
    const storage = getLocalStorage();
    if (storage === null) return;

    const next: WidgetStoredState = { ...readWidgetStorage(widgetKey) };
    for (const field of fields) delete next[field];

    try {
        storage.setItem(widgetStorageKey(widgetKey), JSON.stringify(next));
    } catch {
        // See above.
    }
}

/** Forget everything about this widget key. Never throws. */
export function clearWidgetStorage(widgetKey: string): void {
    const storage = getLocalStorage();
    if (storage === null) return;
    try {
        storage.removeItem(widgetStorageKey(widgetKey));
    } catch {
        // Nothing to do — the entry is unreachable either way.
    }
}
