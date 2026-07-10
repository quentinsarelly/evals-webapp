import React, { createContext, useContext, useEffect, useState } from "react";
import { Person } from "@/lib/types";
import { useAuth } from "./AuthContext";
import { getCurrentPerson, isCurrentUserAdmin } from "@/lib/services/person-service";

interface PersonContextType {
  person: Person | null;
  isLoading: boolean;
  error: Error | null;
  isAdmin: boolean;
  refreshPerson: () => Promise<void>;
}

const PersonContext = createContext<PersonContextType | undefined>(undefined);

export function PersonProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [person, setPerson] = useState<Person | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchPerson = async () => {
    if (!authUser) {
      setPerson(null);
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      const resolved = await getCurrentPerson();
      setPerson(resolved);
      setIsAdmin(resolved ? await isCurrentUserAdmin(resolved.id) : false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch person"));
      setPerson(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchPerson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const refreshPerson = async () => {
    setIsLoading(true);
    await fetchPerson();
  };

  return (
    <PersonContext.Provider value={{ person, isLoading, error, isAdmin, refreshPerson }}>
      {children}
    </PersonContext.Provider>
  );
}

export function usePerson() {
  const context = useContext(PersonContext);
  if (context === undefined) {
    throw new Error("usePerson must be used within a PersonProvider");
  }
  return context;
}
