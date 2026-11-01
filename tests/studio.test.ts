import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLIMATES, analyzeCodes, buildPermitPackage, compareMaterials, conditionAt, parseIdea,
  planSubmission, renderPackageMarkdown, resolveClimate, runStudioWorkflow, simulate, stresses,
  submitPermit, summariseHourly, type SubmissionAdapter,
} from "../src/studio";

const house = () => parseIdea("A 2-storey timber house, 200 sqm, in a very humid tropical rainforest area").spec;

test("parseIdea reads type, storeys, area, climate and materials", () => {
  const p = parseIdea("Build a three storey office of 4,500 m2 in Nairobi with a steel frame and aluminium cladding");
  assert.equal(p.spec.type, "office");
  assert.equal(p.spec.storeys, 3);
  assert.equal(p.spec.grossFloorAreaM2, 4500);
  assert.equal(p.spec.footprintM2, 1500);
  assert.equal(p.spec.location.jurisdictionId, "nairobi-ke");
  assert.equal(p.spec.materials.structure, "steel");
  assert.equal(p.spec.materials.facade, "aluminium");
});

test("parseIdea converts square feet and honours 'per floor'", () => {
  const a = parseIdea("two-storey house, 2,000 sq ft, Portland");
  assert.equal(a.spec.grossFloorAreaM2, 186);
  const b = parseIdea("4 storey apartments, 500 m2 per floor, Miami");
  assert.equal(b.spec.grossFloorAreaM2, 2000);
  assert.equal(b.spec.location.jurisdictionId, "miami-fl");
});

test("parseIdea overrides climate from conditions and flags assumptions", () => {
  const p = parseIdea("a school by the coast with extreme humidity");
  assert.equal(p.spec.climateId, "tropical-humid");
  assert.equal(p.spec.coastal, true);
  assert.ok(p.assumptions.some((a) => /generic international/i.test(a)));
  assert.ok(p.assumptions.some((a) => /Storeys not stated/.test(a)));
});

test("parseIdea never assigns a material to an element that cannot use it", () => {
  const p = parseIdea("a house with a timber roof and brick facade");
  assert.notEqual(p.spec.materials.roof, "timber");
});

test("simulation is monotonic, bounded and deterministic", () => {
  const spec = house();
  const a = simulate(spec, resolveClimate(spec, CLIMATES), { years: 40 });
  const b = simulate(spec, resolveClimate(spec, CLIMATES), { years: 40 });
  assert.deepEqual(a, b);
  for (const el of ["structure", "facade", "roof"] as const) {
    const s = a.elements[el].condition;
    assert.equal(s.length, 41);
    assert.equal(s[0], 100);
    for (let i = 1; i < s.length; i++) { assert.ok(s[i] <= s[i - 1]); assert.ok(s[i] >= 0); }
  }
});

test("humid tropics wear timber faster than a dry climate", () => {
  const spec = house();
  const wet = simulate(spec, CLIMATES["tropical-humid"], { years: 30 });
  const dry = simulate(spec, CLIMATES["hot-arid"], { years: 30 });
  assert.ok(wet.elements.facade.condition[30] < dry.elements.facade.condition[30] - 20);
  assert.equal(wet.elements.facade.dominantStress, "moisture");
});

test("maintenance slows weathering", () => {
  const spec = house();
  const none = simulate(spec, CLIMATES["tropical-humid"], { years: 30, maintenance: "none" });
  const pro = simulate(spec, CLIMATES["tropical-humid"], { years: 30, maintenance: "proactive" });
  assert.ok(pro.elements.facade.condition[30] > none.elements.facade.condition[30] + 15);
});

test("a failing facade accelerates structure damage", () => {
  const spec = house();
  const bad = simulate(spec, CLIMATES["tropical-humid"], { years: 30 });
  const good = simulate({ ...spec, materials: { ...spec.materials, facade: "brick" } }, CLIMATES["tropical-humid"], { years: 30 });
  assert.ok(good.elements.structure.condition[30] > bad.elements.structure.condition[30]);
});

