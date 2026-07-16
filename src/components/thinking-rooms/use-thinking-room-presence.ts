"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  thinkingRoomPresenceSnapshotSchema,
  type ThinkingRoomPresenceArea,
  type ThinkingRoomPresenceSnapshot,
} from "@/domain/thinking-room-presence";

const EMPTY: ThinkingRoomPresenceSnapshot = { presence: [], claims: [] };

export function useThinkingRoomPresence(input: {
  enabled: boolean;
  roomId: string;
  area: ThinkingRoomPresenceArea;
  isComposing: boolean;
  editingContributionId?: string;
}) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const sequence = useRef(0);
  const stopped = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef({ enabled: input.enabled, area: input.area, isComposing: input.isComposing, editingContributionId: input.editingContributionId });
  const [snapshot, setSnapshot] = useState<ThinkingRoomPresenceSnapshot>(EMPTY);
  const [revoked, setRevoked] = useState(false);
  const [debouncedComposing, setDebouncedComposing] = useState(input.isComposing);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedComposing(input.isComposing), 250);
    return () => window.clearTimeout(timer);
  }, [input.isComposing]);

  const sync = useCallback(async () => {
    const current = latest.current;
    if (!current.enabled || stopped.current || !navigator.onLine || document.visibilityState === "hidden") return;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    const requestSequence = ++sequence.current;
    try {
      if (current.editingContributionId) {
        const renewal = await fetch(`/api/thinking-rooms/${encodeURIComponent(input.roomId)}/edit-claim`, {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: requestController.signal,
          body: JSON.stringify({ contributionId: current.editingContributionId, sessionId, active: true }),
        });
        if (renewal.status === 401 || renewal.status === 403) {
          stopped.current = true;
          setRevoked(true);
          setSnapshot(EMPTY);
          return;
        }
      }
      const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(input.roomId)}/presence`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        signal: requestController.signal,
        body: JSON.stringify({ sessionId, area: current.area, isComposing: current.isComposing }),
      });
      if (requestSequence !== sequence.current) return;
      if (response.status === 401 || response.status === 403) {
        stopped.current = true;
        setRevoked(true);
        setSnapshot(EMPTY);
        return;
      }
      if (!response.ok) return;
      const parsed = thinkingRoomPresenceSnapshotSchema.safeParse(await response.json());
      if (parsed.success) setSnapshot(parsed.data);
    } catch {
      // Presence is intentionally best-effort and never blocks room work.
    }
  }, [input.roomId, sessionId]);

  useEffect(() => {
    latest.current = { enabled: input.enabled, area: input.area, isComposing: debouncedComposing, editingContributionId: input.editingContributionId };
    if (input.enabled) queueMicrotask(() => void sync());
  }, [debouncedComposing, input.area, input.editingContributionId, input.enabled, sync]);

  useEffect(() => {
    if (!input.enabled) {
      stopped.current = false;
      return;
    }
    stopped.current = false;
    const interval = window.setInterval(() => void sync(), 8000);
    const resync = () => {
      if (document.visibilityState === "visible" && navigator.onLine) void sync();
    };
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", resync);
      document.removeEventListener("visibilitychange", resync);
      controller.current?.abort();
      sequence.current += 1;
      try {
        const leave = fetch(`/api/thinking-rooms/${encodeURIComponent(input.roomId)}/presence`, {
          method: "DELETE",
          credentials: "same-origin",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        void Promise.resolve(leave).catch(() => undefined);
      } catch {
        // Test and shutdown environments may already have removed fetch.
      }
    };
  }, [input.enabled, input.roomId, sessionId, sync]);

  const changeClaim = useCallback(async (contributionId: string, active: boolean) => {
    const response = await fetch(`/api/thinking-rooms/${encodeURIComponent(input.roomId)}/edit-claim`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contributionId, sessionId, active }),
    });
    if (response.status === 401 || response.status === 403) {
      stopped.current = true;
      setRevoked(true);
      setSnapshot(EMPTY);
    }
    if (response.ok) void sync();
    return response;
  }, [input.roomId, sessionId, sync]);

  return { snapshot: input.enabled ? snapshot : EMPTY, sessionId, revoked, sync, changeClaim };
}
