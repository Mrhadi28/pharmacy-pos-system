import { useState } from "react";
import { useGetMedicines, useCreateMedicine, useUpdateMedicine, useDeleteMedicine, useGetCategories, useGetSuppliers } from "@workspace/api-client-react";
import type { Medicine, Category, Supplier } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { 
  Plus, Search, Edit, Trash2, AlertTriangle, Clock, Pill, ShieldCheck, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  genericName: z.string().optional(),
  manufacturer: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  supplierId: z.coerce.number().optional(),
  salePrice: z.coerce.number().min(0),
  purchasePrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().min(0),
  minStockLevel: z.coerce.number().min(0),
  unit: z.string().min(1, "Unit is required"),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  requiresPrescription: z.boolean().default(false),
});

function getStockStatus(med: Medicine) {
  if (med.stockQuantity <= 0) return { label: "Out of Stock", color: "destructive" as const, bg: "bg-red-50 border-red-200 text-red-700" };
  if (med.stockQuantity <= med.minStockLevel) return { label: "Low Stock", color: "outline" as const, bg: "bg-amber-50 border-amber-200 text-amber-700" };
  return { label: "In Stock", color: "secondary" as const, bg: "bg-green-50 border-green-200 text-green-700" };
}

function getExpiryStatus(expiryDate?: string | null) {
  if (!expiryDate) return null;
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const thirtyStr = thirtyDaysOut.toISOString().split("T")[0];
  if (expiryDate < today) return { label: "Expired", cls: "text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded-md text-xs" };
  if (expiryDate <= thirtyStr) return { label: "Expiring Soon", cls: "text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md text-xs" };
  return null;
}

