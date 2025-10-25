import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import CompanionProfile from "@/pages/CompanionProfile";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ClientDashboard from "@/pages/dashboard/ClientDashboard";
import CompanionDashboard from "@/pages/dashboard/CompanionDashboard";
import AdminDashboard from "@/pages/dashboard/AdminDashboard";
import CompanionOnboarding from "@/pages/onboarding/CompanionOnboarding";
import EditProfile from "@/pages/companion/EditProfile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/companion/:id" component={CompanionProfile} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/onboarding/companion" component={CompanionOnboarding} />
      <Route path="/companion/edit-profile" component={EditProfile} />
      <Route path="/dashboard/client" component={ClientDashboard} />
      <Route path="/dashboard/companion" component={CompanionDashboard} />
      <Route path="/dashboard/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
