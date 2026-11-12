/**
 * `pageUrl` and `referrer` for `POST /conversations` (decision E8 stores them on the
 * conversation; the IP and user agent are taken server-side). Both are dropped rather than
 * truncated when they exceed the contract's 2,000-character bound — a truncated URL is a
 * wrong URL, and a rejected request would cost the visitor their first message.
 */
export function visitorContext(): { pageUrl?: string; referrer?: string } {
    const context: { pageUrl?: string; referrer?: string } = {};
    if (typeof window === "undefined") return context;
    try {
        const href = window.location.href;
        if (href !== "" && href.length <= 2000) context.pageUrl = href;
        const referrer = document.referrer;
        if (referrer !== "" && referrer.length <= 2000) context.referrer = referrer;
    } catch {
        // A sandboxed frame can throw on either read; the conversation is worth more.
    }
    return context;
}
