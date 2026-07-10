import { supabase } from "../supabase";
import { Assignment, AssignmentSource, AssignmentStatus } from "../types";

interface AssignmentRow {
  id: string;
  cycle_id: string;
  evaluator_id: string;
  evaluatee_id: string;
  is_self_eval: boolean;
  is_mandatory: boolean;
  source: AssignmentSource;
  status: AssignmentStatus;
  submitted_at: string | null;
  created_at: string;
  evaluator?: { full_name: string } | null;
  evaluatee?: { full_name: string } | null;
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    evaluatorId: row.evaluator_id,
    evaluateeId: row.evaluatee_id,
    isSelfEval: row.is_self_eval,
    isMandatory: row.is_mandatory,
    source: row.source,
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    evaluatorName: row.evaluator?.full_name,
    evaluateeName: row.evaluatee?.full_name,
  };
}

const WITH_NAMES_SELECT =
  "*, evaluator:people!assignments_evaluator_id_fkey(full_name), evaluatee:people!assignments_evaluatee_id_fkey(full_name)";

/**
 * Assignments where the given person is the evaluator, for a given cycle.
 *
 * RLS only guarantees non-admins can't see others' rows -- it does NOT
 * narrow an admin's query, since the same policy also grants admins full
 * read access (`evaluator_id = current_person_id() OR is_admin()`). This
 * function always filters by evaluatorId explicitly so "my evaluations"
 * means "my evaluations" even when the caller happens to be an admin.
 */
export async function listMyAssignments(
  cycleId: string,
  evaluatorId: string
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(WITH_NAMES_SELECT)
    .eq("cycle_id", cycleId)
    .eq("evaluator_id", evaluatorId)
    .order("is_self_eval", { ascending: false })
    .order("evaluatee_id");

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function getAssignment(
  assignmentId: string
): Promise<Assignment | null> {
  const { data, error } = await supabase
    .from("assignments")
    .select(WITH_NAMES_SELECT)
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAssignment(data) : null;
}

/** Admin view: every assignment in a cycle. */
export async function listCycleAssignments(
  cycleId: string
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select(WITH_NAMES_SELECT)
    .eq("cycle_id", cycleId)
    .order("evaluator_id");

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export interface GenerateAssignmentsWarning {
  warning_person_id: string;
  warning_full_name: string;
  warning_count: number;
}

export async function generateAssignments(
  cycleId: string
): Promise<GenerateAssignmentsWarning[]> {
  const { data, error } = await supabase.rpc("generate_assignments", {
    p_cycle_id: cycleId,
  });

  if (error) throw error;
  return data ?? [];
}

export async function addManualAssignment(
  cycleId: string,
  evaluatorId: string,
  evaluateeId: string
): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      cycle_id: cycleId,
      evaluator_id: evaluatorId,
      evaluatee_id: evaluateeId,
      source: "manual",
    })
    .select(WITH_NAMES_SELECT)
    .single();

  if (error) throw error;
  return mapAssignment(data);
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) throw error;
}

export async function markInProgress(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({ status: "in_progress" })
    .eq("id", assignmentId)
    .eq("status", "pending");

  if (error) throw error;
}

export async function submitAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) throw error;
}

/** Admin-only: reopen a mistakenly submitted evaluation for editing. */
export async function unsubmitAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase
    .from("assignments")
    .update({ status: "in_progress", submitted_at: null })
    .eq("id", assignmentId);

  if (error) throw error;
}
