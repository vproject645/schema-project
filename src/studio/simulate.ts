import { stresses, withCoastal } from "./climate";
import { MATERIALS, allowedMaterials } from "./materials";
import type {
  BuildingRisk, BuildingSpec, Climate, ElementKey, ElementSeries, Issue, Maintenance,
  MaterialId, RoofType, SimulationResult, StressKey, Stresses,
} from "./types";

/**
 * Durability SCREENING model. It reuses the generic material sensitivities from the
 * earlier /simulate page, adds salt, UV and roof/structure coupling, and integrates damage
 * with a moisture-feedback term. Output compares options; it is not engineering analysis.
 */
const CALIBRATION = 0.3;
const FEEDBACK = 1.0;
const STEPS_PER_YEAR = 4;
export const MAINTENANCE_FACTOR: Record<Maintenance, number> = { none: 1, routine: 0.7, proactive: 0.45 };
const ROOF_RAIN: Record<RoofType, number> = { flat: 1.25, gable: 1.0, hip: 0.95, shed: 1.05 };
export const THRESHOLDS = { watch: 70, action: 50, critical: 30 } as const;
export const ELEMENTS: ElementKey[] = ["structure", "facade", "roof"];

const STRESS_LABEL: Record<StressKey, string> = {
  moisture: "humidity", rain: "rainfall", freeze: "freeze-thaw cycling",
  heat: "heat", salt: "salt exposure", uv: "UV radiation",
};
export const stressLabel = (s: StressKey) => STRESS_LABEL[s];

function exposure(element: ElementKey, s: Stresses, roof: RoofType): Stresses {
  if (element !== "roof") return s;
  return { ...s, rain: s.rain * ROOF_RAIN[roof], heat: s.heat * 1.2, uv: s.uv * 1.2 };
}

function weightedSum(material: MaterialId, s: Stresses): number {
  const w = MATERIALS[material].w;
  return (Object.keys(w) as StressKey[]).reduce((sum, k) => sum + w[k] * s[k], 0);
}

function dominant(material: MaterialId, s: Stresses): StressKey {
  const w = MATERIALS[material].w;
  return (Object.keys(w) as StressKey[]).reduce((best, k) => (w[k] * s[k] > w[best] * s[best] ? k : best), "moisture" as StressKey);
}

export function resolveClimate(spec: BuildingSpec, climates: Record<string, Climate>): Climate {
  const c = climates[spec.climateId];
  if (!c) throw new Error(`Unknown climate: ${spec.climateId}`);
  return withCoastal(c, spec.coastal);
}

export function simulate(
  spec: BuildingSpec, climate: Climate,
  opts: { years?: number; maintenance?: Maintenance } = {},
): SimulationResult {
  const years = Math.max(1, Math.min(100, Math.round(opts.years ?? 30)));
  const maintenance = opts.maintenance ?? "none";
  const mf = MAINTENANCE_FACTOR[maintenance];
  const s = stresses(climate);
  const dt = 1 / STEPS_PER_YEAR;
  const D: Record<ElementKey, number> = { structure: 0, facade: 0, roof: 0 };
  const cond: Record<ElementKey, number[]> = { structure: [100], facade: [100], roof: [100] };

  for (let y = 0; y < years; y++) {
    for (let k = 0; k < STEPS_PER_YEAR; k++) {
      const next = { ...D };
      for (const el of ELEMENTS) {
        const m = spec.materials[el];
        const ex = exposure(el, s, spec.roof);
        // The structure is sheltered until the facade deteriorates.
        const shelter = el === "structure" ? 0.35 + 0.65 * D.facade : 1;
        const rate = MATERIALS[m].base * (1 + weightedSum(m, ex)) * CALIBRATION * mf * shelter;
        next[el] = Math.min(1, D[el] + rate * (1 + FEEDBACK * D[el]) * dt);
      }
      Object.assign(D, next);
    }
    for (const el of ELEMENTS) cond[el].push(Math.round(100 * (1 - D[el]) * 10) / 10);
  }

  const elements = {} as Record<ElementKey, ElementSeries>;
  for (const el of ELEMENTS) {
    const m = spec.materials[el];
    const failure = cond[el].findIndex((v) => v < THRESHOLDS.critical);
    elements[el] = {
      element: el, material: m, condition: cond[el],
      dominantStress: dominant(m, exposure(el, s, spec.roof)),
      failureYear: failure === -1 ? null : failure,
    };
  }
  // Overall: the weakest link dominates, with the other elements pulling it down a little.
  const overall = cond.structure.map((_, i) => {
    const vals = ELEMENTS.map((el) => cond[el][i]);
    return Math.round((0.7 * Math.min(...vals) + 0.3 * (vals.reduce((a, b) => a + b, 0) / 3)) * 10) / 10;
  });

  const issues = buildIssues(elements, spec);
  const risks = buildingRisks(spec, climate);
  const result: SimulationResult = { years, maintenance, climate, stresses: s, elements, overall, issues, risks, summary: "" };
  result.summary = summarise(result, spec);
  return result;
}

function firstBelow(series: number[], limit: number): number | null {
  const i = series.findIndex((v) => v < limit);
  return i === -1 ? null : i;
}

