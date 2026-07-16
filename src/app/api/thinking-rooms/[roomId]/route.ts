import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseThinkingRoomRepository,
  parseThinkingRoomAggregate,
  ThinkingRoomRevisionConflictError,
  ThinkingRoomValidationError,
  type SupabaseThinkingRoomClient,
} from "@/lib/thinking-rooms/repository";

interface RoomRouteContext {
  params: Promise<{ roomId: string }>;
}

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

export async function GET(_request: Request, routeContext: RoomRouteContext) {
  try {
    const { roomId } = await routeContext.params;
    z.uuid().parse(roomId);
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to view this Thinking Room" }, { status: 401 });
    }
    const aggregate = await context.repository.load(
      context.workspace.organizationId,
      roomId,
    );
    if (!aggregate) {
      return NextResponse.json({ error: "Thinking Room was not found" }, { status: 404 });
    }
    return NextResponse.json({ aggregate }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Thinking Room identifier is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Thinking Room could not be loaded" }, { status: 500 });
  }
}

export async function PUT(request: Request, routeContext: RoomRouteContext) {
  try {
    if (!sameOrigin(request)) {
      return NextResponse.json({ error: "Request origin is not allowed" }, { status: 403 });
    }
    const { roomId } = await routeContext.params;
    z.uuid().parse(roomId);
    const context = await authenticatedContext();
    if (!context) {
      return NextResponse.json({ error: "Sign in to save this Thinking Room" }, { status: 401 });
    }
    if (context.workspace.role === "viewer") {
      return NextResponse.json({ error: "You cannot edit Thinking Rooms" }, { status: 403 });
    }
    const body = z.object({
      expectedRevision: z.number().int().positive(),
      aggregate: z.unknown(),
    }).parse(await request.json());
    const aggregate = parseThinkingRoomAggregate(body.aggregate);
    if (
      aggregate.room.id !== roomId ||
      aggregate.room.organizationId !== context.workspace.organizationId
    ) {
      return NextResponse.json({ error: "You cannot edit this Thinking Room" }, { status: 403 });
    }
    const saved = await context.repository.save({
      expectedRevision: body.expectedRevision,
      aggregate,
    });
    return NextResponse.json({ aggregate: saved }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof ThinkingRoomRevisionConflictError) {
      return NextResponse.json(
        { code: "revision_conflict", error: error.message },
        { status: 409 },
      );
    }
    if (error instanceof z.ZodError || error instanceof ThinkingRoomValidationError) {
      return NextResponse.json({ error: "Thinking Room data is invalid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Thinking Room could not be saved" }, { status: 500 });
  }
}
