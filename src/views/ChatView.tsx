/**
 * The conversation itself: header, transcript, composer, WhatsApp footer (§4.9).
 *
 * It also renders the two locked states, because a linked or closed conversation is still
 * this view with its composer replaced — the transcript stays readable (every widget read
 * route keeps working after a conversation locks; only writes 409), and swapping to a
 * blank panel would hide the visitor's own words from them.
 *
 * UNREAD HANDLING (§4.9). Two different things wear that name and only one of them is the
 * launcher badge:
 *   - `state.unreadCount` counts what the visitor has not SEEN, and the reducer clears it
 *     whenever the panel is open. That drives the launcher (E6) and nothing here.
 *   - While the panel IS open, the visitor can still be scrolled up in a long transcript
 *     when a reply lands. Auto-scrolling them away from what they were reading is the
 *     wrong answer, so this view counts arrivals that happened away from the bottom
 *     itself and offers a jump pill instead. The count is local because it describes the
 *     scroll position, which no other part of the widget knows or should know.
 */

import { useEffect, useRef, useState } from "react";

import { copy } from "../copy";
import { formatClockTime, formatDayMark, startsNewDay } from "../time";
import type { WidgetAppearance, WidgetMessageView } from "../types";
import { ChevronDownIcon, CloseIcon } from "./icons";
import { ClosedState } from "./ClosedState";
import { LinkedState } from "./LinkedState";
import { Avatar, Composer, ErrorNote, WhatsAppRow } from "./parts";

export interface ChatViewProps {
    appearance: WidgetAppearance;
    organizationName: string;
    messages: WidgetMessageView[];
    /** Why writes are refused, or null while the conversation is live. */
    lock: "linked" | "closed" | null;
    whatsappAvailable: boolean;
    sending: boolean;
    error: string | null;
    onSend: (body: string) => void;
    onOpenHandoff: () => void;
    onDismissError: () => void;
    onMinimize: () => void;
    /** The transcript reached its bottom — the visitor has seen everything. */
    onSeen: () => void;
    onStartNewChat: () => void;
}

/** How close to the bottom still counts as "at the bottom", in pixels. */
const BOTTOM_THRESHOLD_PX = 48;

export function ChatView(props: ChatViewProps) {
    const { appearance, messages, lock } = props;
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [atBottom, setAtBottom] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const previousCountRef = useRef(messages.length);

    // Follow the conversation while the visitor is at the bottom; otherwise remember how
    // much arrived behind their back.
    useEffect(() => {
        const arrived = messages.length - previousCountRef.current;
        previousCountRef.current = messages.length;
        if (atBottom) {
            scrollToBottom(scrollRef.current);
            if (arrived > 0) props.onSeen();
            return;
        }
        if (arrived > 0) setPendingCount((count) => count + arrived);
        // Deliberately keyed on the message COUNT alone. Adding `atBottom` would re-run
        // this the moment the visitor scrolls and yank them back down again.
    }, [messages.length]);

    // On first paint the panel opens showing the newest message, like every chat client.
    useEffect(() => {
        scrollToBottom(scrollRef.current);
    }, []);

    const jumpToLatest = () => {
        scrollToBottom(scrollRef.current);
        setAtBottom(true);
        setPendingCount(0);
        props.onSeen();
    };

    return (
        <section
            className="j-panel j-panel--chat"
            role="complementary"
            aria-label={copy.regionLabel(props.organizationName)}
        >
            <div className="j-header">
                <Avatar appearance={appearance} size="md" />
                <div className="j-header__text">
                    <h2 className="j-header__title">
                        {copy.identityShort(appearance.displayName, props.organizationName)}
                    </h2>
                    <p className="j-header__identity">{appearance.replyTimeText}</p>
                </div>
                <button
                    type="button"
                    className="j-iconbutton"
                    onClick={props.onMinimize}
                    aria-label={copy.minimizeAria}
                >
                    <CloseIcon />
                </button>
            </div>

            <div
                className="j-transcript"
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-label={copy.transcriptAria}
                onScroll={(event) => {
                    const element = event.currentTarget;
                    const reachedBottom =
                        element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX;
                    setAtBottom(reachedBottom);
                    if (!reachedBottom) return;
                    setPendingCount(0);
                    props.onSeen();
                }}
            >
                {messages.map((message, index) => (
                    <Message
                        key={message.id}
                        appearance={appearance}
                        message={message}
                        previous={messages[index - 1]}
                        next={messages[index + 1]}
                    />
                ))}
            </div>

            {pendingCount > 0 && (
                <button type="button" className="j-jump" onClick={jumpToLatest}>
                    {copy.newMessages(pendingCount)}
                    <ChevronDownIcon />
                </button>
            )}

            {lock === null ? (
                <div className="j-composerwrap">
                    {props.error !== null && <ErrorNote message={props.error} onDismiss={props.onDismissError} />}
                    <Composer
                        placeholder={copy.replyPlaceholder}
                        disabled={false}
                        sending={props.sending}
                        onSend={props.onSend}
                    />
                </div>
            ) : lock === "linked" ? (
                <LinkedState onStartNewChat={props.onStartNewChat} />
            ) : (
                <ClosedState onStartNewChat={props.onStartNewChat} />
            )}

            {lock === null && props.whatsappAvailable && (
                <WhatsAppRow hint={copy.continueHintSameConversation} onOpen={props.onOpenHandoff} />
            )}
        </section>
    );
}

