/**
 * The pieces more than one view needs: the persona avatar, the message composer, the
 * "Continue on WhatsApp" row and the inline error note.
 *
 * They live together because each is a handful of lines and none of them owns any state
 * beyond the composer's draft — splitting four of these into four files would make the
 * views harder to read, not easier.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { avatarInitial } from "../appearance";
import { copy } from "../copy";
import { WIDGET_MESSAGE_MAX_CHARS, type WidgetAppearance } from "../types";
import { ArrowUpIcon, CloseIcon, WhatsAppGlyph } from "./icons";

export function Avatar({ appearance, size }: { appearance: WidgetAppearance; size: "lg" | "md" | "sm" }) {
    const url = appearance.avatarUrl?.trim() ?? "";
    return (
        <span className={`j-avatar j-avatar--${size}`}>
            {url === "" ? (
                avatarInitial(appearance.displayName)
            ) : (
                <img src={url} alt={copy.avatarAlt(appearance.displayName)} />
            )}
        </span>
    );
}

export interface ComposerProps {
    placeholder: string;
    disabled: boolean;
    /** True while a send is in flight — the button spins down rather than the input locking. */
    sending: boolean;
    autoFocus?: boolean;
    onSend: (body: string) => void;
}

/**
 * The message box. Enter sends, Shift+Enter breaks a line — the convention every chat the
 * visitor already uses follows, including WhatsApp's web client.
 *
 * The draft is local state on purpose: it must survive a poll landing mid-sentence, and
 * hoisting it into the reducer would make every 3s tick a re-render of the whole tree.
 */
export function Composer({ placeholder, disabled, sending, autoFocus, onSend }: ComposerProps) {
    const [draft, setDraft] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    // Grow with the text up to the CSS max-height, then scroll. Reading `scrollHeight`
    // after resetting the height is the only way to let a textarea shrink again.
    useEffect(() => {
        const element = textareaRef.current;
        if (element === null) return;
        element.style.height = "auto";
        element.style.height = `${element.scrollHeight}px`;
    }, [draft]);

    useEffect(() => {
        if (autoFocus === true) textareaRef.current?.focus();
    }, [autoFocus]);

    const submit = useCallback(() => {
        const body = draft.trim();
        if (body === "" || disabled || sending) return;
        setDraft("");
        onSend(body);
    }, [draft, disabled, sending, onSend]);

    return (
        <div className="j-composer">
            <textarea
                ref={textareaRef}
                className="j-composer__input"
                rows={1}
                value={draft}
                placeholder={placeholder}
                aria-label={placeholder}
                maxLength={WIDGET_MESSAGE_MAX_CHARS}
                disabled={disabled}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey) return;
                    event.preventDefault();
                    submit();
                }}
            />
            <button
                type="button"
                className="j-send"
                onClick={submit}
                disabled={disabled || sending || draft.trim() === ""}
                aria-label={sending ? copy.sendingLabel : copy.sendAria}
            >
                <ArrowUpIcon />
            </button>
        </div>
    );
}

/**
 * The handoff entry point, in the same place in every view (§4.9 puts it on the greeting
 * card and in the chat's footer). Rendered only when `GET /config` reported
 * `whatsapp.available`, so the visitor is never offered a route the server would refuse.
 */
export function WhatsAppRow({ hint, onOpen }: { hint: string; onOpen: () => void }) {
    return (
        <button type="button" className="j-wafooter" onClick={onOpen}>
            <span className="j-wa-glyph">
                <WhatsAppGlyph />
            </span>
            <span className="j-wafooter__label">{copy.continueOnWhatsApp}</span>
            <span className="j-wafooter__hint">{hint}</span>
        </button>
    );
}

export function ErrorNote({ message, onDismiss }: { message: string; onDismiss: () => void }) {
    return (
        <p className="j-error" role="status">
            <span>{message}</span>
            <button type="button" onClick={onDismiss} aria-label={copy.errorDismissAria}>
                <CloseIcon size={13} />
            </button>
        </p>
    );
}
