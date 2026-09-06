/**
 * Which pages the widget appears on (decision F4, §4.9).
 *
 *   <JelyChatWidget widgetKey="…" />                              → every page
 *   <JelyChatWidget widgetKey="…" routes={["/pricing", "/docs/*"]} />
 *
 * Patterns are "glob-ish": a trailing `/*` matches everything BELOW that path, anything
 * else is an exact match. Nothing else is supported — no `?`, no `**`, no mid-pattern
 * wildcards, no regex. §4.9 asks for the simple thing, and a half-implemented glob syntax
 * on a public prop is worse than an obviously small one.
 *
 * Matching is against `window.location.pathname` only: no query string, no hash, no
 * origin. Case-sensitive, because URL paths are.
 *
 * TWO EDGES, BOTH DELIBERATE AND BOTH FLAGGED IN THE P8 HAND-BACK RATHER THAN GUESSED AT:
 *
 *   1. `routes={[]}` matches NOTHING. §4.9 says an OMITTED prop means every page; an empty
 *      array is a caller who passed a list of patterns containing no patterns, and it is
 *      read literally. If you compute the list and it can come out empty, pass `undefined`.
 *   2. `"/docs/*"` matches the SECTION: `/docs/install`, `/docs/a/b`, and `/docs` itself.
 *      Excluding the index would be inconsistent with the trailing-slash rule below —
 *      `/docs/` and `/docs` are one page — and "everything in the docs" is what someone
 *      listing `/docs/*` is asking for. It still cannot match `/docsearch`: the prefix
 *      keeps its slash.
 *
 * A trailing slash is insignificant: `/pricing` and `/pricing/` are the same page to every
 * framework this package targets, so both the pattern and the pathname are normalised
 * before comparison.
 */

const WILDCARD_SUFFIX = "/*";

/**
 * @param pathname `window.location.pathname`, or null when it is not knowable (the server).
 * @param routes the `routes` prop, exactly as given.
 */
export function matchesRoutes(pathname: string | null, routes: string[] | undefined): boolean {
    if (routes === undefined) return true; // Omitted = every page (F4).
    if (pathname === null) return false; // No location to test: render nothing.
    const target = normalizePath(pathname);
    return routes.some((pattern) => matchesPattern(target, pattern));
}

/** One pattern against one already-normalised pathname. Exported for its own checks. */
export function matchesPattern(normalizedPathname: string, pattern: string): boolean {
    const trimmed = pattern.trim();
    if (trimmed === "") return false;

    if (trimmed.endsWith(WILDCARD_SUFFIX)) {
        // "/docs/*" → every path that starts with "/docs/". The prefix keeps its slash, so
        // "/docs/*" cannot match "/docsearch".
        const prefix = withLeadingSlash(trimmed.slice(0, -1));
        return normalizedPathname.startsWith(prefix) || normalizedPathname === normalizePath(prefix);
    }

    return normalizedPathname === normalizePath(withLeadingSlash(trimmed));
}

/** Lower-cases nothing and decodes nothing — only the trailing slash is insignificant. */
function normalizePath(pathname: string): string {
    const withSlash = withLeadingSlash(pathname.trim());
    if (withSlash.length > 1 && withSlash.endsWith("/")) return withSlash.slice(0, -1);
    return withSlash;
}

function withLeadingSlash(value: string): string {
    return value.startsWith("/") ? value : `/${value}`;
}

/** `window.location.pathname`, or null on the server. */
export function currentPathname(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.location.pathname;
    } catch {
        // A sandboxed iframe can throw on `location` access.
        return null;
    }
}
