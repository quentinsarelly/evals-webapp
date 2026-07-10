import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import CategorySection, {
  CategoryFormValue,
} from "@/components/evaluation/CategorySection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { listCategories } from "@/lib/services/category-service";
import {
  getAssignment,
  markInProgress,
  submitAssignment,
} from "@/lib/services/assignment-service";
import {
  getExtras,
  listResponses,
  saveExtras,
  saveResponse,
} from "@/lib/services/response-service";
import { Assignment, Category } from "@/lib/types";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";

type ResponsesState = Record<string, CategoryFormValue>;

const emptyValue = (): CategoryFormValue => ({
  rating: null,
  wins: [""],
  areasOfOpportunity: [""],
});

const EvaluationDetail: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [responses, setResponses] = useState<ResponsesState>({});
  const [growthPlan, setGrowthPlan] = useState("");
  const [otherComments, setOtherComments] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);

  const isLocked = assignment?.status === "submitted";

  useEffect(() => {
    if (!assignmentId) return;

    (async () => {
      const [a, cats] = await Promise.all([getAssignment(assignmentId), listCategories()]);

      if (!a) {
        toast.error("Evaluación no encontrada");
        navigate("/");
        return;
      }

      const [existingResponses, extras] = await Promise.all([
        listResponses(assignmentId),
        getExtras(assignmentId),
      ]);

      const nextResponses: ResponsesState = {};
      for (const cat of cats) {
        const existing = existingResponses.find((r) => r.categoryId === cat.id);
        nextResponses[cat.id] = existing
          ? {
              rating: existing.rating,
              wins: existing.wins.length > 0 ? existing.wins : [""],
              areasOfOpportunity:
                existing.areasOfOpportunity.length > 0 ? existing.areasOfOpportunity : [""],
            }
          : emptyValue();
      }

      setAssignment(a);
      setCategories(cats);
      setResponses(nextResponses);
      setGrowthPlan(extras?.growthPlan ?? "");
      setOtherComments(extras?.otherComments ?? "");
      setLoading(false);
    })();
  }, [assignmentId, navigate]);

  const markStartedOnce = useMemo(() => {
    let called = false;
    return () => {
      if (!called && assignment?.status === "pending") {
        called = true;
        markInProgress(assignment.id);
      }
    };
  }, [assignment]);

  const persistResponse = useDebouncedCallback(
    async (categoryId: string, value: CategoryFormValue) => {
      if (!assignmentId) return;
      setSaveState("saving");
      try {
        await saveResponse(assignmentId, categoryId, {
          rating: value.rating,
          wins: value.wins.filter((w) => w.trim() !== ""),
          areasOfOpportunity: value.areasOfOpportunity.filter((a) => a.trim() !== ""),
        });
        setSaveState("saved");
      } catch (err) {
        toast.error("No se pudo guardar. Revisa tu conexión.");
        setSaveState("idle");
      }
    },
    1500
  );

  const persistExtras = useDebouncedCallback(
    async (nextGrowthPlan: string, nextOtherComments: string) => {
      if (!assignmentId) return;
      setSaveState("saving");
      try {
        await saveExtras(assignmentId, {
          growthPlan: nextGrowthPlan,
          otherComments: nextOtherComments,
          isDraft: true,
        });
        setSaveState("saved");
      } catch (err) {
        toast.error("No se pudo guardar. Revisa tu conexión.");
        setSaveState("idle");
      }
    },
    1500
  );

  const handleCategoryChange = (categoryId: string, value: CategoryFormValue) => {
    markStartedOnce();
    setResponses((prev) => ({ ...prev, [categoryId]: value }));
    persistResponse(categoryId, value);
  };

  const handleGrowthPlanChange = (value: string) => {
    markStartedOnce();
    setGrowthPlan(value);
    persistExtras(value, otherComments);
  };

  const handleOtherCommentsChange = (value: string) => {
    markStartedOnce();
    setOtherComments(value);
    persistExtras(growthPlan, value);
  };

  const handleSubmit = async () => {
    if (!assignment) return;

    const missingRating = categories.some((c) => !responses[c.id]?.rating);
    if (missingRating) {
      toast.error("Falta calificar alguna categoría (1-6) antes de enviar.");
      return;
    }

    if (assignment.isSelfEval && !growthPlan.trim()) {
      toast.error("El plan de desarrollo es obligatorio en la autoevaluación.");
      return;
    }

    setSubmitting(true);
    try {
      await saveExtras(assignment.id, { isDraft: false });
      await submitAssignment(assignment.id);
      toast.success("Evaluación enviada");
      setAssignment({ ...assignment, status: "submitted" });
    } catch (err) {
      toast.error("No se pudo enviar la evaluación.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !assignment) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {assignment.isSelfEval ? "Autoevaluación" : `Evaluación de ${assignment.evaluateeName}`}
            </h1>
            {saveState === "saving" && (
              <p className="text-xs text-muted-foreground">Guardando...</p>
            )}
            {saveState === "saved" && !isLocked && (
              <p className="text-xs text-muted-foreground">Guardado</p>
            )}
          </div>
          <StatusBadge status={assignment.status} />
        </div>

        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            value={responses[cat.id] ?? emptyValue()}
            onChange={(value) => handleCategoryChange(cat.id, value)}
            disabled={isLocked}
          />
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan de desarrollo</CardTitle>
            <p className="text-sm text-muted-foreground">
              1 comportamiento concreto a cambiar en los próximos 90 días, 1 fortaleza a amplificar.
              {assignment.isSelfEval ? " Obligatorio en la autoevaluación." : " Opcional."}
            </p>
          </CardHeader>
          <CardContent>
            <Label htmlFor="growth-plan" className="sr-only">
              Plan de desarrollo
            </Label>
            <Textarea
              id="growth-plan"
              value={growthPlan}
              onChange={(e) => handleGrowthPlanChange(e.target.value)}
              disabled={isLocked}
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Otros comentarios</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="other-comments" className="sr-only">
              Otros comentarios
            </Label>
            <Textarea
              id="other-comments"
              value={otherComments}
              onChange={(e) => handleOtherCommentsChange(e.target.value)}
              disabled={isLocked}
              rows={4}
            />
          </CardContent>
        </Card>

        {!isLocked && (
          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar evaluación"}
          </Button>
        )}

        {isLocked && (
          <p className="text-sm text-center text-muted-foreground">
            Esta evaluación ya fue enviada y no se puede editar. Contacta al administrador si
            necesitas corregirla.
          </p>
        )}
      </div>
    </Layout>
  );
};

export default EvaluationDetail;
