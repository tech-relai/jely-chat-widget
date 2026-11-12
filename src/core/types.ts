/**
 * The controller's public shapes. `JelyChatState` is the reducer's `WidgetState` plus the
 * two facts the reducer does not own: the org's config and whether it failed to load.
 */

import type { WidgetState } from "../state";
import type { WidgetPublicConfigResponse } from "../types";

export interface JelyChatOptions {
    widgetKey: string;
    /** Defaults to `DEFAULT_API_BASE_URL`. */
    apiBaseUrl?: string;
    /** Open the panel on first visit. A visitor's stored open/minimised choice wins. */
    defaultOpen?: boolean;
}

export interface JelyChatState extends WidgetState {
    /** The org's public config, or null until `GET /config` answers. */
    config: WidgetPublicConfigResponse | null;
    /** `GET /config` failed: the install is wrong, render nothing. */
    unavailable: boolean;
}

export interface JelyChat {
    /** The current state. The same object until something changes. */
    getState(): JelyChatState;
    /** Called after every change. Returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Send the first message, creating the conversation. */
    start(text: string): Promise<void>;
    /** Send a message in the current conversation. */
    send(text: string): Promise<void>;
    /** Ask for the WhatsApp handoff payload. Only from the `chat` phase. */
    requestHandoff(): Promise<void>;
    /** Close the handoff payload and return to `chat`. */
    dismissHandoff(): void;
    /** Abandon the current conversation and return to the greeting. */
    startNewChat(): void;
    /** Show the panel (remembered across page loads). */
    open(): void;
    /** Minimise the panel (remembered across page loads). */
    close(): void;
    /** The visitor has seen the transcript up to its newest message. */
    markSeen(): void;
    /** Dismiss `error` without changing anything else. */
    clearError(): void;
    /** Stop polling, abort reads, drop listeners. The instance is inert afterwards. */
    destroy(): void;
}
