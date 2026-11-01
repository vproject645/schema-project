import { MATERIALS } from "./materials";
import { stressLabel, ELEMENTS } from "./simulate";
import type { CodeAnalysis, DocId } from "./codes";
import type { BuildingSpec, SimulationResult } from "./types";

export type DocStatus = "drafted" | "provided" | "needs-input" | "professional";

export interface PackageInputs {
  applicantName?: string;
  ownerName?: string;
  siteAddress?: string;
  parcelId?: string;
  contractorName?: string;
  contractorLicence?: string;
  /** Documents the user (or a professional) has already completed outside the platform. */
  completedDocs?: DocId[];
  generatedAt?: string;
}

export interface PackageDocument {
  id: DocId; title: string; status: DocStatus;
  /** Plain-text draft, when the platform can write one. */
  content?: string;
  /** Facts still missing, or who must prepare it. */
  missing: string[];
  usedBy: string[];
}

export interface PermitPackage {
  title: string;
  project: string;
  jurisdiction: string;
  documents: PackageDocument[];
  byPermit: { permitId: string; name: string; documents: DocId[]; ready: number; total: number }[];
  completeness: number;
  openItems: string[];
  disclaimer: string;
}

type Kind = "draft" | "input" | "professional";
const DOCS: Record<DocId, { title: string; kind: Kind; needs?: (keyof PackageInputs)[]; who?: string }> = {
  "application-form": { title: "Application form (pre-filled)", kind: "draft", needs: ["applicantName", "ownerName", "siteAddress"] },
  "owner-authorisation": { title: "Owner authorisation / consent", kind: "input", who: "The property owner must sign this." },
  "project-description": { title: "Project description", kind: "draft" },
  "site-plan": { title: "Surveyed site plan", kind: "professional", who: "A licensed surveyor or architect. Concept dimensions are supplied as a starting point." },
  drawings: { title: "Permit drawings (plans, sections, elevations)", kind: "professional", who: "A registered architect must prepare and stamp these. The 3D concept is not a permit drawing." },
  "structural-design": { title: "Structural design and calculations", kind: "professional", who: "A licensed structural engineer." },
  geotechnical: { title: "Geotechnical report", kind: "professional", who: "A geotechnical engineer, after a site investigation." },
  "code-summary": { title: "Applicable codes summary", kind: "draft" },
  "durability-statement": { title: "Durability and materials statement", kind: "draft" },
  "energy-compliance": { title: "Energy compliance report", kind: "professional", who: "An energy or building-services engineer." },
  stormwater: { title: "Drainage and stormwater plan", kind: "professional", who: "A civil engineer." },
  "fire-life-safety": { title: "Fire and life-safety plan", kind: "professional", who: "A fire engineer or the architect of record." },
  accessibility: { title: "Accessibility compliance statement", kind: "professional", who: "The architect of record." },
  "environmental-screening": { title: "Environmental screening form (pre-filled)", kind: "draft", needs: ["siteAddress"] },
  "contractor-registration": { title: "Contractor registration and licences", kind: "input", who: "The contractor provides licence numbers." },
  "hurricane-product-approvals": { title: "Wind / hurricane product approvals schedule", kind: "professional", who: "The architect, from manufacturers' approvals." },
  "construction-phase-plan": { title: "Construction health and safety plan", kind: "input", who: "The principal contractor." },
};

const FIELD_LABEL: Record<string, string> = {
  applicantName: "Applicant name", ownerName: "Owner name", siteAddress: "Site address", parcelId: "Parcel / plot number",
  contractorName: "Contractor name", contractorLicence: "Contractor licence number",
};
const mat = (id: keyof typeof MATERIALS) => MATERIALS[id].label.toLowerCase();
const val = (v: string | undefined, label: string) => (v && v.trim() ? v.trim() : `[${label} needed]`);

function describeProject(spec: BuildingSpec): string {
  const m = spec.materials;
  return [
    `${spec.name}: a proposed ${spec.storeys}-storey ${spec.type} at ${spec.location.label}.`,
    `Gross floor area is about ${spec.grossFloorAreaM2} m² on a footprint of about ${spec.footprintM2} m² (${spec.widthM} m × ${spec.depthM} m), rising to ${spec.heightM} m.`,
    `The structure is ${mat(m.structure)}, the facade is ${mat(m.facade)} and the roof is ${spec.roof} with ${mat(m.roof)}.`,
    `Screening occupant load is about ${spec.occupancy} people (gross-area basis). All figures are concept-stage and subject to design development.`,
  ].join("\n");
}

function codeSummary(a: CodeAnalysis): string {
  const lines = [`Likely applicable codes for ${a.jurisdiction.label} (screening only):`, ""];
  for (const c of a.codes) lines.push(`- ${c.title} (${c.issuer}): ${c.why}`);
  if (a.designFlags.length) { lines.push("", "Design flags:"); for (const f of a.designFlags) lines.push(`- ${f}`); }
  lines.push("", "Professionals likely required: " + a.professionals.join(", ") + ".", "", a.disclaimer);
  return lines.join("\n");
}

