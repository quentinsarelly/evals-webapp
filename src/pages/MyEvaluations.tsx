import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePerson } from "@/contexts/PersonContext";
import { getActiveCycle } from "@/lib/services/cycle-service";
import { listMyAssignments } from "@/lib/services/assignment-service";

const MyEvaluations: React.FC = () => {
  const { person } = usePerson();

  const { data: cycle, isLoading: cycleLoading } = useQuery({
    queryKey: ["active-cycle"],
    queryFn: getActiveCycle,
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["my-assignments", cycle?.id, person?.id],
    queryFn: () => listMyAssignments(cycle!.id, person!.id),
    enabled: !!cycle && !!person,
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Mis evaluaciones</h1>
          {cycle && (
            <p className="text-sm text-muted-foreground">
              Ciclo activo: {cycle.name}
              {cycle.responseDeadline && ` · Fecha límite: ${cycle.responseDeadline}`}
            </p>
          )}
        </div>

        {!cycleLoading && !cycle && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay un ciclo de evaluación abierto en este momento.
            </CardContent>
          </Card>
        )}

        {(cycleLoading || assignmentsLoading) && cycle !== null && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
          </div>
        )}

        {assignments?.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {a.isSelfEval ? "Autoevaluación" : `Evaluación de ${a.evaluateeName}`}
              </CardTitle>
              <StatusBadge status={a.status} />
            </CardHeader>
            <CardContent>
              <Button asChild variant={a.status === "submitted" ? "outline" : "default"}>
                <Link to={`/evaluations/${a.id}`}>
                  {a.status === "submitted" ? "Ver" : a.status === "in_progress" ? "Continuar" : "Empezar"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}

        {assignments && assignments.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No tienes evaluaciones asignadas en este ciclo.
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default MyEvaluations;
