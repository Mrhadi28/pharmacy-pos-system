import { useState } from "react";
import { useGetCreditSales, useRecordCreditPayment, useGetCustomers } from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { BookOpen, Search, DollarSign, User, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Plus, Clock, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CreditSaleItem {
  medicineName: string;
  quantity: number;
  medicineUnit: string;
  unitPrice: string;
  total: string;
}

interface CreditSale {
  id: number;
  invoiceNumber: string;
  customerName: string | null;
  customerId: number | null;
  createdAt: string;
  totalAmount: string;
  paidAmount: string;
  creditAmount: string;
  paymentStatus: string;
  items: CreditSaleItem[];
}

const MANUAL_CREDIT_KEY = "/api/credit/manual";

interface ManualCreditPayment {
  id: number;
  entryId: number;
  amountPaid: string;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
}

interface ManualCreditEntry {
  id: number;
  customerName: string;
  customerId: number | null;
  amount: string;
  paidAmount: string;
  dueDate: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ManualCreditEntryDetail extends ManualCreditEntry {
  payments: ManualCreditPayment[];
  totalPaid: number;
  outstanding: number;
}

function useGetManualCredits() {
  return useQuery<ManualCreditEntry[]>({
    queryKey: [MANUAL_CREDIT_KEY],
    queryFn: async () => {
      const res = await fetch("/api/credit/manual");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}

function useGetManualCreditDetail(id: number | null) {
  return useQuery<ManualCreditEntryDetail>({
    queryKey: [`${MANUAL_CREDIT_KEY}/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/credit/manual/${id}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: id !== null,
  });
}

function useCreateManualCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/credit/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [MANUAL_CREDIT_KEY] }),
  });
}

function usePayManualCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { amountPaid: number; paymentMethod: string; notes?: string } }) => {
      const res = await fetch(`/api/credit/manual/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: [MANUAL_CREDIT_KEY] });
      qc.invalidateQueries({ queryKey: [`${MANUAL_CREDIT_KEY}/${vars.id}`] });
    },
  });
}

function useUpdateManualCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/credit/manual/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [MANUAL_CREDIT_KEY] }),
  });
}

function useDeleteManualCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/credit/manual/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [MANUAL_CREDIT_KEY] }),
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "paid": return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Paid</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Overdue</Badge>;
    default: return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Unpaid</Badge>;
  }
}

