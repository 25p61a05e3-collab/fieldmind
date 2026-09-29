# FieldMind

> **A field-service troubleshooting agent that remembers what happened before — and uses that experience to improve future incident recommendations.**

FieldMind is an AI-powered troubleshooting system for field-service teams. It combines **Hindsight persistent memory**, **Groq reasoning**, and **MongoDB** to turn resolved equipment incidents into reusable operational knowledge.

Instead of treating every equipment failure as a completely new problem, FieldMind can recall relevant past experiences and use them when analyzing a new incident.

---

## 🚨 The Problem

Field technicians frequently encounter recurring equipment problems.

Traditional AI troubleshooting systems can analyze the current incident, but without persistent memory they may repeatedly start from the same point.

A technician may already have discovered the real cause of a previous failure, but that resolution can be difficult to reuse when a similar incident happens again.

### FieldMind's approach

FieldMind creates a continuous learning loop:

```text
New Incident
     ↓
Recall Relevant Experience
     ↓
AI Troubleshooting
     ↓
Technician Resolution
     ↓
Retain the New Experience
     ↓
Future Similar Incident
     ↓
Memory-Informed Recommendation
```

The important difference is that **the resolution becomes part of the agent's future context**.

---

## 🧠 Why Hindsight Memory Matters

FieldMind uses **Hindsight** as its persistent memory layer.

The agent performs a memory recall before generating a recommendation.

After a technician resolves an incident, FieldMind extracts the useful operational knowledge and stores it back into Hindsight.

This creates a feedback loop:

```text
                 ┌──────────────────────┐
                 │   New Field Incident │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │   Hindsight Recall   │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │    Groq Reasoning    │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │ Troubleshooting Plan │
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │ Technician Resolution│
                 └──────────┬───────────┘
                            ↓
                 ┌──────────────────────┐
                 │   Hindsight Retain   │
                 └──────────┬───────────┘
                            │
                            └──────→ Future Incidents
```

---

# 🔄 Real Demonstrated Memory Loop

FieldMind was tested using a real P-204 pump incident.

### First incident

The pump reported excessive vibration and shutdown behavior after operating for approximately 10 minutes.

At this point, Hindsight had no relevant prior experience available for the incident.

FieldMind generated a troubleshooting recommendation using the current incident information.

### Technician resolution

The technician identified:

> Coupling misalignment caused excessive vibration after the pump warmed up.

The resolution included:

- Checking alignment
- Correcting the coupling
- Tightening hardware
- Verifying vibration
- Confirming that vibration returned to normal

The resolution was then retained as experience in Hindsight.

### Second related incident

A related P-204 incident was analyzed again.

This time, Hindsight returned a relevant previous experience.

The generated recommendation referenced the previous coupling-misalignment resolution and incorporated that memory into the troubleshooting process.

### Result

```text
P-204 Incident #1
       ↓
No relevant memory
       ↓
AI recommendation
       ↓
Technician finds coupling misalignment
       ↓
Resolution retained in Hindsight
       ↓
P-204 Incident #2
       ↓
Hindsight recalls 1 relevant experience
       ↓
Recommendation influenced by previous resolution
```

This demonstrates the core FieldMind capability:

> **Incident → Recall → Reason → Resolve → Retain → Recall again**

---

# ⚙️ How FieldMind Works

## 1. Incident Intake

A field incident contains information such as:

- Equipment ID
- Equipment type
- Symptoms
- Operating conditions
- Previous observations
- Severity
- Technician notes

---

## 2. Hindsight Recall

Before generating a recommendation, FieldMind queries Hindsight for relevant experiences and observations.

The recall layer uses the incident context to retrieve memories that may help with the current problem.

---

## 3. AI Reasoning

The recalled context is passed into the reasoning process powered by Groq.

The agent combines:

```text
Current Incident
       +
Relevant Hindsight Memories
       ↓
Troubleshooting Recommendation
```

The recommendation contains structured troubleshooting information such as:

- Immediate safety actions
- Troubleshooting sequence
- Warnings
- Root-cause hypotheses
- Recommended checks

---

## 4. Technician Resolution

After troubleshooting, the technician records the actual resolution.

FieldMind captures:

- Root cause
- Actions taken
- Verification
- Technician feedback

---

## 5. Hindsight Retain

The useful resolution is converted into structured experience and retained in Hindsight.

This means the outcome is not discarded after the incident is closed.

It becomes potential knowledge for future incidents.

---

# 🏗️ Architecture

```text
┌───────────────────────┐
│      FieldMind UI     │
│       React + Vite    │
└───────────┬───────────┘
            │
            ↓
┌───────────────────────┐
│    Express Backend    │
│      REST APIs        │
└───────┬───────┬──────┘
        │       │
        │       │
        ↓       ↓
┌───────────┐ ┌───────────────┐
│ Hindsight │ │     Groq      │
│  Memory   │ │ AI Reasoning  │
└───────────┘ └───────────────┘
        │
        ↓
┌───────────────────────┐
│       MongoDB         │
│ Incidents / Resolutions│
└───────────────────────┘
```

### Memory flow

```text
Incident
   │
   ├──────────────→ MongoDB
   │
   ↓
Hindsight Recall
   │
   ↓
Groq
   │
   ↓
Recommendation
   │
   ↓
Technician Resolution
   │
   ├──────────────→ MongoDB
   │
   └──────────────→ Hindsight Retain
```

---

# ✨ Key Features

### Persistent operational memory

