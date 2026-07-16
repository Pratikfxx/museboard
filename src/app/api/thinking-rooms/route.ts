import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import {
  createSupabaseThinkingRoomRepository,
  parseThinkingRoomAggregate,
  type SupabaseThinkingRoomClient,
  type ThinkingRoomAggregate,
} from "@/lib/thinking-rooms/repository";
import { createClient } from "@/lib/supabase/server";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function authenticatedContext() {
  const workspace = await getAuthenticatedWorkspace();
  if (!workspace) return null;
  const supabase = await createClient();
  const repository = createSupabaseThinkingRoomRepository(
    supabase as unknown as SupabaseThinkingRoomClient,
  );
  return { workspace, repository };
}

function creationAttributionMatches(
  aggregate: ThinkingRoomAggregate,
  userId: string,
): boolean {
  return aggregate.room.facilitatorMembershipId === userId &&
    aggregate.contributions.every(({ authorMembershipId }) => authorMembershipId === userId) &&
    aggregate.reactions.every(({ membershipId }) => membershipId === userId) &&
    aggregate.synthesisRevisions.every(
      ({ createdByMembershipId, acceptedByMembershipId }) =>
        createdByMembershipId === userId &&
        (!acceptedByMembershipId || acceptedByMembershipId === userId),
    );
}

export async function GET(request: Request) {
  void request;
  try {
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to view Thinking Rooms" }, { status: 401 });
    }
    const rooms = await context.repository.list(context.workspace.organizationId);
    return NextResponse.json({ rooms }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Thinking Rooms could not be loaded" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 });
    }
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to create a Thinking Room" }, { status: 401 });
    }
    if (context.workspace.role === "viewer") {
      return NextResponse.json({ error: "You cannot create Thinking Rooms" }, { status: 403 });
    }
    const body = z.object({ aggregate: z.unknown() }).parse(await request.json());
    const aggregate = parseThinkingRoomAggregate(body.aggregate);
    if (
      aggregate.room.organizationId !== context.workspace.organizationId ||
      !creationAttributionMatches(aggregate, context.workspace.userId)
    ) {
      return NextResponse.json({ error: "You cannot create this Thinking Room" }, { status: 403 });
    }
    const created = await context.repository.create(aggregate);
    return NextResponse.json({ aggregate: created }, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Thinking Room data is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Thinking Room could not be created" }, { status: 500 });
  }
}
