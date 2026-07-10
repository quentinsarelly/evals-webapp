import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { listPeople, upsertPerson } from "@/lib/services/person-service";
import {
  listEligiblePairs,
  removeEligiblePair,
  setEligiblePair,
} from "@/lib/services/eligibility-service";

const AdminPeople: React.FC = () => {
  const queryClient = useQueryClient();
  const [newPerson, setNewPerson] = useState({ fullName: "", email: "" });
  const [pairEvaluator, setPairEvaluator] = useState<string | undefined>();
  const [pairEvaluatee, setPairEvaluatee] = useState<string | undefined>();
  const [pairMandatory, setPairMandatory] = useState(false);

  const { data: people } = useQuery({ queryKey: ["people"], queryFn: listPeople });
  const { data: pairs } = useQuery({
    queryKey: ["eligible-pairs"],
    queryFn: listEligiblePairs,
  });

  const nameOf = (id: string) => people?.find((p) => p.id === id)?.fullName ?? id;

  const handleAddPerson = async () => {
    if (!newPerson.fullName || !newPerson.email) {
      toast.error("Nombre y correo son obligatorios.");
      return;
    }
    try {
      await upsertPerson(newPerson);
      toast.success("Persona agregada");
      setNewPerson({ fullName: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ["people"] });
    } catch (err) {
      toast.error("No se pudo agregar (¿correo duplicado?)");
    }
  };

  const handleAddPair = async () => {
    if (!pairEvaluator || !pairEvaluatee) return;
    try {
      await setEligiblePair(pairEvaluator, pairEvaluatee, pairMandatory);
      toast.success("Elegibilidad agregada");
      queryClient.invalidateQueries({ queryKey: ["eligible-pairs"] });
    } catch (err) {
      toast.error("No se pudo agregar la elegibilidad.");
    }
  };

  const handleRemovePair = async (evaluatorId: string, evaluateeId: string) => {
    await removeEligiblePair(evaluatorId, evaluateeId);
    queryClient.invalidateQueries({ queryKey: ["eligible-pairs"] });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Personas y elegibilidad</h1>
        <p className="text-sm text-muted-foreground">
          Reemplaza la edición manual de directory.csv/matrix.csv/mandatory.csv. Para una carga
          inicial masiva usa <code>npm run import-legacy-csv</code>.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar persona</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Input
              placeholder="Nombre completo"
              value={newPerson.fullName}
              onChange={(e) => setNewPerson({ ...newPerson, fullName: e.target.value })}
              className="w-56"
            />
            <Input
              placeholder="correo@sarellysarelly.com"
              value={newPerson.email}
              onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
              className="w-64"
            />
            <Button onClick={handleAddPerson}>Agregar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Directorio</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.fullName}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{p.active ? "Sí" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar elegibilidad</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Select value={pairEvaluator} onValueChange={setPairEvaluator}>
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
            <Select value={pairEvaluatee} onValueChange={setPairEvaluatee}>
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pairMandatory}
                onChange={(e) => setPairMandatory(e.target.checked)}
              />
              Obligatoria
            </label>
            <Button onClick={handleAddPair}>Agregar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pares elegibles ({pairs?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evaluador</TableHead>
                  <TableHead>Evaluado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairs?.map((pair) => (
                  <TableRow key={pair.id}>
                    <TableCell>{nameOf(pair.evaluatorId)}</TableCell>
                    <TableCell>{nameOf(pair.evaluateeId)}</TableCell>
                    <TableCell>
                      {pair.isMandatory ? (
                        <Badge variant="destructive">Obligatoria</Badge>
                      ) : (
                        <Badge variant="secondary">Elegible</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleRemovePair(pair.evaluatorId, pair.evaluateeId)}
                      >
                        Quitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminPeople;
