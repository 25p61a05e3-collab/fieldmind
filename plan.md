# FieldMind implementation plan

## Product outcome

FieldMind is a focused workspace for one persona—a field service technician—working one workflow—recurring equipment troubleshooting. The product's value is the persistent memory loop:

`incident → Hindsight recall → Groq recommendation → technician resolution → Hindsight retain → improved future recommendation`

MongoDB Atlas stores structured application records. Hindsight is the real operational memory layer and is never replaced by localStorage, hardcoded memories, or ordinary MongoDB searches.

## Architecture

- **Frontend:** React + Vite + TypeScript + Tailwind CSS. The app is a responsive technician console with an incident intake form, recommendation surface, visible Hindsight memory panel, resolution capture, equipment history, and memory evolution strip.
- **Backend:** Express in `server/_core/index.ts` with dedicated REST routes under `/api`. Business logic is separated into `server/services/` modules; React only calls same-origin APIs.
- **Structured persistence:** MongoDB Atlas via the official MongoDB Node driver. Collections cover incidents, resolutions, equipment, and retained-learning audit records. The MongoDB layer is optional at startup and fails clearly when `MONGODB_URI` is missing or unavailable; it does not impersonate Hindsight.
- **Persistent memory:** Hindsight Cloud REST API. `server/services/hindsight.ts` calls the documented `POST /v1/default/banks/{bank_id}/memories` retain endpoint and `POST /v1/default/banks/{bank_id}/memories/recall` recall endpoint with `Authorization` and a configurable `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, and `HINDSIGHT_BANK_ID`.
- **LLM reasoning:** Groq OpenAI-compatible chat completions from `server/services/groq.ts`, using a structured JSON response contract. The prompt includes the current incident and only the recalled Hindsight evidence. The client never receives provider credentials or hidden chain-of-thought.
- **Agent orchestration:** `server/services/agent.ts` coordinates input normalization, recall, context building, Groq reasoning, response validation, learning extraction, and retain. If Hindsight recall fails, `memoryStatus` is `unavailable` and the recommendation explicitly says it was generated without historical experience; no fabricated memory or confidence is emitted.

## Core REST contract

- `GET /api/health` — unauthenticated service health and configuration readiness summary.
- `GET /api/demo/status` — persisted interaction count, current demo step, and configured-service availability.
- `POST /api/demo/reset` — resets only the demo namespace in MongoDB when configured; never deletes Hindsight records.
- `POST /api/incidents` — validate, persist, perform real Hindsight recall, call Groq, and return the incident plus recommendation, memory evidence, and source status.
- `GET /api/incidents/:id` — return the incident, recommendation, memories, resolution, and lifecycle status.
- `POST /api/incidents/:id/resolve` — validate and persist resolution, create useful learning text, retain that learning in Hindsight, and return the retained knowledge status.
- `GET /api/equipment/:equipmentId` — return structured equipment history and current pattern summary from persisted records; Hindsight remains the source for memory recall.
- `GET /api/memory/recent` — return recent Hindsight-backed retained-learning audit entries when available, with explicit unavailable/error status otherwise.

## Demo behavior

Demo Mode is an explicit UI switch that changes only the seed/input affordances, not the service logic. It submits four realistic P-204/P-207 incidents through the same REST endpoints. When external services are configured, the flow performs actual recall, Groq reasoning, resolution, and Hindsight retain calls. When required credentials are absent, the UI preserves the same honest failure state and does not claim a successful memory progression. No localStorage or hardcoded recommendation replaces the backend.

The demo seed set contains synthetic historical incidents for P-204, P-207, P-301, C-102, and M-115. It is inserted into MongoDB only when the user starts a demo and only with an explicit namespace marker. Seed resolutions are retained through the same Hindsight retain service so judges can see actual recall influence. A later incident query emphasizes recurring vibration after maintenance, coupling alignment, mounting torque, and the 10-minute shutdown pattern.

## UI structure

- **Header:** FieldMind wordmark, current technician identity, Demo Mode control, service status.
- **Left rail:** Incident Console form and concise workflow cue.
- **Main workspace:** Recommendation card, evidence-backed next-step sequence, warning callout, resolution capture.
- **Right rail:** Hindsight Memory panel with actual recall status and expandable memory cards; memory evolution timeline for Interaction 1 / 5 / 10 / 20.
- **Secondary view:** Equipment detail/history drawer or route showing P-204 history and resolution outcomes without expanding the product into a general CMMS.

## Deployment and serving

Use the managed server-capable project with Express serving the Vite-built React SPA in production. The same-origin `/api/*` routes go to the server and browser page routes also reach Express so its SPA fallback can serve the application shell. Versioned assets are cacheable by the server's static middleware; API responses remain dynamic. The committed Dockerfile builds the frontend and bundles the Express server, listens on `PORT`, and exposes `/api/health`.

Configuration declares `features.server: true`, a container `deploy` contract with `Dockerfile` and `/api/health`, and routes matching `/api/*` plus the browser catch-all to `server`. Netlify and Render deployment notes remain documented as an alternative split deployment using `VITE_API_BASE_URL`, but the managed preview/publish path is same-origin and does not expose secrets.

## Validation

Run `pnpm check`, `pnpm test`, `pnpm build`, the dev-server health check, `/manus-routes.json` validation, and focused API/service tests with mocked provider transports. If all external credentials are configured, run an actual lifecycle smoke test: seed/retain → recall incident 1 → resolve/retain → recall related incident → verify memory status and recommendation source change. Without credentials, report the exact missing configuration and distinguish mocked transport tests from live Hindsight/Groq/MongoDB verification.
