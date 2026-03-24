import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

// Pages
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Medicines from "@/pages/Medicines";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Reports from "@/pages/Reports";
import Khata from "@/pages/Khata";
import Users from "@/pages/Users";
import Transactions from "@/pages/Transactions";
import Login from "@/pages/Login";
import SubscriptionPaywall from "@/pages/SubscriptionPaywall";
import { hasActiveSubscription } from "@/lib/pharmacy-subscription";
import { RealtimeSync } from "@/hooks/use-realtime-sync";
import { SupabaseRealtimeSync } from "@/hooks/use-supabase-realtime-sync";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Tab wapas aane par fresh data (dukan mein “live” feel, low effort vs WebSockets)
      refetchOnWindowFocus: true,
      staleTime: 8_000,
    },
  },
});

function AppRoutes() {
  const { user, pharmacy, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Pharmacy POS System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!hasActiveSubscription(pharmacy)) {
    return <SubscriptionPaywall />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/pos" component={POS} />
        <Route path="/medicines" component={Medicines} />
        <Route path="/customers" component={Customers} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/purchases" component={Purchases} />
        <Route path="/reports" component={Reports} />
        <Route path="/khata" component={Khata} />
        <Route path="/users" component={Users} />
        <Route path="/transactions" component={Transactions} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <RealtimeSync />
          <SupabaseRealtimeSync />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
