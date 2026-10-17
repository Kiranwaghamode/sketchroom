import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { Extension, onUpgradePayload } from "@hocuspocus/server";

/** Largest WebSocket message accepted (a whole board is sent on first sync). */
export const MAX_MESSAGE_BYTES = 10 * 1024 * 1024;

/** The client's IP. Behind Railway/Fly the real IP is the first X-Forwarded-For entry. */
function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  return first || request.socket.remoteAddress || "unknown";
}

/**
 * Limits open connections per IP with a simple in-memory counter (fine for the
 * single sync-server instance this MVP runs). Over-limit upgrades get HTTP 429.
 */
export function createConnectionLimit(maxPerIp: number): Extension {
  const open = new Map<string, number>();

  return {
    extensionName: "connection-limit",

    async onUpgrade({ request, socket }: onUpgradePayload) {
      const ip = clientIp(request);
      const count = open.get(ip) ?? 0;
      if (count >= maxPerIp) {
        console.warn(
          `[limits] Rejected connection from ${ip}: ${count} already open`,
        );
        const s = socket as Duplex;
        s.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n");
        s.destroy();
        // An empty rejection stops Hocuspocus from handling the upgrade, without
        // being rethrown (see docs/decisions.md, Phase 5).
        return Promise.reject();
      }
      open.set(ip, count + 1);
      (socket as Duplex).once("close", () => {
        const left = (open.get(ip) ?? 1) - 1;
        if (left <= 0) open.delete(ip);
        else open.set(ip, left);
      });
    },
  };
}
