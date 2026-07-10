import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { usePerson } from "@/contexts/PersonContext";

const AdminRoute: React.FC = () => {
  const { isAdmin, isLoading } = usePerson();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
