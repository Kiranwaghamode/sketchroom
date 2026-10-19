import { prisma, type Role } from "@whiteboard/db";

/**
 * The user's role on an item (a board or a document), or null if they have no
 * access (or it doesn't exist). Both kinds live in the `Board` table.
 */
export async function getItemRole(
  userId: string,
  itemId: string,
): Promise<Role | null> {
  const board = await prisma.board.findUnique({
    where: { id: itemId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!board) return null;
  if (board.ownerId === userId) return "OWNER";
  return board.members[0]?.role ?? null;
}
