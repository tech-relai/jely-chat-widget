/**
 * What a failed write looks like to a UI: a machine-readable `code`, never visitor copy.
 * The English sentences live in the UI layer (`WidgetRoot`'s `describeError`), so a custom
 * UI can word — or translate — them itself.
 *
 * `code` is one of the server's `WidgetApiErrorCode`s, or one of two CLIENT-SIDE codes that
 * never travel on the wire:
 *
 *   - `NETWORK_ERROR` — no response at all: offline, DNS, the request timeout in `api.ts`,
 *     the host site's CSP, or an origin the server refused without CORS headers
 *     (`JelyApiError.isNetworkError`).
 *   - `UNKNOWN` — anything else: a response with no code, a code this package does not
 *     know, or a failure that was not an API error at all.
 *
 * `message` is the server's (or the network layer's) own diagnostic text — for logs, not
 * for the visitor.
 */

import { JelyApiError } from "../api";
import type { WidgetApiErrorCode } from "../types";

export type WidgetErrorCode = WidgetApiErrorCode | "NETWORK_ERROR" | "UNKNOWN";

export interface WidgetError {
    code: WidgetErrorCode;
    message?: string;
}

/**
 * Every wire code, as a record so adding one to `WidgetApiErrorCode` without listing it
 * here fails the build rather than silently mapping it to `UNKNOWN`.
 */
const API_ERROR_CODES: Record<WidgetApiErrorCode, true> = {
    WIDGET_KEY_INVALID: true,
    WIDGET_NOT_READY: true,
    ORIGIN_NOT_ALLOWED: true,
    SESSION_INVALID: true,
    CONVERSATION_LOCKED: true,
    CONVERSATION_CLOSED: true,
    CONVERSATION_NOT_FOUND: true,
    HANDOFF_DISABLED: true,
    RATE_LIMITED: true,
    VALIDATION_ERROR: true,
    NOT_FOUND: true,
    INTERNAL_ERROR: true,
};

function isApiErrorCode(code: string | undefined): code is WidgetApiErrorCode {
    return code !== undefined && Object.prototype.hasOwnProperty.call(API_ERROR_CODES, code);
}

/** Never throws. */
export function toWidgetError(error: unknown): WidgetError {
    if (!(error instanceof JelyApiError)) {
        return error instanceof Error ? { code: "UNKNOWN", message: error.message } : { code: "UNKNOWN" };
    }
    if (error.isNetworkError) return { code: "NETWORK_ERROR", message: error.message };
    return { code: isApiErrorCode(error.code) ? error.code : "UNKNOWN", message: error.message };
}
