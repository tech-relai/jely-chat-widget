/**
 * "Continue on WhatsApp" — the fourth design sample, and the one view whose structure is
 * fixed by §4.9: a recap of the last two messages, a QR rendered client-side from
 * `waLink`, an "Open WhatsApp" button that opens `waLink` in a new tab, "Not now", and the
 * consent line.
 *
 * IT CHANGES NOTHING BY ITSELF. `POST /conversation/handoff` is read-only and repeatable
 * (§12, P2/P4): the conversation links only when the visitor actually SENDS the prefilled
 * WhatsApp message, and the widget finds out on its next poll. So "Not now" is a real
 * option with no cost, the modal can be opened again, and nothing here needs to lock the
 * conversation optimistically.
 *
 * The QR encodes the same `waLink` the button opens, so scanning it from another device
 * and tapping it on this one are the same act. `buildQrSymbol` draws it as one SVG path —
 * no data URI, so the host site needs no extra `img-src` (see `qr.ts`).
 *
 * Rendered as an overlay INSIDE the panel rather than a page-level dialog: the widget owns
 * one fixed element on someone else's site, and a second one covering their page would be
 * both hostile and a z-index fight nobody wins.
 */

import { useMemo } from "react";

import { copy } from "../copy";
import { buildQrSymbol } from "../qr";
import type { RequestWidgetHandoffResponse, WidgetMessageView } from "../types";
import { CheckCircleIcon, CloseIcon, DevicesIcon, ExternalLinkIcon, WhatsAppGlyph } from "./icons";

export interface HandoffModalProps {
    handoff: RequestWidgetHandoffResponse;
    /** The whole transcript; the modal shows the last two of it. */
    messages: WidgetMessageView[];
    onDismiss: () => void;
}

/** §4.9: "a recap preview of the last 2 messages". */
const RECAP_MESSAGE_COUNT = 2;

export function HandoffModal({ handoff, messages, onDismiss }: HandoffModalProps) {
    const qr = useMemo(() => buildQrSymbol(handoff.waLink), [handoff.waLink]);
    const recap = messages.slice(-RECAP_MESSAGE_COUNT);
    // The link is built by the server, but this renders a target the visitor is invited to
    // click on a third party's page, so the scheme is checked here too.
    const openable = /^https?:\/\//i.test(handoff.waLink);

    return (
        // A labelled GROUP, not a dialog: it covers the widget's own panel, never the
        // customer's page, and — like the panel — manages no focus.
        <div className="j-handoff" role="group" aria-label={copy.handoffTitle}>
            <div className="j-handoff__head">
                <span className="j-handoff__tile">
                    <WhatsAppGlyph size={19} />
                </span>
                <div className="j-header__text">
                    <h2 className="j-header__title">{copy.handoffTitle}</h2>
                    <p className="j-header__identity">{copy.handoffSubtitle}</p>
                </div>
                <button type="button" className="j-iconbutton" onClick={onDismiss} aria-label={copy.handoffCloseAria}>
                    <CloseIcon />
                </button>
            </div>

            <div className="j-handoff__scroll">
                {recap.length > 0 && (
                    <div className="j-recap">
                        <p className="j-recap__label">{copy.handoffRecapLabel}</p>
                        {recap.map((message) => (
                            <div
                                key={message.id}
                                className={`j-recap__line ${
                                    message.direction === "visitor" ? "j-recap__line--visitor" : ""
                                }`}
                            >
                                <div
                                    className={`j-recap__bubble ${
                                        message.direction === "visitor" ? "j-bubble--visitor" : "j-bubble--agent"
                                    }`}
                                >
                                    {message.body}
                                </div>
                            </div>
                        ))}
                        <p className="j-recap__foot">
                            <CheckCircleIcon />
                            {copy.handoffStaysConnected}
                        </p>
                    </div>
                )}

                {qr !== null && (
                    <div className="j-qr">
                        <div className="j-qr__tile">
                            <svg
                                viewBox={`0 0 ${qr.viewBoxSize} ${qr.viewBoxSize}`}
                                shapeRendering="crispEdges"
                                role="img"
                                aria-label={copy.handoffQrCaption}
                            >
                                <path d={qr.path} fill="var(--jely-qr-ink)" />
                            </svg>
                        </div>
                        <p className="j-qr__caption">{copy.handoffQrCaption}</p>
                    </div>
                )}
                {qr === null && <p className="j-qr__caption">{copy.handoffQrUnavailable}</p>}

                <div className="j-bullets">
                    <p className="j-bullet">
                        <DevicesIcon />
                        {copy.handoffDevices}
                    </p>
                    <p className="j-bullet">
                        <CheckCircleIcon />
                        {copy.handoffNothingToType}
                    </p>
                </div>

                {openable && (
                    <a className="j-primary" href={handoff.waLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon />
                        {copy.handoffOpen}
                    </a>
                )}
                {handoff.phoneDisplay !== "" && (
                    <p className="j-phoneline">{copy.handoffPhoneLine(handoff.phoneDisplay)}</p>
                )}

                <button type="button" className="j-subtle" onClick={onDismiss}>
                    {copy.handoffNotNow}
                </button>

                <p className="j-consent">{copy.handoffConsent}</p>
            </div>
        </div>
    );
}
