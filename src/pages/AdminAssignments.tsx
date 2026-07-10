import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCycles } from "@/lib/services/cycle-service";
import { listPeople } from "@/lib/services/person-service";
import {
  addManualAssignment,
  deleteAssignment,
  listCycleAssignments,
  unsubmitAssignment,
} from "@/lib/services/assignment-service";

const AdminAssignments: React.FC = () => {
  const queryClient = useQueryClient();
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [newEvaluator, setNewEvaluator] = useState<string | undefined>();
  const [newEvaluatee, setNewEvaluatee] = useState<string | undefined>();

  const { data: cycles } = useQuery({ queryKey: ["cycles"], queryFn: listCycles });
  const activeCycleId = cycleId ?? cycles?.[0]?.id ?? null;

  const { data: people } = useQuery({ queryKey: ["people"], queryFn: listPeople });

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["cycle-assignments", activeCycleId],
    queryFn: () => listCycleAssignments(activeCycleId!),
    enabled: !!activeCycleId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["cycle-assignments", activeCycleId] });

  const handleAdd = async () => {
    if (!activeCycleId || !newEvaluator || !newEvaluatee) return;
    try {
      await addManualAssignment(activeCycleId, newEvaluator, newEvaluatee);
      toast.success("Asignación agregada");
      invalidate();
    } catch (err) {
      toast.error("No se pudo agregar (¿ya existe esa asignación?)");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAssignment(id);
    invalidate();
  };

  const handleUnsubmit = async (id: string) => {
    await unsubmitAssignment(id);
    invalidate();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Asignaciones</h1>

        {cycles && (
          <div className="flex items-center gap-3">
            <Select value={activeCycleId ?? undefined} onValueChange={setCycleId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecciona un ciclo" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar asignación manual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Select value={newEvaluator} onValueChange={setNewEvaluator}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Evaluador" />
                </SelectTrigger>
                <SelectContent>
                  {people?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={newEvaluatee} onValueChange={setNewEvaluatee}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Evaluado" />
                </SelectTrigger>
                <SelectContent>
                  {people?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd}>Agregar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {isLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
            {assignments && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evaluador</TableHead>
                    <TableHead>Evaluado</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.evaluatorName}</TableCell>
                      <TableCell>{a.evaluateeName}</TableCell>
                      <TableCell className="capitalize">{a.source}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {a.status === "submitted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnsubmit(a.id)}
                          >
                            Reabrir
                          </Button>
                        )}
                        {a.status !== "submitted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(a.id)}
                          >
                            Eliminar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminAssignments;
