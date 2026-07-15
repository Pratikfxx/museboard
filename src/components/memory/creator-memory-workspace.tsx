"use client";

import { Brain, CheckCircle, Quotes } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./creator-memory.module.css";

function lines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean))];
}

function memoryDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function CreatorMemoryWorkspace() {
  const memory = useMuseboardStore((state) => state.creatorMemory);
  const updateCreatorMemory = useMuseboardStore((state) => state.updateCreatorMemory);
  const [preferred, setPreferred] = useState(memory.preferredPhrases.join("\n"));
  const [avoid, setAvoid] = useState(memory.avoidPhrases.join("\n"));
  const [structures, setStructures] = useState(memory.preferredStructures.join("\n"));
  const [notes, setNotes] = useState(memory.notes.join("\n"));
  const [status, setStatus] = useState("Review what Museboard should remember before it influences a draft.");

  function save(event: React.FormEvent) {
    event.preventDefault();
    const ok = updateCreatorMemory({
      preferredPhrases: lines(preferred),
      avoidPhrases: lines(avoid),
      preferredStructures: lines(structures),
      notes: lines(notes),
    });
    const version = useMuseboardStore.getState().creatorMemory.version;
    setStatus(ok ? `Memory revision ${version} saved. Future voice work can cite this revision.` : "Memory could not be saved. Remove blank or invalid entries and try again.");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p>Creator memory</p><h1>Teach the system<br />what sounds like you.</h1><span>Inspectable, editable, and versioned. Nothing is inferred silently.</span></div>
        <div className={styles.revision}><Brain aria-hidden="true" size={28} /><strong>Revision {memory.version}</strong><small>Updated {memoryDate(memory.updatedAt)}</small></div>
      </header>

      <p className={styles.status} role="status"><CheckCircle aria-hidden="true" size={18} />{status}</p>

      <form className={styles.form} onSubmit={save}>
        <section className={styles.intro}><Quotes aria-hidden="true" size={34} /><h2>Your language rules</h2><p>One item per line. Keep only guidance you would be comfortable giving a human collaborator.</p></section>
        <label>Phrases to favor<textarea aria-label="Phrases to favor" onChange={(event) => setPreferred(event.target.value)} placeholder={"Show the tradeoff\nClear beats clever"} rows={6} value={preferred} /><small>Reusable phrases and tones that feel natural.</small></label>
        <label>Phrases to avoid<textarea aria-label="Phrases to avoid" onChange={(event) => setAvoid(event.target.value)} placeholder={"Game-changing\nYou won't believe"} rows={6} value={avoid} /><small>Claims, clichés, or tones that break trust.</small></label>
        <label>Structures that work<textarea aria-label="Structures that work" onChange={(event) => setStructures(event.target.value)} placeholder={"Tension → decision → lesson"} rows={5} value={structures} /><small>Story and teaching patterns to reuse intentionally.</small></label>
        <label>Voice notes<textarea aria-label="Voice notes" onChange={(event) => setNotes(event.target.value)} placeholder={"Warm, candid, precise"} rows={5} value={notes} /><small>Higher-level guidance for collaborators and workshops.</small></label>
        <footer><Link href="/app/settings/data">Data controls</Link><button type="submit">Save memory revision</button></footer>
      </form>
    </div>
  );
}
