import { Logger } from "@hocuspocus/extension-logger";
import { Server } from "@hocuspocus/server";
import { persistence } from "./persistence.ts";

const port = Number(process.env["PORT"] ?? 1234);

console.log("sync server starting");

const server = new Server({
  name: "whiteboard-sync",
  port,
  // Save after 2 s without changes, and at least every 10 s while edits continue.
  // Hocuspocus also saves right away when the last client leaves a room.
  debounce: 2000,
  maxDebounce: 10000,
  extensions: [
    new Logger({
      // A drag writes every 30 ms, so logging every change would flood the logs.
      onChange: false,
    }),
    persistence,
  ],
});

await server.listen();
