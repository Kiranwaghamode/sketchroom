import { Database } from "@hocuspocus/extension-database";
import { prisma } from "@whiteboard/db";

/**
 * Loads and saves board content. The whole Y.Doc is stored as one binary column
 * (`Board.state`); shapes are never stored as separate rows.
 */
export const persistence = new Database({
  async fetch({ documentName }) {
    const board = await prisma.board.findUnique({
      where: { id: documentName },
      select: { state: true },
    });
    if (!board) {
      // Phase 5 rejects these connections in onAuthenticate. Until then, just log it.
      console.warn(`[persistence] Unknown board "${documentName}"`);
      return null;
    }
    return board.state ? new Uint8Array(board.state) : null;
  },

  async store({ documentName, state }) {
    // `updatedAt` is set automatically (@updatedAt), so the dashboard's "Edited …" stays correct.
    const { count } = await prisma.board.updateMany({
      where: { id: documentName },
      data: { state: new Uint8Array(state) },
    });
    if (count === 0) {
      console.warn(
        `[persistence] Not saved: board "${documentName}" doesn't exist`,
      );
    } else {
      console.log(
        `[persistence] Saved board "${documentName}" (${state.byteLength} bytes)`,
      );
    }
  },
});
