/**
 * `useJelyChat` — the conversation as React state, for a custom chat UI. The shipped
 * `<JelyChatWidget>` is built on this same hook.
 *
 *   const { chat, state } = useJelyChat({ widgetKey: "jely_wk_…" });
 *   if (state === null || state.config === null || state.unavailable) return null;
 *   // render state.phase / state.messages; call chat.start(), chat.send(), …
 *
 * RENDER NOTHING UNTIL THERE IS A CONFIG. Both values are null on the first render (and on
 * a server render), because the controller is created in an effect. After that, `state` is
 * the live `JelyChatState`, but `state.config` stays null until `GET /config` answers, and
 * `state.unavailable` turns true if it never does — an unknown or disabled key, or a page
 * origin the org has not allowed. A visitor should never see that; the shipped widget
 * renders nothing in all three cases, and a custom UI should do the same.
 *
 * WHY AN EFFECT: creating the controller starts network reads and a poll timer, which must
 * not happen during a server render, and an effect is the one place React pairs with a
 * cleanup. Under StrictMode's mount → unmount → mount the first instance is destroyed (its
 * reads aborted) and the second one lives; unmounting always stops polling.
 *
 * A new controller is created only when `widgetKey` or `apiBaseUrl` changes. `defaultOpen`
 * only seeds a new controller: after that the visitor's own open/minimise choice is the
 * state, and it is remembered across page loads.
 */

import { useEffect, useState, useSyncExternalStore } from "react";

import { createJelyChat } from "../core/createJelyChat";
import type { JelyChat, JelyChatOptions, JelyChatState } from "../core/types";

const noSubscription = () => () => {};
const noState = () => null;

export function useJelyChat(options: JelyChatOptions): { chat: JelyChat | null; state: JelyChatState | null } {
    const { widgetKey, apiBaseUrl, defaultOpen } = options;
    const [chat, setChat] = useState<JelyChat | null>(null);

    useEffect(() => {
        const instance = createJelyChat({ widgetKey, apiBaseUrl, defaultOpen });
        setChat(instance);
        return () => {
            instance.destroy();
            setChat(null);
        };
        // `defaultOpen` only seeds a new controller; changing it must not restart the chat.
    }, [widgetKey, apiBaseUrl]);

    const state = useSyncExternalStore(chat?.subscribe ?? noSubscription, chat?.getState ?? noState, noState);
    return { chat, state };
}
