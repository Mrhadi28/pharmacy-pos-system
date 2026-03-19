import { useGetSalesSummary, useGetTopMedicines } from "@workspace/api-client-react";
import { formatPKR } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Package } from "lucide-react";

export default function Reports() {
  const { data: summary } = useGetSalesSummary({ period: 'month' });
  const { data: topMeds = [] } = useGetTopMedicines({ period: 'month' });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-3xl">Analytics & Reports</h2>
        <p className="text-muted-foreground">Comprehensive overview of pharmacy performance</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="sales" className="rounded-lg data-[state=active]:shadow-sm">Detailed Sales</TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:shadow-sm">Inventory Status</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (30 Days)</CardTitle></CardHeader>
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
            <Card className="shadow-sm border-border col-span-1 lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg"><TrendingUp className="w-5 h-5 text-primary"/> Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary?.dailyBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))"/>
                      <XAxis dataKey="date" tick={{fontSize: 12}} tickFormatter={(val) => val.split('-').pop() || val} />
                      <YAxis tickFormatter={(val) => `₨${val/1000}k`} tick={{fontSize: 12}} width={60} />
                      <Tooltip formatter={(value: number) => formatPKR(value)} cursor={{fill: 'hsl(var(--muted))'}} />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border col-span-1 lg:col-span-1">
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
                    {topMeds.map((med, i) => (
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
      </Tabs>
    </div>
  );
}
