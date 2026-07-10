import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePerson } from "@/contexts/PersonContext";

const ProtectedRoute: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { person, isLoading: personLoading } = usePerson();

  if (authLoading || (user && personLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!person) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-semibold">Cuenta no registrada</h1>
          <p className="text-sm text-muted-foreground">
            Tu cuenta de Google inició sesión correctamente, pero no está en el
            directorio de evaluaciones. Contacta al administrador para que te
            agregue.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
