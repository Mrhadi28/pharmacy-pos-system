import { create } from "zustand";
import { Medicine } from "@workspace/api-client-react";

export interface CartItem {
  medicine: Medicine;
  quantity: number;
  discount: number;
}

interface CartStore {
  items: CartItem[];
  customerId: number | undefined;
  paymentMethod: "cash" | "card" | "jazzcash" | "easypaisa";
  paidAmount: number;
  globalDiscount: number;
  
  // Actions
  addItem: (medicine: Medicine) => void;
  removeItem: (medicineId: number) => void;
  updateQuantity: (medicineId: number, quantity: number) => void;
  updateItemDiscount: (medicineId: number, discount: number) => void;
  setCustomer: (id: number | undefined) => void;
  setPaymentMethod: (method: "cash" | "card" | "jazzcash" | "easypaisa") => void;
  setPaidAmount: (amount: number) => void;
  setGlobalDiscount: (amount: number) => void;
  clearCart: () => void;
  
  // Computed (getters as methods)
  getSubtotal: () => number;
  getTotalDiscount: () => number;
  getGrandTotal: () => number;
  getChange: () => number;
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],
  customerId: undefined,
  paymentMethod: "cash",
  paidAmount: 0,
  globalDiscount: 0,

  addItem: (medicine) => set((state) => {
    const existing = state.items.find((i) => i.medicine.id === medicine.id);
    if (existing) {
      if (existing.quantity >= medicine.stockQuantity) return state; // Don't exceed stock
      return {
        items: state.items.map((i) =>
          i.medicine.id === medicine.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      };
    }
    return { items: [...state.items, { medicine, quantity: 1, discount: 0 }] };
  }),

  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.medicine.id !== id),
  })),

  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map((i) =>
      i.medicine.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
    ),
  })),

  updateItemDiscount: (id, discount) => set((state) => ({
    items: state.items.map((i) =>
      i.medicine.id === id ? { ...i, discount: Math.max(0, discount) } : i
    ),
  })),

  setCustomer: (id) => set({ customerId: id }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setPaidAmount: (amount) => set({ paidAmount: amount }),
  setGlobalDiscount: (amount) => set({ globalDiscount: amount }),
  
  clearCart: () => set({ items: [], customerId: undefined, paidAmount: 0, globalDiscount: 0 }),

  getSubtotal: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.medicine.salePrice * item.quantity, 0);
  },

  getTotalDiscount: () => {
    const { items, globalDiscount } = get();
    const itemsDiscount = items.reduce((sum, item) => sum + item.discount, 0);
    return itemsDiscount + globalDiscount;
  },

  getGrandTotal: () => {
    const { getSubtotal, getTotalDiscount } = get();
    return Math.max(0, getSubtotal() - getTotalDiscount());
  },

  getChange: () => {
    const { paidAmount, getGrandTotal } = get();
    return Math.max(0, paidAmount - getGrandTotal());
  }
}));
