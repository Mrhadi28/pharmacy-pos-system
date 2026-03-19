import { useState } from "react";
import { useGetMedicines, useCreateMedicine, useUpdateMedicine, useDeleteMedicine, Medicine } from "@workspace/api-client-react";
import { formatPKR, formatDate } from "@/lib/format";
import { 
  Plus, Search, Edit, Trash2, Filter, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  salePrice: z.coerce.number().min(0),
  purchasePrice: z.coerce.number().min(0),
  stockQuantity: z.coerce.number().min(0),
  minStockLevel: z.coerce.number().min(0),
  unit: z.string().min(1, "Unit is required"),
  expiryDate: z.string().optional(),
  requiresPrescription: z.boolean().default(false),
});

export default function Medicines() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  
  const queryClient = useQueryClient();
  const { data: medicines = [], isLoading } = useGetMedicines();
  const createMut = useCreateMedicine();
  const updateMut = useUpdateMedicine();
  const deleteMut = useDeleteMedicine();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      genericName: "",
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
      salePrice: med.salePrice,
      purchasePrice: med.purchasePrice || 0,
      stockQuantity: med.stockQuantity,
      minStockLevel: med.minStockLevel,
      unit: med.unit,
      expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : "",
      requiresPrescription: med.requiresPrescription || false,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (editingMedicine) {
      updateMut.mutate({ id: editingMedicine.id, data: values }, {
        onSuccess: () => {
          toast({ title: "Medicine updated successfully" });
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
        }
      });
    } else {
      createMut.mutate({ data: values }, {
        onSuccess: () => {
          toast({ title: "Medicine added successfully" });
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["/api/medicines"] });
        }
      });
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

  const filtered = medicines.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    (m.genericName && m.genericName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-muted/10">
        <div>
          <h2 className="font-display font-bold text-2xl text-foreground">Inventory List</h2>
          <p className="text-sm text-muted-foreground">Manage all medicines and stock levels</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search medicines..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={openAdd} className="shadow-md shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" /> Add Medicine
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Generic Name</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading inventory...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No medicines found</TableCell></TableRow>
            ) : (
              filtered.map((med) => (
                <TableRow key={med.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-foreground">
                    {med.name}
                    {med.requiresPrescription && <Badge variant="outline" className="ml-2 text-[10px]">Rx</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{med.genericName || "-"}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatPKR(med.salePrice)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={med.stockQuantity > med.minStockLevel ? "secondary" : med.stockQuantity > 0 ? "outline" : "destructive"} 
                           className={med.stockQuantity <= med.minStockLevel && med.stockQuantity > 0 ? "border-amber-500 text-amber-600 bg-amber-50" : ""}>
                      {med.stockQuantity} {med.unit}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(med.expiryDate)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(med)} className="hover:text-primary">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(med.id)} className="hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingMedicine ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Brand Name</FormLabel><FormControl><Input {...field} placeholder="e.g. Panadol" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="genericName" render={({ field }) => (
                  <FormItem><FormLabel>Generic Formula</FormLabel><FormControl><Input {...field} placeholder="e.g. Paracetamol" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                  <FormItem><FormLabel>Purchase Price (PKR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salePrice" render={({ field }) => (
                  <FormItem><FormLabel>Sale Price (PKR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stockQuantity" render={({ field }) => (
                  <FormItem><FormLabel>Current Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel>Unit Type</FormLabel><FormControl><Input {...field} placeholder="Tablets, Syrup, etc" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="minStockLevel" render={({ field }) => (
                  <FormItem><FormLabel>Low Stock Alert Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? "Saving..." : "Save Medicine"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
