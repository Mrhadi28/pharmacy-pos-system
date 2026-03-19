import { useGetPurchases } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Purchases() {
  const { data: purchases = [], isLoading } = useGetPurchases();

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 h-full flex flex-col">
      <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
        <div>
          <h2 className="font-display font-bold text-2xl">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm">Stock intake and supplier billing</p>
        </div>
        <Button disabled><Plus className="w-4 h-4 mr-2" /> New PO (Coming Soon)</Button>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow> : 
             purchases.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                   <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                   No purchase orders found
                 </TableCell>
               </TableRow>
             ) : purchases.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-semibold text-primary">{item.poNumber}</TableCell>
                <TableCell>{formatDate(item.createdAt)}</TableCell>
                <TableCell>{item.supplierName}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'received' ? 'secondary' : item.status === 'cancelled' ? 'destructive' : 'outline'}>
                    {item.status.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold">{formatPKR(item.totalAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
