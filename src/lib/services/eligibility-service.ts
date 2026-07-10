import { supabase } from "../supabase";
import { EligiblePair } from "../types";

interface EligiblePairRow {
  id: string;
  evaluator_id: string;
  evaluatee_id: string;
  is_mandatory: boolean;
  created_at: string;
}

function mapPair(row: EligiblePairRow): EligiblePair {
  return {
    id: row.id,
    evaluatorId: row.evaluator_id,
    evaluateeId: row.evaluatee_id,
    isMandatory: row.is_mandatory,
    createdAt: row.created_at,
  };
}

export async function listEligiblePairs(): Promise<EligiblePair[]> {
  const { data, error } = await supabase.from("eligible_pairs").select("*");
  if (error) throw error;
  return (data ?? []).map(mapPair);
}

export async function setEligiblePair(
  evaluatorId: string,
  evaluateeId: string,
  isMandatory: boolean
): Promise<void> {
  const { error } = await supabase.from("eligible_pairs").upsert(
    { evaluator_id: evaluatorId, evaluatee_id: evaluateeId, is_mandatory: isMandatory },
    { onConflict: "evaluator_id,evaluatee_id" }
  );
  if (error) throw error;
}

export async function removeEligiblePair(
  evaluatorId: string,
  evaluateeId: string
): Promise<void> {
  const { error } = await supabase
    .from("eligible_pairs")
    .delete()
    .eq("evaluator_id", evaluatorId)
    .eq("evaluatee_id", evaluateeId);
  if (error) throw error;
}