Past incident resolutions can become reusable experience.

### Memory-informed troubleshooting

The agent recalls relevant experiences before generating recommendations.

### Structured AI recommendations

Recommendations are returned as structured data rather than only free-form text.

### Technician feedback loop

Technician resolutions can be retained as future knowledge.

### Equipment history

Incident and resolution information can be associated with equipment.

### Demo Mode

FieldMind includes demo scenarios that make it possible to demonstrate the memory loop consistently.

### Safety-first fallback

If external AI or memory providers are unavailable, the system can fall back to a safety-oriented response instead of pretending that an unavailable service succeeded.

---

# 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Language | TypeScript |
| Backend | Node.js + Express |
| AI | Groq |
| Persistent Agent Memory | Hindsight |
| Database | MongoDB |
| Styling | Tailwind CSS |
| Testing | Vitest |
| Package Manager | pnpm |

---

# 📁 Project Structure

```text
fieldmind/
│
├── client/
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── pages/
│       └── lib/
│
├── server/
│   ├── routes.ts
│   ├── services/
│   │   ├── agent.ts
│   │   ├── groq.ts
│   │   ├── hindsight.ts
│   │   └── mongo.ts
│   └── *.test.ts
│
├── shared/
│   └── types.ts
│
├── docs/
│   └── hindsight-api-notes.md
│
├── package.json
├── pnpm-lock.yaml
├── .env.example
└── README.md
```

---

# 🔐 Environment Variables

Create a local `.env` file based on `.env.example`.

The application requires credentials for the external services used by the agent.

Example structure:

```env
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_api_key
HINDSIGHT_BANK_ID=FieldMind

GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

MONGODB_URI=your_mongodb_connection_string
```

**Never commit your real `.env` file or API keys to GitHub.**

The repository intentionally includes `.env.example` rather than real credentials.

---

# 🚀 Getting Started

## Requirements

Make sure you have:

- Node.js
- pnpm
- MongoDB
- Hindsight account/API access
- Groq API access

---

## Install dependencies

```bash
pnpm install
```

---

## Configure environment

Create:

```text
.env
```

using:

```text
.env.example
```

as the template.

Add your own service credentials.

---

## Run development server

```bash
pnpm dev
```

---

# 🧪 Validation

The project includes automated checks for important functionality.

Run TypeScript validation:

```bash
pnpm check
```

Run tests:

```bash
pnpm test
```

Create a production build:

```bash
pnpm build
```

The final local validation completed successfully for:

- TypeScript checking
- Test suite
- Production build

---

# 🎬 Recommended Demo Flow

The clearest demonstration of FieldMind's core capability is the following sequence:

### Step 1 — Create the first incident

Use a P-204 pump incident involving excessive vibration.

### Step 2 — Analyze

Show that there is no relevant previous experience available.

### Step 3 — Show the AI recommendation

Allow FieldMind to generate the troubleshooting recommendation.

### Step 4 — Resolve the incident

Enter the technician's actual resolution:

```text
Root cause:
Coupling misalignment caused excessive vibration after the pump warmed up.

Actions:
Checked alignment, corrected coupling, tightened hardware,
and verified vibration.

Feedback:
Vibration returned to normal after alignment correction.
```

### Step 5 — Retain

Show that the resolution was successfully retained in Hindsight.

### Step 6 — Create a related incident

Use another P-204 incident with related symptoms.

### Step 7 — Analyze again

Show Hindsight returning the previous experience.

### Step 8 — Show the difference

The new recommendation should reference the previous coupling-misalignment experience.

This demonstrates that the agent is not simply answering two independent questions.

It is **using persistent memory between incidents**.

---

# 🧠 Hindsight Integration

FieldMind uses Hindsight for two core operations:

## Recall

Before generating a recommendation:

```text
Current incident
      ↓
Hindsight Recall
      ↓
Relevant experiences
      ↓
AI reasoning
```

## Retain

After a technician resolves an incident:

```text
Resolution
    ↓
Structured learning
    ↓
Hindsight Retain
    ↓
Future recall
```

The Hindsight integration is implemented in:

```text
server/services/hindsight.ts
```

The agent orchestration is implemented in:

```text
server/services/agent.ts
```

---

# 🔌 External Services

FieldMind currently integrates with:

- Hindsight for persistent agent memory
- Groq for AI reasoning
- MongoDB for application data persistence

The system is designed so that the agent's memory layer and application data layer have separate responsibilities.

---

# 📚 Resources

### Hindsight

Hindsight is the persistent memory system used by FieldMind.

- Hindsight GitHub: https://github.com/vectorize-io/hindsight
- Hindsight Documentation: https://hindsight.vectorize.io/
- Agent Memory: https://vectorize.io/what-is-agent-memory

---

# 🔭 Future Development

Potential extensions include:

- More equipment-specific memory
- Larger incident histories
- Improved memory filtering
- Technician/team-level operational knowledge
- Richer equipment timelines
- Additional field-service workflows
- More detailed analytics around recurring failures

---

# 📌 Project Status

FieldMind currently demonstrates a working end-to-end memory loop:

```text
Incident
  ↓
Hindsight Recall
  ↓
Groq Recommendation
  ↓
Technician Resolution
  ↓
Hindsight Retain
  ↓
Future Incident
  ↓
Memory-Informed Recommendation
```

The core memory workflow has been tested using a real P-204 equipment scenario.

---

# 📄 License

MIT License.

Copyright © 2026 Sandarsh Jeriopothula.