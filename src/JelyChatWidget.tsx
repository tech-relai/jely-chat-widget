/**
 * The package's one public component.
 *
 *   import { JelyChatWidget } from "@jely/chat-widget";
 *   <JelyChatWidget widgetKey="jely_wk_…" />
 *
 * It owns three things and delegates everything else to `WidgetRoot`: whether this page is
 * one the widget belongs on (`routes`), the shadow host it lives in (F5), and being safe to
 * render on a server (F3).
 *
 * SSR (F3 — App Router and Pages Router both). The first render returns `null` on the
 * server AND in the browser: the host element is created in an effect, which never runs
 * during server rendering and always runs after hydration. There is therefore nothing to
 * mismatch, no `typeof window` branch inside the render, and no `dynamic(() => …, { ssr:
 * false })` for the customer to remember. `"use client"` is added to both bundles by the
 * build (see `vite.config.ts`), so a Server Component may import this file directly.
 *
 * ROUTE MATCHING is re-checked on `popstate` and on a timer at the poll interval, which is
 * what §4.9 asks for in as many words. A client-side navigation in Next.js does NOT fire
 * `popstate`, and the alternative — monkey-patching `history.pushState` — mutates a global
 * the host app owns, on a customer's site, to save three characters of string comparison
 * every three seconds. The plan chose the timer, and it is the right call.
 *
 * THE SHADOW ROOT is attached to a `<div>` appended to `document.body`, and the whole
 * element is removed when the widget unmounts or the route stops matching. It is NOT
 * rendered in place: a widget nested inside the host's layout inherits its stacking
 * context and `overflow: hidden`, which is how these things end up clipped in a footer.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { WIDGET_CSS } from "./css";
import { currentPathname, matchesRoutes } from "./routes";
import { applyWidgetStyles } from "./styles";
import type { WidgetAppearance } from "./types";
import type { JelyChatIdentity } from "./core/identity";
import { POLL_INTERVAL_OPEN_MS } from "./core/polling";
import { WidgetRoot } from "./WidgetRoot";

export interface JelyChatWidgetProps {
    /** The org's public widget key from the Jely developer console: `jely_wk_` + 32 hex. */
    widgetKey: string;
    /** Override the Jely API origin. Defaults to Jely's production API; a trailing slash is stripped. */
    apiBaseUrl?: string;
    /**
     * Pages the widget appears on, as exact paths or `"/section/*"` prefixes. Omit for
     * every page. See `routes.ts` for the two edges (`[]`, and what `/docs/*` covers).
     */
    routes?: string[];
    /** Which corner the launcher sits in. Defaults to `"bottom-right"`. */
    position?: "bottom-right" | "bottom-left";
    /** Override individual appearance fields from the console. Unset keys keep the org's values. */
    appearance?: Partial<WidgetAppearance>;
    /** Open the panel instead of the launcher on first load. Defaults to `false`. */
    defaultOpen?: boolean;
    /**
     * Who the visitor is on your site — e.g. your logged-in user. Labels the conversation on
     * the Support page and in Slack. Display-only and not verified. Can change at any time
     * (after login, say): the current conversation is updated, once per distinct value.
     * Blank fields are ignored; a field you leave out is cleared.
     */
    identity?: JelyChatIdentity;
}

/**
 * Marks the host element in the customer's DOM, so somebody inspecting their page can tell
 * what it is. The widget's z-index (just under the top of the 32-bit range, high enough to
 * clear any real stacking context but low enough that a cookie banner can still cover it)
 * is set on `:host` in the stylesheet.
 */
const HOST_ATTRIBUTE = "data-jely-widget";

/** Set once, and only when the stylesheet could not be applied at all. */
let cspWarningShown = false;

