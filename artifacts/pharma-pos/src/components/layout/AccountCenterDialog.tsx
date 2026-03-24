import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiBase, readJsonError } from "@/lib/api-base";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type TabKey = "subscription" | "backup" | "support";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OverviewResponse {
  plan: {
    name: string;
    amountPkr: number;
    period: string;
    active: boolean;
    subscriptionPaidUntil: string | null;
    progressPercent: number;
  };
  payment: {
    accountTitle: string;
    accountNumber: string;
    bankName: string;
    iban: string;
    note: string | null;
    whatsapp: string | null;
    latestSubmission: {
      id: number;
      status: string;
      amountPkr: number;
      createdAt: string;
      transactionRef?: string | null;
    } | null;
  };
}

const API_BASE = getApiBase();
const FALLBACK_PAYMENT = {
  bankName: "Bank Alfalah",
  accountTitle: "DEVARION SOLUTION",
  accountNumber: "83491010777139",
  iban: "PK69ALFH8349001010777139",
};

export function AccountCenterDialog({ open, onOpenChange }: Props) {
  const { refresh } = useAuth();
  const [tab, setTab] = useState<TabKey>("subscription");
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const [supportForm, setSupportForm] = useState({
    subject: "",
    message: "",
    contactEmail: "",
    contactPhone: "",
  });

  const daysLeft = useMemo(() => {
    if (!overview?.plan.subscriptionPaidUntil) return 0;
    const ms = new Date(overview.plan.subscriptionPaidUntil).getTime() - Date.now();
    return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
  }, [overview?.plan.subscriptionPaidUntil]);
  const paymentDisplay = {
    bankName: overview?.payment.bankName || FALLBACK_PAYMENT.bankName,
    accountTitle: overview?.payment.accountTitle || FALLBACK_PAYMENT.accountTitle,
    accountNumber: overview?.payment.accountNumber || FALLBACK_PAYMENT.accountNumber,
    iban: overview?.payment.iban || FALLBACK_PAYMENT.iban,
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/account/overview`, { credentials: "include" });
      if (!res.ok) throw new Error(await readJsonError(res));
      setOverview(await res.json());
    } catch (e: any) {
      toast({ title: "Could not load account info", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onDialogChange = (next: boolean) => {
    onOpenChange(next);
    if (next) void loadOverview();
  };

  const markSubmissionSent = async () => {
    const submissionId = overview?.payment.latestSubmission?.id;
    if (!submissionId) return;
    try {
      const res = await fetch(`${API_BASE}/account/payment-submission/${submissionId}/mark-sent`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      toast({ title: "Marked as sent", description: "Payment status is updated." });
      await loadOverview();
    } catch (e: any) {
      toast({ title: "Could not mark sent", description: e?.message, variant: "destructive" });
    }
  };

  const markAsPaid = async () => {
    setMarkingPaid(true);
    try {
      const res = await fetch(`${API_BASE}/account/subscription/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      toast({ title: "Marked as paid", description: "Subscription is now active for 1 year." });
      await loadOverview();
      await refresh();
    } catch (e: any) {
      toast({ title: "Could not mark paid", description: e?.message, variant: "destructive" });
    } finally {
      setMarkingPaid(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}`, variant: "destructive" });
    }
  };

  const downloadBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/account/backup`, { credentials: "include" });
      if (!res.ok) throw new Error(await readJsonError(res));
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pharmacy-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded" });
    } catch (e: any) {
      toast({ title: "Backup failed", description: e?.message, variant: "destructive" });
    }
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await fetch(`${API_BASE}/account/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup }),
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      toast({ title: "Data restored", description: "Refresh the page to see restored records." });
      await refresh();
    } catch (e: any) {
      toast({ title: "Restore failed", description: e?.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const submitSupport = async () => {
    if (!supportForm.subject || !supportForm.message) {
      toast({ title: "Subject and message required", variant: "destructive" });
      return;
    }
    setSubmittingSupport(true);
    try {
      const res = await fetch(`${API_BASE}/account/support`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supportForm),
      });
      if (!res.ok) throw new Error(await readJsonError(res));
      const out = (await res.json()) as { mailSent?: boolean };
      if (out.mailSent) {
        toast({ title: "Support message sent", description: "Email sent to support inbox." });
      } else {
        toast({
          title: "Message saved, email not sent",
          description: "SMTP config missing/failed. Ticket is saved in system.",
          variant: "destructive",
        });
      }
      setSupportForm({ subject: "", message: "", contactEmail: "", contactPhone: "" });
    } catch (e: any) {
      toast({ title: "Could not send message", description: e?.message, variant: "destructive" });
    } finally {
      setSubmittingSupport(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onDialogChange}>
      <DialogContent className="left-3 top-3 translate-x-0 translate-y-0 w-[calc(100vw-24px)] max-w-none h-[calc(100vh-24px)] max-h-none p-0 overflow-y-auto rounded-xl">
        <div className="min-h-full flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border">
            <DialogTitle>Account, Subscription, Backup & Support</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 p-6">
          <div className="space-y-2">
            <Button variant={tab === "subscription" ? "default" : "outline"} className="w-full justify-start" onClick={() => setTab("subscription")}>Subscription</Button>
            <Button variant={tab === "backup" ? "default" : "outline"} className="w-full justify-start" onClick={() => setTab("backup")}>Backup & Recover</Button>
            <Button variant={tab === "support" ? "default" : "outline"} className="w-full justify-start" onClick={() => setTab("support")}>Support / Contact</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => void loadOverview()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
          </div>

          <div className="space-y-4 pr-1 pb-6">
            {tab === "subscription" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-4 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Plan: {overview?.plan.name ?? "Annual"}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${overview?.plan.active ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {overview?.plan.active ? "Active" : "Payment Pending"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {overview?.plan.amountPkr?.toLocaleString("en-PK") ?? "12,000"} PKR / annual
                  </p>
                  <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${overview?.plan.progressPercent ?? 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Progress {overview?.plan.progressPercent ?? 0}% {overview?.plan.active ? `• ${daysLeft} day(s) left` : ""}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 p-4 space-y-3 bg-gradient-to-br from-emerald-50 to-white">
                  <p className="font-semibold">Payment module is disabled</p>
                  <p className="text-sm text-muted-foreground">
                    Software usage is unlocked. You can continue all daily operations normally.
                  </p>
                  {overview?.payment.latestSubmission ? (
                    <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p>
                          <span className="font-medium text-foreground">Latest status:</span>{" "}
                          <span className={overview.payment.latestSubmission.status === "paid" ? "text-emerald-700" : "text-amber-700"}>
                            {overview.payment.latestSubmission.status === "paid" ? "Paid" : overview.payment.latestSubmission.status === "sent" ? "Marked as sent" : "Pending"}
                          </span>
                        </p>
                        {overview.payment.latestSubmission.status !== "sent" && overview.payment.latestSubmission.status !== "paid" ? (
                          <Button type="button" size="sm" onClick={() => void markSubmissionSent()}>
                            Mark as sent
                          </Button>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground">
                        Last submission: {Number(overview.payment.latestSubmission.amountPkr || 0).toLocaleString("en-PK")} PKR
                        {" • "}
                        {new Date(overview.payment.latestSubmission.createdAt).toLocaleDateString("en-PK")}
                      </p>
                    </div>
                  ) : null}
                  <div className="text-sm text-muted-foreground">
                    <div className="rounded-lg bg-white border border-emerald-100 p-3 space-y-2">
                      <p><span className="font-medium text-foreground">Bank:</span> {paymentDisplay.bankName}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p><span className="font-medium text-foreground">Title:</span> {paymentDisplay.accountTitle}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyText(paymentDisplay.accountTitle, "Account title")}>Copy</Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p><span className="font-medium text-foreground">Account No:</span> {paymentDisplay.accountNumber}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyText(paymentDisplay.accountNumber, "Account number")}>Copy</Button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="break-all"><span className="font-medium text-foreground">IBAN:</span> {paymentDisplay.iban}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => void copyText(paymentDisplay.iban, "IBAN")}>Copy</Button>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto" variant="secondary" onClick={() => void markAsPaid()} disabled={markingPaid}>
                    {markingPaid ? "Updating..." : "Mark as paid"}
                  </Button>
                </div>
              </div>
            )}

            {tab === "backup" && (
              <div className="space-y-4 rounded-xl border border-border p-4">
                <p className="font-semibold">Data Backup / Recover</p>
                <p className="text-sm text-muted-foreground">
                  Download a backup JSON for this pharmacy, or restore from previously exported file.
                </p>
                <Button onClick={() => void downloadBackup()}>Download Backup</Button>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recover from backup file</label>
                  <Input type="file" accept="application/json" onChange={(e) => void restoreBackup(e.target.files?.[0])} />
                  <p className="text-xs text-amber-700">Warning: restore will replace current pharmacy data.</p>
                </div>
                {restoring && <p className="text-sm text-muted-foreground">Restoring backup...</p>}
              </div>
            )}

            {tab === "support" && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <p className="font-semibold">Support / Contact</p>
                <Input placeholder="Subject" value={supportForm.subject} onChange={(e) => setSupportForm((s) => ({ ...s, subject: e.target.value }))} />
                <Textarea placeholder="Write your query / message..." value={supportForm.message} onChange={(e) => setSupportForm((s) => ({ ...s, message: e.target.value }))} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input placeholder="Contact email (optional)" value={supportForm.contactEmail} onChange={(e) => setSupportForm((s) => ({ ...s, contactEmail: e.target.value }))} />
                  <Input placeholder="Contact phone (optional)" value={supportForm.contactPhone} onChange={(e) => setSupportForm((s) => ({ ...s, contactPhone: e.target.value }))} />
                </div>
                <Button onClick={() => void submitSupport()} disabled={submittingSupport}>
                  {submittingSupport ? "Sending..." : "Send Message"}
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
