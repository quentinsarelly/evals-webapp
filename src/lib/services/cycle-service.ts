import { supabase } from "../supabase";
import { Cycle, CycleStatus } from "../types";

interface CycleRow {
  id: string;
  name: string;
  slug: string;
  period_start: string;
  period_end: string;
  min_evaluations_received: number;
  max_evaluations_given: number;
  include_optional_peers: boolean;
  status: CycleStatus;
  response_deadline: string | null;
  created_at: string;
}

function mapCycle(row: CycleRow): Cycle {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    minEvaluationsReceived: row.min_evaluations_received,
    maxEvaluationsGiven: row.max_evaluations_given,
    includeOptionalPeers: row.include_optional_peers,
    status: row.status,
    responseDeadline: row.response_deadline,
    createdAt: row.created_at,
  };
}

export async function listCycles(): Promise<Cycle[]> {
  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .order("period_start", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapCycle);
}

export async function getActiveCycle(): Promise<Cycle | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("status", "open")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapCycle(data) : null;
}

export async function createCycle(input: {
  name: string;
  slug: string;
  periodStart: string;
  periodEnd: string;
  minEvaluationsReceived?: number;
  maxEvaluationsGiven?: number;
  includeOptionalPeers?: boolean;
  responseDeadline?: string | null;
}): Promise<Cycle> {
  const { data, error } = await supabase
    .from("cycles")
    .insert({
      name: input.name,
      slug: input.slug,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      min_evaluations_received: input.minEvaluationsReceived ?? 3,
      max_evaluations_given: input.maxEvaluationsGiven ?? 2,
      include_optional_peers: input.includeOptionalPeers ?? false,
      response_deadline: input.responseDeadline ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapCycle(data);
}

export async function updateCycleStatus(
  cycleId: string,
  status: Cycle["status"]
): Promise<void> {
  const { error } = await supabase
    .from("cycles")
    .update({ status })
    .eq("id", cycleId);

  if (error) throw error;
}
