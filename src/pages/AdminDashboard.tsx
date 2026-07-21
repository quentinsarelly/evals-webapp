import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createCycle, listCycles, updateCycleStatus } from "@/lib/services/cycle-service";
import { getCycleCompletion } from "@/lib/services/completion-service";
import { generateAssignments } from "@/lib/services/assignment-service";
import { ExportResult, triggerExport } from "@/lib/services/export-service";
import { listPeople } from "@/lib/services/person-service";

const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResults, setExportResults] = useState<ExportResult[]>([]);
  const [newCycle, setNewCycle] = useState({
    name: "",
    slug: "",
    periodStart: "",
    periodEnd: "",
    includeOptionalPeers: false,
  });

  const { data: cycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ["cycles"],
    queryFn: listCycles,
  });

  const cycleId = selectedCycleId ?? cycles?.[0]?.id ?? null;
  const cycle = cycles?.find((c) => c.id === cycleId) ?? null;

  const { data: completion, isLoading: completionLoading } = useQuery({
    queryKey: ["cycle-completion", cycleId],
    queryFn: () => getCycleCompletion(cycleId!),
    enabled: !!cycleId,
  });

  const { data: people } = useQuery({ queryKey: ["people"], queryFn: listPeople });

  const pending = (completion ?? [])
    .filter((row) => row.assignmentsGivenSubmitted < row.assignmentsGiven)
    .map((row) => ({
      ...row,
      email: people?.find((p) => p.id === row.personId)?.email ?? "",
      pendingCount: row.assignmentsGiven - row.assignmentsGivenSubmitted,
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount);

  const handleCreateCycle = async () => {
    if (!newCycle.name || !newCycle.slug || !newCycle.periodStart || !newCycle.periodEnd) {
      toast.error("Completa todos los campos del ciclo.");
      return;
    }
    try {
      await createCycle(newCycle);
      toast.success("Ciclo creado");
      setNewCycle({
        name: "",
        slug: "",
        periodStart: "",
        periodEnd: "",
        includeOptionalPeers: false,
      });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    } catch (err) {
      toast.error("No se pudo crear el ciclo. ¿El slug ya existe?");
    }
  };

  const handleGenerate = async () => {
    if (!cycleId) return;
    setGenerating(true);
    try {
      const warnings = await generateAssignments(cycleId);
      queryClient.invalidateQueries({ queryKey: ["cycle-completion", cycleId] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      if (warnings.length > 0) {
        toast.warning(
          `Asignaciones generadas. ${warnings.length} persona(s) reciben menos del mínimo: ${warnings
            .map((w) => w.warning_full_name)
            .join(", ")}`
        );
      } else {
        toast.success("Asignaciones generadas correctamente.");
      }
    } catch (err) {
      toast.error("No se pudieron generar las asignaciones.");
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenCycle = async () => {
    if (!cycleId) return;
    await updateCycleStatus(cycleId, "open");
    queryClient.invalidateQueries({ queryKey: ["cycles"] });
    toast.success("Ciclo abierto. Los evaluadores ya pueden completar sus formularios.");
  };

  const handleCloseCycle = async () => {
    if (!cycleId) return;
    await updateCycleStatus(cycleId, "closed");
    queryClient.invalidateQueries({ queryKey: ["cycles"] });
    toast.success("Ciclo cerrado.");
  };

  const handleReopenCycle = async () => {
    if (!cycleId) return;
    await updateCycleStatus(cycleId, "open");
    queryClient.invalidateQueries({ queryKey: ["cycles"] });
    toast.success("Ciclo reabierto. Los evaluadores pueden continuar sus formularios.");
  };

  const handleExport = async () => {
    if (!cycleId) return;
    if (completion) {
      const totalGiven = completion.reduce((sum, r) => sum + r.assignmentsGiven, 0);
      const totalSubmitted = completion.reduce((sum, r) => sum + r.assignmentsGivenSubmitted, 0);
      if (totalSubmitted < totalGiven) {
        const confirmed = window.confirm(
          `Solo ${totalSubmitted} de ${totalGiven} evaluaciones han sido enviadas. Exportar ahora marcará el ciclo como "exportado" y los evaluadores dejarán de ver sus formularios pendientes en "Mis evaluaciones". ¿Exportar de todas formas?`
        );
        if (!confirmed) return;
      }
    }
    setExporting(true);
    setExportResults([]);
    try {
      const result = await triggerExport(cycleId);
      toast.success(`${result.results.length} archivo(s) generados.`);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} error(es) durante la exportación.`);
      }
      setExportResults(result.results);
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    } catch (err) {
      toast.error("No se pudo generar la exportación.");
    } finally {
      setExporting(false);
    }
  };

  const handleSelectCycle = (id: string) => {
    setSelectedCycleId(id);
    setExportResults([]);
  };

  const handleCopyPendingEmails = async () => {
    const emails = pending.map((row) => row.email).filter(Boolean).join(", ");
    await navigator.clipboard.writeText(emails);
    toast.success("Correos copiados al portapapeles.");
  };

  const handleExportPendingCsv = () => {
    const header = "Nombre,Correo,Pendientes\n";
    const rows = pending
      .map((row) => `"${row.fullName}","${row.email}",${row.pendingCount}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pendientes-${cycle?.slug ?? "ciclo"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Panel de administración</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin/people">Personas y elegibilidad</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/assignments">Asignaciones</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear nuevo ciclo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newCycle.name}
                onChange={(e) => setNewCycle({ ...newCycle, name: e.target.value })}
                placeholder="H1 2026"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={newCycle.slug}
                onChange={(e) => setNewCycle({ ...newCycle, slug: e.target.value })}
                placeholder="h1-2026"
              />
            </div>
            <div>
              <Label>Inicio</Label>
              <Input
                type="date"
                value={newCycle.periodStart}
                onChange={(e) => setNewCycle({ ...newCycle, periodStart: e.target.value })}
              />
            </div>
            <div>
              <Label>Fin</Label>
              <Input
                type="date"
                value={newCycle.periodEnd}
                onChange={(e) => setNewCycle({ ...newCycle, periodEnd: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm col-span-2 sm:col-span-4">
              <input
                type="checkbox"
                checked={newCycle.includeOptionalPeers}
                onChange={(e) =>
                  setNewCycle({ ...newCycle, includeOptionalPeers: e.target.checked })
                }
              />
              Ciclo de fin de año (incluye evaluaciones de pares opcionales además de
              autoevaluación + manager)
            </label>
            <Button onClick={handleCreateCycle} className="col-span-2 sm:col-span-1">
              Crear ciclo
            </Button>
          </CardContent>
        </Card>

        {!cyclesLoading && cycles && cycles.length > 0 && (
          <div className="flex items-center gap-3">
            <Label>Ciclo:</Label>
            <Select value={cycleId ?? undefined} onValueChange={handleSelectCycle}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecciona un ciclo" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? "Generando..." : "Generar asignaciones"}
            </Button>
            {cycle?.status === "assignments_generated" && (
              <Button variant="outline" onClick={handleOpenCycle}>
                Abrir ciclo
              </Button>
            )}
            {cycle?.status === "open" && (
              <Button variant="outline" onClick={handleCloseCycle}>
                Cerrar ciclo
              </Button>
            )}
            {(cycle?.status === "exported" || cycle?.status === "closed") && (
              <Button variant="outline" onClick={handleReopenCycle}>
                Reabrir ciclo
              </Button>
            )}
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? "Exportando..." : "Generar archivos retro"}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de finalización</CardTitle>
          </CardHeader>
          <CardContent>
            {completionLoading && <p className="text-sm text-muted-foreground">Cargando...</p>}
            {completion && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Dadas (enviadas)</TableHead>
                    <TableHead>Recibidas (enviadas)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completion.map((row) => (
                    <TableRow key={row.personId}>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>
                        {row.assignmentsGivenSubmitted} / {row.assignmentsGiven}
                      </TableCell>
                      <TableCell>
                        {row.assignmentsReceivedSubmitted} / {row.assignmentsReceived}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Pendientes ({pending.length})</CardTitle>
            {pending.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyPendingEmails}>
                  Copiar correos
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPendingCsv}>
                  Exportar CSV
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {pending.length === 0 && !completionLoading && (
              <p className="text-sm text-muted-foreground">
                Todos han enviado sus evaluaciones asignadas.
              </p>
            )}
            {pending.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((row) => (
                    <TableRow key={row.personId}>
                      <TableCell>{row.fullName}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>
                        {row.pendingCount} de {row.assignmentsGiven}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {exportResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Archivos generados ({exportResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {exportResults.map((r) => (
                  <li key={r.personId}>
                    <a
                      href={r.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline text-sm"
                    >
                      {r.fullName}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">
                Estos enlaces vencen en 7 días. Si necesitas volver a descargarlos después,
                genera los archivos de nuevo desde aquí.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default AdminDashboard;
