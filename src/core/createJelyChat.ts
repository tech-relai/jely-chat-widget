/**
 * The conversation, wired together, with no UI: config, session, polling, the reducer and
 * storage. `WidgetRoot` renders it; a custom UI can render it instead. No React here.
 *
 *   const chat = createJelyChat({ widgetKey });
 *   const unsubscribe = chat.subscribe(() => render(chat.getState()));
 *   …
 *   chat.destroy();
 *
 * CREATING IT STARTS IT. The constructor reads `localStorage` (guarded — see `storage.ts`),
 * fetches `GET /config` and, when a stored session survives the TTL, restores it. Nothing
 * touches `window` or storage at import time, so importing this on a server is safe.
 *
 * `config` STAYS NULL UNTIL `GET /config` ANSWERS, and `unavailable` turns true if it never
 * does. The shipped widget renders nothing in both cases, deliberately: painting neutral
 * defaults first would flash a different persona on a customer's page, and a key that is
 * unknown, disabled, or used from an origin the org has not allowed means the INSTALL is
 * wrong — a visitor is never shown our plumbing. Polling waits for the config too.
 *
 * POLLING STOPS ONCE THE CONVERSATION IS LINKED OR CLOSED. The server keeps answering
 * reads on both (§12, P2), so this is a courtesy rather than a requirement: nothing new
 * can arrive — a linked conversation continues on WhatsApp — and the poll budget is per
 * widget KEY (600/minute shared by every visitor on the customer's site), so idle terminal
 * tabs are the one thing worth not spending it on.
 *
 * WRITES OUTLIVE `destroy()`. A first message whose response lands after the host
 * unmounted still stores its session token, exactly as the React-only widget did, so the
 * next mount resumes the conversation instead of orphaning it. Only state updates stop.
 */

import { JelyApiError, createWidgetApiClient } from "../api";
import { clearWidgetStorage, expireStaleSession, removeWidgetStorageFields, writeWidgetStorage } from "../storage";
import { initialWidgetState, pollCursor, widgetReducer, type WidgetEvent } from "../state";
import type { WidgetPublicConfigResponse } from "../types";
import { toWidgetError } from "./errors";
import { createPoller } from "./polling";
import type { JelyChat, JelyChatOptions, JelyChatState } from "./types";
import { visitorContext } from "./visitor";