test("freeze-thaw hurts concrete more than heat does", () => {
  const spec = { ...house(), materials: { structure: "concrete", facade: "concrete", roof: "concrete" } as const };
  const cold = simulate(spec, CLIMATES["cold-continental"], { years: 40 });
  const hot = simulate(spec, CLIMATES["hot-arid"], { years: 40 });
  assert.ok(cold.elements.facade.condition[40] < hot.elements.facade.condition[40]);
  assert.equal(cold.elements.facade.dominantStress, "freeze");
});

test("coastal exposure makes steel the weak choice", () => {
  const spec = house();
  const rank = compareMaterials({ ...spec, coastal: true }, { ...CLIMATES["temperate-maritime"], coastal: true }, "facade", { years: 30 });
  const steel = rank.findIndex((r) => r.material === "steel");
  const alu = rank.findIndex((r) => r.material === "aluminium");
  assert.ok(alu < steel);
});

test("issues are ordered by severity and carry a mitigation", () => {
  const spec = house();
  const r = simulate(spec, CLIMATES["tropical-humid"], { years: 30 });
  assert.ok(r.issues.length > 0);
  assert.equal(r.issues[0].severity, "critical");
  assert.ok(r.issues.every((i) => i.recommendation.length > 10));
  assert.ok(r.risks.find((x) => x.id === "mould")?.level === "high");
});

test("conditionAt interpolates between years", () => {
  assert.equal(conditionAt([100, 90, 70], 0.5), 95);
  assert.equal(conditionAt([100, 90, 70], 9), 70);
});

test("stress values stay in range", () => {
  for (const c of Object.values(CLIMATES)) for (const v of Object.values(stresses(c))) assert.ok(v >= 0 && v <= 1.5);
});

test("summariseHourly derives climate indicators", () => {
  const temp: number[] = [], rh: number[] = [], rain: number[] = [];
  for (let d = 0; d < 10; d++) for (let h = 0; h < 24; h++) { temp.push(d % 2 ? -2 + h * 0.3 : 20); rh.push(85); rain.push(0.5); }
  const c = summariseHourly("x", "x", temp, rh, rain);
  assert.equal(c.source, "observed");
  assert.equal(c.humidShare, 1);
  assert.equal(c.freezeThawDays, Math.round(5 / (10 / 365)));
  assert.throws(() => summariseHourly("x", "x", [1], [1], [0]));
});

test("Portland house uses the residential code; a Portland office uses the structural code and accessibility", () => {
  const h = analyzeCodes(parseIdea("2-storey house in Portland").spec);
  assert.ok(h.codes.some((c) => c.id === "orsc") && !h.codes.some((c) => c.id === "ossc") && !h.codes.some((c) => c.id === "a117"));
  assert.ok(h.designFlags.some((f) => /Seismic/.test(f)));
  const o = analyzeCodes(parseIdea("3-storey office in Portland").spec);
  assert.ok(o.codes.some((c) => c.id === "ossc") && o.codes.some((c) => c.id === "a117"));
  assert.ok(o.permits.some((p) => /DevHub/.test(p.channel)));
});

test("Nairobi projects pick up EIA screening and NCA registration", () => {
  const a = analyzeCodes(parseIdea("4-storey apartments, 3000 m2, Nairobi").spec);
  assert.ok(a.codes.some((c) => c.id === "emca") && a.permits.some((p) => p.id === "nema") && a.permits.some((p) => p.id === "nca"));
});

test("Miami always needs hurricane product approvals and coastal sites add flood rules", () => {
  const a = analyzeCodes(parseIdea("2-storey coastal house in Miami").spec);
  assert.ok(a.codes.some((c) => c.id === "hvhz") && a.codes.some((c) => c.id === "flood"));
  assert.ok(a.permits.find((p) => p.id === "building")!.documents.includes("hurricane-product-approvals"));
  assert.ok(a.designFlags.some((f) => /Wind hazard/.test(f)));
});

test("London flags a tall apartment block as higher-risk", () => {
  const a = analyzeCodes(parseIdea("8-storey apartments in London").spec);
  assert.ok(a.codes.some((c) => c.id === "bsa") && a.permits.some((p) => p.id === "hrb"));
  const low = analyzeCodes(parseIdea("3-storey apartments in London").spec);
  assert.ok(!low.codes.some((c) => c.id === "bsa"));
});

