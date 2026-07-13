import type { PlanCatalogEntry } from "@/domain/entitlements";

export function manualPlanningLabel(
  manualPlanning: PlanCatalogEntry["manualPlanning"],
): string {
  return `${manualPlanning[0].toUpperCase()}${manualPlanning.slice(1)} manual planning`;
}
