import { useState, useMemo, useRef } from "react";
import {
  useGetMedicines,
  useCreateSale,
  useGetCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  CreateSaleInputPaymentMethod
} from "@workspace/api-client-react";
import type { Medicine, Customer, Sale, SaleItem } from "@workspace/api-client-react";
import { useCart } from "@/store/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { formatPKR } from "@/lib/format";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote,
  Smartphone, ReceiptText, Printer, User, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { NEAR_LIVE_REFETCH_MS } from "@/lib/live-query";

interface CompletedSale extends Sale {
  pharmacyName?: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  cashierName?: string;
  customerPhone?: string;
}

function formatReceiptAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export default function POS() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Inline customer capture
  const [inlineCustomerName, setInlineCustomerName] = useState("");
  const [inlineCustomerPhone, setInlineCustomerPhone] = useState("");

  const receiptRef = useRef<HTMLDivElement>(null);

  const { pharmacy, user } = useAuth();
  const { data: medicines = [], isLoading } = useGetMedicines(undefined, {
    query: { refetchInterval: NEAR_LIVE_REFETCH_MS },
  });
  const { data: customers = [], refetch: refetchCustomers } = useGetCustomers(undefined, {
    query: { refetchInterval: NEAR_LIVE_REFETCH_MS },
  });
  const { mutate: createSale, isPending: isCheckingOut } = useCreateSale();
  const { mutate: createCustomer } = useCreateCustomer();
  const { mutate: updateCustomer } = useUpdateCustomer();
  const queryClient = useQueryClient();

  const cart = useCart();

  const typedMedicines = medicines as Medicine[];
  const typedCustomers = customers as Customer[];

  const filteredMedicines = useMemo(() => {
    const activeMeds = typedMedicines.filter((m: Medicine) => (m as Medicine & { isActive?: boolean }).isActive !== false);
    if (!searchTerm) return activeMeds;
    const q = searchTerm.toLowerCase();
    return activeMeds.filter((m: Medicine) =>
      m.name.toLowerCase().includes(q) ||
      (m.genericName && m.genericName.toLowerCase().includes(q)) ||
      ((m as Medicine & { barcode?: string }).barcode && (m as Medicine & { barcode?: string }).barcode!.includes(searchTerm))
    );
  }, [typedMedicines, searchTerm]);

  const isCredit = cart.paymentMethod === "credit";

  const findOrCreateCustomer = async (): Promise<{ id: number; phone: string } | null> => {
    if (selectedCustomerId) {
      const cust = typedCustomers.find((c: Customer) => c.id === selectedCustomerId);
      return cust ? { id: cust.id, phone: cust.phone } : { id: selectedCustomerId, phone: "" };
    }

    if (!inlineCustomerName && !inlineCustomerPhone) return null;

    if (!inlineCustomerPhone || inlineCustomerPhone.length < 7) {
      toast({ title: "Phone number required for customer capture", variant: "destructive" });
      return null;
    }

    // Check if customer already exists by phone
    const normalizedPhone = inlineCustomerPhone.replace(/\s/g, "");
    const existingCustomer = typedCustomers.find((c: Customer) =>
      c.phone.replace(/\s/g, "") === normalizedPhone
    );

    if (existingCustomer) {
      // If the user provided a different name, update the customer record
      if (inlineCustomerName && inlineCustomerName.trim() !== existingCustomer.name.trim()) {
        updateCustomer(
          { id: existingCustomer.id, data: { name: inlineCustomerName } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            },
          }
        );
      }
      return { id: existingCustomer.id, phone: existingCustomer.phone };
    }

    // Create new customer
    return new Promise((resolve) => {
      createCustomer({
        data: {
          name: inlineCustomerName || `Customer (${inlineCustomerPhone})`,
          phone: inlineCustomerPhone,
        }
      }, {
        onSuccess: (newCust: Customer) => {
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          toast({ title: "New customer added!", description: `${newCust.name} saved to customers list` });
          resolve({ id: newCust.id, phone: newCust.phone });
        },
        onError: () => resolve(null),
      });
    });
  };

  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    if (!isCredit && cart.paidAmount <= 0) {
      toast({ title: "Enter paid amount", variant: "destructive" });
      return;
    }
    if (isCredit && !selectedCustomerId && !inlineCustomerName) {
      toast({ title: "Customer required for Khata sale", variant: "destructive" });
      return;
    }

    const customerResult = await findOrCreateCustomer();

    if (isCredit && !customerResult) {
      toast({ title: "Please select or enter a customer for Khata sale", variant: "destructive" });
      return;
    }

    // Capture phone for the receipt before clearing state
    const capturedPhone = customerResult?.phone || inlineCustomerPhone || "";

    createSale({
      data: {
        customerId: customerResult?.id ?? undefined,
        items: cart.items.map(i => ({
          medicineId: i.medicine.id,
          quantity: i.quantity,
          discount: i.discount
        })),
        paidAmount: isCredit ? 0 : cart.paidAmount,
        paymentMethod: cart.paymentMethod as CreateSaleInputPaymentMethod,
        discount: cart.globalDiscount,
      }
    }, {
      onSuccess: (data: Sale) => {
        setCompletedSale({
          ...data,
          pharmacyName: pharmacy?.name,
          pharmacyPhone: pharmacy?.phone,
          pharmacyAddress: pharmacy?.address,
          cashierName: user?.fullName,
          customerPhone: capturedPhone,
        });
        setShowReceipt(true);
        cart.clearCart();
        setSelectedCustomerId(null);
        setInlineCustomerName("");
        setInlineCustomerPhone("");
        toast({ title: isCredit ? "Khata sale recorded!" : "Sale completed!" });
      },
      onError: (err: Error) => {
        toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) { toast({ title: "Allow popups to print", variant: "destructive" }); return; }
    win.document.write(`
      <html>
      <head>
        <title>Receipt - ${completedSale?.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #111827; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 16px; font-weight: bold; }
          .subtitle { font-size: 11px; color: #555; }
          .divider { border-top: 1px dashed #333; margin: 6px 0; }
          .meta-row { display: flex; justify-content: space-between; margin: 2px 0; gap: 8px; }
          .meta-row span:last-child { text-align: right; font-weight: 700; }
          .items-head, .item-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 34px 70px 74px;
            gap: 4px;
            align-items: center;
          }
          .items-head { color: #6b7280; font-weight: 700; margin-bottom: 2px; }
          .item-row { padding: 2px 0; }
          .item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .qty-col { text-align: center; }
          .num-col { text-align: right; font-variant-numeric: tabular-nums; }
          .summary-row { display: flex; justify-content: space-between; margin: 2px 0; font-variant-numeric: tabular-nums; }
          .summary-row span:last-child { text-align: right; }
          .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; padding: 4px 0; }
          .footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>window.print(); window.onafterprint = function(){ window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const selectedCustomer = selectedCustomerId ? typedCustomers.find((c: Customer) => c.id === selectedCustomerId) : null;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">

      {/* LEFT: Medicine Selection */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-card rounded-2xl border border-border shadow-md shadow-black/5">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              autoFocus
              className="w-full pl-10 py-6 text-lg rounded-xl border-border bg-background focus-visible:ring-primary shadow-inner"
              placeholder="Search medicines by name, generic, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : filteredMedicines.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <PillIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">No medicines found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pb-10">
              {filteredMedicines.map((med: Medicine) => (
                <Card
                  key={med.id}
                  className={`cursor-pointer transition-all duration-200 border-border hover:border-primary hover:shadow-lg
                    ${med.stockQuantity <= 0 ? 'opacity-50 grayscale' : ''}`}
                  onClick={() => {
                    if (med.stockQuantity > 0) {
                      cart.addItem(med);
                    } else {
                      toast({ title: "Out of stock!", variant: "destructive" });
                    }
                  }}
                >
                  <div className="p-3 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-foreground leading-tight line-clamp-2 text-sm">{med.name}</h4>
                      <Badge variant={med.stockQuantity > med.minStockLevel ? "default" : med.stockQuantity > 0 ? "secondary" : "destructive"} className="text-xs ml-1 flex-shrink-0">
                        {med.stockQuantity} {med.unit}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{med.genericName || med.manufacturer || ""}</p>
                    <div className="mt-2 flex justify-between items-end">
                      <span className="font-display font-bold text-base text-primary">{formatPKR(med.salePrice)}</span>
                      {med.requiresPrescription && <Badge variant="outline" className="text-[10px] px-1">Rx</Badge>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT: Cart & Checkout */}
      <div className="w-full lg:w-[420px] flex flex-col h-full bg-card rounded-2xl border border-border shadow-xl shadow-black/10 overflow-hidden">
        <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Current Sale
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-none">
              {cart.items.length} items
            </Badge>
          </div>
        </div>

        {/* Customer Selection */}
        <div className="px-4 py-2 bg-muted/30 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <select
              className="flex-1 bg-transparent text-sm text-foreground border-none outline-none py-1"
              value={selectedCustomerId ?? ""}
              onChange={e => {
                const val = e.target.value;
                setSelectedCustomerId(val ? parseInt(val) : null);
                if (val) {
                  setInlineCustomerName("");
                  setInlineCustomerPhone("");
                }
              }}
            >
              <option value="">Walk-in Customer</option>
              {typedCustomers.map((c: Customer) => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>

          {/* Inline customer capture fields — always visible for walk-in customers */}
          {!selectedCustomerId && (
            <div className="space-y-2 pb-1">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Customer name"
                  className="h-8 text-xs"
                  value={inlineCustomerName}
                  onChange={e => setInlineCustomerName(e.target.value)}
                />
                <Input
                  placeholder="Phone number"
                  className="h-8 text-xs"
                  value={inlineCustomerPhone}
                  onChange={e => setInlineCustomerPhone(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Customer will be auto-saved when sale is completed
              </p>
            </div>
          )}

          {selectedCustomer && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                {selectedCustomer.name[0].toUpperCase()}
              </div>
              <span className="font-medium text-foreground">{selectedCustomer.name}</span>
              <span>{selectedCustomer.phone}</span>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 bg-muted/10">
          {cart.items.length === 0 ? (
            <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <ShoppingCart className="w-14 h-14 mb-3" />
              <p>Cart is empty</p>
              <p className="text-sm">Click medicines to add</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.items.map(item => (
                <div key={item.medicine.id} className="p-3 bg-background hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between font-semibold mb-1.5 text-sm">
                    <span className="line-clamp-1 pr-2">{item.medicine.name}</span>
                    <span>{formatPKR((item.medicine.salePrice as number) * item.quantity - item.discount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => cart.updateQuantity(item.medicine.id, item.quantity - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-7 text-center font-medium text-sm">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => cart.updateQuantity(item.medicine.id, item.quantity + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatPKR(item.medicine.salePrice as number)} × {item.quantity} {item.medicine.unit}</span>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => cart.removeItem(item.medicine.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Checkout Panel */}
        <div className="p-4 border-t border-border bg-background z-10">
          <div className="space-y-1.5 mb-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPKR(cart.getSubtotal())}</span>
            </div>
            {cart.getTotalDiscount() > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="text-destructive">-{formatPKR(cart.getTotalDiscount())}</span>
              </div>
            )}
            <div className="flex justify-between font-display font-bold text-xl pt-1.5 border-t border-border border-dashed">
              <span>Total</span>
              <span className="text-primary">{formatPKR(cart.getGrandTotal())}</span>
            </div>
          </div>

          <div className="space-y-3">
            {/* Payment Methods */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'cash', icon: Banknote, label: 'Cash' },
                { id: 'card', icon: CreditCard, label: 'Card' },
                { id: 'jazzcash', icon: Smartphone, label: 'Jazz' },
                { id: 'easypaisa', icon: Smartphone, label: 'Easy' },
                { id: 'credit', icon: BookOpen, label: 'Khata' },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => cart.setPaymentMethod(method.id as CreateSaleInputPaymentMethod)}
                  className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-xs font-medium transition-all
                    ${cart.paymentMethod === method.id
                      ? method.id === 'credit' ? 'border-orange-400 bg-orange-50 text-orange-600 shadow-sm' : 'border-primary bg-primary/10 text-primary shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                >
                  <method.icon className="w-4 h-4 mb-0.5" />
                  {method.label}
                </button>
              ))}
            </div>

            {isCredit ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
                <p className="font-semibold flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Khata (Credit) Sale
                </p>
                <p className="text-xs mt-0.5">Full amount will be added to customer's khata balance</p>
                {!selectedCustomerId && !inlineCustomerName && (
                  <p className="text-xs mt-1 font-semibold text-orange-600">
                    Select a customer or enter name above for khata
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Paid (PKR)</label>
                  <Input
                    type="number"
                    className="font-bold text-base h-10"
                    value={cart.paidAmount || ''}
                    onChange={(e) => cart.setPaidAmount(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Change</label>
                  <div className={`flex items-center px-3 h-10 rounded-md font-bold text-base border
                    ${cart.getChange() < 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted border-transparent text-foreground'}`}>
                    {formatPKR(Math.max(0, cart.getChange()))}
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-bold shadow-lg shadow-primary/25 rounded-xl"
              disabled={
                cart.items.length === 0 ||
                (!isCredit && cart.paidAmount <= 0) ||
                isCheckingOut ||
                (isCredit && !selectedCustomerId && !inlineCustomerName)
              }
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Processing..." : isCredit ? "Add to Khata" : "Checkout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-[380px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-display text-xl flex items-center justify-center gap-2">
              <ReceiptText className="w-6 h-6 text-primary" />
              {completedSale?.paymentStatus === "credit" ? "Khata Recorded!" : "Sale Complete!"}
            </DialogTitle>
          </DialogHeader>

          {/* Printable Receipt */}
          <div ref={receiptRef} className="bg-white border border-dashed border-gray-300 rounded-xl p-4 font-mono text-xs text-gray-800 space-y-2">
            <div className="center text-center">
              <div className="title bold text-base font-bold">{completedSale?.pharmacyName || "Pharmacy POS"}</div>
              {completedSale?.pharmacyAddress && <div className="subtitle text-gray-500 text-xs">{completedSale.pharmacyAddress}</div>}
              {completedSale?.pharmacyPhone && <div className="subtitle text-gray-500 text-xs">Tel: {completedSale.pharmacyPhone}</div>}
            </div>
            <div className="divider border-t border-dashed border-gray-400 my-1" />
            <div className="meta-row"><span className="text-gray-500">Invoice</span><span>{completedSale?.invoiceNumber}</span></div>
            <div className="meta-row"><span className="text-gray-500">Date</span><span>{new Date(completedSale?.createdAt || Date.now()).toLocaleString("en-PK")}</span></div>
            {completedSale?.customerName && (
              <div className="meta-row"><span className="text-gray-500">Customer</span><span>{completedSale.customerName}</span></div>
            )}
            {completedSale?.customerPhone && (
              <div className="meta-row"><span className="text-gray-500">Phone</span><span>{completedSale.customerPhone}</span></div>
            )}
            {completedSale?.cashierName && <div className="meta-row"><span className="text-gray-500">Cashier</span><span>{completedSale.cashierName}</span></div>}
            <div className="divider border-t border-dashed border-gray-400 my-1" />
            <div className="items-head">
              <span>Item</span><span className="qty-col">Qty</span><span className="num-col">Price</span><span className="num-col">Total</span>
            </div>
            {(completedSale?.items || []).map((item: SaleItem, i: number) => (
              <div key={i} className="item-row">
                <span className="item-name">{item.medicineName}</span>
                <span className="qty-col">{item.quantity}</span>
                <span className="num-col">{formatReceiptAmount(item.unitPrice)}</span>
                <span className="num-col font-semibold">{formatReceiptAmount(item.total)}</span>
              </div>
            ))}
            <div className="divider border-t border-dashed border-gray-400 my-1" />
            {(completedSale?.discount ?? 0) > 0 && (
              <div className="summary-row text-gray-600"><span>Discount</span><span>-{formatReceiptAmount(completedSale!.discount)}</span></div>
            )}
            <div className="total-row flex justify-between font-bold text-sm">
              <span>Total</span><span>{formatReceiptAmount(completedSale?.totalAmount ?? 0)}</span>
            </div>
            {completedSale?.paymentStatus !== "credit" && (
              <>
                <div className="summary-row text-gray-600"><span>Paid ({completedSale?.paymentMethod?.toUpperCase()})</span><span>{formatReceiptAmount(completedSale?.paidAmount ?? 0)}</span></div>
                {(completedSale?.changeAmount ?? 0) > 0 && (
                  <div className="summary-row text-gray-600"><span>Change</span><span>{formatReceiptAmount(completedSale!.changeAmount)}</span></div>
                )}
              </>
            )}
            {completedSale?.paymentStatus === "credit" && (
              <div className="summary-row font-bold text-red-600 text-sm">
                <span>KHATA (Credit)</span><span>{formatReceiptAmount(completedSale?.creditAmount || completedSale?.totalAmount || 0)}</span>
              </div>
            )}
            {completedSale?.paymentStatus === "partial" && (
              <div className="summary-row font-bold text-orange-600 text-sm">
                <span>Outstanding</span><span>{formatReceiptAmount(completedSale?.creditAmount ?? 0)}</span>
              </div>
            )}
            <div className="divider border-t border-dashed border-gray-400 my-1" />
            <div className="footer text-center text-gray-400 text-xs">Thank you for your purchase!<br />Please come again</div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row mt-4">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
            <Button className="flex-1" onClick={() => setShowReceipt(false)}>
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PillIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>;
}
