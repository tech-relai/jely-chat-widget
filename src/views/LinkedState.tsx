/**
 * The locked "WhatsApp connected" state (decision E5).
 *
 * It replaces the composer rather than the transcript: the visitor keeps their history —
 * every read route still works after a conversation links, only writes 409 — and the panel
 * explains where the conversation went instead of going blank.
 *
 * "Start a new chat" is VISIBLE, not hidden behind anything (E5 says so explicitly). It
 * clears the stored session, so the next message opens a fresh conversation with a fresh
 * ref; the linked one continues on WhatsApp and is not reopened.
 */

import { copy } from "../copy";
import { LinkIcon } from "./icons";

export function LinkedState({ onStartNewChat }: { onStartNewChat: () => void }) {
    return (
        <div className="j-locked">
            <span className="j-locked__icon j-wa-glyph">
                <LinkIcon size={15} />
            </span>
            <div>
                <p className="j-locked__title">{copy.linkedTitle}</p>
                <p className="j-locked__body">{copy.linkedBody}</p>
                <button type="button" className="j-textbutton" onClick={onStartNewChat}>
                    {copy.startNewChat}
                </button>
            </div>
        </div>
    );
}
