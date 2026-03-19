import { useState, useMemo } from "react";
import { 
  useGetMedicines, 
  useCreateSale, 
  Medicine, 
  CreateSaleInputPaymentMethod 
} from "@workspace/api-client-react";
import { useCart } from "@/store/use-cart";
import { formatPKR } from "@/lib/format";
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  CreditCard, 
  Banknote,
  Smartphone,
  ReceiptText,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function POS() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);

  const { data: medicines = [], isLoading } = useGetMedicines({ isActive: true });
  const { mutate: createSale, isPending: isCheckingOut } = useCreateSale();
  
  const cart = useCart();

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => 
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.genericName && m.genericName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.barcode && m.barcode.includes(searchTerm))
    );
  }, [medicines, searchTerm]);

  const handleCheckout = () => {
    if (cart.items.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }

    if (cart.paidAmount < cart.getGrandTotal()) {
      toast({ title: "Insufficient paid amount", variant: "destructive" });
      return;
    }

    createSale({
      data: {
        items: cart.items.map(i => ({
          medicineId: i.medicine.id,
          quantity: i.quantity,
          discount: i.discount
        })),
        paidAmount: cart.paidAmount,
        paymentMethod: cart.paymentMethod,
        discount: cart.globalDiscount,
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Sale completed successfully!" });
        setLastSaleId(data.invoiceNumber);
        setShowReceipt(true);
        cart.clearCart();
      },
      onError: (err) => {
        toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
      
      {/* LEFT: Medicine Selection */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-card rounded-2xl border border-border shadow-md shadow-black/5">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              autoFocus
              className="w-full pl-10 py-6 text-lg rounded-xl border-border bg-background focus-visible:ring-primary shadow-inner"
              placeholder="Search medicines by name, generic, or barcode (F1)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : filteredMedicines.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
               <PillIcon className="w-16 h-16 mb-4 opacity-20" />
               <p className="text-lg">No medicines found</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 pb-10">
              {filteredMedicines.map(med => (
                <Card 
                  key={med.id} 
                  className={`
                    cursor-pointer transition-all duration-200 border-border hover:border-primary hover:shadow-lg
                    ${med.stockQuantity <= 0 ? 'opacity-50 grayscale hover:border-destructive' : ''}
                  `}
                  onClick={() => {
                    if (med.stockQuantity > 0) {
                      cart.addItem(med);
                      toast({ title: `Added ${med.name}`, duration: 1000 });
                    } else {
                      toast({ title: "Out of stock!", variant: "destructive" });
                    }
                  }}
                >
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-foreground leading-tight line-clamp-2">{med.name}</h4>
                      <Badge variant={med.stockQuantity > med.minStockLevel ? "default" : med.stockQuantity > 0 ? "secondary" : "destructive"}>
                        {med.stockQuantity} {med.unit}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-auto">{med.genericName || "N/A"}</p>
                    <div className="mt-4 flex justify-between items-end">
                      <span className="font-display font-bold text-lg text-primary">{formatPKR(med.salePrice)}</span>
                      {med.requiresPrescription && <Badge variant="outline" className="text-[10px]">Rx</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="w-full lg:w-[450px] flex flex-col h-full bg-card rounded-2xl border border-border shadow-xl shadow-black/10 overflow-hidden">
        <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center">
          <h2 className="font-display font-bold text-xl flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Current Sale
          </h2>
          <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">
            {cart.items.length} items
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-0 bg-muted/10">
          {cart.items.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <ShoppingCart className="w-16 h-16 mb-4" />
              <p>Cart is empty</p>
              <p className="text-sm">Click items to add</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.items.map(item => (
                <div key={item.medicine.id} className="p-4 bg-background hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between font-semibold mb-2">
                    <span className="line-clamp-1 pr-2">{item.medicine.name}</span>
                    <span>{formatPKR(item.medicine.salePrice * item.quantity)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                      <Button 
                        variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                        onClick={() => cart.updateQuantity(item.medicine.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <Button 
                        variant="ghost" size="icon" className="h-7 w-7 rounded-md"
                        onClick={() => cart.updateQuantity(item.medicine.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => cart.removeItem(item.medicine.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Checkout Panel */}
        <div className="p-5 border-t border-border bg-background shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] z-10">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Subtotal</span>
              <span>{formatPKR(cart.getSubtotal())}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Discount</span>
              <span className="text-destructive">-{formatPKR(cart.getTotalDiscount())}</span>
            </div>
            <div className="flex justify-between font-display font-bold text-2xl pt-2 border-t border-border border-dashed">
              <span>Total</span>
              <span className="text-primary">{formatPKR(cart.getGrandTotal())}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'jazzcash', icon: Smartphone, label: 'JazzCash' },
                { id: 'easypaisa', icon: Smartphone, label: 'EasyPaisa' }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => cart.setPaymentMethod(method.id as any)}
                  className={`
                    flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all
                    ${cart.paymentMethod === method.id 
                      ? 'border-primary bg-primary/10 text-primary shadow-sm' 
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  <method.icon className="w-5 h-5 mb-1" />
                  {method.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Paid Amount (PKR)</label>
                <Input 
                  type="number" 
                  className="font-bold text-lg h-12"
                  value={cart.paidAmount || ''}
                  onChange={(e) => cart.setPaidAmount(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Change</label>
                <div className={`
                  flex items-center px-4 h-12 rounded-md font-bold text-lg border
                  ${cart.getChange() < 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted border-transparent text-foreground'}
                `}>
                  {formatPKR(cart.getChange())}
                </div>
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25 rounded-xl"
              disabled={cart.items.length === 0 || cart.paidAmount < cart.getGrandTotal() || isCheckingOut}
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Processing..." : "Checkout (F2)"}
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-2xl flex flex-col items-center gap-2">
              <ReceiptText className="w-12 h-12 text-primary" />
              Payment Successful
            </DialogTitle>
          </DialogHeader>
          
          <div className="bg-muted p-4 rounded-xl text-center space-y-2 mt-4 font-mono text-sm">
            <p className="font-bold text-lg mb-4">PharmaPOS Pakistan</p>
            <p>Invoice: #{lastSaleId}</p>
            <p>Date: {new Date().toLocaleString()}</p>
            <div className="border-t border-b border-dashed border-border py-4 my-4">
               <p>Thanks for your purchase!</p>
            </div>
          </div>

          <DialogFooter className="sm:justify-center mt-6">
            <Button onClick={() => setShowReceipt(false)} className="w-full">
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple internal icon for fallback
function PillIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>;
}
