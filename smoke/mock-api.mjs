/**
 * A local stand-in for the six Jely widget endpoints, so the whole widget flow can be
 * walked on a laptop with no backend, no org, and no real widget key.
 *
 *   node smoke/mock-api.mjs          # http://localhost:8787
 *
 * IT IS A MOCK, NOT A SECOND IMPLEMENTATION. It answers the shapes in `src/types.ts` and
 * imitates the parts of the real middleware the widget can actually observe — the CORS
 * headers, the `x-jely-session` check, the 409 on a locked or closed conversation — and
 * nothing else. There is no persistence (state is one in-memory object, gone when you stop
 * it), no rate limiting, and no origin allowlist beyond "any origin is allowed", which is
 * the one place it is deliberately more permissive than production so the smoke page works
 * from whatever port Vite picked.
 *
 * Zero dependencies, `node:http` only. Node >= 18.
 *
 * It also exposes a few `/mock/*` control routes that DO NOT EXIST on the real server.
 * They are how the smoke page drives the states a real conversation reaches only through
 * an operator or WhatsApp: an agent reply, the WhatsApp link, and a close.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);

/** Any key of the right shape is accepted; anything else 404s exactly as production does. */
const WIDGET_KEY_PATTERN = /^jely_wk_[0-9a-f]{32}$/;

const SESSION_HEADER = "x-jely-session";
const MESSAGE_MAX_CHARS = 2000;

/** The org's widget config, as `GET /config` would answer it. */
const config = {
    organization: { name: "Northwind Tools" },
    appearance: {
        displayName: "Support",
        greeting: "Hi — how can we help?",
        tagline: "Ask us anything. A person will reply here.",
        accentColor: "#FFD400",
        theme: "dark",
        replyTimeText: "Usually replies within a few minutes",
    },
    handoffEnabled: true,
    whatsapp: { available: true },
};

/**
 * One conversation at a time is enough to walk every state, and it keeps the mock small.
 * `POST /conversations` replaces it, which is also what "Start a new chat" does.
 */
let conversation = null;

let messageCounter = 0;

function nextObjectId() {
    // 24 hex characters, ascending — the same shape the real server's ids have.
    const timestamp = Math.floor(Date.now() / 1000)
        .toString(16)
        .padStart(8, "0");
    const counter = (messageCounter += 1).toString(16).padStart(16, "0");
    return `${timestamp}${counter}`;
}

function mintRef() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let ref = "";
    for (let i = 0; i < 6; i += 1) ref += alphabet[Math.floor(Math.random() * alphabet.length)];
    return ref;
}

function conversationView() {
    return {
        ref: conversation.ref,
        status: conversation.status,
        linked: conversation.linkedAt !== null,
        createdAt: conversation.createdAt,
    };
}

function addMessage(direction, body) {
    const message = { id: nextObjectId(), direction, body, createdAt: new Date().toISOString() };
    conversation.messages.push(message);
    return message;
}

/**
 * The mock's one piece of theatre: an agent answers a few seconds after the visitor, so a
 * human walking the flow sees the poll deliver a message rather than having to press a
 * button for every turn.
 */
const AGENT_REPLY_DELAY_MS = 4000;

