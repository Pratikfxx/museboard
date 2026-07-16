"use client";

import { z } from "zod";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import type { Membership } from "@/domain/collaboration";
import {
  addThinkingContribution,
  contributionReactionSchema,
  createSynthesisRevision,
  createThinkingRoom,
  thinkingContributionSchema,
  thinkingRoomSchema,
  thinkingSynthesisRevisionSchema,
  toggleContributionReaction,
  updateThinkingRoomState,
  type AddThinkingContributionInput,
  type CreateSynthesisRevisionInput,
  type CreateThinkingRoomInput,
  type ThinkingRoomState,
  type ToggleContributionReactionInput,
} from "@/domain/thinking-rooms";
import {
  createDemoState,
  createSampleThinkingRoomData,
  type SampleThinkingRoomData,
} from "@/lib/demo/fixtures";

export const THINKING_ROOM_STORAGE_KEY = "museboard-thinking-rooms-v1";
const fallbackStorage = new Map<string, string>();

const safeThinkingRoomStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = localStorage.getItem(name);
      if (value === null) {
        fallbackStorage.delete(name);
      } else {
        fallbackStorage.set(name, value);
      }
      return value;
    } catch {
      return fallbackStorage.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    fallbackStorage.set(name, value);
    try {
      localStorage.setItem(name, value);
    } catch {
      // The in-memory copy keeps Thinking Rooms usable in this tab.
    }
  },
  removeItem: (name) => {
    fallbackStorage.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {
      // The in-memory copy is already cleared.
    }
  },
};

export type ThinkingRoomSyncState = SampleThinkingRoomData["syncState"];

interface ThinkingRoomActions {
  resetSample: (memberships: readonly Membership[]) => void;
  selectRoom: (roomId?: string) => boolean;
  createRoom: (input: CreateThinkingRoomInput, at?: string) => string | undefined;
  updateRoomStatus: (
    roomId: string,
    status: ThinkingRoomState,
    at?: string,
  ) => boolean;
  addContribution: (
    input: AddThinkingContributionInput,
    at?: string,
  ) => string | undefined;
  updateContribution: (
    contributionId: string,
    body: string,
    at?: string,
  ) => boolean;
  deleteContribution: (contributionId: string, at?: string) => boolean;
  toggleReaction: (
    input: ToggleContributionReactionInput,
    at?: string,
  ) => boolean;
  addSynthesisRevision: (
    input: CreateSynthesisRevisionInput,
    at?: string,
  ) => string | undefined;
  markRoomConverted: (roomId: string, at?: string) => boolean;
  setSyncState: (syncState: ThinkingRoomSyncState) => void;
}

export type ThinkingRoomStoreState = SampleThinkingRoomData & ThinkingRoomActions;

const thinkingRoomDataSchema: z.ZodType<SampleThinkingRoomData> = z.object({
  rooms: z.array(thinkingRoomSchema),
  contributions: z.array(thinkingContributionSchema),
  reactions: z.array(contributionReactionSchema),
  synthesisRevisions: z.array(thinkingSynthesisRevisionSchema),
  selectedRoomId: z.string().min(1).optional(),
  syncState: z.enum(["idle", "syncing", "offline", "error"]),
});

function now(): string {
  return new Date().toISOString();
}

function sampleData(memberships: readonly Membership[]): SampleThinkingRoomData {
  return createSampleThinkingRoomData(memberships);
}

