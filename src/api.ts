/**
 * The widget's only network layer.
 *
 * Every call goes to `{apiBaseUrl}/api/widget/v1/{widgetKey}/…` — the key travels in the
 * PATH (decision E3) so the server can answer the CORS preflight strictly per org before
 * reading a body. Session-authenticated routes additionally carry the `x-jely-session`
 * header. No cookies and no credentials are ever sent: `credentials: "omit"` is set
 * explicitly on every request, because the server's CORS policy does not allow
 * credentials and a browser would fail the whole request if the widget asked for them.
 *
 * Failures surface as `JelyApiError`, which carries the server's machine-readable `code`
 * so a caller can branch on `CONVERSATION_LOCKED` vs `CONVERSATION_CLOSED` vs
 * `RATE_LIMITED` without string-matching a message.
 */

import {
    WIDGET_SESSION_HEADER,
    type ApiErrorBody,
    type GetWidgetConversationResponse,
    type GetWidgetMessagesQuery,
    type GetWidgetMessagesResponse,
    type IdentifyWidgetConversationRequest,
    type IdentifyWidgetConversationResponse,
    type PostWidgetMessageRequest,
    type PostWidgetMessageResponse,
    type RequestWidgetHandoffResponse,
    type StartWidgetConversationRequest,
    type StartWidgetConversationResponse,
    type WidgetApiErrorCode,
    type WidgetPublicConfigResponse,
    type WidgetSessionToken,
} from "./types";

/**
 * Where the widget talks to by default (residual R1, decided by the user 2026-09-05).
 * Stored WITHOUT a trailing slash; `normalizeApiBaseUrl` strips any the caller supplies.
 */
export const DEFAULT_API_BASE_URL = "https://jely-v2-api-9qirj.ondigitalocean.app";

/**
 * How long a single request may take before it is aborted.
 *
 * A CHOSEN ENGINEERING BOUND, not a product decision — the plan does not specify one.
 * It exists because the poll schedules its next tick only after the previous one
 * settles: a request that never settles would stop the widget forever, on a page the
 * widget does not own. 20s is comfortably longer than any of these endpoints should
 * take and short enough that a wedged connection self-heals within one poll cycle.
 * A caller passing its own `signal` still wins — whichever aborts first ends the call.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/** The path prefix every widget route shares. */
const WIDGET_PATH_PREFIX = "/api/widget/v1";

/**
 * A non-2xx response, or a request that never produced one.
 *
 * `status` is the HTTP status, or 0 when the request failed before a response existed
 * (DNS, TLS, the host site's CSP `connect-src`, an offline device, or — importantly —
 * a 403 `ORIGIN_NOT_ALLOWED`, which the server answers WITHOUT CORS headers so the
 * browser hides it from us). `isNetworkError` distinguishes that case: when it is true,
 * `code` is always undefined and the failure may be the customer's install rather than
 * anything the visitor did.
 */
export class JelyApiError extends Error {
    readonly status: number;
    readonly code?: WidgetApiErrorCode | string;
    readonly details?: unknown;
    readonly isNetworkError: boolean;

    constructor(init: {
        message: string;
        status: number;
        code?: WidgetApiErrorCode | string;
        details?: unknown;
        isNetworkError?: boolean;
    }) {
        super(init.message);
        this.name = "JelyApiError";
        this.status = init.status;
        this.code = init.code;
        this.details = init.details;
        this.isNetworkError = init.isNetworkError ?? false;
        // Keeps `instanceof` working when the package is consumed from compiled ES5.
        Object.setPrototypeOf(this, JelyApiError.prototype);
    }

    /** True for the two codes that mean "this conversation accepts reads but no writes". */
    get isConversationWriteRefused(): boolean {
        return this.code === "CONVERSATION_LOCKED" || this.code === "CONVERSATION_CLOSED";
    }

    /** True when the stored session token is no longer usable and should be discarded. */
    get isSessionGone(): boolean {
        return this.code === "SESSION_INVALID" || this.code === "CONVERSATION_NOT_FOUND";
    }
}

/**
 * Trim, then remove EVERY trailing slash. R1 states the base URL is stored without one
 * and that the client strips one if given; stripping all of them costs nothing and means
 * `https://api.example.com//` cannot produce a double slash in the path.
 */
export function normalizeApiBaseUrl(baseUrl: string | undefined): string {
    const candidate = (baseUrl ?? "").trim();
    if (candidate === "") return DEFAULT_API_BASE_URL;
    return candidate.replace(/\/+$/, "");
}

/**
 * Build a widget route URL. The key is percent-encoded even though the contract's format
 * (`jely_wk_` + hex) contains nothing that needs escaping — a mis-typed key from a
 * customer's env var must not be able to alter the path shape.
 */
export function buildWidgetUrl(
    baseUrl: string,
    widgetKey: string,
    path: string,
    query?: Record<string, string | number | undefined>,
): string {
    const root = `${normalizeApiBaseUrl(baseUrl)}${WIDGET_PATH_PREFIX}/${encodeURIComponent(widgetKey)}${path}`;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined) continue;
        params.set(key, String(value));
    }
    const search = params.toString();
    return search === "" ? root : `${root}?${search}`;
}

export interface WidgetApiClientOptions {
    widgetKey: string;
    /** Defaults to `DEFAULT_API_BASE_URL`. A trailing slash is stripped. */
    apiBaseUrl?: string;
    /** Defaults to `DEFAULT_REQUEST_TIMEOUT_MS`. */
    requestTimeoutMs?: number;
    /** Injectable for tests and for a host that wraps `fetch`. Defaults to `globalThis.fetch`. */
    fetchImpl?: typeof fetch;
}

