import { useState } from "react";
import { Link } from "wouter";
import { formatPKR } from "@/lib/format";
import { NEAR_LIVE_REFETCH_MS } from "@/lib/live-query";
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight,
  ReceiptText,
  Printer,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useQuery } from "@tanstack/react-query";

type RevenueFilter = "today" | "yesterday" | "week" | "month";

const FILTER_LABELS: Record<RevenueFilter, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This Week",
  month: "This Month",
};

interface SaleItem {
  id: number;
  medicineName: string;
  quantity: number;
  medicineUnit: string;
  unitPrice: string;
  total: string;
}

interface RecentSale {
  id: number;
  invoiceNumber: string;
  customerName: string | null;
  createdAt: string;
  totalAmount: string;
  paidAmount: string;
  creditAmount: string | null;
  discount: string | null;
  tax: string | null;
  changeAmount: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  items: SaleItem[];
}

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  avgOrderValue: number;
  totalMedicines: number;
  lowStockCount: number;
  expiringCount: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  totalCreditOutstanding: number;
  recentSales: RecentSale[];
  filter: string;
}

function useGetDashboardStats(filter: RevenueFilter, from?: string, to?: string) {
  return useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", filter, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
    refetchInterval: NEAR_LIVE_REFETCH_MS,
  });
}

