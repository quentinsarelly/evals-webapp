import { supabase } from "../supabase";
import { EvaluationExtras, EvaluationResponse } from "../types";

interface ResponseRow {
  id: string;
  assignment_id: string;
  category_id: string;
  rating: number | null;
  wins: string[] | null;
  areas_of_opportunity: string[] | null;
  created_at: string;
  updated_at: string;
}

interface ExtrasRow {
  assignment_id: string;
  growth_plan: string | null;
  other_comments: string | null;
  is_draft: boolean;
  updated_at: string;
}

function mapResponse(row: ResponseRow): EvaluationResponse {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    categoryId: row.category_id,
    rating: row.rating,
    wins: row.wins ?? [],
    areasOfOpportunity: row.areas_of_opportunity ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExtras(row: ExtrasRow): EvaluationExtras {
  return {
    assignmentId: row.assignment_id,
    growthPlan: row.growth_plan,
    otherComments: row.other_comments,
    isDraft: row.is_draft,
    updatedAt: row.updated_at,
  };
}

export async function listResponses(
  assignmentId: string
): Promise<EvaluationResponse[]> {
  const { data, error } = await supabase
    .from("evaluation_responses")
    .select("*")
    .eq("assignment_id", assignmentId);

  if (error) throw error;
  return (data ?? []).map(mapResponse);
}

export async function getExtras(
  assignmentId: string
): Promise<EvaluationExtras | null> {
  const { data, error } = await supabase
    .from("evaluation_extras")
    .select("*")
    .eq("assignment_id", assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapExtras(data) : null;
}

/** Autosave one category's rating/wins/areas. Safe to call repeatedly (debounced by the caller). */
export async function saveResponse(
  assignmentId: string,
  categoryId: string,
  fields: { rating?: number | null; wins?: string[]; areasOfOpportunity?: string[] }
): Promise<void> {
  const { error } = await supabase.from("evaluation_responses").upsert(
    {
      assignment_id: assignmentId,
      category_id: categoryId,
      ...(fields.rating !== undefined ? { rating: fields.rating } : {}),
      ...(fields.wins !== undefined ? { wins: fields.wins } : {}),
      ...(fields.areasOfOpportunity !== undefined
        ? { areas_of_opportunity: fields.areasOfOpportunity }
        : {}),
    },
    { onConflict: "assignment_id,category_id" }
  );

  if (error) throw error;
}

export async function saveExtras(
  assignmentId: string,
  fields: { growthPlan?: string | null; otherComments?: string | null; isDraft?: boolean }
): Promise<void> {
  const { error } = await supabase.from("evaluation_extras").upsert(
    {
      assignment_id: assignmentId,
      ...(fields.growthPlan !== undefined ? { growth_plan: fields.growthPlan } : {}),
      ...(fields.otherComments !== undefined
        ? { other_comments: fields.otherComments }
        : {}),
      ...(fields.isDraft !== undefined ? { is_draft: fields.isDraft } : {}),
    },
    { onConflict: "assignment_id" }
  );

  if (error) throw error;
}
