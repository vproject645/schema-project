import type { DocId } from "./codes";
import type { CodeAnalysis } from "./codes";
import type { PermitPackage } from "./permit-package";

/**
 * Submission is only automated where a real adapter exists for an authority.
 * Today none does, so every permit resolves to a reviewed handoff: the platform prepares
 * the package, and a person files it. The adapter interface is here so a supported
 * portal can be added without touching the rest of the pipeline.
 */
export interface SubmissionReceipt { reference: string; submittedAt: string }
export interface SubmissionAdapter {
  id: string;
  jurisdictionId: string;
  /** Permit ids this adapter can file. */
  permitIds: string[];
  submit(pkg: PermitPackage, permitId: string): Promise<SubmissionReceipt>;
}

export interface Approvals { designApproved: boolean; packageApproved: boolean }
export interface SubmissionPlanItem {
  permitId: string; name: string; channel: string;
  mode: "adapter" | "handoff";
  ready: boolean;
  blockers: string[];
  steps: string[];
}

export function planSubmission(
  analysis: CodeAnalysis, pkg: PermitPackage, approvals: Approvals, adapters: SubmissionAdapter[] = [],
): SubmissionPlanItem[] {
  return analysis.permits.map((p) => {
    const adapter = adapters.find((a) => a.jurisdictionId === analysis.jurisdiction.id && a.permitIds.includes(p.id));
    const blockers: string[] = [];
    if (!approvals.designApproved) blockers.push("A person must approve the design and any suggested revisions.");
    if (!approvals.packageApproved) blockers.push("A person must review and approve the package contents.");
    const entry = pkg.byPermit.find((x) => x.permitId === p.id);
    for (const id of p.documents) {
      const d = pkg.documents.find((x) => x.id === id);
      if (d && d.status !== "drafted" && d.status !== "provided") blockers.push(`${d.title}: ${d.missing[0] ?? "still outstanding"}`);
    }
    const mode = adapter ? "adapter" : "handoff";
    return {
      permitId: p.id, name: p.name, channel: p.channel, mode, ready: blockers.length === 0 && !!entry, blockers,
      steps: adapter
        ? [`Submit through the ${adapter.id} adapter after final approval.`, "Store the receipt reference with the project."]
        : [`Export the package.`, `File with ${p.authority} via: ${p.channel}.`, "Record the application reference in the project."],
    };
  });
}

/** Files a permit only when approvals are in, nothing is outstanding and a real adapter exists. */
export async function submitPermit(
  analysis: CodeAnalysis, pkg: PermitPackage, approvals: Approvals, adapters: SubmissionAdapter[], permitId: string,
): Promise<SubmissionReceipt> {
  const item = planSubmission(analysis, pkg, approvals, adapters).find((i) => i.permitId === permitId);
  if (!item) throw new Error(`Unknown permit: ${permitId}`);
  if (item.mode !== "adapter") throw new Error("No automated submission exists for this permit. Use the reviewed handoff.");
  if (!item.ready) throw new Error(`Not ready to submit: ${item.blockers.join(" ")}`);
  const adapter = adapters.find((a) => a.jurisdictionId === analysis.jurisdiction.id && a.permitIds.includes(permitId))!;
  return adapter.submit(pkg, permitId);
}
export type { DocId };
