/**
 * The two time strings the transcript shows: the day mark ("Today · 10:02") and the clock
 * time under a run of messages.
 *
 * The FORMAT follows the visitor's browser locale — `Intl` with an undefined locale, so a
 * 24-hour region sees 14:05 and a 12-hour region sees 2:05 PM. The WORDS ("Today",
 * "Yesterday") come from `copy.ts` like every other string, because those are language,
 * not formatting. Anything older than yesterday shows its date instead of a word.
 *
 * `Intl.DateTimeFormat` instances are cached: constructing one is the expensive part, and
 * a transcript formats a mark per day plus a time per message run on every render.
 */

import { copy } from "./copy";

let timeFormatter: Intl.DateTimeFormat | null = null;
let dateFormatter: Intl.DateTimeFormat | null = null;

function formatters(): { time: Intl.DateTimeFormat; date: Intl.DateTimeFormat } {
    timeFormatter ??= new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    dateFormatter ??= new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
    return { time: timeFormatter, date: dateFormatter };
}

/** An ISO-8601 string from the API, or null when it cannot be parsed. */
function parse(iso: string): Date | null {
    const value = new Date(iso);
    return Number.isNaN(value.getTime()) ? null : value;
}

/** "10:02" in the visitor's locale, or "" for an unparseable timestamp. */
export function formatClockTime(iso: string): string {
    const value = parse(iso);
    return value === null ? "" : formatters().time.format(value);
}

/** "Today · 10:02" / "Yesterday · 18:40" / "4 Mar · 09:15". */
export function formatDayMark(iso: string, now: Date = new Date()): string {
    const value = parse(iso);
    if (value === null) return "";
    const { time, date } = formatters();
    const days = calendarDaysBetween(value, now);
    const day = days === 0 ? copy.dayToday : days === 1 ? copy.dayYesterday : date.format(value);
    return copy.daySeparator(day, time.format(value));
}

/** True when two timestamps fall on different local calendar days. */
export function startsNewDay(iso: string, previousIso: string | undefined): boolean {
    if (previousIso === undefined) return true;
    const current = parse(iso);
    const previous = parse(previousIso);
    if (current === null || previous === null) return false;
    return calendarDaysBetween(current, previous) !== 0;
}

/**
 * Whole local calendar days between two instants — NOT a duration. 23:59 and 00:01 are one
 * day apart even though two minutes passed, which is exactly what a day mark means.
 */
function calendarDaysBetween(earlier: Date, later: Date): number {
    const a = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
    const b = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
    return Math.round((b - a) / 86_400_000);
}
