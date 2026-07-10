import { supabase } from "../supabase";

export interface ExportResult {
  personId: string;
  fullName: string;
  storagePath: string;
  signedUrl: string;
}

export interface GenerateExportResponse {
  results: ExportResult[];
  errors: { personId: string; fullName: string; message: string }[];
}

/** Invokes the generate-export edge function for every person in a cycle. */
export async function triggerExport(
  cycleId: string
): Promise<GenerateExportResponse> {
  const { data, error } = await supabase.functions.invoke("generate-export", {
    body: { cycle_id: cycleId },
  });

  if (error) throw error;
  return data as GenerateExportResponse;
}