export function createJelyChat(options: JelyChatOptions): JelyChat {
    const { widgetKey } = options;
    const client = createWidgetApiClient({ widgetKey, apiBaseUrl: options.apiBaseUrl });

    // Read once, and let a stale conversation go before anything reads a token out of it.
    const stored = expireStaleSession(widgetKey, Date.now());
    let sessionToken: string | null = stored.sessionToken ?? null;
    let config: WidgetPublicConfigResponse | null = null;
    let unavailable = false;

    // A stored preference beats `defaultOpen`: a visitor who minimised the panel meant it,
    // and E5 says a refresh continues where they were. `initialWidgetState` starts in
    // `idle`; opening is what moves it to `greeting`.
    const initialOpen = stored.minimized === undefined ? (options.defaultOpen ?? false) : !stored.minimized;
    let widget = initialWidgetState({ open: initialOpen, lastSeenMessageId: stored.lastSeenMessageId ?? null });
    if (initialOpen) widget = widgetReducer(widget, { type: "panelOpened" });

    let snapshot: JelyChatState = { ...widget, config, unavailable };
    const listeners = new Set<() => void>();
    let destroyed = false;
    const lifetime = new AbortController();
    const poller = createPoller(tick);

    // --- State --------------------------------------------------------------

    /** Re-derive the poll schedule, and publish a new snapshot when anything changed. */
    function commit(changed: boolean) {
        if (destroyed) return;
        const terminal = widget.phase === "linked" || widget.phase === "closed";
        poller.update({
            enabled: sessionToken !== null && config !== null && !unavailable && !terminal,
            minimized: !widget.open,
        });
        if (!changed) return;
        snapshot = { ...widget, config, unavailable };
        for (const listener of [...listeners]) listener();
    }

    function dispatch(event: WidgetEvent) {
        if (destroyed) return;
        const previous = widget;
        widget = widgetReducer(widget, event);
        if (widget.lastSeenMessageId !== null && widget.lastSeenMessageId !== previous.lastSeenMessageId) {
            writeWidgetStorage(widgetKey, { lastSeenMessageId: widget.lastSeenMessageId });
        }
        commit(widget !== previous);
    }

    function discardSession() {
        removeWidgetStorageFields(widgetKey, ["sessionToken", "lastSeenMessageId"]);
        sessionToken = null;
        dispatch({ type: "sessionDiscarded" });
    }

    // --- Bootstrap ----------------------------------------------------------

    client
        .getConfig({ signal: lifetime.signal })
        .then((response) => {
            config = response;
            commit(true);
        })
        .catch(() => {
            if (destroyed || lifetime.signal.aborted) return;
            unavailable = true;
            commit(true);
            /**
             * The one thing the widget cannot degrade around: without `GET /config` it has
             * no persona, no org name and no idea whether the handoff is on. Silence there
             * is the worst outcome -- the site owner sees no widget and no reason -- so say
             * once, plainly, what the two causes are. Both look identical from JavaScript
             * on purpose: an origin that is not on the allowlist is refused WITHOUT CORS
             * headers, so the browser blocks the response exactly as it blocks a CSP
             * violation.
             */
            // eslint-disable-next-line no-console
            console.warn(
                "[jely] The chat widget could not reach " +
                    client.apiBaseUrl +
                    ". Two things cause this: this page's origin is not on the widget's " +
                    "allowed-origins list in the Jely console, or this site's " +
                    "Content-Security-Policy does not allow connect-src to that origin.",
            );
        });

    // The stored session is resolved with the POLL endpoint rather than `GET /conversation`:
    // it returns the conversation AND the transcript in one round trip.
    if (sessionToken !== null) {
        client
            .getMessages({ sessionToken, signal: lifetime.signal })
            .then((response) => {
                dispatch({ type: "sessionRestored", conversation: response.conversation, messages: response.messages });
            })
            .catch((error: unknown) => {
                if (destroyed || lifetime.signal.aborted) return;
                if (error instanceof JelyApiError && error.isSessionGone) discardSession();
                // Any other failure (offline, a 5xx) leaves the session alone: the poll will
                // pick it up, and throwing away a working conversation over one bad request
                // would lose the visitor's transcript.
            });
    }

    // --- Polling (E1) -------------------------------------------------------

    async function tick(signal: AbortSignal) {
        const token = sessionToken;
        if (token === null) return;
        try {
            const response = await client.getMessages({ sessionToken: token, after: pollCursor(widget), signal });
            // `after: pollCursor(...)` means a non-empty list is genuinely NEW — an operator
            // reply keeps the conversation alive, a quiet poll does not.
            if (response.messages.length > 0) writeWidgetStorage(widgetKey, { sessionUpdatedAt: Date.now() });
            dispatch({ type: "polled", conversation: response.conversation, messages: response.messages });
        } catch (error) {
            if (error instanceof JelyApiError && error.isSessionGone) discardSession();
            // Everything else is a tick that produced nothing; the next one follows.
        }
    }

    // --- Actions ------------------------------------------------------------

    async function start(text: string) {
        dispatch({ type: "sendStarted" });
        try {
            const response = await client.startConversation({ body: text, ...visitorContext() });
            writeWidgetStorage(widgetKey, { sessionToken: response.sessionToken, sessionUpdatedAt: Date.now() });
            sessionToken = response.sessionToken;
            dispatch({ type: "conversationStarted", conversation: response.conversation, message: response.message });
        } catch (error) {
            dispatch({ type: "sendFailed", error: toWidgetError(error) });
        }
    }

    async function send(text: string) {
        const token = sessionToken;
        if (token === null) return;
        dispatch({ type: "sendStarted" });
        try {
            const response = await client.postMessage({ body: text }, { sessionToken: token });
            writeWidgetStorage(widgetKey, { sessionUpdatedAt: Date.now() });
            dispatch({ type: "messageSent", message: response.message });
        } catch (error) {
            refuse(error);
        }
    }

    async function requestHandoff() {
        const token = sessionToken;
        // The chat phase implies a session; a missing token is the race where a poll has
        // just discarded it, and the state is about to reset to the greeting anyway.
        if (token === null || widget.phase !== "chat") return;
        dispatch({ type: "sendStarted" });
        try {
            const handoff = await client.requestHandoff({ sessionToken: token });
            dispatch({ type: "handoffOpened", handoff });
        } catch (error) {
            refuse(error);
        }
    }

    /**
     * A failed write. A DEAD SESSION IS NOT A FAILED SEND: it resets straight to a fresh
     * greeting, which is what actually happened, instead of reporting a failure first and
     * resetting on the next poll. A refused write means the server moved the conversation
     * under us; poll at once so the state flips to what explains it.
     */
    function refuse(error: unknown) {
        if (error instanceof JelyApiError && error.isSessionGone) {
            discardSession();
            return;
        }
        dispatch({ type: "sendFailed", error: toWidgetError(error) });
        if (error instanceof JelyApiError && error.isConversationWriteRefused) poller.pollNow();
    }

    return {
        getState: () => snapshot,
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        start,
        send,
        requestHandoff,
        dismissHandoff: () => dispatch({ type: "handoffDismissed" }),
        startNewChat() {
            clearWidgetStorage(widgetKey);
            sessionToken = null;
            dispatch({ type: "startNewChat" });
        },
        open() {
            writeWidgetStorage(widgetKey, { minimized: false });
            dispatch({ type: "panelOpened" });
        },
        close() {
            writeWidgetStorage(widgetKey, { minimized: true });
            dispatch({ type: "panelMinimized" });
        },
        markSeen: () => dispatch({ type: "messagesSeen" }),
        clearError: () => dispatch({ type: "errorCleared" }),
        destroy() {
            if (destroyed) return;
            destroyed = true;
            lifetime.abort();
            poller.stop();
            listeners.clear();
        },
    };
}
