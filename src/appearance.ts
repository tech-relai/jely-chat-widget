/**
 * The persona the visitor sees, and how the three sources of it are combined.
 *
 * PRECEDENCE (§4.9: "props may override"):
 *
 *   package defaults  <  GET /config  <  the `appearance` prop
 *
 * The defaults are the neutral placeholders decision F6 requires and are a VERBATIM copy
 * of the server's own `WIDGET_APPEARANCE_DEFAULTS`
 * (`jelyv2-backend/src/modules/widget/widget.helper.ts`). They are restated here, rather
 * than assumed to arrive from the server, because the widget must be able to render
 * before — or without — a config response, and because a field the server one day makes
 * optional would otherwise render as `undefined` on a customer's page.
 *
 * F6 IS THE RULE THIS FILE EXISTS TO KEEP: the design samples in `widget-samples/` are one
 * client's brand ("ollo", "Billal", their green). Nothing from them appears in this
 * package — the LOOK is matched, the words and colours are Jely's neutral defaults.
 *
 * The prop is a `Partial`, so only the keys actually present override. Passing
 * `{ ctaLabel: undefined }` therefore does NOT clear a CTA configured in the console; it
 * is indistinguishable from not passing the key at all, which is the behaviour a React
 * caller spreading an object expects.
 */

import type { WidgetAppearance } from "./types";

/** Neutral placeholders (F6). Mirrors the server's `WIDGET_APPEARANCE_DEFAULTS`. */
export const WIDGET_APPEARANCE_DEFAULTS: WidgetAppearance = {
    displayName: "Support",
    greeting: "Hi — how can we help?",
    tagline: "Ask us anything. A person will reply here.",
    accentColor: "#FFD400",
    theme: "dark",
    replyTimeText: "Usually replies within a few minutes",
};

/** Six-digit hex, the only form `WidgetAppearanceSchema` accepts for `accentColor`. */
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/**
 * Fold the three sources into one appearance. Blank strings are treated as absent: the
 * console lets an org clear a field, and an empty greeting should fall back to the default
 * rather than render as a gap in the card.
 */
export function resolveAppearance(
    fromServer?: Partial<WidgetAppearance> | null,
    fromProps?: Partial<WidgetAppearance> | null,
): WidgetAppearance {
    const resolved: WidgetAppearance = { ...WIDGET_APPEARANCE_DEFAULTS };
    for (const source of [fromServer, fromProps]) {
        if (source === null || source === undefined) continue;
        applyOverrides(resolved, source);
    }
    if (!HEX_COLOR_PATTERN.test(resolved.accentColor)) {
        resolved.accentColor = WIDGET_APPEARANCE_DEFAULTS.accentColor;
    }
    if (resolved.theme !== "dark" && resolved.theme !== "light") {
        resolved.theme = WIDGET_APPEARANCE_DEFAULTS.theme;
    }
    return resolved;
}

function applyOverrides(target: WidgetAppearance, source: Partial<WidgetAppearance>): void {
    if (isFilled(source.displayName)) target.displayName = source.displayName.trim();
    if (isFilled(source.greeting)) target.greeting = source.greeting.trim();
    if (isFilled(source.tagline)) target.tagline = source.tagline.trim();
    if (isFilled(source.replyTimeText)) target.replyTimeText = source.replyTimeText.trim();
    if (isFilled(source.accentColor)) target.accentColor = source.accentColor.trim();
    if (source.theme !== undefined) target.theme = source.theme;

    // The optional fields have no default: absent stays absent, and a blank string CLEARS
    // one that an earlier source set (an org that emptied its CTA in the console means it).
    if (source.avatarUrl !== undefined) {
        const value = source.avatarUrl.trim();
        if (value === "") delete target.avatarUrl;
        else target.avatarUrl = value;
    }
    if (source.ctaLabel !== undefined) {
        const value = source.ctaLabel.trim();
        if (value === "") delete target.ctaLabel;
        else target.ctaLabel = value;
    }
    if (source.ctaUrl !== undefined) {
        const value = source.ctaUrl.trim();
        if (value === "") delete target.ctaUrl;
        else target.ctaUrl = value;
    }
}

function isFilled(value: string | undefined): value is string {
    return typeof value === "string" && value.trim() !== "";
}

/** The CTA is only rendered when BOTH halves are set — a label with no link does nothing. */
export function resolveCta(appearance: WidgetAppearance): { label: string; url: string } | null {
    const label = appearance.ctaLabel?.trim() ?? "";
    const url = appearance.ctaUrl?.trim() ?? "";
    if (label === "" || url === "") return null;
    // Only http(s). A `javascript:` label-and-link pair reaching this far would be a
    // console-side validation failure, but this component runs on a customer's page and
    // renders a link the visitor is invited to click, so it refuses anything else itself.
    if (!/^https?:\/\//i.test(url)) return null;
    return { label, url };
}

/**
 * The custom properties the stylesheet reads. Set through React's `style` prop, which goes
 * through CSSOM and is therefore unaffected by a strict `style-src` — see the measured
 * table in `styles.ts`. NEVER write these into a `style` ATTRIBUTE string.
 */
export function accentCssVariables(accentColor: string): Record<string, string> {
    const rgb = hexToRgb(accentColor) ?? hexToRgb(WIDGET_APPEARANCE_DEFAULTS.accentColor);
    if (rgb === null) return {};
    const [r, g, b] = rgb;
    return {
        "--jely-accent": accentColor,
        "--jely-accent-ink": readableInkOn(accentColor),
        // The visitor's own bubbles and the reply-time dot are the accent at low opacity,
        // which is how the design keeps a saturated brand colour from shouting.
        "--jely-accent-soft": `rgba(${r}, ${g}, ${b}, 0.16)`,
        "--jely-accent-line": `rgba(${r}, ${g}, ${b}, 0.38)`,
        "--jely-accent-glow": `rgba(${r}, ${g}, ${b}, 0.22)`,
    };
}

/**
 * Black or white on the accent, by sRGB relative luminance — the same rule and threshold
 * the dashboard's `WidgetPreview` uses, so the console preview and the real widget agree.
 * A pale brand colour (Jely's own yellow, for one) must never get white text on it.
 */
export function readableInkOn(hex: string): string {
    const rgb = hexToRgb(hex);
    if (rgb === null) return "#18181b";
    const channel = (value: number) => {
        const srgb = value / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    return luminance > 0.45 ? "#18181b" : "#ffffff";
}

function hexToRgb(hex: string): [number, number, number] | null {
    if (!HEX_COLOR_PATTERN.test(hex)) return null;
    const value = hex.slice(1);
    return [
        Number.parseInt(value.slice(0, 2), 16),
        Number.parseInt(value.slice(2, 4), 16),
        Number.parseInt(value.slice(4, 6), 16),
    ];
}

/** The letter shown when the persona has no avatar image. */
export function avatarInitial(displayName: string): string {
    const trimmed = displayName.trim();
    return trimmed === "" ? "S" : (trimmed[0] ?? "S").toUpperCase();
}
