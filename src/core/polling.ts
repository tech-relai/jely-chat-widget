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
 * handed an `AbortSignal` that fires on `stop()` and on any schedule change, and the timer
 * is cleared in the same step — nothing survives a stop.
 *
 * Why 3s is safe against the server's own limits: `messagesPerSessionPerMinute` is 20 and
 * a 3s poll is exactly 20 requests/minute, which is why the server applies that bucket to
 * the message POST only. The poll is covered by `requestsPerKeyPerMinute` (600) instead —
 * shared across every visitor on the customer's site, so it is a per-install budget, not a
 * per-visitor one.
 *
 * A plain timer, no framework: the controller (`createJelyChat`) owns one poller and calls
 * `update()` after every state change. Each schedule (one `enabled` + `minimized` pair) is
 * its own closure, so a schedule change mid-tick can never inherit the previous one's
 * "running" flag and stall.
 */

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
 * The whole scheduling policy, as one pure function so it can be checked on its own.
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

export interface PollerSchedule {
    /**
     * Whether polling should run at all — false before a conversation exists. Independent
     * of visibility: `enabled: false` means there is nothing to poll for, `hidden` means
     * there is, but not now.
     */
    enabled: boolean;
    /** Selects the 15s interval instead of the 3s one. */
    minimized: boolean;
}

export interface Poller {
    /** Apply a schedule. A change restarts polling with an immediate tick; no change is a no-op. */
    update(schedule: PollerSchedule): void;
    /**
     * Run a tick now and restart the interval from this moment. Used after the visitor
     * sends a message (so the reply is not up to 3s late) and after a refused write.
     * Does nothing while polling is disabled.
     */
    pollNow(): void;
    /** Stop for good: clear the timer, abort the in-flight tick, drop the listener. */
    stop(): void;
}

/**
 * `onTick` is one poll. Rejections are swallowed by design: a failed poll is not an error
 * the visitor should see, it is a tick that produced nothing, and the next one is
 * scheduled anyway. Anything worth surfacing must be handled inside `onTick` itself.
 */
export function createPoller(onTick: (signal: AbortSignal) => Promise<void>): Poller {
    let current: PollerSchedule = { enabled: false, minimized: false };
    let active: { restart: () => void; stop: () => void } | null = null;

    return {
        update(schedule) {
            if (schedule.enabled === current.enabled && schedule.minimized === current.minimized) return;
            current = { ...schedule };
            active?.stop();
            active = schedule.enabled ? startSchedule(schedule.minimized, onTick) : null;
        },
        pollNow() {
            active?.restart();
        },
        stop() {
            active?.stop();
            active = null;
            current = { enabled: false, minimized: false };
        },
    };
}

/**
 * One running schedule. All of this is per-schedule state on purpose: if `minimized`
 * flipped while a tick was in flight, a shared "running" flag would make the new schedule
 * return early and never schedule again — polling would stop silently.
 *
 * Outside a browser (no `document`) it still polls; there is just no visibility signal to
 * pause on.
 */
function startSchedule(
    minimized: boolean,
    onTick: (signal: AbortSignal) => Promise<void>,
): { restart: () => void; stop: () => void } {
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
            await onTick(controller.signal);
        } catch {
            // Deliberately swallowed — see `createPoller`'s doc comment.
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

    const hasDocument = typeof document !== "undefined";
    if (hasDocument) document.addEventListener("visibilitychange", onVisibilityChange);
    void run();

    return {
        restart() {
            if (cancelled) return;
            clearTimer();
            void run();
        },
        stop() {
            cancelled = true;
            if (hasDocument) document.removeEventListener("visibilitychange", onVisibilityChange);
            clearTimer();
            inFlight?.abort();
            inFlight = null;
        },
    };
}
