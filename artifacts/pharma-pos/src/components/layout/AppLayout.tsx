import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Calculator,
  Pill,
  Users,
  Truck,
  ShoppingCart,
  BarChart3,
  LogOut,
  Bell,
  Menu,
  Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "POS / Billing", href: "/pos", icon: Calculator },
  { label: "Medicines", href: "/medicines", icon: Pill },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Purchases", href: "/purchases", icon: ShoppingCart },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const NavLinks = () => (
    <div className="space-y-1 py-4">
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={`
                flex items-center gap-3 px-4 py-3 mx-3 rounded-xl transition-all duration-200 cursor-pointer
                ${isActive 
                  ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : ""}`} />
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border z-20">
        <div className="flex items-center gap-2 text-primary font-display font-bold text-xl">
          <Stethoscope className="w-6 h-6" />
          PharmaPOS
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-card">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 text-primary font-display font-bold text-2xl">
                <Stethoscope className="w-8 h-8" />
                PharmaPOS
              </div>
            </div>
            <NavLinks />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-72 bg-card border-r border-border fixed h-full z-20">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3 text-primary font-display font-extrabold text-2xl tracking-tight">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Stethoscope className="w-7 h-7 text-primary" />
            </div>
            PharmaPOS
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>

        <div className="p-6 border-t border-border/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              AK
            </div>
            <div>
              <p className="font-semibold text-sm">Ali Khan</p>
              <p className="text-xs text-muted-foreground">Admin Pharmacist</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen">
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
            {navItems.find(i => i.href === location)?.label || "Overview"}
          </h1>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-full relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></span>
            </Button>
            <Link href="/pos">
              <Button className="rounded-full shadow-lg shadow-primary/20 px-6">
                <Calculator className="w-4 h-4 mr-2" />
                Quick POS
              </Button>
            </Link>
          </div>
        </header>
        
        <div className="p-4 md:p-8 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
