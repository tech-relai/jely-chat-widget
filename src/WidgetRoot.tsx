/**
 * The conversation, wired together: config, session, polling, the reducer, and which view
 * is on screen. `JelyChatWidget` owns the host element and the `routes` decision; this
 * owns everything that talks to the server.
 *
 * IT RENDERS NOTHING UNTIL `GET /config` ANSWERS, and nothing ever if that call fails.
 * Both halves are deliberate. Painting the neutral defaults first and swapping to the
 * org's persona a moment later would flash a different name on a customer's page; and a
 * key that is unknown, disabled, or used from an origin the org has not allowed means the
 * INSTALL is wrong — `types.ts` states the consequence: render nothing rather than an
 * error on the customer's page. A visitor is never shown our plumbing.
 *
 * POLLING STOPS ONCE THE CONVERSATION IS LINKED OR CLOSED. The server keeps answering
 * reads on both (§12, P2), so this is a courtesy rather than a requirement: nothing new
 * can arrive in the widget — a linked conversation continues on WhatsApp — and the poll
 * budget is per widget KEY (600/minute shared by every visitor on the customer's site),
 * so idle terminal tabs are the one thing worth not spending it on.
 *
 * WHY THE STATE IS MIRRORED IN A REF: `usePolling` keeps `onTick` in a ref so its schedule
 * survives re-renders, which means the tick closure must not capture the state it needs.
 * `stateRef` is that state, read at tick time.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { accentCssVariables, resolveAppearance } from "./appearance";
import { JelyApiError, createWidgetApiClient } from "./api";
import { copy } from "./copy";
import { clearWidgetStorage, readWidgetStorage, removeWidgetStorageFields, writeWidgetStorage } from "./storage";
import { initialWidgetState, pollCursor, widgetReducer } from "./state";
import { WIDGET_MESSAGE_MAX_CHARS, type WidgetAppearance, type WidgetPublicConfigResponse } from "./types";
import { usePolling } from "./usePolling";
import { ChatView } from "./views/ChatView";
import { GreetingCard } from "./views/GreetingCard";
import { HandoffModal } from "./views/HandoffModal";
import { Launcher } from "./views/Launcher";

export interface WidgetRootProps {
    widgetKey: string;
    apiBaseUrl?: string;
    appearance?: Partial<WidgetAppearance>;
    defaultOpen: boolean;
}

/**
 * `widgetKey` is read once, on mount. `JelyChatWidget` gives this component a React `key`
 * of the widget key, so a host that swaps keys gets a clean remount instead of a component
 * holding one org's session against another org's config.
 */
