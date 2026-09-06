/**
 * How the widget's stylesheet gets into its shadow root — and what that costs the host
 * site's Content-Security-Policy.
 *
 * DECISION (S8.1, 2026-09-06): a CONSTRUCTABLE STYLESHEET
 * (`new CSSStyleSheet()` + `replaceSync()` + `shadowRoot.adoptedStyleSheets`), with an
 * inline `<style>` element as the fallback for browsers that lack it.
 *
 * WHY — measured, not assumed. A page was served with
 * `Content-Security-Policy: default-src 'self'; style-src 'self'` (a strict policy with
 * NO `'unsafe-inline'`) and four ways of styling a shadow root were tried in three engines:
 *
 *   mechanism                                    | Blink 152 | Gecko 154 | WebKit 605.1.15
 *   ---------------------------------------------|-----------|-----------|----------------
 *   <style> element appended to the shadow root  | BLOCKED   | BLOCKED   | BLOCKED
 *   constructable sheet + adoptedStyleSheets     | applied   | applied   | applied
 *   el.style.prop = … (CSSOM; React style props) | applied   | applied   | applied
 *   el.setAttribute("style", …)                  | BLOCKED   | BLOCKED   | BLOCKED
 *
 * (Control: with no CSP at all, every one of the four applies in every engine — so the
 * probe was measuring the policy, not a mistake in the test.)
 *
 * "BLOCKED" for the `<style>` element is total: the element's `.sheet` is null, so a
 * shadow root styled that way renders completely unstyled. Shadow DOM does NOT exempt a
 * `<style>` element from `style-src` — the isolation is for the cascade, not for CSP.
 * Constructable stylesheets go through CSSOM, which CSP has no hook into, so they are
 * unaffected by `style-src` in every engine shipping today.
 *
 * THE CSP CONSEQUENCE FOR THE HOST SITE (for P9's install guide):
 *
 *   REQUIRED, always:  connect-src  https://jely-v2-api-9qirj.ondigitalocean.app
 *                      (or whatever `apiBaseUrl` the site passes)
 *   REQUIRED if the persona has an uploaded avatar:
 *                      img-src      the origin serving that avatar
 *   NOT required:      style-src 'unsafe-inline'  — on Chrome/Edge 73+, Firefox 101+ and
 *                      Safari 16.4+, which is every browser that supports
 *                      `adoptedStyleSheets`.
 *   The honest caveat: on OLDER browsers (Safari ≤ 16.3 including iOS ≤ 16.3, Firefox
 *                      ≤ 100) the widget falls back to a `<style>` element, and a site
 *                      whose `style-src` lacks `'unsafe-inline'` will show those visitors
 *                      an UNSTYLED widget. Such a site should either add
 *                      `style-src 'unsafe-inline'` or accept that those visitors see it
 *                      unstyled. Nothing else breaks: the widget still works, and no
 *                      script is ever injected, so `script-src` is never involved.
 *
 * A second reason for this order, independent of CSP: one constructable sheet is parsed
 * once and shared by every shadow root that adopts it, whereas a `<style>` element is
 * re-parsed per root.
 *
 * FOR S8.2 — two rules follow from the table above, and breaking either re-introduces the
 * `'unsafe-inline'` requirement this decision removes:
 *   1. Never use `setAttribute("style", …)`. React's `style={{…}}` prop is fine — it goes
 *      through CSSOM (row 3), which is why the accent colour may be set that way.
 *   2. Anything dynamic (the accent colour, the theme) belongs in the CSS TEXT passed to
 *      `applyWidgetStyles`, as `:host { --jely-accent: … }`, or in a React `style` prop —
 *      never in a style attribute string.
 */

/** True when this browser can adopt a constructable stylesheet into a shadow root. */
export function supportsAdoptedStyleSheets(): boolean {
    if (typeof window === "undefined") return false;
    if (typeof CSSStyleSheet === "undefined") return false;
    if (typeof ShadowRoot === "undefined") return false;
    // `replaceSync` and the settable `adoptedStyleSheets` shipped together; check both,
    // because some old builds exposed the constructor without a usable `replaceSync`.
    return typeof CSSStyleSheet.prototype.replaceSync === "function" && "adoptedStyleSheets" in ShadowRoot.prototype;
}

/**
 * Put `css` into `root`, preferring the constructable stylesheet.
 *
 * Returns the mechanism actually used, so a caller can log it or (S8.2's call) decline to
 * render rather than show an unstyled panel when the fallback is also blocked. Never
 * throws: a browser that refuses both leaves the widget unstyled, not broken.
 */
export function applyWidgetStyles(root: ShadowRoot, css: string): "adopted" | "style-element" | "failed" {
    if (supportsAdoptedStyleSheets()) {
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(css);
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
            return "adopted";
        } catch {
            // Fall through to the element — never leave the widget with no attempt made.
        }
    }

    try {
        const element = document.createElement("style");
        element.textContent = css;
        root.appendChild(element);
        // Under a strict `style-src` the element is inserted but its sheet is null. Saying
        // so lets the caller tell "styled" from "silently unstyled".
        return element.sheet === null ? "failed" : "style-element";
    } catch {
        return "failed";
    }
}

/**
 * THE STYLESHEET ITSELF lives in `css.ts` as `WIDGET_CSS` (S8.2), and `JelyChatWidget`
 * passes it here exactly once per shadow root.
 *
 * It is a CONSTANT rather than a function of the appearance, because the adopted-sheet path
 * above APPENDS: rebuilding the text on every accent or theme change would stack a new
 * sheet each time. Both palettes are therefore in the text behind `.j-root--dark` /
 * `.j-root--light`, and the accent arrives as custom properties set through React's `style`
 * prop — permitted by rule 1 above, and the reason the two rules are stated at all.
 */
