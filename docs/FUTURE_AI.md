# Future AI architecture

**Nothing in this document is implemented.** It records where the product is going, so that today's frontend doesn't block it and future work follows it. Principles are in [PRODUCT.md](PRODUCT.md), and the most important here are: Younes's work first, generation last, and Younes decides.

## 1. Client consultation (public site)

```
CLIENT
  ↓  voice or text (Ask Younes dial / consultation panel)
AI ORCHESTRATOR            server-side; owns the conversation and the tools
  ↓
CONSULTATION STATE         ConsultationSummary - filled in as understanding grows
  ↓
YOUNES WORK SEARCH         tool: search the archive (tags, style, subject, similarity)
  ↓  only if not enough
EXTERNAL INSPIRATION       tool: licensed/credited external references
  ↓  only if still not enough
CONCEPT GENERATION         tool: image generation → always labelled CONCEPT / REFERENCE
  ↓
CONSULTATION SUMMARY       shown to the client, editable
  ↓
CLIENT CONFIRMATION        explicit submit, with contact details
  ↓
YOUNES REVIEW              status moves only by Younes
```

Frontend contracts that already exist (`src/domain/consultation.ts`):
- `ConsultationEntry` records where the conversation started. `find-similar` carries the `workId`.
- `ConsultationSummary` has every field optional, `references: TattooReference[]`, likes and dislikes.
- `TattooReference` is a discriminated union in fallback order: `work` → `upload` → `external` → `concept`. A `concept` keeps its `prompt` and is never shown as a final design.
- `ConsultationStatus` runs `draft` → `submitted` → `under-review` → `accepted | changes-requested | declined` → `contacted` → `booking` → `completed`.

Rules for the orchestrator:
- It speaks for Younes's studio, not as Younes, and never promises acceptance, a price or a date.
- Tool order is enforced by the orchestrator, not left to the model's mood: the work search always runs before an external search, and generation needs both to have been tried, or the client to explicitly ask.
- The conversation can always be dropped and resumed. The summary is the state, and the transcript is supporting material.
- The client always sees and confirms the summary before anything reaches Younes.

Where it runs:
- All model and tool calls happen on a server. The browser talks only to the site's API (`VITE_API_BASE_URL`).
- No provider SDK or key ever ships in the frontend.
- Voice uses the browser for capture and playback, and the server for recognition and synthesis.

## 2. Artist assistant (private dashboard)

```
CHANNELS          website consultations, WhatsApp, Instagram, Facebook, …
  ↓
INGESTION         normalise every message into one inbox item
  ↓
CLASSIFICATION    potential client | existing client | appointment | aftercare | general/personal
  ↓
CLIENT CONTEXT    attach to PotentialClient / Client and their history
  ↓
AI SECRETARY      conversational: "What do we have?" / "Show me more" / "Prepare a message"
  ↓
READ / PREPARE / EXECUTE
  ↓
AUDIT LOG         every action, visible to Younes (AI Activity)
```

### Action levels

| Level | The AI may | Confirmation |
|---|---|---|
| **READ** | Summarise, classify, search, answer questions about the inbox and clients | None |
| **PREPARE** | Draft messages, propose appointment times, draft aftercare follow-ups, fill in records | None (nothing leaves the system) |
| **EXECUTE** | Send a message, confirm or move an appointment, change a consultation's status, post anything externally | **Always explicit, per action.** "Send it" applies to the draft Younes just saw. |

There is never a silent send. An EXECUTE action shows exactly what will go where before it runs, and it is logged afterwards with the approval that allowed it.

### AI Activity (audit log)

Each entry records:
- When, and which level (read, summarised, classified, prepared, sent after approval).
- What it touched (client, channel, message).
- The result.

Younes can always answer "what did the assistant do today?"

### Dashboard areas

Today, AI Secretary, Unified Inbox, Potential Clients ("client muhtamal"), Consultations, Clients, Appointments, Aftercare, AI Activity.

The domain shapes started in `src/domain/client.ts` are `PotentialClient`, `Client`, `Booking` and `Aftercare`.

### Channels

Platform integrations are chosen later, based on what each platform's API actually allows (business messaging APIs, review requirements, rate limits). The ingestion layer has to make every channel look the same to classification and the secretary, so adding a channel never changes the dashboard.

## 3. The client record

```
CLIENT
├── Consultations   (the first one starts the record)
├── Communication   (all channels, one timeline)
├── Appointments
├── Tattoos         (links to TattooWork when the piece joins the archive)
├── Aftercare
└── Future consultations
```

A consultation is never a disposable contact form. It is the first page of a relationship.

## What this means for frontend work now

- Keep consultation UI driven by `ConsultationSummary` / `TattooReference` data, so an orchestrator can drive it later without UI rewrites.
- Keep data behind hooks ([ARCHITECTURE.md](ARCHITECTURE.md)), so the API can replace static data.
- Keep the artist dashboard out of the public bundle (a separate app or a protected, lazily loaded route tree).
- Don't add AI SDKs, vector databases, auth or channel integrations until the phase that needs them ([ROADMAP.md](ROADMAP.md)).
