import React from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList } from "lucide-react";

const Login: React.FC = () => {
  const { user, isLoading, signInWithGoogle } = useAuth();

  if (user && !isLoading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ClipboardList className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Evaluaciones Sarelly</CardTitle>
          <CardDescription>
            Inicia sesión para completar tus evaluaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              className="w-full"
              size="lg"
              onClick={signInWithGoogle}
              disabled={isLoading}
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión con Google"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
