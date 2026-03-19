import { useState } from "react";
import { useGetPurchases, useCreatePurchase, useReceivePurchase, useGetSuppliers, useGetMedicines } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { Package, Plus, Trash2, CheckCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface POItem {
  medicineId: number;
  medicineName: string;
  quantity: number;
  unitCost: number;
}

export default function Purchases() {
  const { data: purchases = [], isLoading, refetch } = useGetPurchases();
  const { data: suppliers = [] } = useGetSuppliers();
  const { data: medicines = [] } = useGetMedicines();
  const { mutate: createPurchase, isPending: isCreating } = useCreatePurchase();
  const { mutate: receivePurchase } = useReceivePurchase();

  const [showCreate, setShowCreate] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([]);
  const [medSearch, setMedSearch] = useState("");
  const [receivingId, setReceivingId] = useState<number | null>(null);

  const addMedicine = (med: any) => {
    if (items.find(i => i.medicineId === med.id)) {
      toast({ title: "Already added", description: `${med.name} is already in the PO` });
      return;
    }
    setItems(prev => [...prev, {
      medicineId: med.id,
      medicineName: med.name,
      quantity: 1,
      unitCost: parseFloat(med.purchasePrice || "0") || 0,
    }]);
    setMedSearch("");
  };

  const updateItem = (idx: number, field: keyof POItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: field === "quantity" || field === "unitCost" ? parseFloat(value) || 0 : value } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  const handleCreate = () => {
    if (!supplierId) { toast({ title: "Select a supplier", variant: "destructive" }); return; }
    if (items.length === 0) { toast({ title: "Add at least one medicine", variant: "destructive" }); return; }

    createPurchase({
      data: {
        supplierId: parseInt(supplierId),
        notes: notes || undefined,
        items: items.map(i => ({ medicineId: i.medicineId, quantity: i.quantity, unitCost: i.unitCost })),
        status: "pending",
      }
    }, {
      onSuccess: () => {
        toast({ title: "Purchase Order created!", description: "Status: Pending" });
        setShowCreate(false);
        setSupplierId("");
        setNotes("");
        setItems([]);
        refetch();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleReceive = (id: number) => {
    if (!confirm("Mark this purchase as received? This will automatically update stock quantities.")) return;
    setReceivingId(id);
    receivePurchase({ id }, {
      onSuccess: () => {
        toast({ title: "Stock updated!", description: "Purchase marked as received — inventory updated" });
        setReceivingId(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
        setReceivingId(null);
      }
    });
  };

  const filteredMeds = medicines.filter((m: any) =>
    !medSearch || m.name.toLowerCase().includes(medSearch.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 flex flex-col">
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
          <div>
            <h2 className="font-display font-bold text-2xl">Purchase Orders</h2>
            <p className="text-muted-foreground text-sm">Stock intake from suppliers</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Purchase Order
          </Button>
        </div>

        <div className="overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    No purchase orders yet
                  </TableCell>
                </TableRow>
              ) : purchases.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold text-primary">{item.poNumber}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(item.createdAt)}</TableCell>
                  <TableCell>{item.supplierName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{item.items?.length || 0} items</TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'received' ? 'secondary' : item.status === 'cancelled' ? 'destructive' : 'outline'}>
                      {item.status === 'received' ? '✓ Received' : item.status === 'cancelled' ? 'Cancelled' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatPKR(parseFloat(item.totalAmount))}</TableCell>
                  <TableCell className="text-right">
                    {item.status === "pending" && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={receivingId === item.id}
                        onClick={() => handleReceive(item.id)}
                      >
                        {receivingId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        )}
                        Receive Stock
                      </Button>
                    )}
                    {item.status === "received" && (
                      <span className="text-xs text-green-600 font-semibold">Stock Updated</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create PO Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">New Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Supplier *</label>
                <select
                  className="w-full border border-border rounded-xl px-3 h-10 text-sm bg-background"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes</label>
                <Input placeholder="Any notes..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Add Medicines</label>
              <div className="relative">
                <Input
                  placeholder="Search medicines to add..."
                  value={medSearch}
                  onChange={e => setMedSearch(e.target.value)}
                />
                {medSearch && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredMeds.map((m: any) => (
                      <button
                        key={m.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted text-sm flex justify-between items-center"
                        onClick={() => addMedicine(m)}
                      >
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">{m.stockQuantity} {m.unit} in stock</span>
                      </button>
                    ))}
                    {filteredMeds.length === 0 && <div className="px-4 py-3 text-sm text-muted-foreground">No medicines found</div>}
                  </div>
                )}
              </div>
            </div>

            {items.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Medicine</th>
                      <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Qty</th>
                      <th className="text-center px-4 py-2 font-semibold text-muted-foreground">Unit Cost (₨)</th>
                      <th className="text-right px-4 py-2 font-semibold text-muted-foreground">Total</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 font-medium">{item.medicineName}</td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="1"
                            className="w-20 h-8 text-center text-sm"
                            value={item.quantity}
                            onChange={e => updateItem(idx, "quantity", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number" min="0"
                            className="w-24 h-8 text-center text-sm"
                            value={item.unitCost}
                            onChange={e => updateItem(idx, "unitCost", e.target.value)}
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{formatPKR(item.quantity * item.unitCost)}</td>
                        <td className="px-2 py-2">
                          <button className="text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 font-bold text-right">Grand Total:</td>
                      <td className="px-4 py-2 text-right font-bold text-primary text-base">{formatPKR(totalAmount)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? "Creating..." : "Create PO"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