/**
 * One bubble, plus the day mark above it when the calendar day changed and the clock time
 * below it when this is the last message of a same-direction run. Timing every message
 * would double the transcript's line count for information the visitor rarely wants.
 *
 * THE TIME IS A SIBLING OF THE AVATAR ROW, NOT A CHILD OF IT. It used to sit in a column
 * beside the avatar, which meant the row's `align-items` resolved against bubble + time
 * together: the avatar aligned to the bottom of the TIMESTAMP and hung visibly below the
 * bubble it belonged to. Keeping the time outside `.j-msg__row` is what lets the avatar
 * align to the bubble itself.
 */
function Message({
    appearance,
    message,
    previous,
    next,
}: {
    appearance: WidgetAppearance;
    message: WidgetMessageView;
    previous: WidgetMessageView | undefined;
    next: WidgetMessageView | undefined;
}) {
    const isVisitor = message.direction === "visitor";
    const showDayMark = startsNewDay(message.createdAt, previous?.createdAt);
    const startsRun = previous === undefined || previous.direction !== message.direction;
    const endsRun = next === undefined || next.direction !== message.direction;
    // The avatar OPENS a run: it sits beside the first agent bubble and aligns with its top
    // edge, the way `widget-samples/` draws it, so a three-message answer reads as one turn
    // rather than three separate people. The rest of the run keeps an avatar-sized spacer,
    // so every bubble in it shares one left edge.
    const showAvatar = !isVisitor && startsRun;

    return (
        <>
            {showDayMark && <p className="j-daymark">{formatDayMark(message.createdAt)}</p>}
            <div className={`j-msg ${isVisitor ? "j-msg--visitor" : "j-msg--agent"}`}>
                <div className="j-msg__row">
                    {!isVisitor &&
                        (showAvatar ? (
                            <Avatar appearance={appearance} size="sm" />
                        ) : (
                            <span className="j-avatar--sm j-msg__spacer" />
                        ))}
                    <div className={`j-bubble ${isVisitor ? "j-bubble--visitor" : "j-bubble--agent"}`}>
                        {message.body}
                    </div>
                </div>
                {endsRun && <p className="j-msg__time">{formatClockTime(message.createdAt)}</p>}
            </div>
        </>
    );
}

function scrollToBottom(element: HTMLDivElement | null): void {
    if (element === null) return;
    element.scrollTop = element.scrollHeight;
}
