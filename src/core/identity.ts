/**
 * The host site's visitor identity: who its logged-in user is. Display-only and UNVERIFIED
 * on Jely's side — anything in a browser can be changed — so it labels the conversation for
 * the operator and nothing more.
 *
 * NORMALISED BEFORE IT IS SENT, so a host's form data never costs the visitor a request:
 * every field is trimmed, a blank one is dropped, and one the server would refuse (over the
 * contract's length, or an email that does not look like one) is dropped too rather than
 * truncated — a cut-off email is a wrong email. When nothing is left, nothing is sent.
 */

import { WIDGET_IDENTITY_LIMITS, type WidgetVisitorIdentity } from "../types";

/** What a host passes as `identity` / to `identify()`. Every field is optional. */
export interface JelyChatIdentity {
    name?: string;
    email?: string;
    workspace?: string;
}

/**
 * A deliberately loose email shape: something@something.tld with no spaces. The server's
 * check is stricter; anything it still refuses is dropped there (see `createJelyChat`).
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: unknown, maxChars: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.length > maxChars) return undefined;
    return trimmed;
}

/** The identity as the API should receive it, or null when there is nothing worth sending. */
export function normalizeIdentity(input: JelyChatIdentity | null | undefined): WidgetVisitorIdentity | null {
    if (input === null || input === undefined || typeof input !== "object") return null;
    const name = field(input.name, WIDGET_IDENTITY_LIMITS.nameMaxChars);
    const rawEmail = field(input.email, WIDGET_IDENTITY_LIMITS.emailMaxChars);
    const email = rawEmail !== undefined && EMAIL_SHAPE.test(rawEmail) ? rawEmail : undefined;
    const workspace = field(input.workspace, WIDGET_IDENTITY_LIMITS.workspaceMaxChars);
    if (name === undefined && email === undefined && workspace === undefined) return null;
    return {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(workspace !== undefined ? { workspace } : {}),
    };
}

/**
 * A short stable fingerprint of a normalised identity (32-bit FNV-1a, hex). It is what the
 * widget remembers in localStorage as "already sent", so the visitor's name and email are
 * not copied into storage a second time. Collisions only mean one identify is skipped.
 */
export function identityFingerprint(identity: WidgetVisitorIdentity): string {
    const text = JSON.stringify([identity.name ?? null, identity.email ?? null, identity.workspace ?? null]);
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
}
