import { NextResponse } from "next/server";

import { buildExportPackage, exportSnapshotSchema } from "@/domain/export";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  try {
    const [{ contentId }, payload] = await Promise.all([params, request.json()]);
    const parsed = exportSnapshotSchema.safeParse(payload);
    if (!parsed.success || parsed.data.content.id !== contentId) {
      return NextResponse.json(
        { error: "The export snapshot is incomplete or does not match this draft." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const built = await buildExportPackage(parsed.data);
    return new Response(Buffer.from(built.zip), {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Content-Type": "application/zip",
        "X-Museboard-Filename": built.filename,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The package could not be assembled." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
