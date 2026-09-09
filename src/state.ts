/**
 * The widget's state machine (§4.9): `idle → greeting → chat → handoff → linked | closed`.
 *
 * A pure reducer, no React and no I/O, so every transition can be checked directly. S8.2
 * renders `phase` and dispatches these events; nothing here knows what a bubble looks like.
 *
 * TWO AXES, NOT ONE. `phase` is where the CONVERSATION is; `open` is whether the panel is
 * showing. They are separate because a visitor can minimise mid-chat (E6: the launcher then
 * carries an unread badge) without the conversation changing state, and because a linked or
 * closed conversation still has to render its own locked panel when re-opened. `idle` is
 * therefore "no conversation yet", not "panel hidden" — a fresh visitor sits in
 * `idle` + `open: false` and the first click takes them to `greeting`.
 *
 *   idle ──open──▶ greeting ──conversationStarted──▶ chat ──handoffOpened──▶ handoff
 *                     │                               ▲                        │
 *                     │                               └──handoffDismissed──────┘
 *                     │
 *   (restored from localStorage) ──▶ chat | linked | closed
 *
 *   chat / handoff / greeting ──serverStateChanged(linked)──▶ linked
 *   chat / handoff / linked   ──serverStateChanged(closed)──▶ closed
 *   linked / closed           ──startNewChat──────────────▶ greeting   (E5)
 *
 * LINKED BEATS CLOSED. A conversation can be both (an operator closes one the visitor has
 * already moved to WhatsApp). The server checks `linked` first and so does this machine:
 * "WhatsApp connected" is the state the visitor needs to see, and it is the one that
 * explains where their conversation went.
 *
 * TERMINAL STATES ARE NOT TERMINAL FOR THE WIDGET. `linked` and `closed` both offer "start
 * a new chat", which clears the session and returns to `greeting` (E5). Only the server can
 * move a conversation INTO them; only the visitor can move out, and doing so abandons the
 * old conversation rather than reopening it.
 */

import type { RequestWidgetHandoffResponse, WidgetConversationView, WidgetMessageView } from "./types";

export type WidgetPhase = "idle" | "greeting" | "chat" | "handoff" | "linked" | "closed";

export interface WidgetState {
    phase: WidgetPhase;
    /** Panel visibility. Orthogonal to `phase` — see the header. */
    open: boolean;
    /** The server's view of the conversation, or null before one exists. */
    conversation: WidgetConversationView | null;
    /** Ascending by creation, deduplicated by id. */
    messages: WidgetMessageView[];
    /** Newest message the visitor has actually seen; the unread cursor (E6). */
    lastSeenMessageId: string | null;
    /** Agent messages newer than `lastSeenMessageId`. Drives the launcher badge. */
    unreadCount: number;
    /** The handoff payload while the modal is up. Cleared on dismiss and on link. */
    handoff: RequestWidgetHandoffResponse | null;
    /** A write is in flight (first message, reply, or handoff request). */
    sending: boolean;
    /** Last visitor-facing error, or null. S8.2 decides how loudly to render it. */
    error: string | null;
}

export function initialWidgetState(options?: { open?: boolean; lastSeenMessageId?: string | null }): WidgetState {
    return {
        phase: "idle",
        open: options?.open ?? false,
        conversation: null,
        messages: [],
        lastSeenMessageId: options?.lastSeenMessageId ?? null,
        unreadCount: 0,
        handoff: null,
        sending: false,
        error: null,
    };
}

