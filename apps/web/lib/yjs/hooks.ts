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
