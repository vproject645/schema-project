<img src="docs/schema-mark.svg" width="56" alt="Schema">

# Schema

The autonomous project agent for commercial fit-outs. Start with a brief and your PDFs; Schema builds the understanding, a linked 2D/3D concept, a permit strategy and a reviewed handoff. You approve every decision that matters.

**Live demo:** [schema.vproject645.workers.dev](https://schema.vproject645.workers.dev) · **License:** [MIT](LICENSE)

## How it works

| Step | You provide | Schema does | You decide |
| --- | --- | --- | --- |
| 1. Understand | A brief and project PDFs | Reads them, states assumptions, lists what is missing | Confirm or correct the assumptions |
| 2. Design and strategy | Answers to open questions | Builds a linked 2D/3D concept and a sourced permit strategy | Approve the concept and strategy |
| 3. Prepare | Feedback | Consolidates open questions into one request | Approve the exact message before anything is sent |
| 4. Handoff | Final review | Runs an independent review pass and builds the package | Approve the reviewed handoff |

Every stage stops at an approval gate, so nothing leaves the workspace without your explicit approval.

[Setup and sharing](docs/SHARING.md) · [Scope](docs/SCOPE.md) · [Design](docs/DESIGN.md) · [Implementation](docs/AUTONOMOUS-IMPLEMENTATION.md) · [Verification](docs/VERIFICATION.md) · [Deployment status](docs/DEPLOYMENT-STATUS.md)

## What it does

Schema runs the internal coordination queue for architects and contractors, and stops wherever a human decision is needed.

1. **Understand.** Reads the brief and PDFs, states assumptions and lists what is missing.
2. **Design and strategy.** Builds one commercial concept that drives an editable floor plan and a 3D cutaway, plus a sourced permit strategy.
3. **Prepare.** Consolidates open questions into one request and prepares coordination work.
4. **Handoff.** Runs an independent review pass, then produces a reviewed package as standalone HTML and project JSON.

Each stage stops at an approval gate, a missing dependency, 12 model requests, 24 tool actions, 60 minutes or two transient retries. Feedback reopens affected work. Nothing leaves the workspace without explicit approval, and email is sent only after the exact recipient, content and attachments are approved.

The first measurable workflow is responding to city review comments on an existing project, alongside the brief-led entry point. The example project is a fictional Portland office fit-out.

## Implemented

- Human-confirmed reviewer register with original numbering, exact response reviews and independent omission, evidence and revision checks.
- Owner-scoped D1 project state, versioned artifacts, tasks, approvals, preferences, fenced jobs and tool receipts.
- R2 originals and complete page-text records. Intake supports eight text-bearing PDFs of at most 10 MB and 50 pages each. Unread or scanned pages stay visible.
- A single concept model drives the floor plan and Three.js cutaway, with geometry checks for boundaries and non-overlap.
- Document inputs, search grounding and validated tools, with saved response IDs and checkpoints for resumable work.
- Missing-information tracker: each open question from the understanding stage gets a status (open, requested, received), an owner (client, architect, engineer) and an optional link to an uploaded file. Updating it sends nothing.
- Editable preference records with decision provenance and deletion. This is application memory, not model retraining.
- Exact-content email approval, provider receipts and uncertain-outcome reconciliation.
- Restricted private MCP batch runner and an hourly cloud check. It cannot approve a decision, send a message or submit a permit.

## Integration status

Source implementation and live acceptance are tracked separately. See [scope](docs/SCOPE.md), [the practitioner evaluation](docs/PRACTITIONER-PILOT.md), [verification evidence](docs/VERIFICATION.md) and [hosted status](docs/DEPLOYMENT-STATUS.md).

- **Model access:** a privately configured hosted `MODEL_API_KEY` is required. A key held only in a browser tab cannot support unattended work.
- **Background work:** native MCP read/write access is verified and an hourly schedule is enabled. Meaningful closed-tab completion remains unverified.
- **Gmail:** the provider interface is tested; a native hosting adapter, eligibility, account consent and live delivery are unavailable. Email is optional, and the reviewed manual handoff works without it.
- **Permitting:** DevHub remains a reviewed handoff. Source citations do not establish site-specific compliance, professional sign-off, permit issuance or construction completion.

## Run locally

Use Node.js 24 and npm. The supported Sites Vinext runtime uses local Wrangler D1/R2 bindings.

```sh
npm install
cp .env.example .dev.vars
npm run build
```

Enter your own model API key privately in ignored `.dev.vars`. Apply the local migrations once, as described in [setup](docs/SHARING.md), then run:

```sh
npm run dev
```

Open the printed address and use local preview sign-in. A local key is not hosted configuration. Do not commit credentials or place them in a `VITE_` variable.

```sh
npm test
npm run build
npm run validate
```

Build output is ignored. It includes a Vinext Worker, browser assets and append-only Drizzle migrations. Publishing is a separate step; forks must create their own Site identity instead of deploying over this development Site.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page with Log in, Register and a showcase of the tools below |
| `/radar` | Subsurface radar and tilt-sensor screening with a simulated AI inversion demo (not a certified geotechnical or disaster-warning system) |
| `/contractor` | Contractor validation hub: field punch list, missing items and RFI coordination |
| `/simulate` | Climate and durability screening with a real weather archive |
| `/site` | Map digital twin and 3D site context, with Use my location |
| `/real3d` | Photorealistic 3D city view (Google 3D Tiles) |
| `/login`, `/register` | Passwordless email-link sign-in and account creation (Supabase) |
| `/app` | The agent workspace. Requires a verified session when Supabase is configured |
| `/studio` | Idea to 3D model, climate time-lapse, codes and permit package. See [Studio](docs/STUDIO.md) |
| `/legacy` | Earlier manual permit desk and residential study |

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Worker secrets, and add `https://<your-domain>/auth/callback` to the Supabase Auth redirect URLs. Without them, `/login` and `/register` show a "not set up" page in production and fall back to the local mock sign-in in development.

## Source map

| Location | Responsibility |
| --- | --- |
| `app/page.tsx`, `app/landing.css` | Public landing page |
| `worker/supabase-auth.ts` | Login, register, callback, session cookie and `/app` gating |
| `src/studio/`, `src/components/StudioApp.tsx`, `StudioScene.tsx` | Studio logic, five-step UI and the 3D weathering scene |
| `src/components/AgentWorkspace.tsx` | Conversation, proposal, decisions, intake and preferences |
| `src/components/OfficeConceptView.tsx` | Linked floor plan, 3D and room editing |
| `src/autonomy/corrections.ts` | Authoritative comments, immutable page evidence, review fingerprints and coverage |
| `src/autonomy/` | Project contract, dependency checks, approvals, concept validation and exports |
| `server/autonomy/runner.ts` | Model continuation, checked tools, stage budgets and receipts |
| `server/autonomy/recovery.ts` | Atomic saved-run recovery and explicit new attempts |
| `server/autonomy/repository.ts` | Durable projects, fenced jobs and state size limits |
| `server/autonomy/documents.ts` | PDF extraction, page provenance, originals and model file uploads |
| `server/autonomy/mail.ts` | Exact-action approval, provider abstraction and reconciliation |
| `server/autonomy/api.ts` | Owner isolation, project APIs and restricted MCP tools |
| `db/`, `drizzle/` | Append-only durable schema |
| `tests/` | Real SQLite/PDF checks and controlled-provider behavior |
| `docs/` | Scope, sharing, verification and design guidance |

## Scope and provenance

Concepts are decision aids, not professionally prepared permit drawings. No complete CAD/BIM, certified code checking, structural analysis, validated environmental simulation, municipal filing, permit issuance or physical construction is claimed. Validate the workflow with a practitioner and authorized historical cases before claiming real permitting value.

Original Schema code is provided under the [MIT license](LICENSE). Dependencies and starter material retain their own licenses. Examples are fictional; no private project records or credentials are included.

Project history and submission notes are kept in [docs/internal](docs/internal).
