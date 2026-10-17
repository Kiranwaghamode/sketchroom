import type { WsToken } from "@whiteboard/shared";
import { SignJWT } from "jose";
import { getBoardRole } from "@/lib/access";
import { auth } from "@/lib/auth";

/** Issues a 5-minute JWT that lets the current user connect to one board on the sync server. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Not logged in" }, { status: 401 });

  const boardId = new URL(request.url).searchParams.get("boardId");
  if (!boardId)
    return Response.json({ error: "boardId is required" }, { status: 400 });

  const role = await getBoardRole(session.user.id, boardId);
  if (!role)
    return Response.json({ error: "No access to this board" }, { status: 403 });

  const secret = process.env["WS_JWT_SECRET"];
  if (!secret) throw new Error("WS_JWT_SECRET is not set");

  const claims: Omit<WsToken, "sub"> = {
    name: session.user.name,
    boardId,
    role,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));

  return Response.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
