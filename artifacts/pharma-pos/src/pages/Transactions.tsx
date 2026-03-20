import { useState } from "react";
import { useGetSales } from "@workspace/api-client-react";
import type { Sale } from "@workspace/api-client-react";
import { formatPKR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReceiptText, Download, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Printer } from "lucide-react";

function getPaymentBadge(status: string, method: string) {
  if (status === "credit") return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Khata</Badge>;
  if (status === "partial") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>;
  return <Badge variant="secondary">{(method || "cash").toUpperCase()}</Badge>;
}

function TransactionSlipModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const handlePrint = () => {
    const content = document.getElementById("tx-slip-txpage-area");
    if (!content) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt - ${sale.invoiceNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #333; margin: 6px 0; }
        .bold { font-weight: bold; }
        .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${content.innerHTML}
      <script>window.print(); window.onafterprint = function(){ window.close(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <ReceiptText className="w-5 h-5 text-primary" /> Transaction Slip
          </DialogTitle>
        </DialogHeader>
        <div id="tx-slip-txpage-area" className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="text-center">
            <div className="font-bold text-base">PharmaPOS</div>
          </div>
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-bold">{sale.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(sale.createdAt).toLocaleString("en-PK")}</span></div>
          {sale.customerName && (
            <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold">{sale.customerName}</span></div>
          )}
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="flex justify-between font-bold text-xs text-gray-500 mb-1">
            <span className="flex-1">Item</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-14 text-right">Price</span>
            <span className="w-16 text-right">Total</span>
          </div>
          {(sale.items || []).map((item, i) => (
            <div key={i} className="flex">
              <span className="flex-1 truncate">{item.medicineName}</span>
              <span className="w-8 text-center">{item.quantity}</span>
              <span className="w-14 text-right">{formatPKR(item.unitPrice)}</span>
              <span className="w-16 text-right font-semibold">{formatPKR(item.total)}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-400 my-1" />
          {sale.discount > 0 && (
            <div className="flex justify-between text-gray-600"><span>Discount</span><span>-{formatPKR(sale.discount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL</span><span>{formatPKR(sale.totalAmount)}</span>
          </div>
          {sale.paymentStatus !== "credit" && (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Paid ({(sale.paymentMethod || "cash").toUpperCase()})</span>
                <span>{formatPKR(sale.paidAmount)}</span>
              </div>
              {sale.changeAmount > 0 && (
                <div className="flex justify-between text-gray-600"><span>Change</span><span>{formatPKR(sale.changeAmount)}</span></div>
              )}
            </>
          )}
          {sale.paymentStatus === "credit" && (
            <div className="flex justify-between font-bold text-red-600 text-sm">
              <span>KHATA (Credit)</span><span>{formatPKR(sale.creditAmount || sale.totalAmount)}</span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="text-center text-gray-400 text-xs">Thank you for your purchase!<br />Please come again</div>
        </div>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function downloadPDF(sales: Sale[], date: string) {
  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) return;
  const dateLabel = date || new Date().toISOString().split("T")[0];
  const total = sales.reduce((sum, s) => sum + (parseFloat(String(s.paidAmount)) || 0), 0);
  const rows = sales.map((s) => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${s.invoiceNumber}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${new Date(s.createdAt).toLocaleString("en-PK")}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${s.customerName || "Walk-in"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">₨ ${Number(s.totalAmount).toLocaleString()}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">₨ ${Number(s.paidAmount).toLocaleString()}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${s.paymentStatus === "credit" ? "Khata" : s.paymentStatus === "partial" ? "Partial" : (s.paymentMethod || "cash").toUpperCase()}</td>
    </tr>`).join("");
  win.document.write(`
    <html><head><title>Transactions — ${dateLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
      th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
      .right { text-align: right; }
      tfoot td { font-weight: bold; border-top: 2px solid #374151; padding: 6px 8px; }
      @media print { .no-print { display: none; } }
    </style></head>
    <body>
      <h1>Transactions — ${dateLabel}</h1>
      <p style="color:#6b7280;font-size:11px;">Generated: ${new Date().toLocaleString("en-PK")} &mdash; ${sales.length} transactions &mdash; <strong>Total Paid: ₨ ${total.toLocaleString()}</strong></p>
      <table>
        <thead><tr>
          <th>Invoice</th><th>Date &amp; Time</th><th>Customer</th>
          <th class="right">Total</th><th class="right">Paid</th><th>Payment</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="4">Total (${sales.length} transactions)</td>
          <td class="right">₨ ${total.toLocaleString()}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <script>window.print(); window.onafterprint = function(){ window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Transactions() {
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [txSearch, setTxSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data: allSales = [], isLoading } = useGetSales({
    startDate: selectedDate || undefined,
    endDate: selectedDate || undefined,
  });

  const sales = allSales as Sale[];

  const filteredSales = sales.filter((s: Sale) => {
    if (!txSearch) return true;
    const q = txSearch.toLowerCase();
    return (
      s.invoiceNumber?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q) ||
      s.paymentMethod?.toLowerCase().includes(q)
    );
  });

  const totalPaid = filteredSales.reduce((sum, s) => sum + (parseFloat(String(s.paidAmount)) || 0), 0);
  const totalRevenue = filteredSales.reduce((sum, s) => sum + (parseFloat(String(s.totalAmount)) || 0), 0);

  const isToday = selectedDate === getTodayDate();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-3xl">Transactions</h2>
        <p className="text-muted-foreground">Browse and export daily transaction records</p>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <ReceiptText className="w-5 h-5 text-primary" />
              {isToday ? "Today's Transactions" : `Transactions — ${selectedDate}`}
            </CardTitle>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search invoice, customer..."
                  className="pl-9 bg-background h-9"
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                />
              </div>
              <Input
                type="date"
                className="h-9 w-40 bg-background"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
              {!isToday && (
                <Button size="sm" variant="outline" onClick={() => { setSelectedDate(getTodayDate()); setTxSearch(""); }}>
                  Today
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadPDF(filteredSales, selectedDate)}
                disabled={filteredSales.length === 0}
              >
                <Download className="w-4 h-4 mr-1.5" /> Download PDF
              </Button>
            </div>
          </div>

          {filteredSales.length > 0 && (
            <div className="flex items-center gap-6 mt-3 text-sm flex-wrap">
              <span className="text-muted-foreground">{filteredSales.length} transactions</span>
              <span className="font-semibold text-primary">Total: {formatPKR(totalRevenue)}</span>
              <span className="text-green-600 font-medium">Paid: {formatPKR(totalPaid)}</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p>Loading transactions...</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p>No transactions found</p>
                        {!isToday && <p className="text-xs mt-1">No transactions on {selectedDate}</p>}
                        {txSearch && <p className="text-xs mt-1">Try adjusting your search</p>}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale: Sale) => (
                      <TableRow
                        key={sale.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => setSelectedSale(sale)}
                      >
                        <TableCell>
                          <span className="font-semibold text-primary hover:underline">{sale.invoiceNumber}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(sale.createdAt).toLocaleTimeString("en-PK")}
                        </TableCell>
                        <TableCell>
                          {sale.customerName ? (
                            <span className="font-medium">{sale.customerName}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-sm">Walk-in</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatPKR(sale.totalAmount)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{formatPKR(sale.paidAmount)}</TableCell>
                        <TableCell>{getPaymentBadge(sale.paymentStatus, sale.paymentMethod)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSale && (
        <TransactionSlipModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
}
