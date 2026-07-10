import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import MyEvaluations from "./pages/MyEvaluations";
import EvaluationDetail from "./pages/EvaluationDetail";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAssignments from "./pages/AdminAssignments";
import AdminPeople from "./pages/AdminPeople";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { PersonProvider } from "./contexts/PersonContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PersonProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<MyEvaluations />} />
                <Route path="/evaluations/:assignmentId" element={<EvaluationDetail />} />

                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/assignments" element={<AdminAssignments />} />
                  <Route path="/admin/people" element={<AdminPeople />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PersonProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