test("every result is marked as needing verification and unknown cities fall back to the baseline", () => {
  const a = analyzeCodes(parseIdea("a shop in Atlantis").spec);
  assert.equal(a.jurisdiction.id, "generic-intl");
  assert.ok(a.codes.every((c) => c.verify === true) && a.permits.every((p) => p.verify === true));
  assert.match(a.disclaimer, /not a compliance finding/);
});

test("package: missing inputs are listed, professional documents are never marked drafted", () => {
  const spec = parseIdea("3-storey office in Portland").spec;
  const codes = analyzeCodes(spec);
  const sim = simulate(spec, resolveClimate(spec, CLIMATES), { years: 30 });
  const empty = buildPermitPackage(spec, codes, sim);
  const form = empty.documents.find((d) => d.id === "application-form")!;
  assert.equal(form.status, "needs-input");
  assert.ok(form.missing.includes("Site address"));
  for (const id of ["structural-design", "drawings", "fire-life-safety"] as const) assert.equal(empty.documents.find((d) => d.id === id)!.status, "professional");
  const full = buildPermitPackage(spec, codes, sim, { applicantName: "A", ownerName: "B", siteAddress: "1 Main St" });
  assert.equal(full.documents.find((d) => d.id === "application-form")!.status, "drafted");
  assert.ok(full.completeness > empty.completeness);
  assert.ok(full.completeness < 100);
});

