import { CLIMATES } from "./climate";
import { analyzeCodes, type CodeAnalysis } from "./codes";
import { parseIdea, type IdeaParser, type ParsedIdea } from "./idea";
import { MATERIALS } from "./materials";
import { buildPermitPackage, type PackageInputs, type PermitPackage } from "./permit-package";
import { compareMaterials, resolveClimate, simulate } from "./simulate";
import type { BuildingSpec, Climate, ElementKey, Maintenance, MaterialId, SimulationResult } from "./types";

export type AgentName = "Intake" | "Design" | "Simulation" | "Revision" | "Codes" | "Permits" | "Review";
export interface AgentEvent { seq: number; agent: AgentName; message: string }
export interface Revision {
  element: ElementKey; from: MaterialId; to: MaterialId; reason: string;
  /** Structure changes are proposed only; the platform never swaps the frame on its own. */
  applied: boolean;
}
export interface WorkflowResult {
  parsed: ParsedIdea;
  climate: Climate;
  baseline: SimulationResult;
  revisions: Revision[];
  /** Spec after applied revisions. */
  spec: BuildingSpec;
  simulation: SimulationResult;
  codes: CodeAnalysis;
  package: PermitPackage;
  log: AgentEvent[];
  /** Human decisions the workflow will not make for the user. */
  gates: { id: "design" | "package" | "filing"; label: string }[];
  reviewFindings: string[];
}
export interface WorkflowOptions {
  years?: number;
  maintenance?: Maintenance;
  /** Target condition (0–100) each element should still have at the horizon. */
  targetCondition?: number;
  /** Observed climate to use instead of the regional preset. */
  climate?: Climate;
  inputs?: PackageInputs;
  parser?: IdeaParser;
  autoRevise?: boolean;
  maxIterations?: number;
}

/**
 * Autonomous loop: understand the idea, simulate it, revise weak facade/roof choices,
 * re-simulate, identify codes and permits, build the package, then self-review.
 * Deterministic and bounded. It stops at human gates and never files anything.
 */
export function runStudioWorkflow(idea: string, opts: WorkflowOptions = {}): WorkflowResult {
  return runWorkflowFromParsed((opts.parser ?? parseIdea)(idea), opts);
}

/** Same pipeline, starting from a parsed (and possibly hand-edited) idea. */
export function runWorkflowFromParsed(parsed: ParsedIdea, opts: WorkflowOptions = {}): WorkflowResult {
  const years = opts.years ?? 30;
  const maintenance = opts.maintenance ?? "none";
  const target = opts.targetCondition ?? 60;
  const log: AgentEvent[] = [];
  const say = (agent: AgentName, message: string) => log.push({ seq: log.length + 1, agent, message });

  say("Intake", `Read the idea: ${parsed.found.join("; ") || "nothing specific"}. Confidence ${parsed.confidence}.`);
  for (const a of parsed.assumptions) say("Intake", `Assumption: ${a}`);

  let spec = parsed.spec;
  say("Design", `Built a ${spec.storeys}-storey ${spec.type}: ${spec.widthM} × ${spec.depthM} × ${spec.heightM} m, ${spec.grossFloorAreaM2} m² gross.`);

  const climate = opts.climate ?? resolveClimate(spec, CLIMATES);
  const baseline = simulate(spec, climate, { years, maintenance });
  say("Simulation", `Ran a ${years}-year weathering simulation in ${climate.label}. ${baseline.summary}`);

  const revisions: Revision[] = [];
  let simulation = baseline;
  if (opts.autoRevise !== false) {
    const max = opts.maxIterations ?? 3;
    for (let i = 0; i < max; i++) {
      const weak = (["facade", "roof", "structure"] as ElementKey[])
        .filter((el) => simulation.elements[el].condition[years] < target && !revisions.some((r) => r.element === el))
        .sort((a, b) => simulation.elements[a].condition[years] - simulation.elements[b].condition[years])[0];
      if (!weak) break;
      const current = spec.materials[weak];
      const options = compareMaterials(spec, climate, weak, { years, maintenance }).filter((o) => o.material !== current);
      const passing = options.filter((o) => o.conditionAtHorizon >= target).sort((a, b) => a.costIndex - b.costIndex)[0];
      const pick = passing ?? options[0];
      const now = simulation.elements[weak].condition[years];
      if (!pick || pick.conditionAtHorizon <= now + 1) {
        say("Revision", `No better ${weak} material found than ${MATERIALS[current].label.toLowerCase()}. Recommend planned maintenance instead.`);
        revisions.push({ element: weak, from: current, to: current, reason: "No better material option in this climate.", applied: false });
        continue;
      }
      const applied = weak !== "structure";
      const reason = `${MATERIALS[current].label} reaches ${Math.round(now)}/100 by year ${years}; ${pick.label} reaches ${Math.round(pick.conditionAtHorizon)}/100${passing ? " at the lowest cost that meets the target" : " (best available)"}.`;
      revisions.push({ element: weak, from: current, to: pick.material, reason, applied });
      say("Revision", applied
        ? `Changed ${weak} from ${MATERIALS[current].label.toLowerCase()} to ${pick.label.toLowerCase()}. ${reason}`
        : `Proposed changing the ${weak} to ${pick.label.toLowerCase()} for your decision. ${reason}`);
      if (applied) {
        spec = { ...spec, materials: { ...spec.materials, [weak]: pick.material } };
        simulation = simulate(spec, climate, { years, maintenance });
        say("Simulation", `Re-ran the simulation. ${simulation.summary}`);
      }
    }
  }

  const codes = analyzeCodes(spec, climate);
  say("Codes", `Identified ${codes.codes.length} likely codes and ${codes.permits.length} permits for ${codes.jurisdiction.label}.`);
  for (const f of codes.designFlags) say("Codes", f);

  const pkg = buildPermitPackage(spec, codes, simulation, opts.inputs);
  say("Permits", `Prepared a permit package: ${pkg.documents.length} documents, ${pkg.completeness} % ready. ${pkg.openItems.length} items need a person or a professional.`);

  const reviewFindings = reviewWorkflow(spec, simulation, codes, pkg, revisions);
  for (const f of reviewFindings) say("Review", f);
  say("Review", "Stopped at the approval gates. Nothing has been filed.");

  return {
    parsed, climate, baseline, revisions, spec, simulation, codes, package: pkg, log, reviewFindings,
    gates: [
      { id: "design", label: "Approve the design and any revisions" },
      { id: "package", label: "Review and approve the permit package" },
      { id: "filing", label: "Authorise filing (done by a person or a supported adapter)" },
    ],
  };
}

/** Independent consistency checks over the finished result. */
export function reviewWorkflow(spec: BuildingSpec, sim: SimulationResult, codes: CodeAnalysis, pkg: PermitPackage, revisions: Revision[]): string[] {
  const out: string[] = [];
  if (codes.jurisdiction.id === "generic-intl") out.push("No local code is modelled for this location. Name a supported city or confirm the adopted codes with the authority.");
  if (sim.climate.source === "preset") out.push("Climate uses an indicative regional preset. Load observed weather for the exact site before relying on the comparison.");
  const proposed = revisions.filter((r) => !r.applied && r.to !== r.from);
  if (proposed.length) out.push(`${proposed.length} proposed change${proposed.length > 1 ? "s need" : " needs"} your decision (${proposed.map((r) => r.element).join(", ")}).`);
  if (pkg.documents.some((d) => d.status === "professional")) out.push("Several documents must be prepared and stamped by licensed professionals. The platform cannot do that.");
  if (spec.occupancy > 500) out.push("Large occupant load: expect a full fire engineering review.");
  return out;
}
