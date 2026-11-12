/**
 * The shipped widget's screen: which view is up, and the keyboard rules around it.
 * `JelyChatWidget` owns the host element and the `routes` decision; the conversation itself
 * — config, session, polling, storage, the reducer — is the `createJelyChat` controller in
 * `core/`, reached through `useJelyChat`. Nothing here talks to the server.
 *
 * IT RENDERS NOTHING UNTIL `GET /config` ANSWERS, and nothing ever if that call fails —
 * see `createJelyChat` for why both halves are deliberate. A visitor is never shown our
 * plumbing.
 *
 * ERRORS ARRIVE AS CODES. The controller carries no copy; `describeError` below is where a
 * code becomes the sentence a visitor reads.
 */

import { accentCssVariables, resolveAppearance } from "./appearance";
import { copy } from "./copy";
import type { WidgetError } from "./core/errors";
import { WIDGET_MESSAGE_MAX_CHARS, type WidgetAppearance } from "./types";
import { useJelyChat } from "./react/useJelyChat";
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
    const { chat, state } = useJelyChat({ widgetKey, apiBaseUrl, defaultOpen });

    if (chat === null || state === null || state.unavailable || state.config === null) return null;

    const appearance = resolveAppearance(state.config.appearance, appearanceOverride);
    const whatsappAvailable = state.config.whatsapp.available;
    const organizationName = state.config.organization.name;
    const error = state.error === null ? null : describeError(state.error);

    return (
        <div
            className={`j-root j-root--${appearance.theme}`}
            // CSSOM, not a style attribute string — see the CSP table in `styles.ts`.
            style={accentCssVariables(appearance.accentColor)}
            onKeyDown={(event) => {
                const inside = isInsideWidget(event.currentTarget, event.target);
                const handoffOpen = state.phase === "handoff";

                // The modal is on top, so it takes Escape first: the visitor means "close
                // this", not "close the whole chat behind it".
                if (shouldDismissHandoffOnEscape({ key: event.key, handoffOpen, targetInsideWidget: inside })) {
                    event.stopPropagation();
                    chat.dismissHandoff();
                    return;
                }
                if (
                    !shouldCloseOnEscape({
                        key: event.key,
                        panelOpen: state.open,
                        handoffOpen,
                        targetInsideWidget: inside,
                    })
                ) {
                    return;
                }
                // Only now: the keystroke came from inside the widget and it closed the
                // panel, so the host page must not also act on it.
                event.stopPropagation();
                chat.close();
            }}
        >
            {!state.open && <Launcher appearance={appearance} unreadCount={state.unreadCount} onOpen={chat.open} />}

            {state.open && state.phase === "greeting" && (
                <GreetingCard
                    appearance={appearance}
                    organizationName={organizationName}
                    sending={state.sending}
                    error={error}
                    onSendFirstMessage={chat.start}
                    onDismissError={chat.clearError}
                    onMinimize={chat.close}
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
                    error={error}
                    onSend={chat.send}
                    onOpenHandoff={chat.requestHandoff}
                    onDismissError={chat.clearError}
                    onMinimize={chat.close}
                    onSeen={chat.markSeen}
                    onStartNewChat={chat.startNewChat}
                />
            )}

            {/* A SIBLING OF THE PANEL, not a child of it: the handoff is a centred,
                page-level modal (see `HandoffModal`), so it is not the panel's overlay any
                more and must not inherit the panel's box or its `overflow: hidden`. */}
            {state.open && state.phase === "handoff" && state.handoff !== null && (
                <HandoffModal handoff={state.handoff} onDismiss={chat.dismissHandoff} />
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
 * The handoff modal is the one exception, and it is a layering rule rather than a new
 * policy: while it is up, Escape belongs to it and the panel does not see the key.
 *
 * Exported for the desk checks. NOT part of the package's public surface — see `index.ts`.
 */
export function shouldCloseOnEscape(input: {
    key: string;
    panelOpen: boolean;
    handoffOpen: boolean;
    targetInsideWidget: boolean;
}): boolean {
    if (input.key !== "Escape") return false;
    if (!input.panelOpen) return false;
    if (input.handoffOpen) return false;
    return input.targetInsideWidget;
}

/** The other half of that rule: Escape dismisses the modal while the modal is up. */
export function shouldDismissHandoffOnEscape(input: {
    key: string;
    handoffOpen: boolean;
    targetInsideWidget: boolean;
}): boolean {
    if (input.key !== "Escape") return false;
    if (!input.handoffOpen) return false;
    return input.targetInsideWidget;
}

/** Whether an event's target sits inside the widget's own tree. Never throws. */
export function isInsideWidget(root: { contains(node: Node): boolean } | null, target: EventTarget | null): boolean {
    if (root === null || target === null) return false;
    if (typeof (target as Node).nodeType !== "number") return false;
    return root.contains(target as Node);
}

/** One visitor-facing sentence per failure the widget can actually cause. */
function describeError(error: WidgetError): string {
    switch (error.code) {
        case "NETWORK_ERROR":
            return copy.errorOffline;
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