test("package: completing a professional document is recorded and markdown renders", () => {
  const spec = parseIdea("2-storey house in Portland").spec;
  const codes = analyzeCodes(spec);
  const pkg = buildPermitPackage(spec, codes, undefined, { completedDocs: ["structural-design"] });
  assert.equal(pkg.documents.find((d) => d.id === "structural-design")!.status, "provided");
  assert.equal(pkg.documents.find((d) => d.id === "durability-statement")!.status, "needs-input");
  const md = renderPackageMarkdown(pkg);
  assert.match(md, /# Permit package/);
  assert.match(md, /Open items/);
});

test("submission is blocked without approvals and always a handoff without an adapter", async () => {
  const spec = parseIdea("2-storey house in Portland").spec;
  const codes = analyzeCodes(spec);
  const sim = simulate(spec, resolveClimate(spec, CLIMATES), { years: 30 });
  const pkg = buildPermitPackage(spec, codes, sim);
  const plan = planSubmission(codes, pkg, { designApproved: false, packageApproved: false });
  assert.ok(plan.every((p) => p.mode === "handoff" && !p.ready && p.blockers.length > 0));
  await assert.rejects(() => submitPermit(codes, pkg, { designApproved: true, packageApproved: true }, [], "building"), /No automated submission/);
});

test("an adapter files only when approved and nothing is outstanding", async () => {
  const spec = parseIdea("2-storey house in Portland").spec;
  const codes = analyzeCodes(spec);
  const trade = codes.permits.find((p) => p.id === "trade")!;
  const adapter: SubmissionAdapter = { id: "test-portal", jurisdictionId: "portland-or", permitIds: ["trade"], submit: async () => ({ reference: "T-1", submittedAt: "now" }) };
  const pkg = buildPermitPackage(spec, codes, undefined, { completedDocs: trade.documents });
  await assert.rejects(() => submitPermit(codes, pkg, { designApproved: true, packageApproved: false }, [adapter], "trade"), /Not ready/);
  const receipt = await submitPermit(codes, pkg, { designApproved: true, packageApproved: true }, [adapter], "trade");
  assert.equal(receipt.reference, "T-1");
});

test("workflow revises a weak facade, re-simulates, and stops at human gates", () => {
  const w = runStudioWorkflow("A 2-storey timber house, 200 sqm, in an area with extreme humidity and heavy rainfall");
  assert.ok(w.revisions.some((r) => r.element === "facade" && r.applied && r.to !== r.from));
  assert.ok(w.simulation.elements.facade.condition[30] > w.baseline.elements.facade.condition[30]);
  assert.notEqual(w.spec.materials.facade, w.parsed.spec.materials.facade);
  assert.deepEqual(w.gates.map((g) => g.id), ["design", "package", "filing"]);
  assert.ok(w.log.some((e) => e.agent === "Revision") && w.log.at(-1)!.message.includes("Nothing has been filed"));
  assert.ok(w.package.openItems.length > 0);
});

test("workflow proposes but never applies a structure change", () => {
  const w = runStudioWorkflow("a timber frame house in a very humid tropical coastal area", { targetCondition: 95 });
  const s = w.revisions.find((r) => r.element === "structure");
  if (s && s.to !== s.from) assert.equal(s.applied, false);
  assert.equal(w.spec.materials.structure, w.parsed.spec.materials.structure);
});

test("workflow with autoRevise off leaves the design alone and is deterministic", () => {
  const a = runStudioWorkflow("2-storey timber house in tropical area", { autoRevise: false });
  const b = runStudioWorkflow("2-storey timber house in tropical area", { autoRevise: false });
  assert.deepEqual(a.spec, a.parsed.spec);
  assert.equal(a.revisions.length, 0);
  assert.deepEqual(a.log, b.log);
});

import { lerpColor, mood, rainSettings, sceneGeometry, wearAt, runWorkflowFromParsed } from "../src/studio";

test("lerpColor blends channels and clamps", () => {
  assert.equal(lerpColor(0x000000, 0xffffff, 0.5), 0x808080);
  assert.equal(lerpColor(0x102030, 0xffffff, -3), 0x102030);
  assert.equal(lerpColor(0x102030, 0xffffff, 9), 0xffffff);
});

test("scene geometry matches the spec and keeps pitched roofs sane", () => {
  const spec = parseIdea("3-storey office, 1500 m2, gable roof").spec;
  const g = sceneGeometry(spec);
  assert.equal(g.storeys, 3);
  assert.equal(Math.round(g.storeyHeight * 10) / 10, 3.6);
  assert.ok(g.roofRise >= 1.2 && g.roofRise <= 4.5);
  assert.ok(g.baysWide >= 1 && g.baysDeep >= 1);
});

test("wear grows with time and rain follows rainfall", () => {
  const spec = house();
  const sim = simulate(spec, CLIMATES["tropical-humid"], { years: 30 });
  assert.ok(wearAt(spec, sim, 20).facade.wear > wearAt(spec, sim, 2).facade.wear);
  assert.equal(wearAt(spec, sim, 0).facade.wear, 0);
  assert.equal(rainSettings(CLIMATES["hot-arid"]).active, false);
  assert.ok(rainSettings(CLIMATES["tropical-humid"]).drops > rainSettings(CLIMATES["temperate-oceanic"]).drops);
  assert.notEqual(mood(CLIMATES["hot-arid"]).ground, mood(CLIMATES["tropical-humid"]).ground);
});

test("hand-edited designs go through the same pipeline", () => {
  const parsed = parseIdea("2-storey timber house in Portland");
  const edited = { ...parsed, spec: { ...parsed.spec, materials: { ...parsed.spec.materials, facade: "brick" as const } } };
  const w = runWorkflowFromParsed(edited, { autoRevise: false });
  assert.equal(w.spec.materials.facade, "brick");
  assert.equal(w.codes.jurisdiction.id, "portland-or");
});

import { reshapeSpec } from "../src/studio";
test("reshapeSpec recomputes massing and keeps materials and place", () => {
  const spec = parseIdea("2-storey timber house in Portland, 200 sqm").spec;
  const next = reshapeSpec(spec, { storeys: 4, grossFloorAreaM2: 400, roof: "flat" });
  assert.equal(next.storeys, 4);
  assert.equal(next.footprintM2, 100);
  assert.equal(next.heightM, 12);
  assert.equal(next.roof, "flat");
  assert.deepEqual(next.materials, spec.materials);
  assert.equal(next.location.jurisdictionId, "portland-or");
  assert.equal(reshapeSpec(spec, { storeys: 999 }).storeys, 60);
});
