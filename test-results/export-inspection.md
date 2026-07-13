# Export package inspection

Inspected `test-results/artifacts/museboard-inspection.zip`, generated through the real `POST /api/export/content-inspection` route on 2026-07-13.

- Filename contract: route returned a versioned Museboard ZIP for YouTube Shorts version 3.
- ZIP entries: `README.md`, `caption.txt`, `script.md`, `shot-list.csv`, `publish-checklist.md`, `metadata/youtube-shorts.json`, and `manifest.json` only.
- Integrity: every non-manifest entry's extracted SHA-256 matched its descriptor in `manifest.json`.
- Self-hash safety: `manifest.json` is intentionally not listed in its own `files` array; the immutable export record stores its SHA-256 separately.
- Rights: `Reference beat — audio rights unknown` appeared under `validation.excludedAssetReferences` and in README guidance; no `assets/` entry was created.
- Metadata: YouTube Shorts, 9:16, safe-zone guidance, disclosure reminder, native-finish guidance, and `references_only` audio status were present.
- Validation: manifest status was `passed`; version ID was `content-inspection-v3`.
- Determinism: the focused integration test generated the same explicit snapshot twice and asserted byte-for-byte equality.

Result: package contract and extracted contents passed direct inspection.