function durability(spec: BuildingSpec, sim: SimulationResult): string {
  const lines = [
    `Durability screening for ${spec.name} at ${spec.location.label}, ${sim.years}-year horizon, ${sim.maintenance === "none" ? "no planned" : sim.maintenance} maintenance.`,
    `Climate basis: ${sim.climate.label} (${sim.climate.source === "observed" ? "observed weather history" : "indicative regional preset"}).`, "",
  ];
  for (const el of ELEMENTS) {
    const e = sim.elements[el];
    lines.push(`- ${el[0].toUpperCase()}${el.slice(1)}, ${mat(e.material)}: ${Math.round(e.condition[sim.years])}/100 at year ${sim.years}; main driver ${stressLabel(e.dominantStress)}.`);
  }
  if (sim.issues.length) { lines.push("", "Issues and proposed mitigations:"); for (const i of sim.issues) lines.push(`- ${i.title}. ${i.recommendation}`); }
  lines.push("", "This is a comparative screening estimate, not an engineering durability assessment.");
  return lines.join("\n");
}

export function buildPermitPackage(
  spec: BuildingSpec, analysis: CodeAnalysis, sim: SimulationResult | undefined, inputs: PackageInputs = {},
): PermitPackage {
  const completed = new Set(inputs.completedDocs ?? []);
  const usage = new Map<DocId, string[]>();
  for (const p of analysis.permits) for (const d of p.documents) usage.set(d, [...(usage.get(d) ?? []), p.name]);

  const documents: PackageDocument[] = [];
  for (const [id, used] of usage) {
    const def = DOCS[id];
    const doc: PackageDocument = { id, title: def.title, status: "needs-input", missing: [], usedBy: used };
    if (completed.has(id)) {
      doc.status = "provided";
    } else if (def.kind === "draft") {
      const missing = (def.needs ?? []).filter((k) => !String(inputs[k] ?? "").trim()).map((k) => FIELD_LABEL[k] ?? k);
      if (id === "durability-statement" && !sim) missing.push("Run the climate simulation");
      doc.missing = missing;
      doc.status = missing.length ? "needs-input" : "drafted";
      if (id === "project-description") doc.content = describeProject(spec);
      if (id === "code-summary") doc.content = codeSummary(analysis);
      if (id === "durability-statement" && sim) doc.content = durability(spec, sim);
      if (id === "application-form") doc.content = [
        `Applicant: ${val(inputs.applicantName, "Applicant name")}`, `Owner: ${val(inputs.ownerName, "Owner name")}`,
        `Site address: ${val(inputs.siteAddress, "Site address")}`, `Parcel / plot: ${val(inputs.parcelId, "Parcel / plot number")}`,
        `Authority: ${analysis.jurisdiction.authority}`, "", describeProject(spec),
      ].join("\n");
      if (id === "environmental-screening") doc.content = [
        `Site address: ${val(inputs.siteAddress, "Site address")}`, `Project: ${spec.name}`,
        `Gross floor area: ${spec.grossFloorAreaM2} m²; estimated site area: ${spec.siteAreaM2} m² (confirm by survey).`,
        `Hazards noted: flood ${analysis.jurisdiction.hazards.flood}; seismic ${analysis.jurisdiction.hazards.seismic}.`,
      ].join("\n");
    } else if (def.kind === "input") {
      doc.status = "needs-input";
      doc.missing = [def.who ?? "Information from the applicant"];
    } else {
      doc.status = "professional";
      doc.missing = [def.who ?? "A licensed professional"];
    }
    if (id === "contractor-registration" && !completed.has(id) && inputs.contractorName && inputs.contractorLicence) {
      doc.status = "drafted"; doc.missing = [];
      doc.content = `Contractor: ${inputs.contractorName}\nLicence: ${inputs.contractorLicence}`;
    }
    doc.title = def.title;
    documents.push(doc);
  }

  const done = (d: PackageDocument) => d.status === "drafted" || d.status === "provided";
  const byPermit = analysis.permits.map((p) => ({
    permitId: p.id, name: p.name, documents: p.documents,
    ready: p.documents.filter((id) => documents.find((d) => d.id === id && done(d))).length, total: p.documents.length,
  }));
  const openItems = documents.filter((d) => !done(d)).map((d) =>
    d.status === "professional" ? `${d.title}: ${d.missing[0]}` : `${d.title}: ${d.missing.join(", ") || "provide"}`);

  return {
    title: `Permit package: ${spec.name}`, project: spec.name, jurisdiction: analysis.jurisdiction.label, documents, byPermit,
    completeness: documents.length ? Math.round((documents.filter(done).length / documents.length) * 100) : 100,
    openItems,
    disclaimer: "Drafted documents are preparation aids. Documents marked professional must be prepared and stamped by licensed practitioners. Nothing here has been filed or approved.",
  };
}

export function renderPackageMarkdown(pkg: PermitPackage, generatedAt?: string): string {
  const out = [`# ${pkg.title}`, "", `Jurisdiction: ${pkg.jurisdiction}`, ...(generatedAt ? [`Prepared: ${generatedAt}`] : []), `Completeness: ${pkg.completeness} %`, "", `> ${pkg.disclaimer}`, "", "## Permits and document readiness", ""];
  for (const p of pkg.byPermit) out.push(`- ${p.name}: ${p.ready} of ${p.total} documents ready`);
  out.push("", "## Documents", "");
  for (const d of pkg.documents) {
    out.push(`### ${d.title} [${d.status}]`, "");
    if (d.content) out.push(d.content, "");
    if (d.missing.length) out.push(`Needs: ${d.missing.join("; ")}`, "");
    out.push(`Used for: ${d.usedBy.join(", ")}`, "");
  }
  if (pkg.openItems.length) { out.push("## Open items", ""); for (const o of pkg.openItems) out.push(`- ${o}`); }
  return out.join("\n");
}