/** Per-call options. `signal` is how the caller cancels an in-flight poll on unmount. */
export interface RequestOptions {
    signal?: AbortSignal;
}

interface SessionRequestOptions extends RequestOptions {
    sessionToken: WidgetSessionToken;
}

export interface WidgetApiClient {
    /** The normalised base URL actually in use. Exposed for the README's CSP `connect-src` line. */
    readonly apiBaseUrl: string;
    getConfig(options?: RequestOptions): Promise<WidgetPublicConfigResponse>;
    startConversation(
        body: StartWidgetConversationRequest,
        options?: RequestOptions,
    ): Promise<StartWidgetConversationResponse>;
    getConversation(options: SessionRequestOptions): Promise<GetWidgetConversationResponse>;
    getMessages(options: SessionRequestOptions & GetWidgetMessagesQuery): Promise<GetWidgetMessagesResponse>;
    postMessage(body: PostWidgetMessageRequest, options: SessionRequestOptions): Promise<PostWidgetMessageResponse>;
    requestHandoff(options: SessionRequestOptions): Promise<RequestWidgetHandoffResponse>;
    identify(
        body: IdentifyWidgetConversationRequest,
        options: SessionRequestOptions,
    ): Promise<IdentifyWidgetConversationResponse>;
}

export function createWidgetApiClient(options: WidgetApiClientOptions): WidgetApiClient {
    const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
    const widgetKey = options.widgetKey;
    const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);

    async function request<T>(init: {
        method: "GET" | "POST";
        path: string;
        query?: Record<string, string | number | undefined>;
        body?: unknown;
        sessionToken?: string;
        signal?: AbortSignal;
    }): Promise<T> {
        if (typeof fetchImpl !== "function") {
            throw new JelyApiError({
                message: "fetch is not available in this environment",
                status: 0,
                isNetworkError: true,
            });
        }

        const url = buildWidgetUrl(apiBaseUrl, widgetKey, init.path, init.query);
        const headers: Record<string, string> = {};
        if (init.body !== undefined) headers["content-type"] = "application/json";
        if (init.sessionToken !== undefined) headers[WIDGET_SESSION_HEADER] = init.sessionToken;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onCallerAbort = () => controller.abort();
        init.signal?.addEventListener("abort", onCallerAbort);
        if (init.signal?.aborted === true) controller.abort();

        let response: Response;
        try {
            response = await fetchImpl(url, {
                method: init.method,
                headers,
                body: init.body === undefined ? undefined : JSON.stringify(init.body),
                credentials: "omit",
                signal: controller.signal,
            });
        } catch (error) {
            // A caller-driven abort (unmount, route change) is NOT an API failure — it is
            // rethrown untouched so the caller can ignore it by name rather than by guess.
            if (init.signal?.aborted === true) throw error;
            throw new JelyApiError({
                message: error instanceof Error ? error.message : "network request failed",
                status: 0,
                isNetworkError: true,
            });
        } finally {
            clearTimeout(timer);
            init.signal?.removeEventListener("abort", onCallerAbort);
        }

        if (!response.ok) throw await toApiError(response);
        return (await readJson(response)) as T;
    }

    return {
        apiBaseUrl,

        getConfig: (opts) =>
            request<WidgetPublicConfigResponse>({ method: "GET", path: "/config", signal: opts?.signal }),

        startConversation: (body, opts) =>
            request<StartWidgetConversationResponse>({
                method: "POST",
                path: "/conversations",
                body,
                signal: opts?.signal,
            }),

        getConversation: (opts) =>
            request<GetWidgetConversationResponse>({
                method: "GET",
                path: "/conversation",
                sessionToken: opts.sessionToken,
                signal: opts.signal,
            }),

        getMessages: (opts) =>
            request<GetWidgetMessagesResponse>({
                method: "GET",
                path: "/conversation/messages",
                query: { after: opts.after, limit: opts.limit },
                sessionToken: opts.sessionToken,
                signal: opts.signal,
            }),

        postMessage: (body, opts) =>
            request<PostWidgetMessageResponse>({
                method: "POST",
                path: "/conversation/messages",
                body,
                sessionToken: opts.sessionToken,
                signal: opts.signal,
            }),

        identify: (body, opts) =>
            request<IdentifyWidgetConversationResponse>({
                method: "POST",
                path: "/conversation/identity",
                body,
                sessionToken: opts.sessionToken,
                signal: opts.signal,
            }),

        // Sent with no body: the contract declares no request body for this route, and a
        // bodyless POST keeps it honest about being read-only.
        requestHandoff: (opts) =>
            request<RequestWidgetHandoffResponse>({
                method: "POST",
                path: "/conversation/handoff",
                sessionToken: opts.sessionToken,
                signal: opts.signal,
            }),
    };
}

/** Parse a JSON body, tolerating a server that answered non-JSON. */
async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text === "") return undefined;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw new JelyApiError({
            message: "the server returned a response that was not JSON",
            status: response.status,
        });
    }
}

/**
 * Turn a non-2xx response into a `JelyApiError`. The body is the project-wide
 * `{ error, code?, details? }` shape, but an error raised by infrastructure in front of
 * the app may not be JSON at all, so every step degrades to the status code.
 */
async function toApiError(response: Response): Promise<JelyApiError> {
    let body: ApiErrorBody | undefined;
    try {
        const parsed = (await response.json()) as unknown;
        if (typeof parsed === "object" && parsed !== null) body = parsed as ApiErrorBody;
    } catch {
        body = undefined;
    }
    return new JelyApiError({
        message:
            typeof body?.error === "string" && body.error !== "" ? body.error : `request failed (${response.status})`,
        status: response.status,
        code: typeof body?.code === "string" ? body.code : undefined,
        details: body?.details,
    });
}
