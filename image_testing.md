# Image testing rules (photo diagnosis)
- Always send base64-encoded JPEG/PNG/WEBP with real visual features (no blank or solid-colour images).
- Re-detect MIME after any conversion; animated images use the first frame only.
- Resize large images to reasonable bounds (the app resizes to max 1280px JPEG client-side).
- Endpoint: POST /api/issues/diagnose {photo_base64, note} → {ok, draft} or {ok:false, message} (fallback path).
