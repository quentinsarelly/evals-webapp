// Supabase Edge Function (Deno). Generates one "{full_name} - Retro
// {cycle.name}.xlsx" file per person in a cycle, reproducing the exact
// aggregation math and cell layout of the old evals-h224/outputFiles.py.
//
// Ground truth (verified directly against Retro File Template.xlsx with
// openpyxl before writing this, not guessed): both the "Auto Retro" sheet
// (index 0, self-eval) and "Retro Equipo" sheet (index 1, combined peer
// feedback) share the same row layout:
//   work_understanding  rating C26 (merged C26:C28), wins D26:D28, areas E26:E28
//   business_impact     rating C30 (merged C30:C32), wins D30:D32, areas E30:E32
//   personal_skills     rating C34 (merged C34:C36), wins D34:D36, areas E34:E36
//   dedication          rating C38 (merged C38:C40), wins D38:D40, areas E38:E40
//   growth_plan         C42 (merged C42:C44), single free-text cell, no rating
//   other_comments      B48:B53, 6 individual cell rows
//
// outputFiles.py writes self-eval wins/areas split across the 3 individual
// cells, but writes COMBINED wins/areas as one bulleted, newline-joined
// string into only the first cell of each 3-cell group (D26 only, not
// D26/D27/D28) -- and combined other_comments goes into B48 only, not
// B48:B53. This function reproduces that asymmetry deliberately; it is not
// a bug to "fix".
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import ExcelJS from "npm:exceljs@4.4.0";

// Browsers enforce CORS; server-to-server calls (e.g. a test script using
// the service role key) don't -- which is why this silently worked from a
// script but failed from the admin dashboard until these headers were added.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...init.headers },
  });
}

const CATEGORY_ROWS: Record<string, number> = {
  work_understanding: 26,
  business_impact: 30,
  personal_skills: 34,
  dedication: 38,
};
const GROWTH_PLAN_CELL = "C42";
const OTHER_COMMENTS_START_ROW = 48;
const OTHER_COMMENTS_MAX_LINES = 6;
const TEMPLATE_STORAGE_PATH = "Retro File Template.xlsx";
const TEMPLATE_BUCKET = "templates";
const RETROS_BUCKET = "retros";

interface CategoryRow {
  id: string;
  key: string;
}

interface ResponseRow {
  assignment_id: string;
  category_id: string;
  rating: number | null;
  wins: string[];
  areas_of_opportunity: string[];
}

interface ExtrasRow {
  assignment_id: string;
  growth_plan: string | null;
  other_comments: string | null;
}

interface AssignmentRow {
  id: string;
  evaluator_id: string;
  evaluatee_id: string;
  evaluatee: { full_name: string } | null;
}

function setWrappedText(cell: ExcelJS.Cell, text: string | null | undefined) {
  if (!text) return;
  cell.value = text;
  cell.alignment = { wrapText: true, vertical: "top" };
}

function bulletJoin(values: (string | null | undefined)[]): string {
  return values
    .filter((v): v is string => !!v && v.trim() !== "")
    .map((v) => `• ${v.replace(/\n/g, " - ")}`)
    .join("\n");
}

function writeSelfEval(
  sheet: ExcelJS.Worksheet,
  categories: CategoryRow[],
  responses: ResponseRow[],
  extras: ExtrasRow | undefined
) {
  for (const cat of categories) {
    const baseRow = CATEGORY_ROWS[cat.key];
    if (!baseRow) continue;

    const response = responses.find((r) => r.category_id === cat.id);
    sheet.getCell(`C${baseRow}`).value = response?.rating ?? null;

    const wins = response?.wins ?? [];
    const areas = response?.areas_of_opportunity ?? [];
    for (let i = 0; i < 3; i++) {
      setWrappedText(sheet.getCell(`D${baseRow + i}`), wins[i]);
      setWrappedText(sheet.getCell(`E${baseRow + i}`), areas[i]);
    }
  }

  setWrappedText(sheet.getCell(GROWTH_PLAN_CELL), extras?.growth_plan);

  const commentLines = (extras?.other_comments ?? "").split("\n").slice(
    0,
    OTHER_COMMENTS_MAX_LINES
  );
  for (let i = 0; i < commentLines.length; i++) {
    setWrappedText(sheet.getCell(`B${OTHER_COMMENTS_START_ROW + i}`), commentLines[i]);
  }
}

