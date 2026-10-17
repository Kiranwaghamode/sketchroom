import { Logger } from "@hocuspocus/extension-logger";
import { Server } from "@hocuspocus/server";
import { createAuth } from "./auth.ts";
import { createConnectionLimit, MAX_MESSAGE_BYTES } from "./limits.ts";
import { persistence } from "./persistence.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const port = Number(process.env["PORT"] ?? 1234);
const maxConnectionsPerIp = Number(process.env["MAX_CONNECTIONS_PER_IP"] ?? 20);
const auth = createAuth({
  secret: requireEnv("WS_JWT_SECRET"),
  allowedOrigin: requireEnv("ALLOWED_ORIGIN"),
});

console.log("sync server starting");

const server = new Server({
  name: "whiteboard-sync",
  port,
  // Save after 2 s without changes, and at least every 10 s while edits continue.
  // Hocuspocus also saves right away when the last client leaves a room.
  debounce: 2000,
  maxDebounce: 10000,
  // Larger messages close the connection (ws enforces this before we see the data).
  websocketOptions: { maxPayload: MAX_MESSAGE_BYTES },
  extensions: [
    new Logger({
      // A drag writes every 30 ms, so logging every change would flood the logs.
      onChange: false,
    }),
    createConnectionLimit(maxConnectionsPerIp),
    auth,
    persistence,
  ],
});

await server.listen();
