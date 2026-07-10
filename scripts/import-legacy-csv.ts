/**
 * One-time (but idempotent/repeatable) importer for the legacy CSV config
 * from evals-h224: directory.csv (people), matrix.csv (eligible pairs,
 * "X" marks), mandatory.csv (required pairs, "1" marks).
 *
 * Usage:
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run import-legacy-csv -- /path/to/evals-h224
 *
 * Does NOT import final_assignments.csv, extracted_data*.json, or any
 * retro_* output -- those are outputs of the process being retired, not
 * source-of-truth config (per the plan's "fresh start" decision).
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in environment/.env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const sourceDir = process.argv[2] ?? process.cwd();

interface DirectoryRow {
  Evaluator: string; // legacy header name -- this is really just "full name"
  Email: string;
}

function readCsv<T = Record<string, string>>(filename: string): T[] {
  const raw = readFileSync(join(sourceDir, filename), "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true }) as T[];
}

/** Parses a matrix CSV (first column = evaluator name, header row = evaluatee names). */
function readMatrix(filename: string): {
  header: string[];
  rows: Record<string, string>[];
} {
  const raw = readFileSync(join(sourceDir, filename), "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true }) as Record<
    string,
    string
  >[];
  const header = Object.keys(records[0] ?? {}).filter((k) => k !== "");
  return { header, rows: records };
}

async function main() {
  console.log(`Importing legacy CSVs from ${sourceDir}`);

  // 1. directory.csv -> people
  const directoryRows = readCsv<DirectoryRow>("directory.csv");
  console.log(`\ndirectory.csv: ${directoryRows.length} people`);

  for (const row of directoryRows) {
    const fullName = row.Evaluator?.trim();
    const email = row.Email?.trim();
    if (!fullName || !email) continue;

    const { error } = await supabase
      .from("people")
      .upsert({ full_name: fullName, email }, { onConflict: "email" });

    if (error) {
      console.error(`  Failed to upsert ${fullName} <${email}>:`, error.message);
    }
  }

  // Build name -> id map for eligibility import
  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("id, full_name");

  if (peopleError) {
    console.error("Failed to fetch people for name lookup:", peopleError.message);
    process.exit(1);
  }

  const nameToId = new Map<string, string>();
  for (const p of people ?? []) {
    nameToId.set(p.full_name, p.id);
  }

  // 2 & 3. matrix.csv (X = eligible) and mandatory.csv (1 = mandatory)
  const unmatchedNames = new Set<string>();
  let eligibleCount = 0;
  let mandatoryCount = 0;

  async function importMatrix(filename: string, isMandatory: boolean, marker: string) {
    if (!existsSync(join(sourceDir, filename))) {
      console.log(
        `\n${filename}: not found in ${sourceDir}, skipping (fine for a mid-year, mandatory-only import)`
      );
      return;
    }

    const { header, rows } = readMatrix(filename);
    console.log(`\n${filename}: ${rows.length} evaluators x ${header.length} evaluatees`);

    for (const row of rows) {
      const evaluatorName = row[""]?.trim();
      if (!evaluatorName) continue;

      const evaluatorId = nameToId.get(evaluatorName);
      if (!evaluatorId) {
        unmatchedNames.add(evaluatorName);
        continue;
      }

      for (const evaluateeName of header) {
        const cell = row[evaluateeName]?.trim();
        if (cell !== marker) continue;

        const evaluateeId = nameToId.get(evaluateeName.trim());
        if (!evaluateeId) {
          unmatchedNames.add(evaluateeName.trim());
          continue;
        }

        const { error } = await supabase.from("eligible_pairs").upsert(
          {
            evaluator_id: evaluatorId,
            evaluatee_id: evaluateeId,
            is_mandatory: isMandatory,
          },
          { onConflict: "evaluator_id,evaluatee_id" }
        );

        if (error) {
          console.error(
            `  Failed to upsert pair ${evaluatorName} -> ${evaluateeName}:`,
            error.message
          );
        } else if (isMandatory) {
          mandatoryCount++;
        } else {
          eligibleCount++;
        }
      }
    }
  }

  await importMatrix("matrix.csv", false, "X");
  await importMatrix("mandatory.csv", true, "1");

  console.log(`\nImported ${eligibleCount} eligible pairs, ${mandatoryCount} mandatory pairs.`);

  if (unmatchedNames.size > 0) {
    console.warn(
      `\nWARNING: ${unmatchedNames.size} name(s) in the CSVs did not match any person in directory.csv (typos?):`
    );
    for (const name of unmatchedNames) {
      console.warn(`  - "${name}"`);
    }
  } else {
    console.log("\nAll names in matrix.csv/mandatory.csv matched a person in directory.csv.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
