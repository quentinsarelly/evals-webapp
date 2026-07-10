/**
 * On-sheet question text per category, verified directly against
 * Retro File Template.xlsx (rows 26/30/34/38). Kept as static UI copy
 * rather than a DB column since it's presentation text tied to this form
 * design, not data the export function or admin needs to read.
 */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  work_understanding:
    "¿El empleado sabe cómo realizar el trabajo de manera completa y correcta?",
  business_impact:
    "Resultados / Impacto en el negocio (KPIs, ventas, margen, proyectos clave)",
  personal_skills:
    "¿El empleado posee las habilidades positivas relacionadas a su trabajo en equipo, como respeto, actitud, manejo de estrés?",
  dedication:
    "¿Qué tan precisa, completa y oportuna son las entregas y la motivación del empleado con la empresa?",
};

export const RATING_LABELS: Record<number, string> = {
  1: "Insatisfactorio",
  2: "Satisfactorio",
  3: "Regular / Neutral",
  4: "Bueno",
  5: "Excelente",
  6: "Sobresaliente",
};