function scheduleAgentReply(forConversation) {
    setTimeout(() => {
        if (conversation !== forConversation) return;
        if (conversation.status !== "open" || conversation.linkedAt !== null) return;
        addMessage("agent", "Thanks — I can help with that. (This is the mock API answering.)");
    }, AGENT_REPLY_DELAY_MS).unref();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? "/", "http://localhost");

    // Production answers the preflight strictly per org before reading anything; the mock
    // reflects whatever origin asked, which is the only difference that matters here.
    if (origin !== undefined) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", `content-type, ${SESSION_HEADER}`);
        res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
    }

    const segments = url.pathname.split("/").filter((segment) => segment !== "");

    // --- control routes (not part of the widget API) ------------------------
    if (segments[0] === "mock") {
        handleControl(segments.slice(1), res);
        return;
    }

    // --- /api/widget/v1/:widgetKey/… ---------------------------------------
    if (segments[0] !== "api" || segments[1] !== "widget" || segments[2] !== "v1") {
        return send(res, 404, { error: "not found", code: "NOT_FOUND" });
    }

    const widgetKey = decodeURIComponent(segments[3] ?? "");
    if (!WIDGET_KEY_PATTERN.test(widgetKey)) {
        return send(res, 404, { error: "unknown widget key", code: "WIDGET_KEY_INVALID" });
    }

    const route = `/${segments.slice(4).join("/")}`;
    const method = req.method ?? "GET";

    if (method === "GET" && route === "/config") {
        return send(res, 200, config);
    }

    if (method === "POST" && route === "/conversations") {
        const body = await readJson(req);
        const text = typeof body?.body === "string" ? body.body.trim() : "";
        if (text === "" || text.length > MESSAGE_MAX_CHARS) {
            return send(res, 400, { error: "body must be 1..2000 characters", code: "VALIDATION_ERROR" });
        }
        conversation = {
            ref: mintRef(),
            status: "open",
            linkedAt: null,
            createdAt: new Date().toISOString(),
            sessionToken: randomHex(48),
            messages: [],
            pageUrl: typeof body?.pageUrl === "string" ? body.pageUrl : undefined,
        };
        const message = addMessage("visitor", text);
        scheduleAgentReply(conversation);
        log(`conversation ${conversation.ref} started from ${conversation.pageUrl ?? "an unknown page"}`);
        return send(res, 201, { sessionToken: conversation.sessionToken, conversation: conversationView(), message });
    }

    // Everything below is session-authenticated.
    const session = req.headers[SESSION_HEADER];
    if (conversation === null || typeof session !== "string" || session !== conversation.sessionToken) {
        return send(res, 401, { error: "unknown session", code: "SESSION_INVALID" });
    }

    if (method === "GET" && route === "/conversation") {
        return send(res, 200, { conversation: conversationView() });
    }

    if (method === "GET" && route === "/conversation/messages") {
        const after = url.searchParams.get("after");
        const index = after === null ? -1 : conversation.messages.findIndex((m) => m.id === after);
        const messages = conversation.messages.slice(index + 1);
        return send(res, 200, { conversation: conversationView(), messages });
    }

    if (method === "POST" && route === "/conversation/messages") {
        const locked = lockedError();
        if (locked !== null) return send(res, 409, locked);
        const body = await readJson(req);
        const text = typeof body?.body === "string" ? body.body.trim() : "";
        if (text === "" || text.length > MESSAGE_MAX_CHARS) {
            return send(res, 400, { error: "body must be 1..2000 characters", code: "VALIDATION_ERROR" });
        }
        const message = addMessage("visitor", text);
        scheduleAgentReply(conversation);
        return send(res, 201, { message });
    }

    if (method === "POST" && route === "/conversation/handoff") {
        const locked = lockedError();
        if (locked !== null) return send(res, 409, locked);
        const prefilledText = `Continue my ${config.organization.name} support conversation · ${conversation.ref}`;
        return send(res, 200, {
            ref: conversation.ref,
            waLink: `https://wa.me/447700900123?text=${encodeURIComponent(prefilledText)}`,
            prefilledText,
            phoneDisplay: "+44 7700 900123",
        });
    }

    return send(res, 404, { error: "not found", code: "NOT_FOUND" });
});

function lockedError() {
    if (conversation.linkedAt !== null) {
        return { error: "this conversation continues on WhatsApp", code: "CONVERSATION_LOCKED" };
    }
    if (conversation.status === "closed") {
        return { error: "this conversation is closed", code: "CONVERSATION_CLOSED" };
    }
    return null;
}

/** `/mock/reply`, `/mock/link`, `/mock/close`, `/mock/reset` — the operator's side. */
function handleControl(segments, res) {
    const action = segments[0] ?? "";
    if (conversation === null && action !== "reset") {
        return send(res, 409, { error: "no conversation yet — send a first message from the widget" });
    }
    switch (action) {
        case "reply":
            addMessage("agent", "An operator replied from the dashboard. (Mock control route.)");
            log("agent reply injected");
            return send(res, 200, { ok: true });
        case "link":
            conversation.linkedAt = new Date().toISOString();
            log(`conversation ${conversation.ref} linked to WhatsApp`);
            return send(res, 200, { ok: true });
        case "close":
            conversation.status = "closed";
            log(`conversation ${conversation.ref} closed`);
            return send(res, 200, { ok: true });
        case "reset":
            conversation = null;
            log("state reset");
            return send(res, 200, { ok: true });
        default:
            return send(res, 404, { error: "unknown control route" });
    }
}

function send(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(payload);
}

async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length === 0) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        return {};
    }
}

function randomHex(length) {
    let out = "";
    while (out.length < length) out += Math.floor(Math.random() * 16).toString(16);
    return out.slice(0, length);
}

function log(line) {
    process.stdout.write(`[mock-api] ${line}\n`);
}

server.listen(PORT, () => {
    log(`listening on http://localhost:${PORT}`);
    log("control routes: /mock/reply  /mock/link  /mock/close  /mock/reset");
});
