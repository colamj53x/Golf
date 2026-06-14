import { Component, ReactNode, Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { GolfDataProvider } from "@/context/GolfDataContext";
import { PracticeDataProvider } from "@/context/PracticeDataContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DurableLocalSettingsSync } from "@/components/DurableLocalSettingsSync";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PracticeTemplate = lazy(async () => ({
  default: (await import("./components/PracticeTemplate")).PracticeTemplate,
}));

const queryClient = new QueryClient();

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("App render failed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="max-w-xl rounded-lg border bg-card p-6 text-left shadow-sm">
            <h1 className="text-xl font-semibold text-foreground">Something went wrong loading Golf Hub</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Refresh the page. If this keeps happening, the app has caught the startup error instead of showing a blank screen.
            </p>
            <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
          <DurableLocalSettingsSync />
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppErrorBoundary>
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
            </AppErrorBoundary>
          </TooltipProvider>
        </PracticeDataProvider>
      </GolfDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
