/**
 * The widget's only persistence: one `localStorage` entry per widget key, holding the
 * session token, the last message the visitor has seen, and whether the panel was left
 * minimised.
 *
 * `localStorage["jely.widget.<widgetKey>"] = { sessionToken, lastSeenMessageId, minimized }`
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
 */

/** What the widget keeps between page loads. Every field is optional — none is load-bearing. */
export interface WidgetStoredState {
    /** The per-session secret from `POST /conversations`. The server never re-issues it. */
    sessionToken?: string;
    /** Cursor for the unread badge (E6): the newest message id the visitor has actually seen. */
    lastSeenMessageId?: string;
    /** Whether the panel was minimised when the visitor left the page. */
    minimized?: boolean;
}

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
    return state;
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
