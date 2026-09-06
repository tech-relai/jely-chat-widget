/**
 * The whole point of this example: the widget is mounted ONCE, in the root layout, so an
 * open conversation survives every client-side navigation in the app.
 *
 * `layout.tsx` is a Server Component and `<JelyChatWidget>` is imported into it directly —
 * no `"use client"` here, no `next/dynamic`, no `ssr: false`. The package's bundles carry
 * the `"use client"` directive themselves, and the widget renders `null` until an effect
 * runs in the browser, so there is nothing for the server to render and nothing to
 * mismatch on hydration.
 */

import type { Metadata } from "next";
import { JelyChatWidget } from "@jely/chat-widget";

export const metadata: Metadata = {
    title: "Jely chat widget — example",
    description: "Minimal Next.js App Router app that mounts @jely/chat-widget.",
};

const WIDGET_KEY = process.env.NEXT_PUBLIC_JELY_WIDGET_KEY ?? "";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    background: "#0b0b0c",
                    color: "#e7e7ea",
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                }}
            >
                {children}

                {/*
                 * Rendered only when a key is configured: a widget mounted with an empty
                 * key would just fail its config request and render nothing anyway, and
                 * the page below says so in as many words.
                 */}
                {WIDGET_KEY !== "" && <JelyChatWidget widgetKey={WIDGET_KEY} />}
            </body>
        </html>
    );
}
