/**
 * The first thing a visitor sees when they open the widget, and the only view that can
 * start a conversation.
 *
 * STRUCTURE (§4.9, matching the second design sample): avatar, the greeting headline, the
 * "I'm {displayName} from {organization}" identity line, the tagline, the reply-time line,
 * an optional CTA, the first-message input and the guest note.
 *
 * NO "CONTINUE ON WHATSAPP" ROW (user, 2026-09-08), which §4.9 does list here. It was a
 * dead control: `POST /conversation/handoff` is session-authenticated and there is no
 * session until the visitor sends something, so the row's only possible outcome on this
 * card was the error "Send your first message here, then you can move it to WhatsApp".
 * Offering a route and then refusing it is worse than not offering it — the row appears in
 * the chat footer the moment there is a conversation to move.
 *
 * WHERE THE HEADLINE COMES FROM — a resolved conflict inside the plan, flagged here
 * because it is the one place a reader would otherwise think something was missed.
 * §4.9 writes the headline literally as "Hi — I'm {displayName} from {org}", while the
 * contract carries a configurable `greeting` documented as the "greeting headline"
 * (default "Hi — how can we help?"). Rendering §4.9's sentence as the headline would leave
 * `greeting` with nowhere to go; rendering both as headlines gives the visitor "Hi —" twice
 * with the default copy. So the org's `greeting` IS the headline, and §4.9's sentence
 * becomes the identity line directly under it — the same bold-line/muted-line pair the
 * sample shows, with the composition §4.9 asks for intact.
 */

import { resolveCta } from "../appearance";
import { copy } from "../copy";
import type { WidgetAppearance } from "../types";
import { CloseIcon, ExternalLinkIcon, GuestIcon } from "./icons";
import { Avatar, Composer, ErrorNote } from "./parts";

export interface GreetingCardProps {
    appearance: WidgetAppearance;
    organizationName: string;
    sending: boolean;
    error: string | null;
    onSendFirstMessage: (body: string) => void;
    onDismissError: () => void;
    onMinimize: () => void;
}

export function GreetingCard(props: GreetingCardProps) {
    const { appearance, organizationName } = props;
    const cta = resolveCta(appearance);

    return (
        <section className="j-panel" role="complementary" aria-label={copy.regionLabel(organizationName)}>
            <div className="j-header">
                <Avatar appearance={appearance} size="lg" />
                <div className="j-header__text">
                    <h2 className="j-header__title">{appearance.greeting}</h2>
                    <p className="j-header__identity">
                        {copy.identityGreeting(appearance.displayName, organizationName)}
                    </p>
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

            <div className="j-body">
                <p className="j-tagline">{appearance.tagline}</p>

                <p className="j-replytime">
                    <span className="j-replytime__dot" />
                    <span>{appearance.replyTimeText}</span>
                </p>

                {cta !== null && (
                    <a className="j-cta" href={cta.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon size={14} />
                        {cta.label}
                    </a>
                )}

                <Composer
                    placeholder={copy.firstMessagePlaceholder}
                    disabled={false}
                    sending={props.sending}
                    onSend={props.onSendFirstMessage}
                />

                {props.error !== null && <ErrorNote message={props.error} onDismiss={props.onDismissError} />}

                <p className="j-note">
                    <GuestIcon />
                    <span>{copy.guestNote}</span>
                </p>
            </div>
        </section>
    );
}
