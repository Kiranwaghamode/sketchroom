import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useMemo } from "react";
import { useStore, type Store } from "./yjs/hooks";

// Presence (who's online, cursors) lives in Yjs *awareness*: it's never stored in
// the Y.Doc or the database, and disappears when a client disconnects.

export type Awareness = NonNullable<HocuspocusProvider["awareness"]>;

export type PresenceUser = { id: string; name: string; color: string };
export type PresenceCursor = { x: number; y: number } | null; // world coordinates
export type PresenceState = { user?: PresenceUser; cursor?: PresenceCursor };

const PRESENCE_COLORS = [
  "#e03131",
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#c2255c",
  "#5c940d",
];

/** A stable color per user, from a hash of the user id. */
export function userColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]!;
}

export type OnlineUser = PresenceUser & { isYou: boolean };

function onlineUsersStore(awareness: Awareness): Store<OnlineUser[]> {
  const read = () => {
    // One entry per user, even if they have the board open in several tabs.
    const byId = new Map<string, OnlineUser>();
    for (const [clientId, state] of awareness.getStates() as Map<
      number,
      PresenceState
    >) {
      const user = state.user;
      if (!user) continue;
      const isYou = clientId === awareness.clientID;
      const existing = byId.get(user.id);
      if (!existing || isYou)
        byId.set(user.id, { ...user, isYou: isYou || !!existing?.isYou });
    }
    // You first, then everyone else by name.
    return [...byId.values()].sort(
      (a, b) =>
        Number(b.isYou) - Number(a.isYou) || a.name.localeCompare(b.name),
    );
  };
  let snapshot = read();
  let key = JSON.stringify(snapshot);
  return {
    subscribe(onChange) {
      // "change" fires for cursor moves too; only re-render when the user list changes.
      const handler = () => {
        const next = read();
        const nextKey = JSON.stringify(next);
        if (nextKey === key) return;
        snapshot = next;
        key = nextKey;
        onChange();
      };
      handler();
      awareness.on("change", handler);
      return () => awareness.off("change", handler);
    },
    get: () => snapshot,
  };
}

/** Unique users currently on the board, including you. */
export function useOnlineUsers(awareness: Awareness): OnlineUser[] {
  return useStore(useMemo(() => onlineUsersStore(awareness), [awareness]));
}
