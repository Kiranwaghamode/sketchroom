import type {
  Extension,
  onAuthenticatePayload,
  onConnectPayload,
} from "@hocuspocus/server";
import { WsTokenSchema } from "@whiteboard/shared";
import { jwtVerify } from "jose";

/** Stored as the connection context after a successful onAuthenticate. */
export type ConnectionContext = {
  user: { id: string; name: string; role: "OWNER" | "EDITOR" | "VIEWER" };
};

type Options = { secret: string; allowedOrigin: string };

/**
 * Only browsers on ALLOWED_ORIGIN, holding a valid short-lived JWT for this exact
 * board, may connect. Viewers get a read-only connection: the server drops their updates.
 */
export function createAuth({ secret, allowedOrigin }: Options): Extension {
  const key = new TextEncoder().encode(secret);

  function reject(
    socketId: string,
    documentName: string,
    reason: string,
  ): never {
    console.warn(
      `[auth] Rejected connection ${socketId} to "${documentName}": ${reason}`,
    );
    throw new Error(reason);
  }

  return {
    extensionName: "auth",

    async onConnect({
      requestHeaders,
      socketId,
      documentName,
    }: onConnectPayload) {
      const origin = requestHeaders.get("origin");
      if (origin !== allowedOrigin) {
        reject(
          socketId,
          documentName,
          `origin ${origin ?? "(none)"} is not allowed`,
        );
      }
    },

    async onAuthenticate({
      token,
      documentName,
      socketId,
      connectionConfig,
    }: onAuthenticatePayload): Promise<ConnectionContext> {
      if (!token) reject(socketId, documentName, "no token");

      let claims;
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
        });
        claims = WsTokenSchema.parse(payload);
      } catch (error) {
        reject(
          socketId,
          documentName,
          `invalid token (${(error as Error).message})`,
        );
      }

      if (claims.boardId !== documentName) {
        reject(
          socketId,
          documentName,
          `token is for board "${claims.boardId}"`,
        );
      }
      if (claims.role === "VIEWER") connectionConfig.readOnly = true;

      return { user: { id: claims.sub, name: claims.name, role: claims.role } };
    },
  };
}
