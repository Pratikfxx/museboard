import { z } from "zod";

const PLANNER_INCREMENT_MINUTES = 15;
const DEFAULT_LOAD_FACTOR = 0.8;

export interface PlannerTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: number;
  opportunityScore: number;
  contentId?: string;
  scheduledFor?: string;
  dueAt?: string;
  stage?: "evidence" | "angle" | "hook" | "outline" | "script" | "shoot" | "review" | "ready";
  status?: "planned" | "in_progress" | "done" | "missed" | "cancelled";
  dependencies?: string[];
  timezone?: string;
}

export interface ScheduledPlannerTask extends PlannerTask {
  scheduledMinutes: number;
}

export interface WeeklyPlan {
  availableMinutes: number;
  scheduledMinutes: number;
  scheduled: ScheduledPlannerTask[];
  unscheduled: PlannerTask[];
}

export const plannerTaskSchema: z.ZodType<PlannerTask> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  estimatedMinutes: z.number().positive(),
  priority: z.number().min(0).max(100),
  opportunityScore: z.number().min(0).max(100),
  contentId: z.string().min(1).optional(),
  scheduledFor: z.iso.datetime().optional(),
  dueAt: z.iso.datetime().optional(),
  stage: z
    .enum(["evidence", "angle", "hook", "outline", "script", "shoot", "review", "ready"])
    .optional(),
  status: z.enum(["planned", "in_progress", "done", "missed", "cancelled"]).optional(),
  dependencies: z.array(z.string().min(1)).optional(),
  timezone: z.string().min(1).optional(),
});

export type PlannerLoadLabel = "comfortable" | "focused" | "heavy" | "overloaded";

export function plannerLoadLabel(scheduledMinutes: number, capacityMinutes: number): PlannerLoadLabel {
  if (capacityMinutes <= 0) return scheduledMinutes > 0 ? "overloaded" : "comfortable";
  const load = scheduledMinutes / capacityMinutes;
  if (load < 0.6) return "comfortable";
  if (load <= 0.8) return "focused";
  if (load <= 1) return "heavy";
  return "overloaded";
}

function roundedMinutes(minutes: number): number {
  return Math.ceil(minutes / PLANNER_INCREMENT_MINUTES) * PLANNER_INCREMENT_MINUTES;
}

function rankingScore(task: PlannerTask): number {
  return task.priority * 0.65 + task.opportunityScore * 0.35;
}

export function planWeek({
  capacityMinutes,
  tasks,
  loadFactor = DEFAULT_LOAD_FACTOR,
}: {
  capacityMinutes: number;
  tasks: PlannerTask[];
  loadFactor?: number;
}): WeeklyPlan {
  const safeCapacity = Math.max(0, capacityMinutes);
  const safeLoad = Math.min(1, Math.max(0, loadFactor));
  const availableMinutes =
    Math.floor(
      (safeCapacity * safeLoad) / PLANNER_INCREMENT_MINUTES,
    ) * PLANNER_INCREMENT_MINUTES;
  const ranked = [...tasks].sort(
    (left, right) =>
      rankingScore(right) - rankingScore(left) || left.id.localeCompare(right.id),
  );
  const scheduled: ScheduledPlannerTask[] = [];
  const unscheduled: PlannerTask[] = [];
  let scheduledMinutes = 0;

  for (const task of ranked) {
    const duration = roundedMinutes(task.estimatedMinutes);

    if (scheduledMinutes + duration <= availableMinutes) {
      scheduled.push({ ...task, scheduledMinutes: duration });
      scheduledMinutes += duration;
    } else {
      unscheduled.push({ ...task });
    }
  }

  return { availableMinutes, scheduledMinutes, scheduled, unscheduled };
}