function writeCombined(
  sheet: ExcelJS.Worksheet,
  categories: CategoryRow[],
  peerResponses: ResponseRow[],
  peerExtras: ExtrasRow[]
) {
  for (const cat of categories) {
    const baseRow = CATEGORY_ROWS[cat.key];
    if (!baseRow) continue;

    const catResponses = peerResponses.filter((r) => r.category_id === cat.id);
    const ratings = catResponses
      .map((r) => r.rating)
      .filter((r): r is number => r !== null && r !== undefined);

    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null;

    sheet.getCell(`C${baseRow}`).value = avgRating;
    setWrappedText(
      sheet.getCell(`D${baseRow}`),
      bulletJoin(catResponses.map((r) => (r.wins ?? []).join(" - ")))
    );
    setWrappedText(
      sheet.getCell(`E${baseRow}`),
      bulletJoin(catResponses.map((r) => (r.areas_of_opportunity ?? []).join(" - ")))
    );
  }

  setWrappedText(
    sheet.getCell(GROWTH_PLAN_CELL),
    bulletJoin(peerExtras.map((e) => e.growth_plan))
  );
  setWrappedText(
    sheet.getCell(`B${OTHER_COMMENTS_START_ROW}`),
    bulletJoin(peerExtras.map((e) => e.other_comments))
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { cycle_id } = await req.json();
    if (!cycle_id) {
      return jsonResponse({ error: "cycle_id is required" }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cycle, error: cycleError } = await supabase
      .from("cycles")
      .select("*")
      .eq("id", cycle_id)
      .single();
    if (cycleError || !cycle) {
      return jsonResponse({ error: "cycle not found" }, { status: 404 });
    }

    const { data: categories } = await supabase
      .from("categories")
      .select("id, key")
      .order("display_order");

    const { data: rawAssignments } = await supabase
      .from("assignments")
      .select("id, evaluator_id, evaluatee_id, evaluatee:people!assignments_evaluatee_id_fkey(full_name)")
      .eq("cycle_id", cycle_id);

    const assignments = (rawAssignments ?? []) as unknown as AssignmentRow[];
    const assignmentIds = assignments.map((a) => a.id);

    const { data: allResponses } = await supabase
      .from("evaluation_responses")
      .select("assignment_id, category_id, rating, wins, areas_of_opportunity")
      .in("assignment_id", assignmentIds);

    const { data: allExtras } = await supabase
      .from("evaluation_extras")
      .select("assignment_id, growth_plan, other_comments")
      .in("assignment_id", assignmentIds);

    const { data: templateData, error: templateError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .download(TEMPLATE_STORAGE_PATH);

    if (templateError || !templateData) {
      return jsonResponse(
        {
          error: `template not found in storage bucket "${TEMPLATE_BUCKET}" at "${TEMPLATE_STORAGE_PATH}" -- upload it once before running exports`,
        },
        { status: 500 }
      );
    }
    const templateBuffer = await templateData.arrayBuffer();

    const evaluateeIds = Array.from(new Set(assignments.map((a) => a.evaluatee_id)));

    const results: { personId: string; fullName: string; storagePath: string; signedUrl: string }[] = [];
    const errors: { personId: string; fullName: string; message: string }[] = [];

    for (const evaluateeId of evaluateeIds) {
      const evaluateeAssignments = assignments.filter(
        (a) => a.evaluatee_id === evaluateeId
      );
      const fullName = evaluateeAssignments[0]?.evaluatee?.full_name ?? "Unknown";

      try {
        const selfAssignment = evaluateeAssignments.find(
          (a) => a.evaluator_id === evaluateeId
        );
        const peerAssignments = evaluateeAssignments.filter(
          (a) => a.evaluator_id !== evaluateeId
        );

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);

        const selfSheet = workbook.worksheets[0];
        const combinedSheet = workbook.worksheets[1];

        if (selfAssignment) {
          const selfResponses = (allResponses ?? []).filter(
            (r) => r.assignment_id === selfAssignment.id
          );
          const selfExtras = (allExtras ?? []).find(
            (e) => e.assignment_id === selfAssignment.id
          );
          writeSelfEval(selfSheet, categories ?? [], selfResponses, selfExtras);
        }

        if (peerAssignments.length > 0) {
          const peerIds = peerAssignments.map((a) => a.id);
          const peerResponses = (allResponses ?? []).filter((r) =>
            peerIds.includes(r.assignment_id)
          );
          const peerExtras = (allExtras ?? []).filter((e) =>
            peerIds.includes(e.assignment_id)
          );
          writeCombined(combinedSheet, categories ?? [], peerResponses, peerExtras);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const storagePath = `${cycle.slug}/${fullName} - Retro ${cycle.name}.xlsx`;

        const { error: uploadError } = await supabase.storage
          .from(RETROS_BUCKET)
          .upload(storagePath, buffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: signedUrlData } = await supabase.storage
          .from(RETROS_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

        results.push({
          personId: evaluateeId,
          fullName,
          storagePath,
          signedUrl: signedUrlData?.signedUrl ?? "",
        });
      } catch (err) {
        errors.push({
          personId: evaluateeId,
          fullName,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (errors.length === 0) {
      await supabase.from("cycles").update({ status: "exported" }).eq("id", cycle_id);
    }

    return jsonResponse({ results, errors });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
});
