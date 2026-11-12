/**
 * Type-checks the two custom-UI entries against the BUILT declarations, the way a customer
 * compiles against them (`npm run typecheck:smoke`). Never run, never bundled: nothing
 * imports this file. The `@ts-expect-error` lines prove the types are real — if a
 * declaration ever degraded to `any`, they would become unused and fail the check.
 */

import {
    buildHandoffQr,
    createJelyChat,
    resolveAppearance,
    resolveCta,
    WIDGET_MESSAGE_MAX_CHARS,
    type HandoffQr,
    type JelyChat,
    type JelyChatIdentity,
    type JelyChatState,
    type WidgetErrorCode,
    type WidgetPhase,
} from "@jely/chat-widget/headless";
import {
    useJelyChat,
    createJelyChat as createFromReact,
    type JelyChatIdentity as ReactIdentity,
} from "@jely/chat-widget/react";
import type { JelyChatIdentity as RootIdentity, JelyChatWidgetProps } from "@jely/chat-widget";

const chat: JelyChat = createJelyChat({ widgetKey: "jely_wk_0123456789abcdef0123456789abcdef", defaultOpen: true });
const state: JelyChatState = chat.getState();
const phase: WidgetPhase = state.phase;
const code: WidgetErrorCode | undefined = state.error?.code;
const qr: HandoffQr | null = state.handoff === null ? null : buildHandoffQr(state.handoff.waLink);
const cta = resolveCta(resolveAppearance(state.config?.appearance));
const unsubscribe: () => void = chat.subscribe(() => undefined);

const identity: JelyChatIdentity = { name: "Ada", email: "ada@example.com" };
const fromRoot: RootIdentity = identity;
const fromReact: ReactIdentity = fromRoot;
chat.identify(fromReact);
createJelyChat({ widgetKey: "k", identity: { workspace: "Northwind" } });
const props: JelyChatWidgetProps = { widgetKey: "k", identity };
// @ts-expect-error — identity fields are strings
chat.identify({ name: 42 });

// @ts-expect-error — `phase` is a union of strings, not a number
const wrong: number = state.phase;
// @ts-expect-error — unknown option
createJelyChat({ widgetKey: "k", pollIntervalMs: 1 });

export function usesHook(): boolean {
    const { chat: fromHook, state: fromHookState } = useJelyChat({ widgetKey: "k", identity: { name: "Ada" } });
    return fromHook === null || fromHookState?.config === null;
}

void [phase, code, qr, cta, unsubscribe, wrong, WIDGET_MESSAGE_MAX_CHARS, createFromReact, props];