export type WidgetEvent =
    /** Launcher clicked, or `defaultOpen` on mount. */
    | { type: "panelOpened" }
    /** Minimised back to the launcher. Does not change `phase`. */
    | { type: "panelMinimized" }
    /**
     * A stored session resolved on mount: the server told us the conversation's current
     * state, and the transcript came with it.
     */
    | { type: "sessionRestored"; conversation: WidgetConversationView; messages: WidgetMessageView[] }
    /** The stored session is unusable (SESSION_INVALID / CONVERSATION_NOT_FOUND) — forget it. */
    | { type: "sessionDiscarded" }
    /** A write started (first message, reply, handoff request). */
    | { type: "sendStarted" }
    /** `POST /conversations` succeeded: the conversation now exists. */
    | { type: "conversationStarted"; conversation: WidgetConversationView; message: WidgetMessageView }
    /** `POST /conversation/messages` succeeded. */
    | { type: "messageSent"; message: WidgetMessageView }
    /** A write failed. `sending` is cleared; `phase` is untouched unless the server moved it. */
    | { type: "sendFailed"; error: string }
    /** A poll returned. Both the conversation state and any new messages arrive together. */
    | { type: "polled"; conversation: WidgetConversationView; messages: WidgetMessageView[] }
    /** The handoff modal is up, with the payload the server returned. */
    | { type: "handoffOpened"; handoff: RequestWidgetHandoffResponse }
    /** "Not now — keep chatting here". */
    | { type: "handoffDismissed" }
    /** "Start a new chat" from the linked or closed state (E5). */
    | { type: "startNewChat" }
    /** The visitor has seen the transcript up to its newest message. */
    | { type: "messagesSeen" }
    /** Dismiss the current error without changing anything else. */
    | { type: "errorCleared" };

/**
 * Which phase a conversation is in according to the server. `linked` wins over `closed`;
 * see the header.
 */
export function phaseForConversation(conversation: WidgetConversationView): "chat" | "linked" | "closed" {
    if (conversation.linked) return "linked";
    if (conversation.status === "closed") return "closed";
    return "chat";
}

/** True once the server will refuse writes — the widget must hide its composer. */
export function isConversationLocked(conversation: WidgetConversationView | null): boolean {
    if (conversation === null) return false;
    return conversation.linked || conversation.status === "closed";
}

export function widgetReducer(state: WidgetState, event: WidgetEvent): WidgetState {
    switch (event.type) {
        case "panelOpened": {
            // Opening never invents a conversation: a visitor with none lands on the
            // greeting card, one with a conversation lands wherever the server left them.
            const phase = state.phase === "idle" ? "greeting" : state.phase;
            return markSeen({ ...state, open: true, phase });
        }

        case "panelMinimized":
            // A half-finished handoff collapses back to the chat rather than reopening as a
            // modal over a page the visitor has since scrolled away from.
            return {
                ...state,
                open: false,
                phase: state.phase === "handoff" ? "chat" : state.phase,
                handoff: state.phase === "handoff" ? null : state.handoff,
            };

        case "sessionRestored": {
            const messages = mergeMessages([], event.messages);
            return markSeenIfOpen({
                ...state,
                phase: phaseForConversation(event.conversation),
                conversation: event.conversation,
                messages,
                unreadCount: countUnread(messages, state.lastSeenMessageId),
                error: null,
            });
        }

        case "sessionDiscarded":
            // Everything about the old conversation goes, including the unread cursor: it
            // pointed at a transcript this visitor can no longer reach.
            return { ...initialWidgetState({ open: state.open }), phase: state.open ? "greeting" : "idle" };

        case "sendStarted":
            return { ...state, sending: true, error: null };

        case "conversationStarted": {
            const messages = mergeMessages([], [event.message]);
            return markSeenIfOpen({
                ...state,
                phase: phaseForConversation(event.conversation),
                conversation: event.conversation,
                messages,
                unreadCount: 0,
                sending: false,
                error: null,
            });
        }

        case "messageSent": {
            const messages = mergeMessages(state.messages, [event.message]);
            return markSeenIfOpen({ ...state, messages, sending: false, error: null });
        }

        case "sendFailed":
            return { ...state, sending: false, error: event.error };

        case "polled": {
            const messages = mergeMessages(state.messages, event.messages);
            const phase = nextPhaseFromServer(state.phase, event.conversation);
            const next: WidgetState = {
                ...state,
                phase,
                conversation: event.conversation,
                messages,
                unreadCount: countUnread(messages, state.lastSeenMessageId),
                // A conversation that has just linked has left the widget: the modal it was
                // opened from is now describing something that already happened.
                handoff: phase === "linked" || phase === "closed" ? null : state.handoff,
            };
            return markSeenIfOpen(next);
        }

        case "handoffOpened":
            // Only a live chat can open the modal. A poll that locked the conversation in
            // the meantime wins over a handoff request that was already in flight.
            if (state.phase !== "chat") return { ...state, sending: false };
            return { ...state, phase: "handoff", handoff: event.handoff, sending: false, error: null };

        case "handoffDismissed":
            if (state.phase !== "handoff") return state;
            return { ...state, phase: "chat", handoff: null };

        case "startNewChat":
            // Any phase that HAS a conversation, not only the terminal two. The chat header
            // offers this while the conversation is still live, and the guard used to make
            // that button do nothing at all. `idle` and `greeting` are excluded because
            // there is nothing to abandon — the visitor is already on a fresh chat.
            if (state.phase === "idle" || state.phase === "greeting") return state;
            return { ...initialWidgetState({ open: true }), phase: "greeting" };

        case "messagesSeen":
            return markSeen(state);

        case "errorCleared":
            return { ...state, error: null };

        default: {
            // Exhaustiveness: adding an event without handling it fails the build.
            const unhandled: never = event;
            return unhandled;
        }
    }
}

