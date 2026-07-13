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
import { useMemo, useState } from "react";

import { plannerLoadLabel, type PlannerTask } from "@/domain/planner";
import { DEMO_NOW } from "@/lib/demo/fixtures";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./planner.module.css";

const days = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(DEMO_NOW);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
});

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

export function localDateTimeToUtc(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = desired;
  for (let pass = 0; pass < 3; pass += 1) {
    const formatted = partsInZone(new Date(guess).toISOString(), timezone);
    const [fy, fm, fd] = formatted.date.split("-").map(Number);
    const [fh, fmin] = formatted.time.split(":").map(Number);
    const represented = Date.UTC(fy, fm - 1, fd, fh, fmin, 0, 0);
    guess += desired - represented;
  }
  return new Date(guess).toISOString();
}

function dayLabel(date: string, timezone: string) {
  const instant = localDateTimeToUtc(date, "12:00", timezone);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: timezone }).format(new Date(instant));
}

function weekdayIndex(date: string, timezone: string) {
  const instant = localDateTimeToUtc(date, "12:00", timezone);
  const short = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone }).format(new Date(instant));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

function MoveDialog({ task, timezone, onClose, onMove }: { task: PlannerTask; timezone: string; onClose: () => void; onMove: (date: string, time: string) => void }) {
  const parts = task.scheduledFor ? partsInZone(task.scheduledFor, timezone) : { date: days[0], time: "09:00" };
  const [date, setDate] = useState(parts.date);
  const [time, setTime] = useState(parts.time);
  const times = Array.from({ length: 49 }, (_, index) => {
    const minutes = 7 * 60 + index * 15;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
  return (
    <div className={styles.scrim} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-modal="true" aria-label={`Move ${task.title}`} className={styles.dialog} role="dialog">
        <header><div><p>Accessible reschedule</p><h2>Move {task.title}</h2></div><button aria-label="Close move dialog" onClick={onClose} type="button">×</button></header>
        <label>Day<select aria-label="Day" onChange={(event) => setDate(event.target.value)} value={date}>{days.map((value) => <option key={value} value={value}>{dayLabel(value, timezone)}</option>)}</select></label>
        <label>Time<select aria-label="Time" onChange={(event) => setTime(event.target.value)} value={time}>{times.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <p>Shown in {timezone}. Museboard stores the matching UTC instant.</p>
        <div><button onClick={onClose} type="button">Cancel</button><button className={styles.moveConfirm} onClick={() => onMove(date, time)} type="button">Move task</button></div>
      </section>
    </div>
  );
}

export function PlannerWorkspace() {
  const creator = useMuseboardStore((state) => state.creator);
  const tasks = useMuseboardStore((state) => state.plannerTasks);
  const plannerUndo = useMuseboardStore((state) => state.plannerUndo);
  const reschedule = useMuseboardStore((state) => state.reschedulePlannerTask);
  const updateStatus = useMuseboardStore((state) => state.updatePlannerTaskStatus);
  const undo = useMuseboardStore((state) => state.undoPlannerChange);
  const [movingId, setMovingId] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [status, setStatus] = useState("");
  const timezone = creator?.timezone ?? "UTC";
  const capacity = creator?.weeklyCapacityMinutes ?? 300;
  const ceiling = Math.floor((capacity * 0.8) / 15) * 15;
  const planned = tasks.filter(({ status: taskStatus }) => taskStatus !== "cancelled" && taskStatus !== "done").reduce((sum, task) => sum + Math.ceil(task.estimatedMinutes / 15) * 15, 0);
  const load = plannerLoadLabel(planned, capacity);
  const loadTitle = `${load[0].toUpperCase()}${load.slice(1)} week`;
  const moving = tasks.find(({ id }) => id === movingId);

  const taskTitle = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);

  function move(task: PlannerTask, date: string, time: string) {
    const instant = localDateTimeToUtc(date, time, timezone);
    reschedule(task.id, instant, timezone);
    setMovingId(undefined);
    setStatus(`Moved ${task.title} to ${dayLabel(date, timezone)}.`);
  }

  function dropOn(date: string) {
    const task = tasks.find(({ id }) => id === draggingId);
    if (!task) return;
    const local = task.scheduledFor ? partsInZone(task.scheduledFor, timezone).time : "09:00";
    move(task, date, local);
    setDraggingId(undefined);
  }

  function overdue(task: PlannerTask) {
    return task.status === "missed" || Boolean(task.dueAt && new Date(task.dueAt) < new Date(DEMO_NOW));
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}><div><p>Sample workspace · not live</p><h1>Your production week</h1><span>Plan creative energy, not just empty hours.</span></div><div className={styles.timezone}><Clock aria-hidden="true" size={18} /><span><strong>{timezone}</strong><small>Saved in this browser · no server sync</small></span></div></header>

      <section aria-label="Weekly capacity" className={styles.capacity}>
        <div><strong>{capacity} min capacity</strong><span>{ceiling} min planning ceiling</span><small>20% held as breathing room</small></div>
        <div className={styles.load} data-load={load}><span>{Math.round((planned / capacity) * 100)}%</span><strong aria-describedby="focused-load-description">{loadTitle}</strong><small>{planned} minutes currently planned</small><i className={styles.srOnly} id="focused-load-description">60–80% of capacity keeps creative load sustainable</i></div>
        <div className={styles.capacityTrack}><span style={{ width: `${Math.min(100, (planned / capacity) * 100)}%` }} /><i style={{ left: "80%" }} /></div>
      </section>

      <div className={styles.explanation}><Info aria-hidden="true" size={20} /><p><strong>Museboard stops at 80% by default.</strong> Tasks are rounded to 15 minutes, dependencies remain visible, and recovery days keep their breathing room.</p></div>

      <div className={styles.week}>
        {days.map((date) => {
          const dayTasks = tasks.filter((task) => task.scheduledFor && (partsInZone(task.scheduledFor, timezone).date === date || (date === days[0] && overdue(task))));
          const recovery = creator?.recoveryDays?.includes(weekdayIndex(date, timezone));
          const label = dayLabel(date, timezone);
          return (
            <section aria-label={label} className={styles.day} key={date} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOn(date)} role="group">
              <header><div><strong>{label.split(", ")[0]}</strong><small>{label.split(", ")[1]}</small></div>{recovery ? <span><MoonStars aria-hidden="true" size={15} /> {label.split(", ")[0]} · recovery day</span> : null}</header>
              <div className={styles.dayTasks}>{dayTasks.length ? dayTasks.map((task) => (
                <article aria-label={task.title} className={styles.task} draggable key={task.id} onDragStart={(event) => { setDraggingId(task.id); event.dataTransfer?.setData("text/plain", task.id); }}>
                  <div className={styles.taskTop}><DotsSixVertical aria-hidden="true" size={18} /><span>{task.stage ?? "creative block"}</span><small>{task.estimatedMinutes}m</small></div>
                  <h2>{task.title}</h2>
                  {task.dependencies?.length ? <p>After {task.dependencies.map((id) => taskTitle.get(id) ?? id).join(", ")}</p> : null}
                  {overdue(task) ? <strong className={styles.overdue}>Overdue · choose what happens next</strong> : null}
                  <div className={styles.taskActions}>
                    <button onClick={() => setMovingId(task.id)} type="button">Move {task.title}</button>
                    {overdue(task) ? <><button aria-label={`Mark done ${task.title}`} onClick={() => { updateStatus(task.id, "done"); setStatus(`Marked ${task.title} done.`); }} type="button"><Check aria-hidden="true" size={15} /> Mark done</button><button aria-label={`Skip ${task.title}`} onClick={() => { updateStatus(task.id, "cancelled"); setStatus(`Skipped ${task.title}.`); }} type="button"><SkipForward aria-hidden="true" size={15} /> Skip</button><button aria-label={`Re-plan ${task.title}`} onClick={() => setMovingId(task.id)} type="button"><CalendarBlank aria-hidden="true" size={15} /> Re-plan</button></> : null}
                  </div>
                </article>
              )) : <p className={styles.open}>Open buffer</p>}</div>
            </section>
          );
        })}
      </div>

      <footer className={styles.statusBar}><p aria-live="polite" role="status">{status}</p>{plannerUndo ? <button onClick={() => { undo(); setStatus(`Restored ${plannerUndo.before.title} to its previous time.`); }} type="button"><ArrowCounterClockwise aria-hidden="true" size={18} /> Undo move</button> : null}</footer>
      {moving ? <MoveDialog onClose={() => setMovingId(undefined)} onMove={(date, time) => move(moving, date, time)} task={moving} timezone={timezone} /> : null}
    </div>
  );
}
