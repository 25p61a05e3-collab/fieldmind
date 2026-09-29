# FieldMind

> Every solved issue becomes experience.

FieldMind is a professional field-service troubleshooting workspace for technicians investigating recurring equipment failures. It turns resolved incidents into persistent operational experience so the next recommendation can start from what actually worked before.

## What is built

FieldMind focuses on one persona and one workflow: a field service technician troubleshooting recurring equipment issues.

The working flow is:

```text
Incident → Hindsight recall → Groq reasoning → Recommendation
        → Technician resolution → Hindsight retain → Better future response
```

The application includes:

- A technician incident console for equipment ID, equipment type, location, issue, symptoms, severity, and operating context.
- A real backend analysis route that validates input, saves a structured incident, recalls Hindsight experience, calls Groq with the current incident plus recalled evidence, and returns a grounded recommendation.
- A visible Hindsight memory panel showing actual recalled facts, their type, context, tags, timestamps, metadata, and why they were ranked as relevant.
- A resolution capture flow that stores the structured result in MongoDB Atlas and retains useful learning in Hindsight.
- Equipment history backed by structured incident and resolution records.
- A Demo Mode that uses the same API and service logic, with an isolated Hindsight tag scope so Interaction 1 can start with no session memories and later stages can add realistic synthetic experience through actual retain calls.
- Explicit provider states. Missing or failing Hindsight, Groq, or MongoDB does not become a fake success state.

## Why persistent memory matters

A normal chat transcript is not enough for field operations. FieldMind retains useful operational learning: what equipment failed, what conditions were present, what diagnosis was confirmed, what actions were tried, what worked or failed, and what the technician wants the next person to know.

MongoDB stores structured application records for incident history and auditability. Hindsight is the persistent agent memory layer. MongoDB is not used as a substitute for Hindsight recall.

## How Hindsight Makes FieldMind Better

1. **First incident:** the technician receives a first-pass checklist when no relevant experience exists.
2. **Repeated incidents:** Hindsight recall surfaces prior equipment-specific resolutions and similar cases.
3. **More history:** accumulated successful and unsuccessful attempts change which diagnostic action is recommended first.
4. **Resolution:** the technician records what actually happened.
5. **Future incident:** the learning is retained in Hindsight and can be recalled for the next related incident.

The UI makes this visible with the Hindsight panel, evidence cards, the memory-influence explanation, the retained-learning confirmation, and the Interaction 1 → 5 → 10 → 20 progression rail.

## Architecture

```text
React/Vite technician console
          │ same-origin REST calls
          ▼
Express server
  ├─ Incident API + validation
  ├─ Agent orchestrator
  │    ├─ Hindsight recall/retain
  │    └─ Groq JSON recommendation
  └─ MongoDB Atlas structured records
```

### Hindsight integration

