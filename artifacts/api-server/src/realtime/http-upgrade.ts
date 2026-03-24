import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { verifyWsToken } from "./ws-token";
import { registerRealtimeClient } from "./hub";

/**
 * WebSocket at same host as API: ws(s)://host/api/realtime?token=...
 * Vite dev: proxy /api with ws:true → forwards here.
 */
export function attachRealtimeWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    try {
      const host = req.headers.host ?? "localhost";
      const url = new URL(req.url ?? "/", `http://${host}`);

      if (url.pathname !== "/api/realtime") {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get("token");
      const v = verifyWsToken(token);
      if (!v.ok) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        registerRealtimeClient(v.pharmacyId, ws);
      });
    } catch {
      socket.destroy();
    }
  });
}
