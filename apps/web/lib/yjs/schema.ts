import type { Shape } from "@whiteboard/shared";
import * as Y from "yjs";

/**
 * Transaction origin for every local edit. The undo manager (Phase 8) tracks
 * only this origin, so remote updates and restores are never undone by mistake.
 */
export const LOCAL_ORIGIN = "local";

/** One shape = one Y.Map with a key per property (PLAN.md section 6.2). */
export type ShapeMap = Y.Map<unknown>;

/** Properties a patch may change. `id`, `type` and `createdBy` never change. */
export type ShapePatch = Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  fontSize: number;
  points: number[];
}>;

/** A new shape, before it gets an id. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
export type NewShape = DistributiveOmit<Shape, "id">;

export function getShapes(doc: Y.Doc) {
  return doc.getMap<ShapeMap>("shapes");
}

export function getOrder(doc: Y.Doc) {
  return doc.getArray<string>("order");
}

export function createBoardDoc() {
  const doc = new Y.Doc();
  return { doc, shapes: getShapes(doc), order: getOrder(doc) };
}
