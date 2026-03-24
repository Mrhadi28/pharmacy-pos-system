import "./load-env";
import http from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachRealtimeWebSocket } from "./realtime/http-upgrade";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
attachRealtimeWebSocket(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket /api/realtime)");
});
