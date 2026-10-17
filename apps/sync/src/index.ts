import { Logger } from "@hocuspocus/extension-logger";
import { Server } from "@hocuspocus/server";

const port = Number(process.env["PORT"] ?? 1234);

console.log("sync server starting");

const server = new Server({
  name: "whiteboard-sync",
  port,
  extensions: [
    new Logger({
      // A drag writes every 30 ms, so logging every change would flood the logs.
      onChange: false,
    }),
  ],
});

await server.listen();
