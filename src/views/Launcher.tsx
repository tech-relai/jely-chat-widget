/**
 * The collapsed widget: a pill carrying the persona's avatar, one line of text, and the
 * unread badge (decision E6).
 *
 * A pill rather than the more common circle, because that is what the design reference
 * shows and because a circle with a chat glyph says nothing about who is behind it. The
 * label is the one visitor-facing string in the widget that is NOT configurable in phase 1
 * — the appearance schema has no field for it — so it is a neutral line in `copy.ts`
 * rather than anything borrowed from the samples.
 *
 * While replies are waiting the label becomes the count. That is deliberate: a badge alone
 * is a number with no verb, and the launcher is often the only thing on screen.
 */

import { copy } from "../copy";
import type { WidgetAppearance } from "../types";
import { Avatar } from "./parts";
import { ChatIcon } from "./icons";

export interface LauncherProps {
    appearance: WidgetAppearance;
    /** Agent messages the visitor has not seen. 0 hides the badge. */
    unreadCount: number;
    onOpen: () => void;
}

export function Launcher({ appearance, unreadCount, onOpen }: LauncherProps) {
    const hasUnread = unreadCount > 0;
    const label = hasUnread ? copy.launcherUnread(unreadCount) : copy.launcherPrompt;

    return (
        <button
            type="button"
            className="j-launcher"
            onClick={onOpen}
            aria-label={hasUnread ? copy.launcherUnread(unreadCount) : copy.launcherOpenAria}
        >
            <span className="j-launcher__avatar">
                <Avatar appearance={appearance} size="md" />
                {hasUnread && (
                    // Capped at 9+: the badge is 17px across and a real conversation never
                    // reaches double digits unseen.
                    <span className="j-launcher__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
            </span>
            <span className="j-launcher__label">{label}</span>
            <span className="j-launcher__glyph">
                <ChatIcon />
            </span>
        </button>
    );
}