export function WidgetRoot({ widgetKey, apiBaseUrl, appearance: appearanceOverride, defaultOpen }: WidgetRootProps) {
    const client = useMemo(() => createWidgetApiClient({ widgetKey, apiBaseUrl }), [widgetKey, apiBaseUrl]);

    const stored = useMemo(() => readWidgetStorage(widgetKey), [widgetKey]);
    const [config, setConfig] = useState<WidgetPublicConfigResponse | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [sessionToken, setSessionToken] = useState<string | null>(stored.sessionToken ?? null);

    // A stored preference beats `defaultOpen`: a visitor who minimised the panel meant it,
    // and E5 says a refresh continues where they were.
    const initialOpen = stored.minimized === undefined ? defaultOpen : !stored.minimized;
    const [state, dispatch] = useReducer(widgetReducer, undefined, () =>
        initialWidgetState({ open: initialOpen, lastSeenMessageId: stored.lastSeenMessageId ?? null }),
    );

    const stateRef = useRef(state);
    stateRef.current = state;
    const sessionTokenRef = useRef(sessionToken);
    sessionTokenRef.current = sessionToken;

    // `initialWidgetState` starts in `idle`; opening is what moves it to `greeting`.
    useEffect(() => {
        if (initialOpen) dispatch({ type: "panelOpened" });
        // Mount only — later opens come from the launcher.
    }, []);

    // --- Bootstrap ----------------------------------------------------------

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        client
            .getConfig({ signal: controller.signal })
            .then((response) => {
                if (active) setConfig(response);
            })
            .catch(() => {
                if (active && !controller.signal.aborted) setUnavailable(true);
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [client]);

    // The stored session is resolved with the POLL endpoint rather than `GET /conversation`:
    // it returns the conversation AND the transcript in one round trip, and the widget needs
    // both to render anything.
    useEffect(() => {
        const token = sessionTokenRef.current;
        if (token === null) return;
        const controller = new AbortController();
        let active = true;
        client
            .getMessages({ sessionToken: token, signal: controller.signal })
            .then((response) => {
                if (!active) return;
                dispatch({ type: "sessionRestored", conversation: response.conversation, messages: response.messages });
            })
            .catch((error: unknown) => {
                if (!active || controller.signal.aborted) return;
                if (error instanceof JelyApiError && error.isSessionGone) discardSession();
                // Any other failure (offline, a 5xx) leaves the session alone: the poll will
                // pick it up, and throwing away a working conversation over one bad request
                // would lose the visitor's transcript.
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [client]);

    const discardSession = useCallback(() => {
        removeWidgetStorageFields(widgetKey, ["sessionToken", "lastSeenMessageId"]);
        setSessionToken(null);
        dispatch({ type: "sessionDiscarded" });
    }, [widgetKey]);

    // --- Polling (E1) -------------------------------------------------------

    const onTick = useCallback(
        async (signal: AbortSignal) => {
            const token = sessionTokenRef.current;
            if (token === null) return;
            try {
                const response = await client.getMessages({
                    sessionToken: token,
                    after: pollCursor(stateRef.current),
                    signal,
                });
                dispatch({ type: "polled", conversation: response.conversation, messages: response.messages });
            } catch (error) {
                if (error instanceof JelyApiError && error.isSessionGone) discardSession();
                // Everything else is a tick that produced nothing; the next one follows.
            }
        },
        [client, discardSession],
    );

    const terminal = state.phase === "linked" || state.phase === "closed";
    const { pollNow } = usePolling({
        enabled: sessionToken !== null && config !== null && !unavailable && !terminal,
        minimized: !state.open,
        onTick,
    });

    // --- Persistence --------------------------------------------------------

    useEffect(() => {
        if (state.lastSeenMessageId === null) return;
        writeWidgetStorage(widgetKey, { lastSeenMessageId: state.lastSeenMessageId });
    }, [widgetKey, state.lastSeenMessageId]);

    // --- Actions ------------------------------------------------------------

    const openPanel = useCallback(() => {
        writeWidgetStorage(widgetKey, { minimized: false });
        dispatch({ type: "panelOpened" });
    }, [widgetKey]);

    const minimizePanel = useCallback(() => {
        writeWidgetStorage(widgetKey, { minimized: true });
        dispatch({ type: "panelMinimized" });
    }, [widgetKey]);

    const sendFirstMessage = useCallback(
        async (body: string) => {
            dispatch({ type: "sendStarted" });
            try {
                const response = await client.startConversation({ body, ...visitorContext() });
                writeWidgetStorage(widgetKey, { sessionToken: response.sessionToken });
                setSessionToken(response.sessionToken);
                dispatch({
                    type: "conversationStarted",
                    conversation: response.conversation,
                    message: response.message,
                });
            } catch (error) {
                dispatch({ type: "sendFailed", error: describeError(error) });
            }
        },
        [client, widgetKey],
    );

    const sendMessage = useCallback(
        async (body: string) => {
            const token = sessionTokenRef.current;
            if (token === null) return;
            dispatch({ type: "sendStarted" });
            try {
                const response = await client.postMessage({ body }, { sessionToken: token });
                dispatch({ type: "messageSent", message: response.message });
            } catch (error) {
                // A DEAD SESSION IS NOT A FAILED SEND. Before this, a 401 here showed the
                // generic "that didn't send" and the session was only discarded when the
                // next poll (≤ 3 s later) 401'd as well — so the visitor read the wrong
                // explanation first and watched the panel change its mind. Discarding here
                // resets straight to a fresh greeting, which is what actually happened.
                if (error instanceof JelyApiError && error.isSessionGone) {
                    discardSession();
                    return;
                }
                dispatch({ type: "sendFailed", error: describeError(error) });
                // A refused write means the server moved the conversation under us; poll at
                // once so the panel flips to the state that explains it.
                if (error instanceof JelyApiError && error.isConversationWriteRefused) pollNow();
            }
        },
        [client, discardSession, pollNow],
    );

    const openHandoff = useCallback(async () => {
        const token = sessionTokenRef.current;
        if (token === null) {
            // The greeting card offers the handoff (§4.9 lists it there), but there is no
            // conversation to move yet — `POST /conversation/handoff` is session-authenticated.
            dispatch({ type: "sendFailed", error: copy.handoffNeedsMessage });
            return;
        }
        dispatch({ type: "sendStarted" });
        try {
            const handoff = await client.requestHandoff({ sessionToken: token });
            dispatch({ type: "handoffOpened", handoff });
        } catch (error) {
            // Same rule as `sendMessage`: a gone session resets rather than reporting a
            // failure that did not happen.
            if (error instanceof JelyApiError && error.isSessionGone) {
                discardSession();
                return;
            }
            dispatch({ type: "sendFailed", error: describeError(error) });
            if (error instanceof JelyApiError && error.isConversationWriteRefused) pollNow();
        }
    }, [client, discardSession, pollNow]);

    const startNewChat = useCallback(() => {
        clearWidgetStorage(widgetKey);
        setSessionToken(null);
        dispatch({ type: "startNewChat" });
    }, [widgetKey]);

    // --- Render -------------------------------------------------------------

    if (unavailable || config === null) return null;

    const appearance = resolveAppearance(config.appearance, appearanceOverride);
    const whatsappAvailable = config.whatsapp.available;
    const organizationName = config.organization.name;

    return (
        <div
            className={`j-root j-root--${appearance.theme}`}
            // CSSOM, not a style attribute string — see the CSP table in `styles.ts`.
            style={accentCssVariables(appearance.accentColor)}
            onKeyDown={(event) => {
                const inside = isInsideWidget(event.currentTarget, event.target);
                if (!shouldCloseOnEscape({ key: event.key, panelOpen: state.open, targetInsideWidget: inside })) {
                    return;
                }
                // Only now: the keystroke came from inside the widget and it closed the
                // panel, so the host page must not also act on it.
                event.stopPropagation();
                minimizePanel();
            }}
        >
            {!state.open && <Launcher appearance={appearance} unreadCount={state.unreadCount} onOpen={openPanel} />}

            {state.open && state.phase === "greeting" && (
                <GreetingCard
                    appearance={appearance}
                    organizationName={organizationName}
                    whatsappAvailable={whatsappAvailable}
                    sending={state.sending}
                    error={state.error}
                    onSendFirstMessage={sendFirstMessage}
                    onOpenHandoff={openHandoff}
                    onDismissError={() => dispatch({ type: "errorCleared" })}
                    onMinimize={minimizePanel}
                />
            )}

            {state.open && state.phase !== "greeting" && state.phase !== "idle" && (
                <ChatView
                    appearance={appearance}
                    organizationName={organizationName}
                    messages={state.messages}
                    lock={state.phase === "linked" ? "linked" : state.phase === "closed" ? "closed" : null}
                    whatsappAvailable={whatsappAvailable}
                    sending={state.sending}
                    error={state.error}
                    onSend={sendMessage}
                    onOpenHandoff={openHandoff}
                    onDismissError={() => dispatch({ type: "errorCleared" })}
                    onMinimize={minimizePanel}
                    onSeen={() => dispatch({ type: "messagesSeen" })}
                    onStartNewChat={startNewChat}
                    overlay={
                        state.phase === "handoff" && state.handoff !== null ? (
                            <HandoffModal
                                handoff={state.handoff}
                                messages={state.messages}
                                onDismiss={() => dispatch({ type: "handoffDismissed" })}
                            />
                        ) : null
                    }
                />
            )}
        </div>
    );
}

/**
 * ESCAPE CLOSES THE PANEL — but only a keystroke that came from inside the widget.
 *
 * The widget lives on someone else's page. It traps no focus (which is why the panel is a
 * labelled region and not a `role="dialog"`), and by the same courtesy it must not swallow
 * the host's own Escape handling: a customer's modal, menu or search overlay keeps working
 * exactly as it did. Containment is the whole rule, and it is a pure function so it can be
 * checked without a browser.
 *
 * The handler is attached to the widget's root element rather than to `document`, so in
 * practice the event has already proved it came from inside by reaching it; the explicit
 * check states the rule rather than leaving it implied by where a listener happens to sit.
 *
 * Exported for the desk checks. NOT part of the package's public surface — see `index.ts`.
 */
export function shouldCloseOnEscape(input: { key: string; panelOpen: boolean; targetInsideWidget: boolean }): boolean {
    if (input.key !== "Escape") return false;
    if (!input.panelOpen) return false;
    return input.targetInsideWidget;
}

/** Whether an event's target sits inside the widget's own tree. Never throws. */
export function isInsideWidget(root: { contains(node: Node): boolean } | null, target: EventTarget | null): boolean {
    if (root === null || target === null) return false;
    if (typeof (target as Node).nodeType !== "number") return false;
    return root.contains(target as Node);
}

/**
 * `pageUrl` and `referrer` for `POST /conversations` (decision E8 stores them on the
 * conversation; the IP and user agent are taken server-side). Both are dropped rather than
 * truncated when they exceed the contract's 2,000-character bound — a truncated URL is a
 * wrong URL, and a rejected request would cost the visitor their first message.
 */
function visitorContext(): { pageUrl?: string; referrer?: string } {
    const context: { pageUrl?: string; referrer?: string } = {};
    if (typeof window === "undefined") return context;
    try {
        const href = window.location.href;
        if (href !== "" && href.length <= 2000) context.pageUrl = href;
        const referrer = document.referrer;
        if (referrer !== "" && referrer.length <= 2000) context.referrer = referrer;
    } catch {
        // A sandboxed frame can throw on either read; the conversation is worth more.
    }
    return context;
}

/** One visitor-facing sentence per failure the widget can actually cause. */
function describeError(error: unknown): string {
    if (!(error instanceof JelyApiError)) return copy.errorSendFailed;
    if (error.isNetworkError) return copy.errorOffline;
    switch (error.code) {
        case "RATE_LIMITED":
            return copy.errorRateLimited;
        case "VALIDATION_ERROR":
            return copy.errorTooLong(WIDGET_MESSAGE_MAX_CHARS);
        case "CONVERSATION_LOCKED":
            return copy.linkedTitle;
        case "CONVERSATION_CLOSED":
            return copy.closedTitle;
        case "HANDOFF_DISABLED":
            return copy.errorHandoffUnavailable;
        default:
            return copy.errorSendFailed;
    }
}
