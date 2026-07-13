"use client";

import {
  ArrowCounterClockwise,
  CalendarBlank,
  Check,
  Clock,
  DotsSixVertical,
  Info,
  MoonStars,
  SkipForward,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { plannerLoadLabel, type PlannerTask } from "@/domain/planner";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./planner.module.css";

function partsInZone(instant: string, timezone: string) {
  const values: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant))) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

/** Resolves repeated wall times to the earlier instant and rejects nonexistent DST-gap times. */
export function localDateTimeToUtc(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Choose a valid local date and time.");
  }
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const candidates: number[] = [];
  try {
    for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
      const candidate = desired + offsetMinutes * 60_000;
      const rendered = partsInZone(new Date(candidate).toISOString(), timezone);
      if (rendered.date === date && rendered.time === time) candidates.push(candidate);
    }
  } catch {
    throw new Error(`Timezone ${timezone} is not supported.`);
  }
  if (!candidates.length) {
    throw new Error(`${date} at ${time} does not exist in ${timezone} because of a clock change.`);
  }
  return new Date(Math.min(...candidates)).toISOString();
}

function addLocalDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function weekdayIndex(date: string, timezone: string) {
  let instant: string;
  let displayZone = timezone;
  try {
    instant = localDateTimeToUtc(date, "12:00", timezone);
  } catch {
    instant = `${date}T12:00:00.000Z`;
    displayZone = "UTC";
  }
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: displayZone }).format(new Date(instant));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function weekDates(anchorInstant: string, timezone: string) {
  const anchorDate = partsInZone(anchorInstant, timezone).date;
  const daysSinceMonday = (weekdayIndex(anchorDate, timezone) + 6) % 7;
  const monday = addLocalDays(anchorDate, -daysSinceMonday);
  return Array.from({ length: 7 }, (_, index) => addLocalDays(monday, index));
}

