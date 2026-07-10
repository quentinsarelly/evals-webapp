import { supabase } from "../supabase";
import { Category } from "../types";

interface CategoryRow {
  id: string;
  key: string;
  label_es: string;
  display_order: number;
  max_wins: number;
  max_areas: number;
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    key: row.key,
    labelEs: row.label_es,
    displayOrder: row.display_order,
    hasRating: true,
    hasWinsAreas: true,
    maxWins: row.max_wins,
    maxAreas: row.max_areas,
  };
}

let cachedCategories: Category[] | null = null;

/** Categories rarely change mid-cycle; cache the small (4-row) table in memory. */
export async function listCategories(): Promise<Category[]> {
  if (cachedCategories) return cachedCategories;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order");

  if (error) throw error;
  cachedCategories = (data ?? []).map(mapCategory);
  return cachedCategories;
}
