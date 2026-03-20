import { ReactNode, useState } from "react";
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
  Stethoscope,
  BookOpen,
  UserCog,
  AlertTriangle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { formatPKR } from "@/lib/format";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "POS / Billing", href: "/pos", icon: Calculator },
  { label: "Medicines", href: "/medicines", icon: Pill },
  { label: "Khata (Credit)", href: "/khata", icon: BookOpen },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Purchases", href: "/purchases", icon: ShoppingCart },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Staff / Users", href: "/users", icon: UserCog },
];

const pageTitles: Record<string, string> = {
  "/transactions": "Transactions",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, pharmacy, logout } = useAuth();
  const { data: stats } = useGetDashboardStats();
  const [showAlerts, setShowAlerts] = useState(false);

  const alertCount = (stats?.lowStockCount || 0) + (stats?.expiringCount || 0);
  const initials = user?.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  const NavLinks = ({ onNavClick }: { onNavClick?: () => void }) => (
    <div className="space-y-0.5 py-4">
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href} onClick={onNavClick}>
            <span
              className={`
                flex items-center gap-3 px-4 py-2.5 mx-3 rounded-xl transition-all duration-200 cursor-pointer
                ${isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary-foreground" : ""}`} />
              <span className="truncate">{item.label}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );

  const AlertsPopup = () => (
    <div className="fixed top-20 right-6 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
        <h3 className="font-display font-bold text-lg flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> Alerts
          {alertCount > 0 && <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded-full">{alertCount}</span>}
        </h3>
        <button onClick={() => setShowAlerts(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {stats?.lowStockCount === 0 && stats?.expiringCount === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No alerts — all good!</div>
        ) : (
          <>
            {stats?.lowStockCount && stats.lowStockCount > 0 ? (
              <Link href="/medicines">
                <div className="p-4 hover:bg-muted/30 cursor-pointer flex items-start gap-3" onClick={() => setShowAlerts(false)}>
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{stats.lowStockCount} Low Stock Medicine{stats.lowStockCount > 1 ? "s" : ""}</p>
                    <p className="text-xs text-muted-foreground">Reorder needed — click to view</p>
                  </div>
                </div>
              </Link>
            ) : null}
            {stats?.expiringCount && stats.expiringCount > 0 ? (
              <Link href="/reports">
                <div className="p-4 hover:bg-muted/30 cursor-pointer flex items-start gap-3" onClick={() => setShowAlerts(false)}>
                  <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{stats.expiringCount} Medicine{stats.expiringCount > 1 ? "s" : ""} Expiring Soon</p>
                    <p className="text-xs text-muted-foreground">Within 30 days — click to view</p>
                  </div>
                </div>
              </Link>
            ) : null}
            {stats?.totalCreditOutstanding && stats.totalCreditOutstanding > 0 ? (
              <Link href="/khata">
                <div className="p-4 hover:bg-muted/30 cursor-pointer flex items-start gap-3" onClick={() => setShowAlerts(false)}>
                  <BookOpen className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Outstanding Khata</p>
                    <p className="text-xs text-muted-foreground">{formatPKR(stats.totalCreditOutstanding)} pending collection</p>
                  </div>
                </div>
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border z-20">
        <div className="flex items-center gap-2 text-primary font-display font-bold text-xl">
          <Stethoscope className="w-6 h-6" />
          <span className="truncate">{pharmacy?.name || "PharmaPOS"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-muted-foreground hover:text-foreground" onClick={() => setShowAlerts(!showAlerts)}>
            <Bell className="w-5 h-5" />
            {alertCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />}
          </button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="w-6 h-6" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-card">
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2 text-primary font-display font-bold text-xl">
                  <Stethoscope className="w-6 h-6" />
                  <span className="truncate">{pharmacy?.name || "PharmaPOS"}</span>
                </div>
              </div>
              <NavLinks />
              <div className="p-4 border-t border-border mt-auto">
                <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-card border-r border-border fixed h-full z-20">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-2.5 text-primary font-display font-extrabold text-xl tracking-tight">
            <div className="p-1.5 bg-primary/10 rounded-xl flex-shrink-0">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <span className="truncate">{pharmacy?.name || "PharmaPOS"}</span>
          </div>
          {pharmacy?.city && <p className="text-xs text-muted-foreground mt-1 truncate pl-1">{pharmacy.city}</p>}
        </div>

        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground h-9" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" />Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="hidden md:flex h-16 items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-border/50">
          <h1 className="font-display text-xl font-bold text-foreground tracking-tight">
            {navItems.find(i => i.href === location)?.label || pageTitles[location] || "PharmaPOS"}
          </h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Button variant="outline" size="icon" className="rounded-full relative" onClick={() => setShowAlerts(!showAlerts)}>
                <Bell className="w-4 h-4" />
                {alertCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />}
              </Button>
              {showAlerts && <AlertsPopup />}
            </div>
            <Link href="/pos">
              <Button className="rounded-full shadow-lg shadow-primary/20 px-5 h-9 text-sm">
                <Calculator className="w-3.5 h-3.5 mr-1.5" />Quick POS
              </Button>
            </Link>
          </div>
        </header>

        {showAlerts && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setShowAlerts(false)}>
            <AlertsPopup />
          </div>
        )}

        <div className="p-4 md:p-6 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
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
