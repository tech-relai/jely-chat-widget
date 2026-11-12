/**
 * `@jely/chat-widget/react` — `useJelyChat`, plus everything `./headless` exports, so a
 * React app building its own chat UI imports from one place.
 *
 *   import { useJelyChat, resolveAppearance } from "@jely/chat-widget/react";
 *
 * The shipped `<JelyChatWidget>` (root entry) is built on this same hook.
 */

export { useJelyChat } from "./react/useJelyChat";
export * from "./headless";
