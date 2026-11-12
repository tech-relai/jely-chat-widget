/**
 * Keeps the conversation's visitor identity in step with what the host passed, for one
 * controller (`createJelyChat`). Same shape as `createPoller`: a function holding its own
 * small state, handed what it needs.
 *
 * BEST-EFFORT. Without a conversation the identity rides along with the first message
 * (`startConversation`); with one it goes to `POST /conversation/identity`, once per
 * distinct identity — the fingerprint of what this session already sent is kept in storage,
 * so a reload or a re-render sends nothing. A failure is never shown to the visitor and is
 * not retried on a timer (so a 429 cannot loop): the next change, or the next page load,
 * tries again. An identity the server refuses as invalid is remembered for this page and not
 * sent again, and it never costs the visitor their first message — the start is retried
 * once without it.
 */

import { JelyApiError, type WidgetApiClient } from "../api";
import { readWidgetStorage, writeWidgetStorage } from "../storage";
import type { StartWidgetConversationResponse, WidgetVisitorIdentity } from "../types";
import { identityFingerprint, normalizeIdentity, type JelyChatIdentity } from "./identity";
import { visitorContext } from "./visitor";

export interface IdentitySyncDeps {
    client: WidgetApiClient;
    widgetKey: string;
    /** The controller's lifetime: aborts an identify in flight on `destroy()`. */
    signal: AbortSignal;
    /** The current session token, or null before a conversation exists. */
    getSessionToken(): string | null;
    isDestroyed(): boolean;
    /** The session this identify was sent to is gone (401); called only if it is still current. */
    onSessionGone(): void;
}

export interface IdentitySync {
    /** Replace the held identity (normalised) and send it if a conversation exists. */
    set(input: JelyChatIdentity | null | undefined): void;
    /** Send the held identity to the current conversation unless it already has it. */
    flush(): Promise<void>;
    /**
     * `POST /conversations` for `text`, carrying the held identity when there is one.
     * `identitySent` is the fingerprint to store with the new session, or null.
     */
    startConversation(
        text: string,
    ): Promise<{ response: StartWidgetConversationResponse; identitySent: string | null }>;
}

export function createIdentitySync(deps: IdentitySyncDeps, initial: JelyChatIdentity | undefined): IdentitySync {
    const { client, widgetKey } = deps;
    // The host's visitor identity, normalised; null when there is nothing to send.
    let identity: WidgetVisitorIdentity | null = normalizeIdentity(initial);
    // An identity the server refused as invalid: not sent again from this page.
    let rejectedFingerprint: string | null = null;
    let identifying = false;
    let identifyAgain = false;

    async function flush(): Promise<void> {
        const token = deps.getSessionToken();
        const current = identity;
        if (deps.isDestroyed() || token === null || current === null) return;
        const fingerprint = identityFingerprint(current);
        if (fingerprint === rejectedFingerprint) return;
        if (fingerprint === readWidgetStorage(widgetKey).identitySent) return;
        if (identifying) {
            identifyAgain = true;
            return;
        }

        identifying = true;
        try {
            await client.identify({ identity: current }, { sessionToken: token, signal: deps.signal });
            // Only for the session it was sent to: a new chat may have started meanwhile.
            if (deps.getSessionToken() === token) {
                writeWidgetStorage(widgetKey, { identitySent: fingerprint, sessionUpdatedAt: Date.now() });
            }
        } catch (error) {
            if (error instanceof JelyApiError && error.isSessionGone) {
                if (deps.getSessionToken() === token) deps.onSessionGone();
            } else if (error instanceof JelyApiError && error.code === "VALIDATION_ERROR") {
                rejectedFingerprint = fingerprint;
            }
            // Anything else (offline, 429, 5xx): left for the next change or page load.
        } finally {
            identifying = false;
            // A different identity arrived while this one was in flight; the same one is not
            // retried here, which is what keeps a failing request from looping.
            const latest = identity;
            if (identifyAgain && latest !== null && identityFingerprint(latest) !== fingerprint) {
                identifyAgain = false;
                void flush();
            }
            identifyAgain = false;
        }
    }

    return {
        set(input) {
            identity = normalizeIdentity(input);
            void flush();
        },
        flush,
        async startConversation(text) {
            const request = { body: text, ...visitorContext() };
            const attached =
                identity !== null && identityFingerprint(identity) !== rejectedFingerprint ? identity : null;
            if (attached === null) return { response: await client.startConversation(request), identitySent: null };

            const fingerprint = identityFingerprint(attached);
            try {
                const response = await client.startConversation({ ...request, identity: attached });
                return { response, identitySent: fingerprint };
            } catch (error) {
                if (!(error instanceof JelyApiError) || error.code !== "VALIDATION_ERROR") throw error;
                rejectedFingerprint = fingerprint;
                return { response: await client.startConversation(request), identitySent: null };
            }
        },
    };
}
