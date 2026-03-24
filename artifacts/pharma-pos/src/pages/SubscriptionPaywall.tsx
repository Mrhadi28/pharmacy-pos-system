import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { getApiBase } from "@/lib/api-base";
import { Stethoscope, RefreshCw, LogOut } from "lucide-react";

interface BillingInfo {
  amountPkr: number;
  currency: string;
  periodLabel: string;
  whatsapp: string | null;
  note: string | null;
}

export default function SubscriptionPaywall() {
  const { pharmacy, logout, refresh } = useAuth();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/billing/info`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as BillingInfo;
          if (!cancelled) setInfo(data);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amount = info?.amountPkr ?? 12000;
  const wa = info?.whatsapp?.replace(/\D/g, "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/15 rounded-2xl mx-auto">
          <Stethoscope className="w-8 h-8 text-amber-600" />
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">Subscription zaroori hai</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            <span className="font-semibold text-foreground">{pharmacy?.name}</span> ke liye software use karne ke liye
            salana fee ada karni hogi.
          </p>
        </div>
        <div className="rounded-xl bg-muted/60 py-6 px-4 border border-border">
          <p className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">Salana package</p>
          <p className="text-4xl font-extrabold text-primary mt-2 tabular-nums">
            {loading ? "—" : `${amount.toLocaleString("en-PK")} PKR`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{info?.periodLabel ?? "1 year"} — ek dafa payment</p>
        </div>
        <div className="text-left text-sm text-muted-foreground space-y-3 bg-background/80 rounded-xl p-4 border border-border">
          <p className="font-semibold text-foreground">Payment kaise karein</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>JazzCash / bank transfer se fee bhejein (details neeche).</li>
            <li>Receipt / screenshot WhatsApp par bhejein.</li>
            <li>Hum activate kar den ge — phir &quot;Refresh status&quot; dabayein.</li>
          </ol>
          {info?.note ? <p className="pt-2 border-t border-border">{info.note}</p> : null}
          {wa ? (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full mt-2 py-3 rounded-xl bg-[#25D366] text-white font-semibold hover:opacity-95"
            >
              WhatsApp par rabta
            </a>
          ) : (
            <p className="text-xs pt-2">Server par PAYMENT_WHATSAPP set karein (admin).</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button className="flex-1" onClick={() => void refresh()} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh status
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => void logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
