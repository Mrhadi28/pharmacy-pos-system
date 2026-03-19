import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Medicines from "@/pages/Medicines";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
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
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
