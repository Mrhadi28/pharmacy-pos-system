import { useState } from "react";
import { useGetSalesSummary, useGetTopMedicines, useGetSales } from "@workspace/api-client-react";
import type { Sale, TopMedicine } from "@workspace/api-client-react";
import { formatPKR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Package, Search, ReceiptText, Printer, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type PeriodFilter = "today" | "week" | "month" | "year";

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

function TransactionSlipModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const handlePrint = () => {
    const content = document.getElementById("tx-slip-print-area");
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
        .item-row { display: flex; justify-content: space-between; padding: 2px 0; }
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

        <div id="tx-slip-print-area" className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs space-y-2">
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
          {sale.tax > 0 && (
            <div className="flex justify-between text-gray-600"><span>Tax</span><span>+{formatPKR(sale.tax)}</span></div>
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
          {sale.paymentStatus === "partial" && (
            <div className="flex justify-between font-bold text-orange-600 text-sm">
              <span>Outstanding</span><span>{formatPKR(sale.creditAmount)}</span>
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

function getPaymentBadge(status: string, method: string) {
  if (status === "credit") return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Khata</Badge>;
  if (status === "partial") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>;
  return <Badge variant="secondary">{(method || "cash").toUpperCase()}</Badge>;
}

function downloadOverviewPDF(
  period: PeriodFilter,
  summary: { totalRevenue?: number; totalTransactions?: number; averageTransaction?: number; dailyBreakdown?: Array<{ date: string; revenue: number }> } | undefined,
  topMeds: TopMedicine[]
) {
  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) return;
  const periodLabel = PERIOD_LABELS[period];
  const dailyRows = (summary?.dailyBreakdown || []).map((d) => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${d.date}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">₨ ${Number(d.revenue).toLocaleString()}</td>
    </tr>`).join("");
  const topMedRows = topMeds.map((m) => `
    <tr>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;">${m.medicineName}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.quantitySold}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">₨ ${Number(m.revenue).toLocaleString()}</td>
    </tr>`).join("");
  win.document.write(`
    <html><head><title>Overview Report — ${periodLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin: 20px 0 8px; color: #374151; }
      .stats { display: flex; gap: 16px; margin-bottom: 20px; }
      .stat-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 18px; min-width: 140px; }
      .stat-label { font-size: 11px; color: #6b7280; }
      .stat-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
      th.right, td.right { text-align: right; }
      @media print { .no-print { display: none; } }
    </style></head>
    <body>
      <h1>Analytics Overview — ${periodLabel}</h1>
      <p style="color:#6b7280;font-size:12px;">Generated: ${new Date().toLocaleString("en-PK")}</p>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-label">Total Revenue</div>
          <div class="stat-value">₨ ${Number(summary?.totalRevenue || 0).toLocaleString()}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${summary?.totalTransactions || 0}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Avg Order Value</div>
          <div class="stat-value">₨ ${Number(summary?.averageTransaction || 0).toLocaleString()}</div>
        </div>
      </div>
      ${dailyRows ? `<h2>Daily Breakdown</h2>
      <table><thead><tr><th>Date</th><th class="right">Revenue</th></tr></thead>
      <tbody>${dailyRows}</tbody></table>` : ""}
      ${topMedRows ? `<h2>Top Selling Medicines</h2>
      <table><thead><tr><th>Medicine</th><th class="right">Qty Sold</th><th class="right">Revenue</th></tr></thead>
      <tbody>${topMedRows}</tbody></table>` : ""}
      <script>window.print(); window.onafterprint = function(){ window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

function downloadTransactionsPDF(sales: Sale[], startDate: string, endDate: string) {
  const win = window.open("", "_blank", "width=800,height=700");
  if (!win) return;
  const dateLabel = startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : "All dates";
  const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(String(s.paidAmount)) || 0), 0);
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
    <html><head><title>Transaction History</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th { background: #f3f4f6; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
      .right { text-align: right; }
      tfoot td { font-weight: bold; border-top: 2px solid #374151; padding: 6px 8px; }
      @media print { .no-print { display: none; } }
    </style></head>
    <body>
      <h1>Transaction History</h1>
      <p style="color:#6b7280;font-size:11px;">${dateLabel} &mdash; Generated: ${new Date().toLocaleString("en-PK")}</p>
      <p style="margin:8px 0;font-size:12px;">${sales.length} transactions &nbsp;&nbsp; <strong>Total Paid: ₨ ${totalRevenue.toLocaleString()}</strong></p>
      <table>
        <thead><tr>
          <th>Invoice</th><th>Date &amp; Time</th><th>Customer</th>
          <th class="right">Total</th><th class="right">Paid</th><th>Payment</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td colspan="4">Total (${sales.length} transactions)</td>
          <td class="right">₨ ${totalRevenue.toLocaleString()}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <script>window.print(); window.onafterprint = function(){ window.close(); }<\/script>
    </body></html>
  `);
  win.document.close();
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [txSearch, setTxSearch] = useState("");
  const [txStartDate, setTxStartDate] = useState("");
  const [txEndDate, setTxEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data: summary } = useGetSalesSummary({ period });
  const { data: topMeds = [] } = useGetTopMedicines({ period });
  const { data: allSales = [] } = useGetSales({
    startDate: txStartDate || undefined,
    endDate: txEndDate || undefined,
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

  const totalRevenue = filteredSales.reduce((sum: number, s: Sale) => sum + (parseFloat(String(s.paidAmount)) || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-3xl">Analytics & Reports</h2>
        <p className="text-muted-foreground">Comprehensive overview of pharmacy performance</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-lg data-[state=active]:shadow-sm">Transaction History</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:shadow-sm">Inventory Status</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Period filter buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-muted-foreground mr-1">Period:</span>
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
                  period === p
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => downloadOverviewPDF(period, summary, topMeds as TopMedicine[])}
            >
              <Download className="w-4 h-4 mr-1.5" /> Download PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-display font-bold text-primary">{formatPKR(summary?.totalRevenue || 0)}</div></CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-display font-bold">{summary?.totalTransactions || 0}</div></CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Average Order Value</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-display font-bold text-foreground/80">{formatPKR(summary?.averageTransaction || 0)}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg"><TrendingUp className="w-5 h-5 text-primary"/> Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.dailyBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                      <XAxis dataKey="date" tick={{fontSize: 12}} tickFormatter={(val: string) => val.split('-').pop() || val} />
                      <YAxis tickFormatter={(val: number) => `₨${val/1000}k`} tick={{fontSize: 12}} width={60} />
                      <Tooltip formatter={(value: number) => formatPKR(value)} cursor={{fill: 'hsl(var(--muted))'}} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg"><Package className="w-5 h-5 text-blue-500"/> Top Selling Medicines</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(topMeds as TopMedicine[]).map((med: TopMedicine, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{med.medicineName}</TableCell>
                        <TableCell className="text-right">{med.quantitySold}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatPKR(med.revenue)}</TableCell>
                      </TableRow>
                    ))}
                    {topMeds.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8">No data available</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Transaction History Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <CardTitle className="font-display text-xl flex items-center gap-2">
                  <ReceiptText className="w-5 h-5 text-primary" /> Transaction History
                </CardTitle>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-56">
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
                    className="h-9 w-36 bg-background"
                    value={txStartDate}
                    onChange={e => setTxStartDate(e.target.value)}
                    placeholder="From date"
                  />
                  <Input
                    type="date"
                    className="h-9 w-36 bg-background"
                    value={txEndDate}
                    onChange={e => setTxEndDate(e.target.value)}
                    placeholder="To date"
                  />
                  {(txSearch || txStartDate || txEndDate) && (
                    <Button size="sm" variant="outline" onClick={() => { setTxSearch(""); setTxStartDate(""); setTxEndDate(""); }}>
                      Clear
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadTransactionsPDF(filteredSales, txStartDate, txEndDate)}
                  >
                    <Download className="w-4 h-4 mr-1.5" /> Download PDF
                  </Button>
                </div>
              </div>
              {filteredSales.length > 0 && (
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-muted-foreground">{filteredSales.length} transactions</span>
                  <span className="font-semibold text-primary">Total: {formatPKR(totalRevenue)}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date & Time</TableHead>
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
                          {(txSearch || txStartDate || txEndDate) && <p className="text-xs mt-1">Try adjusting your filters</p>}
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
                            {new Date(sale.createdAt).toLocaleString("en-PK")}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-6">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="font-display text-xl">Inventory Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Visit the Medicines page for detailed inventory management.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Slip Modal */}
      {selectedSale && (
        <TransactionSlipModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
}