export default function Medicines() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "expired">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: medicines = [], isLoading } = useGetMedicines();
  const { data: categories = [] } = useGetCategories();
  const { data: suppliers = [] } = useGetSuppliers();
  const createMut = useCreateMedicine();
  const updateMut = useUpdateMedicine();
  const deleteMut = useDeleteMedicine();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      genericName: "",
      manufacturer: "",
      salePrice: 0,
      purchasePrice: 0,
      stockQuantity: 0,
      minStockLevel: 10,
      unit: "Tablets",
      requiresPrescription: false,
    }
  });

  const openAdd = () => {
    setEditingMedicine(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEdit = (med: Medicine) => {
    setEditingMedicine(med);
    form.reset({
      name: med.name,
      genericName: med.genericName || "",
      manufacturer: med.manufacturer || "",
      categoryId: med.categoryId || undefined,
      supplierId: med.supplierId || undefined,
      salePrice: med.salePrice,
      purchasePrice: med.purchasePrice || 0,
      stockQuantity: med.stockQuantity,
      minStockLevel: med.minStockLevel,
      unit: med.unit,
      expiryDate: med.expiryDate ? String(med.expiryDate) : "",
      batchNumber: med.batchNumber || "",
      barcode: med.barcode || "",
      description: med.description || "",
      requiresPrescription: med.requiresPrescription || false,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmittingForm) return;
    setIsSubmittingForm(true);
    const payload = {
      ...values,
      categoryId: values.categoryId || undefined,
      supplierId: values.supplierId || undefined,
      expiryDate: values.expiryDate || undefined,
      batchNumber: values.batchNumber || undefined,
      barcode: values.barcode || undefined,
      description: values.description || undefined,
    };

    try {
      if (editingMedicine) {
        await updateMut.mutateAsync({ id: editingMedicine.id, data: payload });
        toast({ title: "Medicine updated successfully" });
      } else {
        await createMut.mutateAsync({ data: payload });
        toast({ title: "Medicine added successfully" });
      }
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
    } catch (e: any) {
      const details = e?.response?.data?.details;
      const message = Array.isArray(details) && details.length > 0 ? details.join(", ") : (e?.message ?? "Could not save medicine");
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this medicine?")) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Medicine deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
        }
      });
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = (medicines as Medicine[]).filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
      (m.genericName && m.genericName.toLowerCase().includes(search.toLowerCase())) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(search.toLowerCase()));
    
    if (filterStatus === "low") return matchSearch && m.stockQuantity <= m.minStockLevel;
    if (filterStatus === "expired") return matchSearch && m.expiryDate && m.expiryDate <= today;
    return matchSearch;
  });

  const lowStockCount = (medicines as Medicine[]).filter(m => m.stockQuantity <= m.minStockLevel).length;
  const expiredCount = (medicines as Medicine[]).filter(m => m.expiryDate && m.expiryDate <= today).length;

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Package className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Items</p>
            <p className="font-display font-bold text-xl">{medicines.length}</p>
          </div>
        </div>
        <div
          className={`bg-card border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all ${filterStatus === "low" ? "border-amber-400 bg-amber-50" : "border-border hover:border-amber-300"}`}
          onClick={() => setFilterStatus(filterStatus === "low" ? "all" : "low")}
        >
          <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Low Stock</p>
            <p className="font-display font-bold text-xl text-amber-600">{lowStockCount}</p>
          </div>
        </div>
        <div
          className={`bg-card border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all ${filterStatus === "expired" ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/40"}`}
          onClick={() => setFilterStatus(filterStatus === "expired" ? "all" : "expired")}
        >
          <div className="p-2 bg-destructive/10 rounded-lg"><Clock className="w-5 h-5 text-destructive" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Expired</p>
            <p className="font-display font-bold text-xl text-destructive">{expiredCount}</p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 overflow-hidden flex flex-col flex-1">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-muted/10">
          <div>
            <h2 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <Pill className="w-6 h-6 text-primary" /> Medicines Inventory
            </h2>
            <p className="text-sm text-muted-foreground">
              {filterStatus !== "all" ? `Showing ${filterStatus === "low" ? "low stock" : "expired"} items` : "All medicines and stock levels"}
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search by name, generic, manufacturer..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAdd} className="shadow-md shadow-primary/20 whitespace-nowrap">
              <Plus className="w-4 h-4 mr-2" /> Add Medicine
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading inventory...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Pill className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold">No medicines found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-0 divide-y divide-border">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground sticky top-0 z-10">
                <div className="col-span-3">Medicine</div>
                <div className="col-span-2">Formula / Category</div>
                <div className="col-span-2">Manufacturer</div>
                <div className="col-span-1 text-right">Buy</div>
                <div className="col-span-1 text-right">Sell</div>
                <div className="col-span-1 text-center">Stock</div>
                <div className="col-span-1">Expiry</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {filtered.map((med) => {
                const stock = getStockStatus(med);
                const expiry = getExpiryStatus(med.expiryDate);
                return (
                  <div key={med.id} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-muted/30 transition-colors group">
                    {/* Medicine Name */}
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{med.name}</span>
                        {med.requiresPrescription && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] border border-blue-300 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                            <ShieldCheck className="w-2.5 h-2.5" /> Rx
                          </span>
                        )}
                      </div>
                      {med.batchNumber && <p className="text-[10px] text-muted-foreground mt-0.5">Batch: {med.batchNumber}</p>}
                    </div>

                    {/* Generic / Category */}
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm text-foreground truncate">{med.genericName || <span className="text-muted-foreground italic text-xs">—</span>}</p>
                      {med.categoryName && <p className="text-[10px] text-muted-foreground mt-0.5">{med.categoryName}</p>}
                    </div>

                    {/* Manufacturer */}
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm text-muted-foreground truncate">{med.manufacturer || "—"}</p>
                    </div>

                    {/* Purchase Price */}
                    <div className="col-span-1 text-right">
                      <span className="text-xs text-muted-foreground">{med.purchasePrice ? formatPKR(med.purchasePrice) : "—"}</span>
                    </div>

                    {/* Sale Price */}
                    <div className="col-span-1 text-right">
                      <span className="font-bold text-primary text-sm">{formatPKR(med.salePrice)}</span>
                    </div>

                    {/* Stock */}
                    <div className="col-span-1 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border ${stock.bg}`}>
                        {med.stockQuantity} {med.unit}
                      </span>
                    </div>

                    {/* Expiry */}
                    <div className="col-span-1">
                      {med.expiryDate ? (
                        <div>
                          <span className="text-xs text-muted-foreground">{med.expiryDate}</span>
                          {expiry && <div className={expiry.cls + " mt-0.5"}>{expiry.label}</div>}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(med)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(med.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingMedicine ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Brand Name *</FormLabel><FormControl><Input {...field} placeholder="e.g. Panadol" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="genericName" render={({ field }) => (
                  <FormItem><FormLabel>Generic Formula</FormLabel><FormControl><Input {...field} placeholder="e.g. Paracetamol 500mg" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input {...field} placeholder="e.g. GSK" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel>Unit Type</FormLabel><FormControl>
                    <select {...field} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                      <option>Tablets</option>
                      <option>Capsules</option>
                      <option>Syrup (ml)</option>
                      <option>Injection</option>
                      <option>Cream (g)</option>
                      <option>Drops</option>
                      <option>Sachet</option>
                      <option>Inhaler</option>
                      <option>Patch</option>
                      <option>Other</option>
                    </select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl>
                    <select {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                      <option value="">-- Select Category --</option>
                      {(categories as Category[]).map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="supplierId" render={({ field }) => (
                  <FormItem><FormLabel>Supplier</FormLabel><FormControl>
                    <select {...field} value={field.value || ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} className="w-full border border-input rounded-md px-3 py-2 bg-background text-sm">
                      <option value="">-- Select Supplier --</option>
                      {(suppliers as Supplier[]).map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                  <FormItem><FormLabel>Purchase Price (PKR)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salePrice" render={({ field }) => (
                  <FormItem><FormLabel>Sale Price (PKR) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stockQuantity" render={({ field }) => (
                  <FormItem><FormLabel>Current Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="minStockLevel" render={({ field }) => (
                  <FormItem><FormLabel>Low Stock Alert At</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="batchNumber" render={({ field }) => (
                  <FormItem><FormLabel>Batch Number</FormLabel><FormControl><Input {...field} placeholder="e.g. BT2024001" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem><FormLabel>Barcode</FormLabel><FormControl><Input {...field} placeholder="Barcode / SKU" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="col-span-2">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description / Notes</FormLabel><FormControl><Input {...field} placeholder="Optional description..." /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="col-span-2">
                  <FormField control={form.control} name="requiresPrescription" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <input
                          type="checkbox"
                          id="requiresPrescription"
                          checked={field.value}
                          onChange={field.onChange}
                          className="w-4 h-4 rounded"
                        />
                        <div>
                          <FormLabel htmlFor="requiresPrescription" className="cursor-pointer font-semibold text-sm">
                            Requires Prescription (Rx)
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">This medicine requires a doctor's prescription</p>
                        </div>
                      </div>
                    </FormItem>
                  )} />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmittingForm || createMut.isPending || updateMut.isPending}>
                  {isSubmittingForm || createMut.isPending || updateMut.isPending ? "Saving..." : "Save Medicine"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