function SlipModal({ sale, onClose }: { sale: RecentSale; onClose: () => void }) {
  const handlePrint = () => {
    const content = document.getElementById("slip-print-area");
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
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <ReceiptText className="w-5 h-5 text-primary" /> Transaction Slip
          </DialogTitle>
        </DialogHeader>

        <div id="slip-print-area" className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs space-y-2">
          <div className="text-center">
            <div className="font-bold text-base">Pharmacy POS</div>
          </div>
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="flex justify-between"><span className="text-gray-500">Invoice</span><span className="font-bold">{sale.invoiceNumber}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(sale.createdAt).toLocaleString("en-PK")}</span></div>
          {sale.customerName && <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-bold">{sale.customerName}</span></div>}
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="flex justify-between font-bold text-xs text-gray-500 mb-1">
            <span className="flex-1">Item</span>
            <span className="w-8 text-center">Qty</span>
            <span className="w-14 text-right">Price</span>
            <span className="w-16 text-right">Total</span>
          </div>
          {(sale.items || []).map((item: SaleItem, i: number) => (
            <div key={i} className="flex">
              <span className="flex-1 truncate">{item.medicineName}</span>
              <span className="w-8 text-center">{item.quantity}</span>
              <span className="w-14 text-right">{formatPKR(parseFloat(item.unitPrice))}</span>
              <span className="w-16 text-right font-semibold">{formatPKR(parseFloat(item.total))}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-400 my-1" />
          {parseFloat(sale.discount || "0") > 0 && (
            <div className="flex justify-between text-gray-600"><span>Discount</span><span>-{formatPKR(parseFloat(sale.discount!))}</span></div>
          )}
          {parseFloat(sale.tax || "0") > 0 && (
            <div className="flex justify-between text-gray-600"><span>Tax</span><span>+{formatPKR(parseFloat(sale.tax!))}</span></div>
          )}
          <div className="flex justify-between font-bold text-sm">
            <span>Total</span><span>{formatPKR(parseFloat(sale.totalAmount || "0"))}</span>
          </div>
          {sale.paymentStatus !== "credit" && (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Paid ({(sale.paymentMethod || "cash").toUpperCase()})</span>
                <span>{formatPKR(parseFloat(sale.paidAmount || "0"))}</span>
              </div>
              {parseFloat(sale.changeAmount || "0") > 0 && (
                <div className="flex justify-between text-gray-600"><span>Change</span><span>{formatPKR(parseFloat(sale.changeAmount!))}</span></div>
              )}
            </>
          )}
          {sale.paymentStatus === "credit" && (
            <div className="flex justify-between font-bold text-red-600 text-sm">
              <span>KHATA (Credit)</span><span>{formatPKR(parseFloat(sale.creditAmount || sale.totalAmount || "0"))}</span>
            </div>
          )}
          <div className="border-t border-dashed border-gray-400 my-1" />
          <div className="text-center text-gray-400 text-xs">Thank you for your purchase!<br />Please come again</div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>("today");
  const [selectedSale, setSelectedSale] = useState<RecentSale | null>(null);

  const { data, isLoading } = useGetDashboardStats(revenueFilter);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  const stats: DashboardStats = data ?? {
    todaySales: 0,
    todayTransactions: 0,
    avgOrderValue: 0,
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    totalCreditOutstanding: 0,
    recentSales: [],
    filter: "today",
  };

  const chartData = stats.recentSales.length > 0
    ? stats.recentSales.slice(0, 7).reverse().map((s: RecentSale) => ({
        name: new Date(s.createdAt).toLocaleDateString("en-PK", { weekday: "short" }),
        total: parseFloat(s.totalAmount || "0"),
      }))
    : [
        { name: "Mon", total: 0 },
        { name: "Tue", total: 0 },
        { name: "Wed", total: 0 },
        { name: "Thu", total: 0 },
        { name: "Fri", total: 0 },
        { name: "Sat", total: 0 },
        { name: "Sun", total: 0 },
      ];

  return (
    <div className="space-y-8">
      {/* Revenue Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-muted-foreground mr-1">Revenue Period:</span>
        {(Object.keys(FILTER_LABELS) as RevenueFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setRevenueFilter(f)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
              revenueFilter === f
                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-md shadow-black/5 bg-gradient-to-br from-primary to-emerald-400 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <p className="font-medium text-primary-foreground/80">{FILTER_LABELS[revenueFilter]} Sales</p>
              <div className="p-2 bg-white/20 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4">{formatPKR(stats.todaySales)}</h3>
            <p className="text-sm mt-2 flex items-center text-primary-foreground/90">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {stats.todayTransactions} transactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-black/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-muted-foreground">Avg Order Value</p>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Activity className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4 text-foreground">{formatPKR(stats.avgOrderValue || 0)}</h3>
            <p className="text-sm mt-2 text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-black/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-muted-foreground">Low Stock Alerts</p>
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4 text-amber-600">{stats.lowStockCount}</h3>
            <p className="text-sm mt-2 text-muted-foreground">
              Require immediate reorder
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-black/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-muted-foreground">Expiring Soon</p>
              <div className="p-2 bg-destructive/10 text-destructive rounded-lg"><Clock className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4 text-destructive">{stats.expiringCount}</h3>
            <p className="text-sm mt-2 text-muted-foreground">
              Within next 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <Card className="lg:col-span-2 border-none shadow-md shadow-black/5">
          <div className="p-6 border-b border-border/50 flex justify-between items-center">
            <h3 className="font-display font-bold text-lg">Revenue — {FILTER_LABELS[revenueFilter]}</h3>
            <div className="flex gap-2">
              <span className="flex items-center text-sm text-muted-foreground">
                <span className="w-3 h-3 rounded-full bg-primary mr-2"></span>
                Revenue
              </span>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value: number) => `₨${value/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [formatPKR(value), "Revenue"]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales List - Clickable */}
        <Card className="border-none shadow-md shadow-black/5 flex flex-col">
          <div className="p-6 border-b border-border/50 flex justify-between items-center">
            <h3 className="font-display font-bold text-lg">Recent Transactions</h3>
            <Link href="/transactions">
              <span className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer">
                View All Transactions <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-y-auto">
            {stats.recentSales.length > 0 ? (
              <div className="divide-y divide-border/50">
                {stats.recentSales.map((sale: RecentSale) => (
                  <button
                    key={sale.id}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left group"
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ReceiptText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString("en-PK")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatPKR(parseFloat(sale.totalAmount || "0"))}</p>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                        {sale.paymentMethod?.toUpperCase() ?? "CASH"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p>No recent transactions</p>
                <p className="text-xs mt-1">for {FILTER_LABELS[revenueFilter].toLowerCase()}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Transaction slip modal */}
      {selectedSale && (
        <SlipModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
}
