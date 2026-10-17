import { WebSocketStatus, type HocuspocusProvider } from "@hocuspocus/provider";
import type { Shape } from "@whiteboard/shared";
import { useMemo, useSyncExternalStore } from "react";
import type * as Y from "yjs";
import { getOrder, getShapes } from "./schema";

/** A tiny external store for useSyncExternalStore. `get` returns a cached snapshot. */
export type Store<T> = {
  subscribe: (onChange: () => void) => () => void;
  get: () => T;
};

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

function shapeIdsStore(doc: Y.Doc): Store<string[]> {
  const order = getOrder(doc);
  let snapshot = order.toArray();
  return {
    subscribe(onChange) {
      const handler = () => {
        snapshot = order.toArray();
        onChange();
      };
      // Catch changes made between creating the store and subscribing.
      snapshot = order.toArray();
      order.observe(handler);
      return () => order.unobserve(handler);
    },
    get: () => snapshot,
  };
}

function shapeStore(doc: Y.Doc, id: string): Store<Shape | null> {
  const shapes = getShapes(doc);
  const read = () => (shapes.get(id)?.toJSON() as Shape | undefined) ?? null;
  let snapshot = read();
  return {
    subscribe(onChange) {
      let map = shapes.get(id);
      const onShapeChange = () => {
        snapshot = read();
        onChange();
      };
      // Fires only when keys of `shapes` are added/removed (not for edits inside a shape).
      const onShapesChange = (event: Y.YMapEvent<Y.Map<unknown>>) => {
        if (!event.keysChanged.has(id)) return;
        map?.unobserve(onShapeChange);
        map = shapes.get(id);
        map?.observe(onShapeChange);
        onShapeChange();
      };
      snapshot = read();
      map?.observe(onShapeChange);
      shapes.observe(onShapesChange);
      return () => {
        map?.unobserve(onShapeChange);
        shapes.unobserve(onShapesChange);
      };
    },
    get: () => snapshot,
  };
}

/** The drawing order (list of shape ids). Re-renders when the order changes. */
export function useShapeIds(doc: Y.Doc): string[] {
  return useStore(useMemo(() => shapeIdsStore(doc), [doc]));
}

/**
 * A plain-object snapshot of one shape, or null if it doesn't exist.
 * Re-renders only when that shape's Y.Map changes (or the shape is added/removed).
 */
export function useShape(doc: Y.Doc, id: string): Shape | null {
  return useStore(useMemo(() => shapeStore(doc, id), [doc, id]));
}

export type ConnectionStatus = "connected" | "connecting" | "offline";

export type ConnectionState = {
  status: ConnectionStatus;
  /** True once the first sync with the server has finished (stays true afterwards). */
  loaded: boolean;
  /** True while local changes haven't been acknowledged by the server yet. */
  saving: boolean;
};

function connectionStore(provider: HocuspocusProvider): Store<ConnectionState> {
  let loaded = provider.synced;
  const read = (): ConnectionState => {
    const socket = provider.configuration.websocketProvider.status;
    // "Connected" means the socket is open *and* the document handshake finished.
    const status: ConnectionStatus =
      socket === WebSocketStatus.Disconnected
        ? "offline"
        : socket === WebSocketStatus.Connected && provider.synced
          ? "connected"
          : "connecting";
    if (provider.synced) loaded = true;
    return { status, loaded, saving: provider.hasUnsyncedChanges };
  };
  let snapshot = read();
  return {
    subscribe(onChange) {
      const handler = () => {
        const next = read();
        if (
          next.status !== snapshot.status ||
          next.loaded !== snapshot.loaded ||
          next.saving !== snapshot.saving
        ) {
          snapshot = next;
          onChange();
        }
      };
      handler();
      provider.on("status", handler);
      provider.on("synced", handler);
      provider.on("close", handler);
      provider.on("unsyncedChanges", handler);
      return () => {
        provider.off("status", handler);
        provider.off("synced", handler);
        provider.off("close", handler);
        provider.off("unsyncedChanges", handler);
      };
    },
    get: () => snapshot,
  };
}

/** Connection status of the sync provider, for the status dot and the loading screen. */
export function useConnectionStatus(
  provider: HocuspocusProvider,
): ConnectionState {
  return useStore(useMemo(() => connectionStore(provider), [provider]));
}
