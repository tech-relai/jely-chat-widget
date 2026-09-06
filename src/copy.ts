/*
 * Every English string the widget can render, in one place (§4.9).
 *
 * WHY ONE FILE: a later i18n pass should be mechanical — swap this object for one keyed
 * by locale and nothing else moves. So the rule is absolute: **no user-visible string
 * literal appears anywhere else in `src/`.** Interpolated lines are functions rather than
 * `"…{name}…"` templates, because a translator needs to move the placeholder inside the
 * sentence, which a `replace()` on a template cannot express.
 *
 * WHAT IS NOT HERE, deliberately:
 *   - the persona's own words (`displayName`, `greeting`, `tagline`, `replyTimeText`,
 *     `ctaLabel`) — those are the org's configuration, served by `GET /config`, and are
 *     already in the org's own language;
 *   - "WhatsApp", which is a product name and is never translated;
 *   - anything from `widget-samples/`. Those screenshots are one client's brand (F6);
 *     the LAYOUT is copied, the words are not.
 *
 * The interface is declared separately from the value so that a missing key is a compile
 * error rather than something a reviewer has to notice.
 */

export interface WidgetCopy {
    // --- Launcher -----------------------------------------------------------
    /** The one line on the collapsed launcher. Not configurable in phase 1. */
    launcherPrompt: string;
    launcherOpenAria: string;
    launcherCloseAria: string;
    /** Launcher label while unread agent messages are waiting (E6). */
    launcherUnread: (count: number) => string;

    // --- Panel chrome -------------------------------------------------------
    /**
     * The accessible name of the widget's landmark. The panel is a LABELLED REGION, not a
     * dialog: it manages no focus and traps none, and `role="dialog"` would promise a
     * screen-reader user modal semantics the widget deliberately does not provide.
     */
    regionLabel: (organizationName: string) => string;
    minimizeAria: string;
    /** "I'm {displayName} from {organization}" — the greeting card's identity line. */
    identityGreeting: (displayName: string, organizationName: string) => string;
    /** "{displayName} from {organization}" — the chat header's identity line. */
    identityShort: (displayName: string, organizationName: string) => string;
    avatarAlt: (displayName: string) => string;

    // --- Greeting card ------------------------------------------------------
    firstMessagePlaceholder: string;
    guestNote: string;

    // --- Chat ---------------------------------------------------------------
    replyPlaceholder: string;
    sendAria: string;
    sendingLabel: string;
    dayToday: string;
    dayYesterday: string;
    /** "Today · 10:02" */
    daySeparator: (day: string, time: string) => string;
    /** The jump-to-latest pill when replies land while the visitor has scrolled up. */
    newMessages: (count: number) => string;
    transcriptAria: string;

    // --- WhatsApp handoff ---------------------------------------------------
    continueOnWhatsApp: string;
    /** Right-hand hint on the greeting card's WhatsApp row. */
    continueHintOptional: string;
    /** Right-hand hint on the chat view's WhatsApp row. */
    continueHintSameConversation: string;
    handoffTitle: string;
    handoffSubtitle: string;
    handoffRecapLabel: string;
    handoffStaysConnected: string;
    handoffDevices: string;
    handoffNothingToType: string;
    handoffQrCaption: string;
    handoffQrUnavailable: string;
    handoffPhoneLine: (phoneDisplay: string) => string;
    handoffOpen: string;
    handoffNotNow: string;
    handoffConsent: string;
    handoffCloseAria: string;
    /** Shown when the visitor asks for the handoff before sending anything. */
    handoffNeedsMessage: string;

    // --- Terminal states (E5) ----------------------------------------------
    linkedTitle: string;
    linkedBody: string;
    closedTitle: string;
    closedBody: string;
    startNewChat: string;

    // --- Errors -------------------------------------------------------------
    errorSendFailed: string;
    errorRateLimited: string;
    errorTooLong: (maxChars: number) => string;
    errorOffline: string;
    errorHandoffUnavailable: string;
    errorDismissAria: string;
}

export const copy: WidgetCopy = {
    launcherPrompt: "Chat with us",
    launcherOpenAria: "Open the chat",
    launcherCloseAria: "Minimise the chat",
    launcherUnread: (count) => (count === 1 ? "1 new reply" : `${count} new replies`),

    regionLabel: (organizationName) => `Chat with ${organizationName}`,
    minimizeAria: "Minimise the chat",
    identityGreeting: (displayName, organizationName) => `I'm ${displayName} from ${organizationName}`,
    identityShort: (displayName, organizationName) => `${displayName} from ${organizationName}`,
    avatarAlt: (displayName) => `${displayName}'s photo`,

    firstMessagePlaceholder: "Ask a question…",
    guestNote: "You're chatting as a guest — no sign-in or phone number needed.",

    replyPlaceholder: "Write a reply…",
    sendAria: "Send message",
    sendingLabel: "Sending…",
    dayToday: "Today",
    dayYesterday: "Yesterday",
    daySeparator: (day, time) => `${day} · ${time}`,
    newMessages: (count) => (count === 1 ? "1 new reply" : `${count} new replies`),
    transcriptAria: "Conversation",

    continueOnWhatsApp: "Continue on WhatsApp",
    continueHintOptional: "Optional",
    continueHintSameConversation: "Same conversation, on WhatsApp",
    handoffTitle: "Continue this conversation on WhatsApp",
    handoffSubtitle: "Same conversation — now on WhatsApp.",
    handoffRecapLabel: "Moving with you",
    handoffStaysConnected: "Your conversation will stay connected",
    handoffDevices: "Continue on your phone, the desktop app, or WhatsApp Web.",
    handoffNothingToType: "Nothing to type — the message is written for you.",
    handoffQrCaption: "Scan the code with your phone, or open WhatsApp on this device.",
    handoffQrUnavailable: "Use the button below to open WhatsApp on this device.",
    handoffPhoneLine: (phoneDisplay) => `You'll be messaging ${phoneDisplay}`,
    handoffOpen: "Open WhatsApp",
    handoffNotNow: "Not now — keep chatting here",
    handoffConsent:
        "By continuing, you agree to receive messages about this request on WhatsApp. You can stop them at any time.",
    handoffCloseAria: "Close",
    handoffNeedsMessage: "Send your first message here, then you can move it to WhatsApp.",

    linkedTitle: "You're connected on WhatsApp",
    linkedBody: "This conversation continues on WhatsApp — anything new will arrive there.",
    closedTitle: "This conversation was closed",
    closedBody: "Thanks for getting in touch. Start a new chat whenever you need us.",
    startNewChat: "Start a new chat",

    errorSendFailed: "That didn't send. Check your connection and try again.",
    errorRateLimited: "That's a lot of messages at once — give it a moment and try again.",
    errorTooLong: (maxChars) => `Messages are limited to ${maxChars} characters.`,
    errorOffline: "We couldn't reach support just now. Try again in a moment.",
    errorHandoffUnavailable: "Moving to WhatsApp isn't available right now.",
    errorDismissAria: "Dismiss this message",
};