export function JelyChatWidget(props: JelyChatWidgetProps) {
    const { widgetKey, apiBaseUrl, routes, appearance, identity } = props;
    const position = props.position ?? "bottom-right";
    const defaultOpen = props.defaultOpen ?? false;

    const [pathname, setPathname] = useState<string | null>(null);
    const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
    const hostRef = useRef<HTMLDivElement | null>(null);

    // Keep `pathname` current. `setPathname` with the identity guard means an unchanged
    // path costs one string comparison and no render.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const read = () => setPathname((current) => currentPathname() ?? current);
        read();
        window.addEventListener("popstate", read);
        window.addEventListener("hashchange", read);
        const timer = setInterval(read, POLL_INTERVAL_OPEN_MS);
        return () => {
            window.removeEventListener("popstate", read);
            window.removeEventListener("hashchange", read);
            clearInterval(timer);
        };
    }, []);

    const active = matchesRoutes(pathname, routes);

    useEffect(() => {
        if (!active) return;
        if (typeof document === "undefined") return;

        const host = document.createElement("div");
        host.setAttribute(HOST_ATTRIBUTE, "");
        host.setAttribute("data-jely-position", position);

        let root: ShadowRoot;
        try {
            root = host.attachShadow({ mode: "open" });
        } catch {
            // No Shadow DOM means no style isolation (F5), and rendering into a customer's
            // page without it is worse than not rendering.
            return;
        }

        // THE HOST IS CONNECTED BEFORE THE STYLES ARE APPLIED, and the order is the whole
        // fix. `applyWidgetStyles` judges its `<style>` fallback by `element.sheet`, and
        // HTML's "update a style block" returns early for an element whose node document
        // has no browsing context — a `<style>` inside a shadow root on a host that is not
        // in the document therefore ALWAYS has `sheet === null`, whether or not any CSP is
        // in play. Applying first made the fallback report "failed" on every browser that
        // takes it (Safari ≤ 16.3 including iOS ≤ 16.3, Firefox ≤ 100), so the widget never
        // rendered there and blamed the site's Content-Security-Policy for it. Chrome, Edge
        // and Safari 16.4+ never noticed, because they take the adopted-stylesheet path,
        // which needs no document at all.
        //
        // Appending first costs nothing visually: the host is empty until `setShadowRoot`
        // lets the portal render into it, so nothing can paint unstyled in the meantime.
        document.body.appendChild(host);

        // "failed" now means what it says: the constructable stylesheet is unavailable AND
        // the fallback <style> was genuinely blocked by the host's `style-src` — the widget
        // would paint as a column of unstyled text over their page. S8.1 left the choice
        // here and this is it: DO NOT RENDER, take the host back out of their DOM, and say
        // why once in the console so the site's developer has something to act on. Nothing
        // is broken, only absent.
        if (applyWidgetStyles(root, WIDGET_CSS) === "failed") {
            host.remove();
            warnAboutBlockedStyles();
            return;
        }

        hostRef.current = host;
        setShadowRoot(root);

        return () => {
            hostRef.current = null;
            setShadowRoot(null);
            host.remove();
        };
    }, [active]);

    // Moving the launcher is an attribute flip, not a remount — a remount would discard the
    // open panel and the visitor's half-typed message.
    useEffect(() => {
        hostRef.current?.setAttribute("data-jely-position", position);
    }, [position, shadowRoot]);

    if (shadowRoot === null) return null;

    return createPortal(
        <WidgetRoot
            key={widgetKey}
            widgetKey={widgetKey}
            apiBaseUrl={apiBaseUrl}
            appearance={appearance}
            defaultOpen={defaultOpen}
            identity={identity}
        />,
        shadowRoot,
    );
}

function warnAboutBlockedStyles(): void {
    if (cspWarningShown) return;
    cspWarningShown = true;
    // The only console call in the package, and the only channel a host developer will
    // ever see this on.
    console.warn(
        "[@jely/chat-widget] The chat widget was not rendered: this browser has no support for " +
            "constructable stylesheets and the page's Content-Security-Policy blocked the fallback " +
            "<style> element. Add 'unsafe-inline' to style-src, or accept that visitors on browsers " +
            "older than Safari 16.4 / Firefox 101 will not see the widget.",
    );
}
