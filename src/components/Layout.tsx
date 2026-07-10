import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePerson } from "@/contexts/PersonContext";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, LogOut, ShieldCheck } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { person, isAdmin, isLoading } = usePerson();
  const { signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-5 w-5 text-primary" />
            Evaluaciones
          </Link>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}
            {person && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {person.fullName}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
