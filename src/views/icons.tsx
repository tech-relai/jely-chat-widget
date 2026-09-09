/**
 * Every icon the widget draws, as inline SVG.
 *
 * No icon package: this bundle ships to customer sites, and pulling a whole icon library
 * in for nine glyphs would be the largest thing in it. They are drawn in one weight
 * (1.6px strokes on a 24-unit grid, round caps and joins) so they read as one family —
 * the same discipline `ui-direction.md` asks for in the dashboard ("single icon family,
 * no mixing").
 *
 * All of them inherit `currentColor`, so colour is a CSS concern. The one exception is
 * `WhatsAppGlyph`, which is a filled brand mark: WhatsApp's own glyph, coloured by the
 * `--jely-whatsapp` variable. That is the platform's mark, not a customer's — decision F6
 * is about the design samples' CLIENT branding, which appears nowhere in this package.
 */

interface IconProps {
    size?: number;
}

function stroke(size: number) {
    return {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true,
        focusable: false,
    };
}

export function ChatIcon({ size = 18 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.8-.4L3 21l1.4-4.2A8.2 8.2 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4Z" />
        </svg>
    );
}

export function CloseIcon({ size = 16 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="m18 6-12 12M6 6l12 12" />
        </svg>
    );
}

/** A compose square — "start a new chat", the same shape every messaging client uses. */
export function NewChatIcon({ size = 16 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
    );
}

export function ArrowUpIcon({ size = 15 }: IconProps) {
    return (
        <svg {...stroke(size)} strokeWidth={2}>
            <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
    );
}

export function ChevronDownIcon({ size = 13 }: IconProps) {
    return (
        <svg {...stroke(size)} strokeWidth={2}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export function GuestIcon({ size = 13 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

export function CheckCircleIcon({ size = 14 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M21.5 11.1V12a9.5 9.5 0 1 1-5.6-8.7" />
            <path d="m9 11.5 3 3 9.5-9.5" />
        </svg>
    );
}

export function LinkIcon({ size = 14 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M10 13a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5" />
            <path d="M14 11a4.5 4.5 0 0 0-6.8-.5l-2.7 2.7a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" />
        </svg>
    );
}

export function ExternalLinkIcon({ size = 15 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
        </svg>
    );
}

export function ArchiveIcon({ size = 14 }: IconProps) {
    return (
        <svg {...stroke(size)}>
            <rect x="3" y="4.5" width="18" height="4.5" rx="1.2" />
            <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" />
            <path d="M10 13h4" />
        </svg>
    );
}

/** WhatsApp's own mark, filled. Coloured by `--jely-whatsapp` through `.j-wa-glyph`. */
export function WhatsAppGlyph({ size = 18 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
    );
}
