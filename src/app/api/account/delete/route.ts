export async function POST() {
  return Response.json(
    {
      error: "sample_local_only",
      message:
        "No cloud account exists for this sample workspace. Delete local data from Data settings.",
      retryable: false,
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
