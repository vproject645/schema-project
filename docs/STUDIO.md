# Schema Studio

Studio is the idea-to-permit flow at `/studio`. It is public and client-side: no account, database or model key is needed.

1. **Idea.** Plain-language description in, a building spec out (`src/studio/idea.ts`). Everything read from the text and everything assumed is listed.
2. **Model.** Editable massing (storeys, area, roof, three materials) shown in a Three.js scene (`src/components/StudioScene.tsx`).
3. **Simulate.** A durability screening model ages structure, facade and roof over 10 to 60 years for a climate preset or one year of observed weather (`src/studio/simulate.ts`). The scene plays this as a time-lapse with rain, staining, rust and algae. Issues, building risks and a per-element material comparison come with it. An agent loop can swap weak facade and roof materials for the cheapest option that meets a target, then re-simulate. It only proposes frame changes.
4. **Codes and permits.** The codes and permits that likely apply, with the reason for each, for Portland, Nairobi, Miami, London and a generic baseline (`src/studio/codes.ts`).
5. **Package.** Drafted documents, the facts still needed, documents that need licensed professionals, two approval gates, and a per-permit filing plan (`src/studio/permit-package.ts`, `submission.ts`). Export as Markdown or JSON.

## What it does not do

- It is a screening tool. The material model uses generic sensitivities, not tested data or engineering analysis.
- Code and permit results come from the concept alone. They are not a compliance finding, are marked `verify`, and may be out of date for a given authority.
- Concept massing is not a permit drawing. Structural, geotechnical, fire, energy, stormwater and drawing documents stay with licensed professionals.
- No filing is automated. `SubmissionAdapter` is the extension point; none is registered, so every permit is a reviewed handoff. Nothing is filed without both approvals and a complete document set.
- The idea parser is rule-based. Replace `parseIdea` with a model-backed `IdeaParser` and the rest of the pipeline is unchanged.

## Tests

`npm test` runs `tests/studio.test.ts` with the rest. It covers parsing, the simulation (monotonic, deterministic, climate and maintenance effects, facade-to-frame coupling), each jurisdiction's triggers, package status rules, submission blocking, adapter behaviour and the revision loop.
