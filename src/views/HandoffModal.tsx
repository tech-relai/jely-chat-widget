/**
 * "Continue on WhatsApp" — the fourth design sample.
 *
 * IT CHANGES NOTHING BY ITSELF. `POST /conversation/handoff` is read-only and repeatable
 * (§12, P2/P4): the conversation links only when the visitor actually SENDS the prefilled
 * WhatsApp message, and the widget finds out on its next poll. So "Not now" is a real
 * option with no cost, the modal can be opened again, and nothing here needs to lock the
 * conversation optimistically.
 *
 * TWO STEPS AND NOTHING ELSE (user, 2026-09-08). §4.9 specified a recap of the last two
 * messages beside the QR; it is gone, and the view is now the QR, two numbered steps, the
 * button and the consent line. The recap answered a question ("does my conversation come
 * with me?") that one line answers just as well, while crowding out the only two facts the
 * visitor has to act on — and the second of those, that the prefilled message must be SENT
 * unchanged, was previously implied by "nothing to type" rather than stated.
 *
 * The steps are an `<ol>` with CSS counters rather than hardcoded numerals, so the QR-less
 * fallback renumbers itself instead of showing a lone "2".
 *
 * The QR encodes the same `waLink` the button opens, so scanning it from another device
 * and tapping it on this one are the same act. `buildQrSymbol` draws it as one SVG path —
 * no data URI, so the host site needs no extra `img-src` (see `qr.ts`).
 *
 * A CENTRED, PAGE-LEVEL MODAL (user ruling, 2026-09-08), which reverses this file's
 * original decision to overlay only the widget's own panel. The panel is 372px wide; the
 * sample is a two-column card with the instructions and the call to action beside the QR.
 * Folded into one narrow column it became a scroll, and "Open WhatsApp" — the entire point
 * of the view — sat below the fold. Moving to WhatsApp is a decision the visitor makes
 * once, so it gets the screen for the moment it takes.
 *
 * It is STILL ONE ELEMENT on the customer's page: the modal is `position: fixed` inside
 * the widget's existing shadow host, which is fixed but untransformed, so a fixed
 * descendant resolves against the viewport. No second host, no new z-index.
 *
 * Escape and the backdrop both dismiss. Escape is handled by `WidgetRoot`'s root handler,
 * which already owns the widget's one Escape policy and now gives this modal the key
 * before the panel gets it.
 */

import { useEffect, useId, useMemo, useRef, type KeyboardEvent } from "react";

import { copy } from "../copy";
import { buildQrSymbol } from "../qr";
import type { RequestWidgetHandoffResponse } from "../types";
import { CheckCircleIcon, CloseIcon, ExternalLinkIcon, WhatsAppGlyph } from "./icons";

export interface HandoffModalProps {
    handoff: RequestWidgetHandoffResponse;
    onDismiss: () => void;
}

export function HandoffModal({ handoff, onDismiss }: HandoffModalProps) {
    const qr = useMemo(() => buildQrSymbol(handoff.waLink), [handoff.waLink]);
    const titleId = useId();
    const cardRef = useRef<HTMLDivElement | null>(null);
    // The link is built by the server, but this renders a target the visitor is invited to
    // click on a third party's page, so the scheme is checked here too.
    const openable = /^https?:\/\//i.test(handoff.waLink);
    const hasPhone = handoff.phoneDisplay !== "";

    // Unlike the panel, this one really is modal — it covers the customer's page — so it
    // takes focus on open. Without this the visitor's focus would still be in the composer
    // behind the backdrop, and their next Tab would walk the page they cannot see.
    //
    // And it gives focus back on close, to the "Continue on WhatsApp" row that opened it.
    // Focus otherwise falls to the page body, which puts a keyboard visitor outside the
    // widget entirely — their next Escape would reach the customer's page instead of
    // closing the panel they are still looking at.
    useEffect(() => {
        const card = cardRef.current;
        const root = card?.getRootNode();
        const opener = root instanceof ShadowRoot || root instanceof Document ? root.activeElement : null;
        card?.focus();
        return () => {
            if (opener instanceof HTMLElement) opener.focus();
        };
    }, []);

    return (
        <div
            className="j-modal"
            role="presentation"
            // mousedown, not click: a drag that starts inside the card and ends on the
            // backdrop is a text selection, not a dismissal.
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onDismiss();
            }}
        >
            <div
                className="j-modal__card"
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={(event) => trapTab(event, cardRef.current)}
            >
                <div className="j-modal__head">
                    <span className="j-modal__tile">
                        <WhatsAppGlyph size={20} />
                    </span>
                    <div className="j-modal__heading">
                        <h2 className="j-modal__title" id={titleId}>
                            {copy.handoffTitle}
                        </h2>
                        <p className="j-modal__subtitle">{copy.handoffSubtitle}</p>
                    </div>
                    <button
                        type="button"
                        className="j-iconbutton"
                        onClick={onDismiss}
                        aria-label={copy.handoffCloseAria}
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div className="j-modal__body">
                    <div className="j-modal__main">
                        <ol className="j-steps">
                            <li className="j-step">{qr !== null ? copy.handoffStepScan : copy.handoffStepNoQr}</li>
                            <li className="j-step">{copy.handoffStepSend}</li>
                        </ol>

                        <p className="j-assurance">
                            <CheckCircleIcon />
                            {copy.handoffStaysConnected}
                        </p>

                        <div className="j-modal__actions">
                            {openable && (
                                <a
                                    className="j-primary j-primary--whatsapp"
                                    href={handoff.waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLinkIcon />
                                    {copy.handoffOpen}
                                </a>
                            )}
                            <button type="button" className="j-subtle" onClick={onDismiss}>
                                {copy.handoffNotNow}
                            </button>
                        </div>
                    </div>

                    {/* Omitted entirely when there is neither a QR nor a number to show —
                        an empty column would leave the card lopsided for no reason. */}
                    {(qr !== null || hasPhone) && (
                        <div className="j-modal__side">
                            {qr !== null && (
                                <div className="j-qr__tile">
                                    <svg
                                        viewBox={`0 0 ${qr.viewBoxSize} ${qr.viewBoxSize}`}
                                        shapeRendering="crispEdges"
                                        role="img"
                                        aria-label={copy.handoffQrAria}
                                    >
                                        <path d={qr.path} fill="var(--jely-qr-ink)" />
                                    </svg>
                                </div>
                            )}
                            {hasPhone && <p className="j-phoneline">{copy.handoffPhoneLine(handoff.phoneDisplay)}</p>}
                        </div>
                    )}
                </div>

                <p className="j-consent">{copy.handoffConsent}</p>
            </div>
        </div>
    );
}

/**
 * Keeps Tab inside the card, which is what `aria-modal="true"` promises. The card holds
 * three focusable things at most (close, "Open WhatsApp", "Not now"), so reading them on
 * each Tab is cheaper than tracking them.
 *
 * `getRootNode()` rather than `document.activeElement`: inside a shadow root the document
 * only reports the HOST as active, so the comparison would never match.
 */
function trapTab(event: KeyboardEvent<HTMLDivElement>, card: HTMLDivElement | null): void {
    if (event.key !== "Tab" || card === null) return;
    const focusable = card.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) return;

    const active = (card.getRootNode() as ShadowRoot | Document).activeElement;

    if (event.shiftKey && (active === first || active === card)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
    }
}
