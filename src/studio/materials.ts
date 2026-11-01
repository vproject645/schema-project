import type { ElementKey, MaterialId, StressKey } from "./types";

export interface MaterialModel {
  id: MaterialId;
  label: string;
  /** Baseline annual damage rate in a benign climate (fraction/year). */
  base: number;
  /** Sensitivity to each stress. Generic screening values, not tested data. */
  w: Record<StressKey, number>;
  /** Relative installed cost, 1 = reference. Used only to rank alternatives. */
  costIndex: number;
  /** Scene colours: as-built → heavily weathered. */
  color: { fresh: number; aged: number };
  allowed: ElementKey[];
  /** Advice keyed by the stress that dominates for this material. */
  mitigation: Record<StressKey, string>;
}

const generic = (s: string) => s;

export const MATERIALS: Record<MaterialId, MaterialModel> = {
  timber: {
    id: "timber", label: "Timber", base: 0.018,
    w: { moisture: 1.6, rain: 1.0, freeze: 0.6, heat: 0.3, salt: 0.2, uv: 0.5 },
    costIndex: 1.0, color: { fresh: 0xb98a5a, aged: 0x6f6a5c },
    allowed: ["structure", "facade"],
    mitigation: {
      moisture: "Use treated or thermally modified timber, a ventilated rain-screen cavity and raised bases.",
      rain: "Add generous roof overhangs and drip details; keep end grain sealed.",
      freeze: "Detail to shed water; avoid trapped moisture pockets.",
      heat: "Specify stable species and light-coloured finishes to limit checking.",
      salt: generic("Rinse and re-coat on a short cycle near the coast."),
      uv: "Use pigmented UV-stable stains and plan re-coating.",
    },
  },
  steel: {
    id: "steel", label: "Painted steel", base: 0.012,
    w: { moisture: 1.5, rain: 0.8, freeze: 0.3, heat: 0.3, salt: 1.8, uv: 0.3 },
    costIndex: 1.3, color: { fresh: 0x8c959d, aged: 0x7a4a32 },
    allowed: ["structure", "facade", "roof"],
    mitigation: {
      moisture: "Hot-dip galvanise and use a high-build paint system; avoid water traps.",
      rain: "Detail drainage so water never pools on flanges or connections.",
      freeze: "Check for ice jacking at connections and drainage points.",
      heat: "Allow for thermal movement at joints and fixings.",
      salt: "Use a marine-grade coating system (C5 class) or stainless fixings.",
      uv: "Choose UV-stable topcoats and schedule repainting.",
    },
  },
  concrete: {
    id: "concrete", label: "Reinforced concrete", base: 0.006,
    w: { moisture: 0.6, rain: 0.5, freeze: 1.4, heat: 0.4, salt: 1.0, uv: 0.1 },
    costIndex: 1.4, color: { fresh: 0xaeb0ad, aged: 0x6f726c },
    allowed: ["structure", "facade", "roof"],
    mitigation: {
      moisture: "Increase cover to reinforcement and use a low-permeability mix.",
      rain: "Add drip edges and surface sealer on exposed faces.",
      freeze: "Specify air-entrained concrete and a freeze-thaw resistant mix design.",
      heat: "Provide movement joints at suitable spacing.",
      salt: "Use higher cover, corrosion-inhibiting admixtures or stainless reinforcement.",
      uv: "Little action needed; consider a coating for appearance.",
    },
  },
  brick: {
    id: "brick", label: "Brick masonry", base: 0.005,
    w: { moisture: 0.5, rain: 0.6, freeze: 1.2, heat: 0.2, salt: 0.6, uv: 0.05 },
    costIndex: 1.3, color: { fresh: 0xa65a3f, aged: 0x7d5a4b },
    allowed: ["structure", "facade"],
    mitigation: {
      moisture: "Keep the cavity ventilated and weep holes clear; check flashings.",
      rain: "Use full flashings and drip-protected copings.",
      freeze: "Specify frost-resistant bricks and keep copings and sills sealed.",
      heat: "Provide soft joints to accommodate expansion.",
      salt: "Use salt-resistant bricks and mortar mix near the coast.",
      uv: "Little action needed.",
    },
  },
  aluminium: {
    id: "aluminium", label: "Aluminium cladding", base: 0.007,
    w: { moisture: 0.3, rain: 0.2, freeze: 0.1, heat: 0.6, salt: 0.8, uv: 0.2 },
    costIndex: 1.6, color: { fresh: 0xc7ccd1, aged: 0x9aa0a4 },
    allowed: ["facade", "roof"],
    mitigation: {
      moisture: "Isolate from dissimilar metals to avoid galvanic corrosion.",
      rain: "Check sealant joints annually.",
      freeze: "Little action needed.",
      heat: "Allow expansion at fixings; use PVDF finishes to limit colour change.",
      salt: "Use anodised or marine-grade PVDF finishes and rinse regularly.",
      uv: "Use PVDF coatings for colour retention.",
    },
  },
  membrane: {
    id: "membrane", label: "Single-ply roof membrane", base: 0.02,
    w: { moisture: 0.7, rain: 0.5, freeze: 0.8, heat: 1.4, salt: 0.2, uv: 1.5 },
    costIndex: 0.7, color: { fresh: 0x6c7075, aged: 0x4c4f4a },
    allowed: ["roof"],
    mitigation: {
      moisture: "Add tapered insulation to avoid ponding and inspect seams yearly.",
      rain: "Provide overflow scuppers and keep outlets clear.",
      freeze: "Use a cold-flexible membrane and protect seams from ice.",
      heat: "Use a reflective, UV-stable membrane and ballast or a protection layer.",
      salt: "Rinse debris and inspect edge terminations.",
      uv: "Specify a reflective membrane with a UV-stable top layer.",
    },
  },
  "fibre-cement": {
    id: "fibre-cement", label: "Fibre-cement cladding", base: 0.008,
    w: { moisture: 0.6, rain: 0.6, freeze: 0.9, heat: 0.3, salt: 0.3, uv: 0.3 },
    costIndex: 0.9, color: { fresh: 0xb9b6a8, aged: 0x8a8d7c },
    allowed: ["facade", "roof"],
    mitigation: {
      moisture: "Seal cut edges and provide a ventilated cavity.",
      rain: "Detail joints with flashings and keep edges sealed.",
      freeze: "Choose boards rated for freeze-thaw exposure.",
      heat: "Allow movement at fixings.",
      salt: "Rinse and recoat periodically.",
      uv: "Use pigmented coatings for colour stability.",
    },
  },
};

export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export function allowedMaterials(element: ElementKey): MaterialId[] {
  return MATERIAL_IDS.filter((id) => MATERIALS[id].allowed.includes(element));
}
