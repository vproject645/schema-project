/** Shared types for the Studio: idea → spec → simulation → codes → permit package. */

export type BuildingType =
  | "house" | "apartments" | "office" | "retail" | "warehouse" | "school" | "clinic" | "hotel";
export type MaterialId =
  | "timber" | "steel" | "concrete" | "brick" | "aluminium" | "membrane" | "fibre-cement";
export type RoofType = "flat" | "gable" | "hip" | "shed";
export type ElementKey = "structure" | "facade" | "roof";
export type StressKey = "moisture" | "rain" | "freeze" | "heat" | "salt" | "uv";
export type Maintenance = "none" | "routine" | "proactive";

export interface BuildingSpec {
  name: string;
  type: BuildingType;
  storeys: number;
  /** Gross floor area, all storeys, m². */
  grossFloorAreaM2: number;
  /** Ground-floor footprint, m². */
  footprintM2: number;
  /** Estimated site area, m² (assumption unless the user supplies it). */
  siteAreaM2: number;
  widthM: number;
  depthM: number;
  heightM: number;
  roof: RoofType;
  materials: Record<ElementKey, MaterialId>;
  /** Screening occupant load from gross-area factors. */
  occupancy: number;
  location: { label: string; jurisdictionId: string; lat?: number; lng?: number };
  climateId: string;
  /** Overrides the preset when the idea says "coastal" / "seaside". */
  coastal?: boolean;
}

export interface Climate {
  id: string;
  label: string;
  /** °C */
  meanTemp: number;
  /** mm per year */
  annualRain: number;
  /** % */
  meanRH: number;
  /** share of hours above 80 % RH, 0–1 */
  humidShare: number;
  freezeThawDays: number;
  /** days per year above 32 °C */
  hotDays: number;
  frostDays: number;
  /** peak UV index */
  uvIndex: number;
  coastal: boolean;
  /** preset = indicative regional values; observed = summarised from weather history */
  source: "preset" | "observed";
}

export type Stresses = Record<StressKey, number>;

export interface Issue {
  id: string;
  element: ElementKey;
  severity: "watch" | "action" | "critical";
  /** Year (from completion) in which the threshold is first crossed. */
  year: number;
  title: string;
  cause: StressKey;
  detail: string;
  recommendation: string;
}

export interface BuildingRisk {
  id: string;
  title: string;
  level: "low" | "moderate" | "high";
  detail: string;
}

export interface ElementSeries {
  element: ElementKey;
  material: MaterialId;
  /** Condition 100 → 0, index = whole years from completion. */
  condition: number[];
  dominantStress: StressKey;
  /** First year condition < 30 (end of useful service), or null within the horizon. */
  failureYear: number | null;
}

export interface SimulationResult {
  years: number;
  maintenance: Maintenance;
  climate: Climate;
  stresses: Stresses;
  elements: Record<ElementKey, ElementSeries>;
  overall: number[];
  issues: Issue[];
  risks: BuildingRisk[];
  summary: string;
}
