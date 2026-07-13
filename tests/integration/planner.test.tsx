import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

function activatePlanner() {
  const workspace = buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "lifestyle_business",
    audience: "Independent designers rebuilding a sustainable creative habit",
    platforms: ["tiktok_video"],
    weeklyCapacityMinutes: 225,
    voice: "Warm, candid, and precise",
    boundaries: "No fake urgency",
    firstHook: "Perfection is costing us the story.",
  });
  workspace.creator.timezone = "Asia/Kolkata";
  workspace.creator.recoveryDays = [4];
  workspace.plannerTasks = workspace.plannerTasks.map((task, index) => ({
    ...task,
    stage: index === 2 ? "shoot" : index === 1 ? "outline" : "hook",
    status: "planned",
    dependencies: index === 2 ? [workspace.plannerTasks[1].id] : [],
    dueAt: task.scheduledFor,
    timezone: "Asia/Kolkata",
  }));
  useMuseboardStore.getState().completeOnboarding(workspace);
  return workspace;
}

describe("creator planner", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("explains real capacity, the default buffer, recovery days, dependencies, and deterministic load", () => {
    const workspace = activatePlanner();
    render(<PlannerWorkspace />);

    expect(screen.getByRole("heading", { name: /your production week/i })).toBeVisible();
    expect(screen.getByText(/225 min capacity/i)).toBeVisible();
    expect(screen.getByText(/180 min planning ceiling/i)).toBeVisible();
    expect(screen.getByText(/20% held as breathing room/i)).toBeVisible();
    expect(screen.getByText(/focused week/i)).toHaveAccessibleDescription(/60–80%/i);
    expect(screen.getByText(/thursday · recovery day/i)).toBeVisible();
    const recordTask = screen.getByRole("article", { name: /record a rough first take/i });
    expect(within(recordTask).getByText(/after outline the first short-form post/i)).toBeVisible();
    expect(screen.getByText(/asia\/kolkata/i)).toBeVisible();
    expect(screen.getByText(/saved in this browser · no server sync/i)).toBeVisible();
    expect(workspace.plannerTasks.every(({ estimatedMinutes }) => estimatedMinutes % 15 === 0)).toBe(true);
  });

  it("moves a task with the keyboard-accessible sheet, persists the UTC instant, and undoes it", async () => {
    const user = userEvent.setup();
    activatePlanner();
    render(<PlannerWorkspace />);
    const task = useMuseboardStore.getState().plannerTasks.find(({ title }) => /record/i.test(title))!;
    const before = task.scheduledFor;

    await user.click(screen.getByRole("button", { name: /move record a rough first take/i }));
    const sheet = screen.getByRole("dialog", { name: /move record a rough first take/i });
    await user.selectOptions(within(sheet).getByLabelText(/day/i), "2026-07-17");
    await user.selectOptions(within(sheet).getByLabelText(/time/i), "10:15");
    await user.click(within(sheet).getByRole("button", { name: /move task/i }));

    const moved = useMuseboardStore.getState().plannerTasks.find(({ id }) => id === task.id)!;
    expect(moved.scheduledFor).not.toBe(before);
    expect(moved.scheduledFor).toBe("2026-07-17T04:45:00.000Z");
    expect(screen.getByRole("status")).toHaveTextContent(/moved.+friday/i);
    expect(screen.getByRole("button", { name: /undo move/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /undo move/i }));
    expect(
      useMuseboardStore.getState().plannerTasks.find(({ id }) => id === task.id)?.scheduledFor,
    ).toBe(before);
  });

  it("supports desktop drag as an enhancement without removing the Move control", () => {
    activatePlanner();
    render(<PlannerWorkspace />);
    const task = useMuseboardStore.getState().plannerTasks[0];
    const card = screen.getByRole("article", { name: task.title });
    const friday = screen.getByRole("group", { name: /friday/i });

    fireEvent.dragStart(card, { dataTransfer: { setData: () => undefined } });
    fireEvent.dragOver(friday);
    fireEvent.drop(friday);

    expect(screen.getByRole("button", { name: new RegExp(`move ${task.title}`, "i") })).toBeVisible();
    expect(useMuseboardStore.getState().plannerTasks[0].scheduledFor).toContain("2026-07-17");
  });

  it("keeps overdue work visible with Move, Done, Skip, and Re-plan actions", async () => {
    const user = userEvent.setup();
    activatePlanner();
    const overdue = useMuseboardStore.getState().plannerTasks[0];
    useMuseboardStore.setState({
      plannerTasks: useMuseboardStore.getState().plannerTasks.map((task) =>
        task.id === overdue.id
          ? {
              ...task,
              status: "missed",
              scheduledFor: "2026-07-10T04:30:00.000Z",
              dueAt: "2026-07-10T04:30:00.000Z",
            }
          : task,
      ),
    });
    render(<PlannerWorkspace />);

    const card = screen.getByRole("article", { name: overdue.title });
    expect(within(card).getByText(/overdue/i)).toBeVisible();
    expect(within(card).getByRole("button", { name: /^move/i })).toBeVisible();
    expect(within(card).getByRole("button", { name: /mark done/i })).toBeVisible();
    expect(within(card).getByRole("button", { name: /^skip/i })).toBeVisible();
    expect(within(card).getByRole("button", { name: /re-plan/i })).toBeVisible();

    await user.click(within(card).getByRole("button", { name: /mark done/i }));
    expect(
      useMuseboardStore.getState().plannerTasks.find(({ id }) => id === overdue.id)?.status,
    ).toBe("done");
  });
});