export default function Khata() {
  const { data: creditSalesRaw = [], isLoading, refetch } = useGetCreditSales();
  const creditSales = creditSalesRaw as CreditSale[];
  const { data: customers = [] } = useGetCustomers();
  const { data: manualCredits = [], isLoading: isLoadingManual } = useGetManualCredits();
  const { mutate: recordPayment, isPending } = useRecordCreditPayment();
  const createManual = useCreateManualCredit();
  const payManual = usePayManualCredit();
  const updateManual = useUpdateManualCredit();
  const deleteManual = useDeleteManualCredit();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"pos" | "manual">("manual");
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Manual credit forms/modals
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    customerName: "",
    customerId: "",
    amount: "",
    dueDate: "",
    notes: "",
    status: "unpaid",
  });

  // Detail view for a manual credit entry
  const [detailEntryId, setDetailEntryId] = useState<number | null>(null);
  const { data: detailEntry, isLoading: isLoadingDetail } = useGetManualCreditDetail(detailEntryId);
  const [manualPayAmount, setManualPayAmount] = useState("");
  const [manualPayMethod, setManualPayMethod] = useState("cash");
  const [manualPayNotes, setManualPayNotes] = useState("");

  const filtered = creditSales.filter((s: CreditSale) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q);
  });

  const filteredManual = manualCredits.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.customerName?.toLowerCase().includes(q) || m.notes?.toLowerCase().includes(q);
  });

  const totalOutstanding = creditSales.reduce((sum, s: CreditSale) => sum + parseFloat(s.creditAmount || "0"), 0);
  const totalManualOutstanding = manualCredits
    .filter((m) => m.status !== "paid")
    .reduce((sum, m) => sum + Math.max(0, parseFloat(m.amount || "0") - parseFloat(m.paidAmount || "0")), 0);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePay = () => {
    const sale = selectedSale;
    if (!sale || !payAmount || parseFloat(payAmount) <= 0) {
      toast({ title: "Enter valid amount", variant: "destructive" });
      return;
    }
    recordPayment({
      saleId: sale.id,
      data: { amountPaid: parseFloat(payAmount), paymentMethod: payMethod, notes: payNotes || undefined }
    }, {
      onSuccess: () => {
        toast({ title: "Payment recorded!", description: `${formatPKR(parseFloat(payAmount))} received from ${sale.customerName}` });
        setSelectedSale(null);
        setPayAmount("");
        setPayNotes("");
        refetch();
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" })
    });
  };

  const handleCreateManual = () => {
    if (!manualForm.customerName || !manualForm.amount || parseFloat(manualForm.amount) <= 0) {
      toast({ title: "Customer name and amount required", variant: "destructive" });
      return;
    }
    createManual.mutate({
      customerName: manualForm.customerName,
      customerId: manualForm.customerId ? parseInt(manualForm.customerId) : undefined,
      amount: parseFloat(manualForm.amount),
      dueDate: manualForm.dueDate || undefined,
      notes: manualForm.notes || undefined,
      status: manualForm.status,
    }, {
      onSuccess: () => {
        toast({ title: "Credit entry added!" });
        setShowManualForm(false);
        setManualForm({ customerName: "", customerId: "", amount: "", dueDate: "", notes: "", status: "unpaid" });
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleUpdateStatus = (entry: ManualCreditEntry, newStatus: string) => {
    updateManual.mutate({ id: entry.id, data: { status: newStatus } }, {
      onSuccess: () => toast({ title: "Status updated" }),
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleDeleteManual = (id: number) => {
    if (confirm("Delete this credit entry?")) {
      deleteManual.mutate(id, {
        onSuccess: () => toast({ title: "Entry deleted" }),
      });
    }
  };

  const handleManualPayment = () => {
    if (!detailEntryId || !manualPayAmount || parseFloat(manualPayAmount) <= 0) {
      toast({ title: "Enter valid amount", variant: "destructive" });
      return;
    }
    payManual.mutate({
      id: detailEntryId,
      data: { amountPaid: parseFloat(manualPayAmount), paymentMethod: manualPayMethod, notes: manualPayNotes || undefined },
    }, {
      onSuccess: () => {
        toast({ title: "Payment recorded!" });
        setManualPayAmount("");
        setManualPayNotes("");
      },
      onError: (err) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/15 rounded-xl"><AlertCircle className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Total Khata Outstanding</p>
              <p className="font-display font-bold text-2xl text-destructive">{formatPKR(totalOutstanding + totalManualOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><BookOpen className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Open Credit Entries</p>
              <p className="font-display font-bold text-2xl">{creditSales.length + manualCredits.filter((m) => m.status !== "paid").length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><User className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Customers with Khata</p>
              <p className="font-display font-bold text-2xl">
                {new Set(creditSales.map((s: CreditSale) => s.customerId).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Khata Register
            </h2>
            <p className="text-muted-foreground text-sm">Credit sales and outstanding payments</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input className="pl-10" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Button onClick={() => setShowManualForm(true)} className="whitespace-nowrap">
              <Plus className="w-4 h-4 mr-2" /> New Credit Entry
            </Button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border px-6">
          <button
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("manual")}
          >
            Manual Entries ({manualCredits.length})
          </button>
          <button
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === "pos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("pos")}
          >
            POS Credit Sales ({(creditSales as unknown[]).length})
          </button>
        </div>

        <div className="overflow-auto">
          {activeTab === "manual" ? (
            isLoadingManual ? (
              <div className="text-center py-16 text-muted-foreground">Loading...</div>
            ) : filteredManual.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
                <p className="font-semibold">No manual credit entries</p>
                <p className="text-sm">Click "New Credit Entry" to add one.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 text-sm">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Customer</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Due Date</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Amount</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-destructive">Outstanding</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredManual.map((entry) => {
                    const outstanding = Math.max(0, parseFloat(entry.amount || "0") - parseFloat(entry.paidAmount || "0"));
                    const isOverdue = entry.dueDate && new Date(entry.dueDate) < new Date() && entry.status !== "paid";
                    return (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                              {(entry.customerName || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="font-medium">{entry.customerName}</span>
                              {entry.notes && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{entry.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-sm">{formatDate(entry.createdAt)}</td>
                        <td className="px-6 py-4 text-sm">
                          {entry.dueDate ? (
                            <span className={isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}>
                              {isOverdue && <Clock className="w-3 h-3 inline mr-1" />}
                              {entry.dueDate}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">{formatPKR(parseFloat(entry.amount))}</td>
                        <td className="px-6 py-4 text-right font-bold text-destructive">{formatPKR(outstanding)}</td>
                        <td className="px-6 py-4">
                          <select
                            className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
                            value={entry.status}
                            onChange={e => handleUpdateStatus(entry, e.target.value)}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => { setDetailEntryId(entry.id); setManualPayAmount(""); setManualPayNotes(""); }}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Detail
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              onClick={() => handleDeleteManual(entry.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            isLoading ? (
              <div className="text-center py-16 text-muted-foreground">Loading khata records...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20 text-green-500" />
                <p className="font-semibold">No outstanding khata!</p>
                <p className="text-sm">All payments are clear.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 text-sm">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Invoice</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Customer</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Total Bill</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground">Paid</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted-foreground text-destructive">Outstanding</th>
                    <th className="text-left px-6 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((sale: CreditSale) => (
                    <>
                      <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <button
                            className="flex items-center gap-2 text-primary font-semibold hover:underline"
                            onClick={() => toggleRow(sale.id)}
                          >
                            {expandedRows.has(sale.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {sale.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                              {(sale.customerName || "?")[0].toUpperCase()}
                            </div>
                            <span className="font-medium">{sale.customerName || <span className="text-muted-foreground italic">Walk-in</span>}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-sm">{formatDate(sale.createdAt)}</td>
                        <td className="px-6 py-4 text-right font-semibold">{formatPKR(parseFloat(sale.totalAmount))}</td>
                        <td className="px-6 py-4 text-right text-green-600 font-medium">{formatPKR(parseFloat(sale.paidAmount))}</td>
                        <td className="px-6 py-4 text-right font-bold text-destructive">{formatPKR(parseFloat(sale.creditAmount || "0"))}</td>
                        <td className="px-6 py-4">
                          <Badge variant={sale.paymentStatus === "credit" ? "destructive" : "secondary"}>
                            {sale.paymentStatus === "credit" ? "KHATA" : "PARTIAL"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setSelectedSale(sale); setPayAmount(sale.creditAmount || ""); }}
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1" /> Receive Payment
                          </Button>
                        </td>
                      </tr>
                      {expandedRows.has(sale.id) && (
                        <tr key={`${sale.id}-items`} className="bg-muted/10">
                          <td colSpan={8} className="px-10 py-3">
                            <div className="text-sm">
                              <p className="font-semibold text-muted-foreground mb-2">Items in this sale:</p>
                              <div className="space-y-1">
                                {(sale.items || []).map((item, i) => (
                                  <div key={i} className="flex items-center gap-4">
                                    <span className="font-medium">{item.medicineName}</span>
                                    <span className="text-muted-foreground">× {item.quantity} {item.medicineUnit}</span>
                                    <span className="text-muted-foreground">@ {formatPKR(parseFloat(item.unitPrice))}</span>
                                    <span className="font-semibold">{formatPKR(parseFloat(item.total))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* POS Credit Payment Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record Khata Payment</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-semibold">{selectedSale.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold">{selectedSale.customerName || "Walk-in"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bill</span>
                  <span className="font-bold">{formatPKR(parseFloat(selectedSale.totalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="text-green-600 font-bold">{formatPKR(parseFloat(selectedSale.paidAmount))}</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-2">
                  <span className="font-semibold text-destructive">Outstanding</span>
                  <span className="font-bold text-destructive text-lg">{formatPKR(parseFloat(selectedSale.creditAmount || "0"))}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Amount Receiving (PKR)</label>
                <Input type="number" className="h-12 font-bold text-lg" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {["cash", "jazzcash", "easypaisa", "card"].map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all capitalize ${payMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                    >{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes (optional)</label>
                <Input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Add a note..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSale(null)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handlePay} disabled={isPending}>
              {isPending ? "Saving..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Credit Detail / Payment History Dialog */}
      <Dialog open={detailEntryId !== null} onOpenChange={() => setDetailEntryId(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Credit Entry Detail</DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : detailEntry ? (
            <div className="space-y-4">
              {/* Entry summary */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-lg">{detailEntry.customerName}</span>
                  {getStatusBadge(detailEntry.status)}
                </div>
                {detailEntry.notes && <p className="text-muted-foreground italic text-xs">{detailEntry.notes}</p>}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-dashed">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-base">{formatPKR(parseFloat(detailEntry.amount))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Paid</p>
                    <p className="font-bold text-base text-green-600">{formatPKR(detailEntry.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="font-bold text-base text-destructive">{formatPKR(detailEntry.outstanding)}</p>
                  </div>
                </div>
                {detailEntry.dueDate && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Due: {detailEntry.dueDate}</span>
                    {new Date(detailEntry.dueDate) < new Date() && detailEntry.status !== "paid" && (
                      <Badge className="bg-red-100 text-red-700 text-[10px]">Overdue</Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Payment History</h4>
                {detailEntry.payments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-xl">No payments recorded yet</div>
                ) : (
                  <div className="space-y-2">
                    {detailEntry.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl text-sm">
                        <div>
                          <span className="font-semibold text-green-700">{formatPKR(parseFloat(payment.amountPaid))}</span>
                          <span className="text-muted-foreground ml-2 capitalize">{payment.paymentMethod}</span>
                          {payment.notes && <p className="text-xs text-muted-foreground mt-0.5">{payment.notes}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Record New Payment */}
              {detailEntry.outstanding > 0 && (
                <div className="border-t border-dashed pt-4 space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Record Payment</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Amount (PKR)</label>
                      <Input
                        type="number"
                        className="h-10 font-bold"
                        value={manualPayAmount}
                        onChange={e => setManualPayAmount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Method</label>
                      <select
                        className="w-full h-10 border border-border rounded-md px-2 text-sm bg-background"
                        value={manualPayMethod}
                        onChange={e => setManualPayMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="jazzcash">JazzCash</option>
                        <option value="easypaisa">Easypaisa</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>
                  <Input
                    value={manualPayNotes}
                    onChange={e => setManualPayNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="h-9"
                  />
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleManualPayment}
                    disabled={payManual.isPending}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    {payManual.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailEntryId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Manual Credit Entry Form */}
      <Dialog open={showManualForm} onOpenChange={setShowManualForm}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> New Credit Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Customer Name *</label>
                <Input
                  value={manualForm.customerName}
                  onChange={e => setManualForm(f => ({ ...f, customerName: e.target.value }))}
                  placeholder="Enter customer name"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Link to Existing Customer (optional)</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm"
                  value={manualForm.customerId}
                  onChange={e => {
                    const val = e.target.value;
                    const cust = (customers as Customer[]).find((c) => c.id === parseInt(val));
                    setManualForm(f => ({ ...f, customerId: val, customerName: cust ? cust.name : f.customerName }));
                  }}
                >
                  <option value="">-- Not linked --</option>
                  {(customers as Customer[]).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Amount (PKR) *</label>
                <Input
                  type="number"
                  value={manualForm.amount}
                  onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Due Date</label>
                <Input
                  type="date"
                  value={manualForm.dueDate}
                  onChange={e => setManualForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Status</label>
                <select
                  className="w-full border border-border rounded-md px-3 py-2 bg-background text-sm"
                  value={manualForm.status}
                  onChange={e => setManualForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes</label>
                <Input
                  value={manualForm.notes}
                  onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
            <Button onClick={handleCreateManual} disabled={createManual.isPending}>
              {createManual.isPending ? "Saving..." : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
