/**
 * The widget's delivery mechanism (decision E1). There is no realtime transport in the
 * Jely backend, so the widget polls:
 *
 *   - every 3s  while the panel is open,
 *   - every 15s while it is minimised,
 *   - not at all while the tab is hidden.
 *
 * Ticks never overlap: the next one is scheduled only after the previous has settled, so
 * a slow network stretches the interval rather than stacking requests. Every tick is
 * handed an `AbortSignal` that fires on unmount and on any options change, and the timer
 * is cleared in the same cleanup — nothing survives an unmount.
 *
 * Why 3s is safe against the server's own limits: `messagesPerSessionPerMinute` is 20 and
 * a 3s poll is exactly 20 requests/minute, which is why the server applies that bucket to
 * the message POST only. The poll is covered by `requestsPerKeyPerMinute` (600) instead —
 * shared across every visitor on the customer's site, so it is a per-install budget, not a
 * per-visitor one.
 */

import { useCallback, useEffect, useRef } from "react";

/** Poll every 3 seconds while the panel is open. */
export const POLL_INTERVAL_OPEN_MS = 3_000;

/** Poll every 15 seconds while the panel is minimised (the unread badge still updates). */
export const POLL_INTERVAL_MINIMIZED_MS = 15_000;

export interface PollIntervalInput {
    /** The panel is minimised to the launcher. */
    minimized: boolean;
    /** The tab is hidden (`document.visibilityState === "hidden"`). */
    hidden: boolean;
}

/**
 * The whole scheduling policy, as one pure function so it can be checked without React.
 * Returns `null` for "do not poll at all".
 */
export function selectPollIntervalMs(input: PollIntervalInput): number | null {
    if (input.hidden) return null;
    return input.minimized ? POLL_INTERVAL_MINIMIZED_MS : POLL_INTERVAL_OPEN_MS;
}

/** True when the document is currently hidden. Safe on the server and in old browsers. */
export function isDocumentHidden(): boolean {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "hidden";
}

export interface UsePollingOptions {
    /**
     * Whether polling should run at all — false before a conversation exists. Independent
     * of visibility: `enabled: false` means there is nothing to poll for, `hidden` means
     * there is, but not now.
     */
    enabled: boolean;
    /** Selects the 15s interval instead of the 3s one. */
    minimized: boolean;
    /**
     * One poll. Rejections are swallowed by design: a failed poll is not an error the
     * visitor should see, it is a tick that produced nothing, and the next one is
     * scheduled anyway. Anything worth surfacing must be handled inside `onTick` itself.
     */
    onTick: (signal: AbortSignal) => Promise<void>;
}

export interface UsePollingResult {
    /**
     * Run a tick now and restart the interval from this moment. Used after the visitor
     * sends a message (so the reply is not up to 3s late) and when the tab becomes
     * visible again.
     */
    pollNow: () => void;
}

export function usePolling(options: UsePollingOptions): UsePollingResult {
    const { enabled, minimized, onTick } = options;

    // `onTick` is usually a fresh closure on every render; keeping it in a ref means the
    // effect below restarts only when the SCHEDULE changes, never merely because the
    // parent re-rendered.
    const onTickRef = useRef(onTick);
    onTickRef.current = onTick;

    // The handle `pollNow` reaches through. It is rebound on every effect run and nulled
    // in the cleanup, so a `pollNow` from a stale render can never revive a dead schedule.
    const restartRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!enabled) return;
        if (typeof window === "undefined") return;

        // All of this is per-effect state, NOT refs. A ref would be shared with the
        // previous effect run: if `minimized` flipped while a tick was in flight, the new
        // run would see the old "running" flag, return early, and never schedule again —
        // polling would stop silently.
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let inFlight: AbortController | null = null;
        let running = false;

        const clearTimer = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const schedule = () => {
            clearTimer();
            const intervalMs = selectPollIntervalMs({ minimized, hidden: isDocumentHidden() });
            if (intervalMs === null) return; // Paused; `onVisibilityChange` restarts us.
            timer = setTimeout(() => void run(), intervalMs);
        };

        const run = async () => {
            if (cancelled || running) return;
            if (isDocumentHidden()) return; // Became hidden while the timer was pending.

            running = true;
            const controller = new AbortController();
            inFlight = controller;
            try {
                await onTickRef.current(controller.signal);
            } catch {
                // Deliberately swallowed — see `onTick`'s doc comment.
            } finally {
                running = false;
                if (inFlight === controller) inFlight = null;
                if (!cancelled) schedule();
            }
        };

        const onVisibilityChange = () => {
            if (cancelled) return;
            if (isDocumentHidden()) {
                clearTimer();
                return;
            }
            // Back in view: catch up immediately rather than waiting out an interval.
            void run();
        };

        restartRef.current = () => {
            if (cancelled) return;
            clearTimer();
            void run();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        void run();

        return () => {
            cancelled = true;
            restartRef.current = null;
            document.removeEventListener("visibilitychange", onVisibilityChange);
            clearTimer();
            inFlight?.abort();
            inFlight = null;
        };
    }, [enabled, minimized]);

    const pollNow = useCallback(() => {
        restartRef.current?.();
    }, []);

    return { pollNow };
}