function dayLabel(date: string, timezone: string) {
  try {
    const instant = localDateTimeToUtc(date, "12:00", timezone);
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: timezone }).format(new Date(instant));
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00.000Z`));
  }
}

function MoveDialog({
  task,
  timezone,
  days,
  onClose,
  onMove,
}: {
  task: PlannerTask;
  timezone: string;
  days: string[];
  onClose: () => void;
  onMove: (date: string, time: string) => string | undefined;
}) {
  const parts = task.scheduledFor ? partsInZone(task.scheduledFor, timezone) : { date: days[0], time: "09:00" };
  const [date, setDate] = useState(days.includes(parts.date) ? parts.date : days[0]);
  const [time, setTime] = useState(parts.time);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const dayRef = useRef<HTMLSelectElement>(null);
  const timeRef = useRef<HTMLSelectElement>(null);
  const times = Array.from({ length: 49 }, (_, index) => {
    const minutes = 7 * 60 + index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });

  useEffect(() => {
    dayRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button, select, [href], [tabindex]:not([tabindex='-1'])") ?? [])]
      .filter((element) => !element.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function submitMove() {
    const moveError = onMove(date, time);
    if (!moveError) return;
    setError(moveError);
    queueMicrotask(() => timeRef.current?.focus());
  }

  return (
    <div className={styles.scrim} onKeyDown={handleKeyDown} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-modal="true" aria-label={`Move ${task.title}`} className={styles.dialog} ref={dialogRef} role="dialog">
        <header><div><p>Accessible reschedule</p><h2>Move {task.title}</h2></div><button aria-label="Close move dialog" onClick={onClose} type="button">×</button></header>
        <label>Day<select aria-label="Day" onChange={(event) => { setDate(event.target.value); setError(""); }} ref={dayRef} value={date}>{days.map((value) => <option key={value} value={value}>{dayLabel(value, timezone)}</option>)}</select></label>
        <label>Time<select aria-describedby={error ? "move-time-error" : undefined} aria-invalid={error ? true : undefined} aria-label="Time" onChange={(event) => { setTime(event.target.value); setError(""); }} ref={timeRef} value={time}>{times.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        {error ? <p className={styles.dialogError} id="move-time-error" role="alert">{error}</p> : null}
        <p>Shown in {timezone}. Repeated clock-change times use the earlier instant; nonexistent times are rejected.</p>
        <div><button onClick={onClose} type="button">Cancel</button><button className={styles.moveConfirm} onClick={submitMove} type="button">Move task</button></div>
      </section>
    </div>
  );
}

export function PlannerWorkspace({ now }: { now?: string } = {}) {
  const creator = useMuseboardStore((state) => state.creator);
  const tasks = useMuseboardStore((state) => state.plannerTasks);
  const plannerUndo = useMuseboardStore((state) => state.plannerUndo);
  const reschedule = useMuseboardStore((state) => state.reschedulePlannerTask);
  const updateStatus = useMuseboardStore((state) => state.updatePlannerTaskStatus);
  const undo = useMuseboardStore((state) => state.undoPlannerChange);
  const [movingId, setMovingId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [status, setStatus] = useState("");
  const openerRef = useRef<HTMLButtonElement | undefined>(undefined);
  const [currentInstant] = useState(() => now ?? new Date().toISOString());
  const timezone = creator?.timezone ?? "UTC";
  const days = useMemo(() => weekDates(currentInstant, timezone), [currentInstant, timezone]);
  const capacity = creator?.weeklyCapacityMinutes ?? 300;
  const ceiling = Math.floor((capacity * 0.8) / 15) * 15;
  const planned = tasks
    .filter((task) => task.status !== "cancelled" && task.status !== "done" && task.scheduledFor && days.includes(partsInZone(task.scheduledFor, timezone).date))
    .reduce((sum, task) => sum + Math.ceil(task.estimatedMinutes / 15) * 15, 0);
  const load = plannerLoadLabel(planned, capacity);
  const loadTitle = `${load[0].toUpperCase()}${load.slice(1)} week`;
  const moving = tasks.find(({ id }) => id === movingId);
  const taskTitle = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);

  function closeMove() {
    setMovingId(undefined);
    queueMicrotask(() => openerRef.current?.focus());
  }

  function openMove(taskId: string, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setMovingId(taskId);
  }

  function move(task: PlannerTask, date: string, time: string) {
    try {
      const instant = localDateTimeToUtc(date, time, timezone);
      reschedule(task.id, instant, timezone);
      closeMove();
      setStatus(`Moved ${task.title} to ${dayLabel(date, timezone)}.`);
      return undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : "That local time could not be scheduled.";
      setStatus(message);
      return message;
    }
  }

  function dropOn(date: string) {
    const task = tasks.find(({ id }) => id === draggingId);
    if (!task) return;
    const local = task.scheduledFor ? partsInZone(task.scheduledFor, timezone).time : "09:00";
    move(task, date, local);
    setDraggingId(undefined);
  }

  function overdue(task: PlannerTask) {
    const dueAt = task.dueAt ?? task.scheduledFor;
    return task.status === "missed" || Boolean(dueAt && new Date(dueAt) < new Date(currentInstant));
  }

  function taskCard(task: PlannerTask) {
    return (
      <article aria-label={task.title} className={styles.task} draggable key={task.id} onDragStart={(event) => { setDraggingId(task.id); event.dataTransfer?.setData("text/plain", task.id); }}>
        <div className={styles.taskTop}><DotsSixVertical aria-hidden="true" size={18} /><span>{task.stage ?? "creative block"}</span><small>{task.estimatedMinutes}m</small></div>
        <h2>{task.title}</h2>
        {task.dependencies?.length ? <p>After {task.dependencies.map((id) => taskTitle.get(id) ?? id).join(", ")}</p> : null}
        {overdue(task) ? <strong className={styles.overdue}>Overdue · choose what happens next</strong> : null}
        <div className={styles.taskActions}>
          <button onClick={(event) => openMove(task.id, event.currentTarget)} type="button">Move {task.title}</button>
          {overdue(task) ? <><button aria-label={`Mark done ${task.title}`} onClick={() => { updateStatus(task.id, "done"); setStatus(`Marked ${task.title} done.`); }} type="button"><Check aria-hidden="true" size={15} /> Mark done</button><button aria-label={`Skip ${task.title}`} onClick={() => { updateStatus(task.id, "cancelled"); setStatus(`Skipped ${task.title}.`); }} type="button"><SkipForward aria-hidden="true" size={15} /> Skip</button><button aria-label={`Re-plan ${task.title}`} onClick={(event) => openMove(task.id, event.currentTarget)} type="button"><CalendarBlank aria-hidden="true" size={15} /> Re-plan</button></> : null}
        </div>
      </article>
    );
  }

  const outsideTasks = tasks.filter((task) =>
    task.status !== "cancelled"
    && task.status !== "done"
    && (!task.scheduledFor || !days.includes(partsInZone(task.scheduledFor, timezone).date)),
  );

  return (
    <>
      <div aria-hidden={moving ? true : undefined} className={styles.page} inert={moving ? true : undefined}>
        <header className={styles.header}><div><p>Sample workspace · not live</p><h1>Your production week</h1><span>Plan creative energy, not just empty hours.</span></div><div className={styles.timezone}><Clock aria-hidden="true" size={18} /><span><strong>{timezone}</strong><small>Saved in this browser · no server sync</small></span></div></header>

        <section aria-label="Weekly capacity" className={styles.capacity}>
          <div><strong>{capacity} min capacity</strong><span>{ceiling} min planning ceiling</span><small>20% held as breathing room</small></div>
          <div className={styles.load} data-load={load}><span>{Math.round((planned / capacity) * 100)}%</span><strong aria-describedby="focused-load-description">{loadTitle}</strong><small>{planned} minutes currently planned</small><i className={styles.srOnly} id="focused-load-description">60–80% of capacity keeps creative load sustainable</i></div>
          <div className={styles.capacityTrack}><span style={{ width: `${Math.min(100, (planned / capacity) * 100)}%` }} /><i style={{ left: "80%" }} /></div>
        </section>

        <div className={styles.explanation}><Info aria-hidden="true" size={20} /><p><strong>Museboard stops at 80% by default.</strong> Tasks are rounded to 15 minutes, dependencies remain visible, and recovery days keep their breathing room.</p></div>

        <div className={styles.week}>
          {days.map((date) => {
            const dayTasks = tasks.filter((task) =>
              task.status !== "cancelled"
              && task.status !== "done"
              && task.scheduledFor
              && partsInZone(task.scheduledFor, timezone).date === date,
            );
            const recovery = creator?.recoveryDays?.includes(weekdayIndex(date, timezone));
            const label = dayLabel(date, timezone);
            return (
              <section aria-label={label} className={styles.day} key={date} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(date)} role="group">
                <header><div><strong>{label.split(", ")[0]}</strong><small>{label.split(", ")[1]}</small></div>{recovery ? <span><MoonStars aria-hidden="true" size={15} /> {label.split(", ")[0]} · recovery day</span> : null}</header>
                <div className={styles.dayTasks}>{dayTasks.length ? dayTasks.map(taskCard) : <p className={styles.open}>Open buffer</p>}</div>
              </section>
            );
          })}
        </div>

        {outsideTasks.length ? <section aria-labelledby="outside-week-heading" className={styles.outsideWeek}><div><p>Needs a decision</p><h2 id="outside-week-heading">Outside this week</h2><span>Overdue, future, and unscheduled work stays visible until you move, finish, or skip it.</span></div><div className={styles.outsideGrid}>{outsideTasks.map(taskCard)}</div></section> : null}

        <footer className={styles.statusBar}><p aria-live="polite" role="status">{status}</p>{plannerUndo ? <button onClick={() => { undo(); setStatus(`Restored ${plannerUndo.before.title} to its previous time.`); }} type="button"><ArrowCounterClockwise aria-hidden="true" size={18} /> Undo move</button> : null}</footer>
      </div>
      {moving ? <MoveDialog days={days} onClose={closeMove} onMove={(date, time) => move(moving, date, time)} task={moving} timezone={timezone} /> : null}
    </>
  );
}