/**
 * Where the server can move the widget. It may only ever move it FORWARD into a terminal
 * state — nothing on the wire can drag a visitor out of `greeting` or back out of `linked`.
 *
 * THE CONSEQUENCE, RECORDED DELIBERATELY (ruled at S8.2): a conversation never leaves
 * `linked` or `closed`, and `WidgetRoot` stops polling once it reaches either. So an
 * operator who REOPENS a closed conversation from the Support page is not seen by a widget
 * still sitting open on that page — the visitor starts a new chat instead. That is the
 * accepted phase-1 trade: resuming would mean polling terminal conversations indefinitely
 * against the 600/minute budget shared by every visitor on the customer's site, to serve a
 * rare case, and it matches §1.4's "a refreshed page with a new message is a new session".
 */
function nextPhaseFromServer(phase: WidgetPhase, conversation: WidgetConversationView): WidgetPhase {
    const serverPhase = phaseForConversation(conversation);
    if (serverPhase === "linked" || serverPhase === "closed") return serverPhase;
    // Server says "still open", which the widget already knew: keep the local phase, so a
    // poll landing while the handoff modal is up does not close it under the visitor.
    return phase;
}

/** Mark the transcript read, but only while the panel is actually in front of the visitor. */
function markSeenIfOpen(state: WidgetState): WidgetState {
    return state.open ? markSeen(state) : state;
}

function markSeen(state: WidgetState): WidgetState {
    const newest = state.messages[state.messages.length - 1];
    if (newest === undefined) return { ...state, unreadCount: 0 };
    return { ...state, lastSeenMessageId: newest.id, unreadCount: 0 };
}

/**
 * Agent messages after the seen cursor. Visitor messages never count as unread — the
 * visitor wrote them. An unknown cursor (a message since deleted, or storage from an older
 * install) counts the whole transcript rather than silently counting nothing.
 */
export function countUnread(messages: WidgetMessageView[], lastSeenMessageId: string | null): number {
    if (messages.length === 0) return 0;
    const seenIndex = lastSeenMessageId === null ? -1 : messages.findIndex((m) => m.id === lastSeenMessageId);
    return messages.slice(seenIndex + 1).filter((m) => m.direction === "agent").length;
}

/**
 * Append new messages, dropping ids already present and keeping ascending order.
 *
 * The poll is cursor-based and should never resend a message, but a message the widget
 * optimistically appended from a POST response can arrive again on the next poll, so the
 * dedupe is load-bearing rather than defensive.
 */
export function mergeMessages(existing: WidgetMessageView[], incoming: WidgetMessageView[]): WidgetMessageView[] {
    if (incoming.length === 0) return existing;
    const seen = new Set(existing.map((m) => m.id));
    const added = incoming.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });
    return added.length === 0 ? existing : [...existing, ...added];
}

/** The id to send as `?after=` on the next poll, or undefined for the whole transcript. */
export function pollCursor(state: WidgetState): string | undefined {
    const newest = state.messages[state.messages.length - 1];
    return newest?.id;
}
