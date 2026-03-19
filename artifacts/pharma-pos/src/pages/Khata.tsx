import { useState } from "react";
import { useGetCreditSales, useRecordCreditPayment, useGetCustomers } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { BookOpen, Search, DollarSign, User, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export default function Khata() {
  const { data: creditSales = [], isLoading, refetch } = useGetCreditSales();
  const { data: customers = [] } = useGetCustomers();
  const { mutate: recordPayment, isPending } = useRecordCreditPayment();

  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filtered = creditSales.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.invoiceNumber?.toLowerCase().includes(q) || s.customerName?.toLowerCase().includes(q);
  });

  const totalOutstanding = creditSales.reduce((sum: number, s: any) => sum + parseFloat(s.creditAmount || "0"), 0);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handlePay = () => {
    if (!selectedSale || !payAmount || parseFloat(payAmount) <= 0) {
      toast({ title: "Enter valid amount", variant: "destructive" });
      return;
    }
    recordPayment({
      saleId: selectedSale.id,
      data: { amountPaid: parseFloat(payAmount), paymentMethod: payMethod, notes: payNotes || undefined }
    }, {
      onSuccess: () => {
        toast({ title: "Payment recorded!", description: `${formatPKR(parseFloat(payAmount))} received from ${selectedSale.customerName}` });
        setSelectedSale(null);
        setPayAmount("");
        setPayNotes("");
        refetch();
      },
      onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" })
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
              <p className="font-display font-bold text-2xl text-destructive">{formatPKR(totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><BookOpen className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Open Credit Entries</p>
              <p className="font-display font-bold text-2xl">{creditSales.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl"><User className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Customers with Khata</p>
              <p className="font-display font-bold text-2xl">{new Set(creditSales.map((s: any) => s.customerId).filter(Boolean)).size}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-2xl flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Khata Register
            </h2>
            <p className="text-muted-foreground text-sm">Credit sales and outstanding payments</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input className="pl-10" placeholder="Search by invoice or customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
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
                {filtered.map((sale: any) => (
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
                              {(sale.items || []).map((item: any, i: number) => (
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
          )}
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record Khata Payment</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-semibold">{selectedSale.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-semibold">{selectedSale.customerName || "Walk-in"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Bill</span><span className="font-bold">{formatPKR(parseFloat(selectedSale.totalAmount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid</span><span className="text-green-600 font-bold">{formatPKR(parseFloat(selectedSale.paidAmount))}</span></div>
                <div className="flex justify-between border-t border-dashed pt-2"><span className="font-semibold text-destructive">Outstanding</span><span className="font-bold text-destructive text-lg">{formatPKR(parseFloat(selectedSale.creditAmount || "0"))}</span></div>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Amount Receiving (PKR)</label>
                <Input
                  type="number"
                  className="h-12 font-bold text-lg"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="0"
                />
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
    </div>
  );
}