function buildIssues(elements: Record<ElementKey, ElementSeries>, spec: BuildingSpec): Issue[] {
  const out: Issue[] = [];
  for (const el of ELEMENTS) {
    const e = elements[el];
    const crit = firstBelow(e.condition, THRESHOLDS.critical);
    const act = firstBelow(e.condition, THRESHOLDS.action);
    const watch = firstBelow(e.condition, THRESHOLDS.watch);
    const sev = crit !== null ? "critical" : act !== null ? "action" : watch !== null ? "watch" : null;
    if (!sev) continue;
    const year = (crit ?? act ?? watch) as number;
    const m = MATERIALS[e.material];
    const cause = e.dominantStress;
    const what = el === "structure" ? "structural frame" : el === "facade" ? "facade" : "roof";
    out.push({
      id: `${el}-${sev}`, element: el, severity: sev, year, cause,
      title: `${m.label} ${what} ${sev === "critical" ? "reaches end of service life" : sev === "action" ? "needs intervention" : "needs monitoring"} by year ${year}`,
      detail: `${stressLabel(cause).charAt(0).toUpperCase()}${stressLabel(cause).slice(1)} is the dominant driver for ${m.label.toLowerCase()} here. Condition first drops below ${THRESHOLDS[sev]}/100 around year ${year}` +
        (el === "structure" ? ", accelerated once the facade stops protecting the frame." : "."),
      recommendation: m.mitigation[cause],
    });
  }
  const order = { critical: 0, action: 1, watch: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.year - b.year);
}

function buildingRisks(spec: BuildingSpec, c: Climate): BuildingRisk[] {
  const level = (v: number, mod: number, hi: number): "low" | "moderate" | "high" => (v >= hi ? "high" : v >= mod ? "moderate" : "low");
  const risks: BuildingRisk[] = [
    { id: "mould", title: "Interior moisture and mould",
      level: level(c.humidShare, 0.35, 0.55),
      detail: `Relative humidity is above 80 % for about ${Math.round(c.humidShare * 100)} % of hours. Plan cross-ventilation, vapour control and dehumidification where needed.` },
    { id: "drainage", title: "Roof and site drainage",
      level: level(c.annualRain * (spec.roof === "flat" ? 1.25 : 1), 1100, 1900),
      detail: `About ${Math.round(c.annualRain)} mm of rain per year${spec.roof === "flat" ? " on a flat roof, where ponding is a real risk" : ""}. Size outlets and overflows for peak intensity, not the annual average.` },
    { id: "freeze", title: "Freeze-thaw damage",
      level: level(c.freezeThawDays, 20, 60),
      detail: `${c.freezeThawDays} freeze-thaw days per year affect masonry, concrete and drainage details.` },
    { id: "heat", title: "Heat load and thermal movement",
      level: level(c.hotDays, 30, 90),
      detail: `${c.hotDays} days per year above 32 °C. Consider shading, reflective roofing and movement joints.` },
    { id: "corrosion", title: "Corrosion from salt exposure",
      level: c.coastal ? "high" : "low",
      detail: c.coastal ? "Coastal salt accelerates corrosion of steel, reinforcement and fixings." : "Not a coastal site, so salt is a minor factor." },
  ];
  return risks;
}

function summarise(r: SimulationResult, spec: BuildingSpec): string {
  const worst = ELEMENTS.map((el) => r.elements[el]).sort((a, b) => a.condition[r.years] - b.condition[r.years])[0];
  const end = r.overall[r.years];
  const mat = MATERIALS[worst.material].label.toLowerCase();
  const critical = r.issues.filter((i) => i.severity === "critical").length;
  return `After ${r.years} years with ${r.maintenance === "none" ? "no planned" : r.maintenance} maintenance, overall condition is about ${Math.round(end)}/100. ` +
    `The weakest element is the ${worst.element} (${mat}), at ${Math.round(worst.condition[r.years])}/100, mainly from ${stressLabel(worst.dominantStress)}. ` +
    (critical ? `${critical} element${critical > 1 ? "s" : ""} reach end of service life within the horizon.` : "No element reaches end of service life within the horizon.");
}

/** Condition at a fractional year, linearly interpolated. */
export function conditionAt(series: number[], year: number): number {
  const t = Math.max(0, Math.min(series.length - 1, year));
  const i = Math.floor(t);
  const f = t - i;
  return i >= series.length - 1 ? series[series.length - 1] : series[i] * (1 - f) + series[i + 1] * f;
}

export interface MaterialComparison {
  material: MaterialId; label: string; costIndex: number;
  conditionAtHorizon: number; failureYear: number | null;
}

/** Rank every allowed material for one element, holding the rest of the design fixed. */
export function compareMaterials(
  spec: BuildingSpec, climate: Climate, element: ElementKey,
  opts: { years?: number; maintenance?: Maintenance } = {},
): MaterialComparison[] {
  return allowedMaterials(element).map((material) => {
    const trial = { ...spec, materials: { ...spec.materials, [element]: material } };
    const r = simulate(trial, climate, opts);
    const e = r.elements[element];
    return { material, label: MATERIALS[material].label, costIndex: MATERIALS[material].costIndex,
      conditionAtHorizon: e.condition[r.years], failureYear: e.failureYear };
  }).sort((a, b) => b.conditionAtHorizon - a.conditionAtHorizon);
}
