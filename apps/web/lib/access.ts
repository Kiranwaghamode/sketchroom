import { prisma, type Role } from "@whiteboard/db";

/** The user's role on a board, or null if they have no access (or the board doesn't exist). */
export async function getBoardRole(
  userId: string,
  boardId: string,
): Promise<Role | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!board) return null;
  if (board.ownerId === userId) return "OWNER";
  return board.members[0]?.role ?? null;
}
