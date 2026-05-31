import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { GolfDataProvider } from "@/context/GolfDataContext";
import { PracticeDataProvider } from "@/context/PracticeDataContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PracticeTemplate = lazy(async () => ({
  default: (await import("./components/PracticeTemplate")).PracticeTemplate,
}));

const queryClient = new QueryClient();

const AppLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6">
    <div className="text-center">
      <p className="text-base font-medium text-foreground">Loading golf hub...</p>
      <p className="mt-2 text-sm text-muted-foreground">Preparing your dashboard and stats.</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GolfDataProvider>
        <PracticeDataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<AppLoader />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/practice-template"
                    element={
                      <ProtectedRoute>
                        <PracticeTemplate />
                      </ProtectedRoute>
                    }
                  />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </PracticeDataProvider>
      </GolfDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
