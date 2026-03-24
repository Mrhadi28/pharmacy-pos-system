import { WebSocket } from "ws";

const rooms = new Map<number, Set<WebSocket>>();

const BROADCAST = JSON.stringify({ t: "invalidate", scope: "data" });

export function registerRealtimeClient(pharmacyId: number, ws: WebSocket): void {
  let set = rooms.get(pharmacyId);
  if (!set) {
    set = new Set();
    rooms.set(pharmacyId, set);
  }
  set.add(ws);
  const cleanup = (): void => {
    set!.delete(ws);
    if (set!.size === 0) rooms.delete(pharmacyId);
  };
  ws.on("close", cleanup);
  ws.on("error", cleanup);
}

/** Call after writes that should refresh all open POS/dashboard tabs for this pharmacy. */
export function notifyPharmacyDataChanged(pharmacyId: number): void {
  const set = rooms.get(pharmacyId);
  if (!set) return;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(BROADCAST);
      } catch {
        /* ignore */
      }
    }
  }
}
