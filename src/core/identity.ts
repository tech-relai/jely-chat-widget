/**
 * The host site's visitor identity: who its logged-in user is. Display-only and UNVERIFIED
 * on Jely's side — anything in a browser can be changed — so it labels the conversation for
 * the operator and nothing more.
 *
 * NORMALISED BEFORE IT IS SENT, so a host's form data never costs the visitor a request:
 * every field is trimmed, a blank one is dropped, and one the server would refuse (over the
 * contract's length, or an email its validator rejects) is dropped too rather than
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
 * The exact pattern the server's validator applies to `identity.email`: zod 3.25.76's
 * `.email()` (`emailRegex` in `zod/v3/types.js`), copied byte for byte so an email the
 * widget sends is one the API accepts. ASCII only — `josé@example.com` or
 * `name@münchen.de` are refused there, so they are dropped here. Re-check it when the
 * backend's zod version changes.
 */
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

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
    const email = rawEmail !== undefined && EMAIL_PATTERN.test(rawEmail) ? rawEmail : undefined;
    const workspace = field(input.workspace, WIDGET_IDENTITY_LIMITS.workspaceMaxChars);
    if (name === undefined && email === undefined && workspace === undefined) return null;
    return {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(workspace !== undefined ? { workspace } : {}),
    };
}

/**
 * The same identity without its email, or null when there was no email or nothing else is
 * left. The one fallback after the server refuses an identity: name and workspace are
 * plain bounded strings, so an email is the likely culprit.
 */
export function withoutEmail(identity: WidgetVisitorIdentity): WidgetVisitorIdentity | null {
    if (identity.email === undefined) return null;
    const { email: _email, ...rest } = identity;
    return rest.name === undefined && rest.workspace === undefined ? null : rest;
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
