/**
 * One page, no styling framework, nothing to distract from the widget in the corner.
 */

const WIDGET_KEY = process.env.NEXT_PUBLIC_JELY_WIDGET_KEY ?? "";

export default function HomePage() {
    return (
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px" }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>Jely chat widget — example</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a1a1aa", margin: "0 0 24px" }}>
                The widget is mounted in <code>app/layout.tsx</code>. Look in the bottom-right corner.
            </p>

            {WIDGET_KEY === "" ? (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#f5c451", margin: 0 }}>
                    No widget key configured. Copy <code>.env.local.example</code> to <code>.env.local</code>, put your
                    org&rsquo;s key in it, and restart <code>next dev</code>.
                </p>
            ) : (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#a1a1aa", margin: 0 }}>
                    If the launcher does not appear, check that <code>http://localhost:3000</code> is on this
                    org&rsquo;s allowed-origins list in the Jely developer console.
                </p>
            )}
        </main>
    );
}
