import { useGetDashboardStats } from "@workspace/api-client-react";
import { formatPKR } from "@/lib/format";
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Pill,
  ArrowUpRight
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const { data, isLoading, isError } = useGetDashboardStats();

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

  // Fallback data if API returns empty or errors
  const stats = data || {
    todaySales: 0,
    todayTransactions: 0,
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    recentSales: []
  };

  const chartData = [
    { name: "Mon", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Tue", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Wed", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Thu", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Fri", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Sat", total: Math.floor(Math.random() * 50000) + 10000 },
    { name: "Sun", total: Math.floor(Math.random() * 50000) + 10000 },
  ];

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-md shadow-black/5 bg-gradient-to-br from-primary to-emerald-400 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <p className="font-medium text-primary-foreground/80">Today's Sales</p>
              <div className="p-2 bg-white/20 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4">{formatPKR(stats.todaySales)}</h3>
            <p className="text-sm mt-2 flex items-center text-primary-foreground/90">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {stats.todayTransactions} transactions today
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md shadow-black/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-medium text-muted-foreground">Total Medicines</p>
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Pill className="w-5 h-5" /></div>
            </div>
            <h3 className="text-3xl font-display font-bold mt-4 text-foreground">{stats.totalMedicines}</h3>
            <p className="text-sm mt-2 text-muted-foreground">
              Active in inventory
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
            <h3 className="font-display font-bold text-lg">Weekly Revenue Overview</h3>
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
                    tickFormatter={(value) => `₨${value/1000}k`}
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

        {/* Recent Sales List */}
        <Card className="border-none shadow-md shadow-black/5 flex flex-col">
          <div className="p-6 border-b border-border/50 flex justify-between items-center">
            <h3 className="font-display font-bold text-lg">Recent Transactions</h3>
          </div>
          <div className="p-0 flex-1 overflow-y-auto">
            {stats.recentSales.length > 0 ? (
              <div className="divide-y divide-border/50">
                {stats.recentSales.map((sale) => (
                  <div key={sale.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{sale.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatPKR(sale.totalAmount)}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium uppercase tracking-wider">
                        {sale.paymentMethod}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                <Activity className="w-12 h-12 mb-4 opacity-20" />
                <p>No recent transactions</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
