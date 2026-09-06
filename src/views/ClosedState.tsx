/**
 * The conversation an operator closed from the Support page.
 *
 * Deliberately NOT merged with `LinkedState` despite the shared shape: the two say
 * different things for different reasons, and the repo's rule is that duplication beats
 * premature reuse until a third call site turns up. Merging them would also invite a
 * `variant` prop, which is how a component starts describing states instead of rendering
 * one.
 *
 * Same affordance as the linked state (E5): a visible "Start a new chat" that clears the
 * session. A closed conversation is never reopened from the widget — only an operator can
 * reopen one, and by then the visitor has a new one.
 */

import { copy } from "../copy";
import { ArchiveIcon } from "./icons";

export function ClosedState({ onStartNewChat }: { onStartNewChat: () => void }) {
    return (
        <div className="j-locked">
            <span className="j-locked__icon">
                <ArchiveIcon size={15} />
            </span>
            <div>
                <p className="j-locked__title">{copy.closedTitle}</p>
                <p className="j-locked__body">{copy.closedBody}</p>
                <button type="button" className="j-textbutton" onClick={onStartNewChat}>
                    {copy.startNewChat}
                </button>
            </div>
        </div>
    );
}