function nextId(prefix: string, existingIds: readonly string[]): string {
  let index = existingIds.length + 1;
  let candidate = `${prefix}-${index}`;
  while (existingIds.includes(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }
  return candidate;
}

function dataFromState(state: ThinkingRoomStoreState): SampleThinkingRoomData {
  return {
    rooms: state.rooms,
    contributions: state.contributions,
    reactions: state.reactions,
    synthesisRevisions: state.synthesisRevisions,
    selectedRoomId: state.selectedRoomId,
    syncState: state.syncState,
  };
}

export const useThinkingRoomStore = create<ThinkingRoomStoreState>()(
  persist<ThinkingRoomStoreState, [], [], SampleThinkingRoomData>(
    (set, get) => ({
      ...sampleData(createDemoState().memberships),

      resetSample: (memberships) => set(sampleData(memberships)),

      selectRoom: (roomId) => {
        if (roomId && !get().rooms.some(({ id }) => id === roomId)) return false;
        set({ selectedRoomId: roomId });
        return true;
      },

      createRoom: (input, at = now()) => {
        const state = get();
        const id = nextId("thinking-room", state.rooms.map(({ id }) => id));
        const room = createThinkingRoom(input, { id, at });
        set((current) => ({
          rooms: [...current.rooms, room],
          selectedRoomId: room.id,
        }));
        return room.id;
      },

      updateRoomStatus: (roomId, status, at = now()) => {
        const state = get();
        const room = state.rooms.find(({ id }) => id === roomId);
        if (!room) return false;
        const updated = updateThinkingRoomState(room, status, {
          at,
          expectedRevision: room.revision,
        });
        set((current) => ({
          rooms: current.rooms.map((candidate) =>
            candidate.id === roomId ? updated : candidate,
          ),
        }));
        return true;
      },

      addContribution: (input, at = now()) => {
        const state = get();
        if (!state.rooms.some(({ id }) => id === input.roomId)) return undefined;
        const id = nextId(
          "thinking-contribution",
          state.contributions.map(({ id: contributionId }) => contributionId),
        );
        const contribution = addThinkingContribution(input, { id, at });
        set((current) => ({
          contributions: [...current.contributions, contribution],
        }));
        return contribution.id;
      },

      updateContribution: (contributionId, body, at = now()) => {
        const state = get();
        const contribution = state.contributions.find(
          ({ id }) => id === contributionId,
        );
        if (!contribution || contribution.deletedAt) return false;
        const updated = thinkingContributionSchema.parse({
          ...contribution,
          body,
          updatedAt: at,
          revision: contribution.revision + 1,
        });
        set((current) => ({
          contributions: current.contributions.map((candidate) =>
            candidate.id === contributionId ? updated : candidate,
          ),
        }));
        return true;
      },

      deleteContribution: (contributionId, at = now()) => {
        const state = get();
        const contribution = state.contributions.find(
          ({ id }) => id === contributionId,
        );
        if (!contribution || contribution.deletedAt) return false;
        const deleted = thinkingContributionSchema.parse({
          ...contribution,
          deletedAt: at,
          updatedAt: at,
          revision: contribution.revision + 1,
        });
        set((current) => ({
          contributions: current.contributions.map((candidate) =>
            candidate.id === contributionId ? deleted : candidate,
          ),
          reactions: current.reactions.filter(
            ({ contributionId: candidateId }) => candidateId !== contributionId,
          ),
        }));
        return true;
      },

      toggleReaction: (input, at = now()) => {
        const state = get();
        const contribution = state.contributions.find(
          ({ id }) => id === input.contributionId,
        );
        if (
          !contribution ||
          contribution.deletedAt ||
          contribution.roomId !== input.roomId
        ) {
          return false;
        }
        const id = nextId(
          "thinking-reaction",
          state.reactions.map(({ id: reactionId }) => reactionId),
        );
        const reactions = toggleContributionReaction(state.reactions, input, {
          id,
          at,
        });
        set({ reactions });
        return true;
      },

      addSynthesisRevision: (input, at = now()) => {
        const state = get();
        if (!state.rooms.some(({ id }) => id === input.roomId)) return undefined;
        const id = nextId(
          "thinking-synthesis",
          state.synthesisRevisions.map(({ id: revisionId }) => revisionId),
        );
        const revision = createSynthesisRevision(
          state.synthesisRevisions,
          input,
          { id, at },
        );
        set((current) => ({
          synthesisRevisions: [...current.synthesisRevisions, revision],
        }));
        return revision.id;
      },

      markRoomConverted: (roomId, at = now()) => {
        const state = get();
        const room = state.rooms.find(({ id }) => id === roomId);
        if (!room) return false;
        if (room.status === "converted") return true;
        if (room.status !== "decided") return false;
        const converted = updateThinkingRoomState(room, "converted", {
          at,
          expectedRevision: room.revision,
        });
        set((current) => ({
          rooms: current.rooms.map((candidate) =>
            candidate.id === roomId ? converted : candidate,
          ),
        }));
        return true;
      },

      setSyncState: (syncState) => set({ syncState }),
    }),
    {
      name: THINKING_ROOM_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeThinkingRoomStorage),
      partialize: dataFromState,
      merge: (persisted, current) => {
        const parsed = thinkingRoomDataSchema.safeParse(persisted);
        return parsed.success
          ? {
              ...current,
              ...parsed.data,
              selectedRoomId: parsed.data.selectedRoomId,
            }
          : current;
      },
    },
  ),
);
