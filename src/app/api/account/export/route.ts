export async function POST() {
  return Response.json(
    {
      error: "sample_local_only",
      message:
        "This workspace is stored only in this browser. Download its JSON from Data settings.",
      retryable: false,
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
