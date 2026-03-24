import { useState } from "react";
import { useGetSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, Supplier } from "@workspace/api-client-react";
import { Plus, Search, Edit, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().min(10, "Phone number required"),
  email: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  ntn: z.string().optional(),
});

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useGetSuppliers();
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", address: "", city: "", ntn: "" }
  });

  const openAdd = () => { setEditingItem(null); form.reset(); setIsDialogOpen(true); };
  const openEdit = (item: Supplier) => { 
    setEditingItem(item); 
    form.reset({ 
      name: item.name, contactPerson: item.contactPerson || "", phone: item.phone, 
      email: item.email || "", address: item.address || "", city: item.city || "", ntn: item.ntn || "" 
    }); 
    setIsDialogOpen(true); 
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmittingForm) return;
    setIsSubmittingForm(true);
    try {
      if (editingItem) {
        await updateMut.mutateAsync({ id: editingItem.id, data: values });
      } else {
        await createMut.mutateAsync({ data: values });
      }
      toast({ title: `Supplier ${editingItem ? "updated" : "added"} successfully` });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Request failed", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this supplier?")) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
        }
      });
    }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.phone.includes(search));

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 h-full flex flex-col">
      <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
        <div>
          <h2 className="font-display font-bold text-2xl">Distributors / Suppliers</h2>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Search..." className="w-64 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Supplier</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone / Email</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow> : 
             filtered.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center"><Truck className="w-4 h-4"/></div>
                  {item.name}
                </TableCell>
                <TableCell>{item.contactPerson || "-"}</TableCell>
                <TableCell>{item.phone}<br/><span className="text-xs text-muted-foreground">{item.email}</span></TableCell>
                <TableCell>{item.city || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="w-4 h-4"/></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive"><Trash2 className="w-4 h-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>{editingItem ? "Edit" : "Add"} Supplier</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({field}) => <FormItem className="col-span-2 mt-2"><FormLabel>Company Name</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <FormField control={form.control} name="contactPerson" render={({field}) => <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <FormField control={form.control} name="phone" render={({field}) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <FormField control={form.control} name="email" render={({field}) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <FormField control={form.control} name="city" render={({field}) => <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <FormField control={form.control} name="address" render={({field}) => <FormItem className="col-span-2"><FormLabel>Full Address</FormLabel><FormControl><Input {...field}/></FormControl></FormItem>} />
              <DialogFooter className="col-span-2 pt-4">
                <Button type="submit" className="w-full" disabled={isSubmittingForm || createMut.isPending || updateMut.isPending}>
                  {isSubmittingForm || createMut.isPending || updateMut.isPending ? "Saving..." : "Save Supplier"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
