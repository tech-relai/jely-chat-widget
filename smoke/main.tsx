/**
 * The smoke page: a plain page with the BUILT widget mounted on it, talking to the local
 * mock API. Both HTML files load this same module — `index.html` with no CSP, `csp.html`
 * under a strict one — so the only difference between them is the policy.
 *
 * `@jely/chat-widget` is aliased to `../dist/index.js` in `vite.config.ts`, so this
 * exercises the shipped bundle rather than the source. What breaks here is what would
 * break on a customer's site.
 */

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { JelyChatWidget } from "@jely/chat-widget";

/** Any key of the right shape; the mock accepts all of them. */
const WIDGET_KEY = "jely_wk_0123456789abcdef0123456789abcdef";
const MOCK_API = "http://localhost:8787";

function control(action: "reply" | "link" | "close" | "reset", write: (line: string) => void) {
    void fetch(`${MOCK_API}/mock/${action}`, { method: "POST" })
        .then(async (response) => {
            const body = (await response.json()) as { error?: string };
            write(response.ok ? `${action}: ok` : `${action}: ${body.error ?? response.status}`);
        })
        .catch((error: unknown) => write(`${action}: ${error instanceof Error ? error.message : "failed"}`));
}

/** `?user=1` starts the page "logged in", to check the identity riding on the first message. */
const STARTS_LOGGED_IN = new URLSearchParams(window.location.search).get("user") === "1";

function Page({ cspOn }: { cspOn: boolean }) {
    const [loggedIn, setLoggedIn] = useState(STARTS_LOGGED_IN);
    const [renders, setRenders] = useState(0);
    const write = (line: string) => {
        const log = document.getElementById("log");
        if (log !== null) log.textContent = line;
    };

    return (
        <div className="page">
            <h1>Jely chat widget — smoke page{cspOn ? " (strict CSP)" : ""}</h1>
            <p>
                The widget below is the built bundle from <code>dist/</code>, talking to the mock API on{" "}
                <code>localhost:8787</code>. Open the launcher in the bottom-right corner and send a message; the mock
                answers about four seconds later.
            </p>
            <p>
                {cspOn ? (
                    <>
                        This page sends <code>style-src 'self'</code> with no <code>'unsafe-inline'</code>. If the
                        widget looks identical to the page without a CSP, the constructable stylesheet is doing its job.
                    </>
                ) : (
                    <>
                        No Content-Security-Policy on this page. Compare with <code>/csp.html</code>, which sends a
                        strict one.
                    </>
                )}
            </p>

            <p className="links">
                <a href="./index.html">no CSP</a> · <a href="./csp.html">strict CSP</a>
            </p>

            <div className="controls">
                <button type="button" onClick={() => control("reply", write)}>
                    Agent replies
                </button>
                <button type="button" onClick={() => control("link", write)}>
                    Link to WhatsApp
                </button>
                <button type="button" onClick={() => control("close", write)}>
                    Close conversation
                </button>
                <button type="button" onClick={() => control("reset", write)}>
                    Reset mock state
                </button>
                <button type="button" id="login" onClick={() => setLoggedIn((value) => !value)}>
                    {loggedIn ? "Log out" : "Log in as Ada"}
                </button>
                <button type="button" id="rerender" onClick={() => setRenders((count) => count + 1)}>
                    Re-render ({renders})
                </button>
            </div>
            <p className="log" id="log">
                These drive the mock API the way an operator or WhatsApp would. Send a first message before using them.
            </p>

            {/* A new object literal on every render, on purpose: the widget compares by value. */}
            <JelyChatWidget
                widgetKey={WIDGET_KEY}
                apiBaseUrl={MOCK_API}
                identity={loggedIn ? { name: " Ada Lovelace ", email: "ada@example.com", workspace: "" } : undefined}
            />
        </div>
    );
}

const container = document.getElementById("app");
if (container !== null) {
    createRoot(container).render(
        <StrictMode>
            <Page cspOn={container.dataset.csp === "on"} />
        </StrictMode>,
    );
}