The server uses the official Hindsight HTTP contract documented at [hindsight.vectorize.io](https://hindsight.vectorize.io/):

- Recall: `POST /v1/default/banks/{bank_id}/memories/recall`
- Retain: `POST /v1/default/banks/{bank_id}/memories`

The implementation sends the API key in a server-side `Authorization: Bearer …` header. It uses the documented recall fields (`query`, `types`, `prefer_observations`, `budget`, `max_tokens`, `query_timestamp`, and optional `tags`) and the documented retain item fields (`content`, `context`, `timestamp`, `document_id`, `metadata`, and `tags`).

Hindsight recall returns structured facts, not raw chat history. FieldMind maps those facts into evidence cards without inventing scores or confidence percentages. A Hindsight error produces an explicit `unavailable` state and a visible note such as:

> Memory service unavailable — this recommendation was generated without historical experience.

### Groq integration

`server/services/groq.ts` calls Groq's OpenAI-compatible chat completions endpoint from the server. The prompt contains the incident and recalled Hindsight evidence. The response is required to be JSON with a validated recommendation shape. Malformed output is rejected and shown as an explicit fallback state; hidden chain-of-thought is never sent to the browser.

### MongoDB integration

`server/services/mongo.ts` uses the official MongoDB Node driver. It stores incidents, resolutions, and demo sessions in the configured database. If MongoDB is not configured in local preview, the app uses an ephemeral in-process store and labels records as `ephemeral`; it does not present that fallback as durable storage.

## Environment variables

Copy `.env.example` to `.env` for local development. Keep all credentials server-side.

| Variable             | Required for               | Description                                                         |
| -------------------- | -------------------------- | ------------------------------------------------------------------- |
| `MONGODB_URI`        | Durable structured records | MongoDB Atlas connection string.                                    |
| `MONGODB_DB_NAME`    | MongoDB                    | Defaults to `fieldmind`.                                            |
| `HINDSIGHT_BASE_URL` | Real memory                | Hindsight Cloud/API base URL supplied by the Hindsight workspace.   |
| `HINDSIGHT_API_KEY`  | Real memory                | Hindsight server credential.                                        |
| `HINDSIGHT_BANK_ID`  | Real memory                | Hindsight memory bank, for example `fieldmind`.                     |
| `GROQ_API_KEY`       | AI reasoning               | Groq server credential.                                             |
| `GROQ_MODEL`         | Groq                       | Defaults to `openai/gpt-oss-120b`.                                  |
| `GROQ_BASE_URL`      | Groq                       | Defaults to `https://api.groq.com/openai/v1`.                       |
| `VITE_API_BASE_URL`  | Split deployment only      | Optional Netlify → Render backend URL. Never put private keys here. |

No provider credentials are committed in the repository or exposed to the browser.

## Local development

Requirements: Node.js 22 and pnpm 10.18.0.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The application runs on `http://localhost:3000` by default. The server exposes `GET /api/health` and the route manifest at `GET /manus-routes.json`.

Useful commands:

```bash
pnpm check       # TypeScript compiler
pnpm test        # Vitest tests
pnpm build       # Vite frontend + bundled Express server
pnpm start       # Run the production bundle
pnpm format      # Prettier
```

## API endpoints

| Method | Path                          | Purpose                                                                           |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/api/health`                 | Provider readiness and service health.                                            |
| `POST` | `/api/incidents`              | Validate, save, recall, reason, and return a recommendation.                      |
| `GET`  | `/api/incidents/:id`          | Return an incident and its stored resolution.                                     |
| `POST` | `/api/incidents/:id/resolve`  | Save a resolution, extract useful learning, and retain it in Hindsight.           |
| `GET`  | `/api/equipment/:equipmentId` | Structured equipment history.                                                     |
| `GET`  | `/api/memory/recent`          | Hindsight-backed recent recall plus structured resolution audit records.          |
| `POST` | `/api/demo/start`             | Start a new isolated Demo Mode session.                                           |
| `POST` | `/api/demo/advance`           | Retain realistic synthetic experiences for the next demo stage through Hindsight. |
| `GET`  | `/api/demo/status`            | Read current demo session and provider state.                                     |

## Demo instructions

1. Configure `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, `HINDSIGHT_BANK_ID`, `GROQ_API_KEY`, and `MONGODB_URI`.
2. Start the app and click **Demo Mode**.
3. Analyze **Interaction 1**. Because the demo session has an empty Hindsight tag scope, the memory panel should show no relevant experience and the recommendation should be a generic first-pass checklist.
4. Record a realistic resolution such as `Coupling misalignment` / `Realigned coupling and verified vibration under load` / `Resolved`. Submit **Retain resolution**.
5. Choose **Interaction 5**. The backend will retain the demo's realistic P-204/P-207 historical experiences through the same Hindsight retain route, then analyze the related P-204 incident through the same recall and Groq logic.
6. Repeat the resolution and advance to **Interaction 10** and **Interaction 20**. Watch the memory panel, the `memory influence` explanation, the recommendation source badge, and the retained-learning banner.
7. Expand each memory card to show what happened, context, timestamp, document ID, tags, and the relevance explanation.

Demo Mode is not a localStorage simulation and does not contain hardcoded recommendation results. If a provider is not configured, the UI says so and does not claim that memory or AI reasoning occurred.

## Testing and current verification

The repository includes service contract tests for malformed Groq response handling and the documented Hindsight route contract. The implementation has been checked with:

- `pnpm check` — passing.
- `pnpm build` — passing.
- `pnpm test` — 4 test files and 10 tests passing.
- Local development health check — `GET /api/health` returns `200`.
- Route manifest check — `GET /manus-routes.json` returns the declared JSON contract.
- No-credential incident request — returns a clearly labeled fallback recommendation and `memoryStatus: "not_configured"` rather than fabricating recall.

A live Hindsight retain/recall → Groq reasoning → resolution → later recall lifecycle requires the manual credentials above. The current verification distinguishes live provider testing from transport and no-credential checks; no live provider credential was available in this environment. Do not treat the no-credential lifecycle check as proof of live provider connectivity.

## Deployment

### Managed project preview/publish

The managed project is configured as a server-capable application with:

- `features.server: true`
- `Dockerfile` container deployment
- `/api/health` health path
- `/api/*` and browser catch-all routed to the Express server

The container builds the Vite frontend, bundles the Express server, and listens on `PORT`. Add the production values through the managed secret/environment input surface before publishing. A successful checkpoint or Preview is not a live public deployment until Publish confirms it.

### Netlify + Render split deployment

For the requested external target arrangement:

- Build the frontend with `pnpm build:static` and publish `dist/public` to Netlify.
- Deploy the Express container to Render with `pnpm build` and `pnpm start`.
- Set `VITE_API_BASE_URL` in Netlify to the Render backend URL.
- Set `MONGODB_URI`, `MONGODB_DB_NAME`, `HINDSIGHT_BASE_URL`, `HINDSIGHT_API_KEY`, `HINDSIGHT_BANK_ID`, and Groq variables in Render only.
- Set `FRONTEND_ORIGIN` in Render to the exact Netlify origin. The Express server allows only that explicit origin for `/api` requests; the current managed preview is same-origin and does not need CORS.

## Project structure

```text
client/
  public/manus-routes.json   route manifest
  src/App.tsx                technician console and workflow state
  src/index.css              FieldMind design system
  src/lib/api.ts             typed browser API client
server/
  _core/index.ts             Express boot and production/static serving
  routes.ts                  REST endpoints and validation
  services/agent.ts          recall → reasoning → learning orchestration
  services/hindsight.ts      documented Hindsight REST client
  services/groq.ts           Groq JSON reasoning client
  services/mongo.ts          MongoDB Atlas persistence and preview fallback
shared/types.ts              shared API contracts
ideas.md                     committed design brief
plan.md                      implementation and deployment plan
.env.example                 required environment variable template
Dockerfile                   production build and runtime contract
```

## Future improvements

The focused foundation is ready for an authenticated technician identity, richer equipment metadata, provider-backed search filters, and an asynchronous operation status UI for very large Hindsight retain jobs. Those are intentionally secondary to the working persistent memory loop.
