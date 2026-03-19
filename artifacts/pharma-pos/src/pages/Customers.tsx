import { useState } from "react";
import { useGetCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, Customer } from "@workspace/api-client-react";
import { Plus, Search, Edit, Trash2, User } from "lucide-react";
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
import { formatPKR } from "@/lib/format";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Phone number required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

export default function Customers() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useGetCustomers();
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", email: "", address: "" }
  });

  const openAdd = () => { setEditingItem(null); form.reset(); setIsDialogOpen(true); };
  const openEdit = (item: Customer) => { 
    setEditingItem(item); 
    form.reset({ name: item.name, phone: item.phone, email: item.email || "", address: item.address || "" }); 
    setIsDialogOpen(true); 
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const action = editingItem 
      ? updateMut.mutateAsync({ id: editingItem.id, data: values })
      : createMut.mutateAsync({ data: values });

    action.then(() => {
      toast({ title: `Customer ${editingItem ? "updated" : "added"} successfully` });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    }).catch(e => toast({ title: "Error", description: e.message, variant: "destructive" }));
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this customer?")) {
      deleteMut.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Deleted" });
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        }
      });
    }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.phone.includes(search));

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 h-full flex flex-col">
      <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10">
        <div>
          <h2 className="font-display font-bold text-2xl">Customers</h2>
          <p className="text-muted-foreground text-sm">Manage client records and histories</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input placeholder="Search name or phone..." className="pl-9 w-64 bg-background" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" /> Add Customer</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Total Purchases</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow> : 
             filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow> :
             filtered.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><User className="w-4 h-4"/></div>
                  {item.name}
                </TableCell>
                <TableCell>{item.phone}<br/><span className="text-xs text-muted-foreground">{item.email}</span></TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate">{item.address || "-"}</TableCell>
                <TableCell className="text-right font-semibold">{formatPKR(item.totalPurchases)}</TableCell>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Edit" : "Add"} Customer</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({field}) => <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="phone" render={({field}) => <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="email" render={({field}) => <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <FormField control={form.control} name="address" render={({field}) => <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} />
              <DialogFooter><Button type="submit">Save Customer</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
