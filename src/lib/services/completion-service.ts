import { supabase } from "../supabase";
import { CycleCompletionRow } from "../types";

interface CompletionRow {
  person_id: string;
  full_name: string;
  assignments_given: number;
  assignments_given_submitted: number;
  assignments_received: number;
  assignments_received_submitted: number;
}

export async function getCycleCompletion(
  cycleId: string
): Promise<CycleCompletionRow[]> {
  const { data, error } = await supabase
    .from("cycle_completion")
    .select("*")
    .eq("cycle_id", cycleId)
    .order("full_name");

  if (error) throw error;

  return ((data ?? []) as CompletionRow[]).map((row) => ({
    personId: row.person_id,
    fullName: row.full_name,
    assignmentsGiven: row.assignments_given,
    assignmentsGivenSubmitted: row.assignments_given_submitted,
    assignmentsReceived: row.assignments_received,
    assignmentsReceivedSubmitted: row.assignments_received_submitted,
  }));
}
