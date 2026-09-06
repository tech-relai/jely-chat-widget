/**
 * The handoff QR code, rendered client-side from `waLink` (§4.9).
 *
 * `qrcode`'s `create()` is used rather than `toDataURL()` / `toString()` on purpose:
 *
 *   - `toDataURL()` produces a `data:image/png` URL, which needs `img-src data:` in the
 *     HOST SITE's Content-Security-Policy. The widget already asks a customer for one CSP
 *     directive (`connect-src`); asking for a second, for a picture we can draw ourselves,
 *     is not a good trade.
 *   - `toString({ type: "svg" })` produces markup that would have to go in through
 *     `dangerouslySetInnerHTML`.
 *   - `create()` returns the module bitmap and nothing else, so the SVG below is built
 *     from real React elements — no data URI, no innerHTML, no canvas, and one `<path>`
 *     element for the whole symbol.
 *
 * The result is deterministic and synchronous, so the modal renders the code in its first
 * paint rather than after an await.
 */

import QRCode from "qrcode";

export interface QrSymbol {
    /** Modules per side, excluding the quiet zone. */
    moduleCount: number;
    /** Side of the `viewBox`, i.e. `moduleCount` + twice the quiet zone. */
    viewBoxSize: number;
    /** An SVG path covering every dark module, in `viewBox` units. */
    path: string;
}

/**
 * Four modules is the quiet zone the QR specification requires; scanners are unreliable
 * without it, and the white tile the modal draws is exactly this margin.
 */
const QUIET_ZONE_MODULES = 4;

/**
 * Build the symbol, or null if the text cannot be encoded (too long for any version).
 * Never throws: a missing QR degrades to the "Open WhatsApp" button, which does the same
 * job on the device the visitor is already holding.
 *
 * Error correction level M is the default and the right one here: the link is short, and
 * H would add modules (a denser symbol) for redundancy a screen does not need.
 */
export function buildQrSymbol(text: string): QrSymbol | null {
    if (text === "") return null;

    let modules: { size: number; get(row: number, col: number): number };
    try {
        modules = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
    } catch {
        return null;
    }

    const size = modules.size;
    if (!Number.isInteger(size) || size <= 0) return null;

    // One `M x y h1 v1 h-1 z` per dark module. Adjacent modules merge visually because
    // they share an edge, so no run-length optimisation is needed for a crisp symbol.
    const segments: string[] = [];
    for (let row = 0; row < size; row += 1) {
        for (let column = 0; column < size; column += 1) {
            if (modules.get(row, column) !== 1) continue;
            segments.push(`M${column + QUIET_ZONE_MODULES} ${row + QUIET_ZONE_MODULES}h1v1h-1z`);
        }
    }
    if (segments.length === 0) return null;

    return {
        moduleCount: size,
        viewBoxSize: size + QUIET_ZONE_MODULES * 2,
        path: segments.join(""),
    };
}
