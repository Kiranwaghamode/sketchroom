import { useMemo } from "react";
import * as Y from "yjs";
import { useStore, type Store } from "./hooks";
import { getOrder, getShapes, LOCAL_ORIGIN } from "./schema";

/** Edits closer together than this merge into one undo step. */
export const CAPTURE_TIMEOUT = 500;

/**
 * Undo only *my* changes: the manager tracks transactions with LOCAL_ORIGIN
 * (every function in mutations.ts uses it). Remote updates arrive with the
 * provider as their origin, so they're never undone by mistake.
 */
export function createUndoManager(doc: Y.Doc) {
  return new Y.UndoManager([getShapes(doc), getOrder(doc)], {
    trackedOrigins: new Set([LOCAL_ORIGIN]),
    captureTimeout: CAPTURE_TIMEOUT,
  });
}

/**
 * Starts a gesture (drag, resize) that must undo in one step, however long it
 * takes and even if the pointer pauses: a new step starts now, and everything
 * written until `endGesture` merges into it.
 */
export function beginGesture(undoManager: Y.UndoManager | undefined) {
  if (!undoManager) return;
  undoManager.stopCapturing();
  undoManager.captureTimeout = Number.POSITIVE_INFINITY;
}

/** Ends a gesture: the next edit starts a new undo step. */
export function endGesture(undoManager: Y.UndoManager | undefined) {
  if (!undoManager) return;
  undoManager.captureTimeout = CAPTURE_TIMEOUT;
  undoManager.stopCapturing();
}

type UndoState = { canUndo: boolean; canRedo: boolean };

function undoStateStore(undoManager: Y.UndoManager): Store<UndoState> {
  const read = () => ({
    canUndo: undoManager.undoStack.length > 0,
    canRedo: undoManager.redoStack.length > 0,
  });
  let snapshot = read();
  return {
    subscribe(onChange) {
      const handler = () => {
        const next = read();
        if (
          next.canUndo === snapshot.canUndo &&
          next.canRedo === snapshot.canRedo
        )
          return;
        snapshot = next;
        onChange();
      };
      handler();
      undoManager.on("stack-item-added", handler);
      undoManager.on("stack-item-popped", handler);
      undoManager.on("stack-cleared", handler);
      return () => {
        undoManager.off("stack-item-added", handler);
        undoManager.off("stack-item-popped", handler);
        undoManager.off("stack-cleared", handler);
      };
    },
    get: () => snapshot,
  };
}

/** Whether Undo / Redo are available, for the toolbar buttons. */
export function useUndoState(undoManager: Y.UndoManager): UndoState {
  return useStore(useMemo(() => undoStateStore(undoManager), [undoManager]));
}
