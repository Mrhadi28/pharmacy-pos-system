import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { hasActiveSubscription } from "@/lib/pharmacy-subscription";
import { getApiBase } from "@/lib/api-base";

/**
 * WebSocket → React Query invalidate (same pharmacy: POS sale updates dashboard on other tabs).
 */
export function RealtimeSync() {
  const { user, pharmacy } = useAuth();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!user || !hasActiveSubscription(pharmacy)) {
      return;
    }

    let stopped = false;

    const invalidateAllApi = (): void => {
      qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return typeof k === "string" && k.startsWith("/api/");
        },
      });
    };

    const connect = async (): Promise<void> => {
      if (stopped) return;
      try {
        const res = await fetch(`${getApiBase()}/auth/ws-token`, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { token?: string };
        if (!data.token) return;

        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        const host = window.location.host;
        const url = `${proto}//${host}${base}/api/realtime?token=${encodeURIComponent(data.token)}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = () => {
          invalidateAllApi();
        };

        ws.onopen = () => {
          attemptRef.current = 0;
        };

        ws.onclose = () => {
          wsRef.current = null;
          if (stopped) return;
          attemptRef.current += 1;
          const delay = Math.min(30_000, 1000 * 2 ** Math.min(attemptRef.current, 5));
          timerRef.current = setTimeout(() => void connect(), delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (stopped) return;
        timerRef.current = setTimeout(() => void connect(), 8000);
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [user, pharmacy, qc]);

  return null;
}
