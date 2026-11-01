import { CLIMATES } from "./climate";
import { MATERIALS, MATERIAL_IDS } from "./materials";
import type { BuildingSpec, BuildingType, ElementKey, MaterialId, RoofType } from "./types";

export interface ParsedIdea {
  spec: BuildingSpec;
  /** What was read from the text vs. assumed. Shown to the user so nothing is silent. */
  found: string[];
  assumptions: string[];
  confidence: "low" | "medium" | "high";
}

/** Swap this for a model-backed parser behind the same signature; the rest of the pipeline is unchanged. */
export type IdeaParser = (idea: string) => ParsedIdea;

const WORD_NUMBERS: Record<string, number> = {
  one: 1, single: 1, two: 2, double: 2, three: 3, triple: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

interface Place { keys: RegExp; label: string; jurisdictionId: string; climateId: string; lat: number; lng: number }
export const PLACES: Place[] = [
  { keys: /\bnairobi\b|\bkenya\b/, label: "Nairobi, Kenya", jurisdictionId: "nairobi-ke", climateId: "highland-subtropical", lat: -1.2673, lng: 36.806 },
  { keys: /\bportland\b|\boregon\b/, label: "Portland, Oregon, USA", jurisdictionId: "portland-or", climateId: "temperate-maritime", lat: 45.5152, lng: -122.6784 },
  { keys: /\bmiami\b|\bflorida\b/, label: "Miami, Florida, USA", jurisdictionId: "miami-fl", climateId: "humid-subtropical-coast", lat: 25.7617, lng: -80.1918 },
  { keys: /\blondon\b|\bengland\b|\bunited kingdom\b|\buk\b/, label: "London, UK", jurisdictionId: "london-uk", climateId: "temperate-oceanic", lat: 51.5072, lng: -0.1276 },
  { keys: /\blagos\b|\bnigeria\b|\baccra\b|\bghana\b/, label: "West Africa (tropical humid)", jurisdictionId: "generic-intl", climateId: "tropical-humid", lat: 6.5244, lng: 3.3792 },
  { keys: /\bsingapore\b|\bkuala lumpur\b|\bjakarta\b|\bmumbai\b|\bmanila\b|\bbangkok\b/, label: "Southeast Asia (tropical humid)", jurisdictionId: "generic-intl", climateId: "tropical-humid", lat: 1.3521, lng: 103.8198 },
  { keys: /\bdubai\b|\babu dhabi\b|\briyadh\b|\bphoenix\b/, label: "Arabian Gulf (hot arid)", jurisdictionId: "generic-intl", climateId: "hot-arid", lat: 25.2048, lng: 55.2708 },
  { keys: /\boslo\b|\bhelsinki\b|\bminneapolis\b|\bchicago\b|\bmontreal\b|\btoronto\b|\bcanada\b/, label: "Northern cold climate", jurisdictionId: "generic-intl", climateId: "cold-continental", lat: 45.5017, lng: -73.5673 },
];

const TYPE_RULES: [RegExp, BuildingType][] = [
  [/\b(?:warehouse|factory|industrial|depot|logistics)\b/, "warehouse"],
  [/\b(?:school|classroom|college|campus)\b/, "school"],
  [/\b(?:clinic|hospital|health\s?cent(?:er|re)|medical)\b/, "clinic"],
  [/\b(?:hotel|hostel|lodge|resort)\b/, "hotel"],
  [/\b(?:apartments?|flats?|multi-?family|condos?)\b|residential (?:block|tower)/, "apartments"],
  [/\b(?:office|workspace|co-?working|headquarters)\b/, "office"],
  [/\b(?:shop|retail|store|mall|supermarket|restaurant|caf[eé])s?\b/, "retail"],
  [/\b(?:house|home|villa|cottage|bungalow|residence|cabin|dwelling)\b/, "house"],
];

const FLOOR_HEIGHT: Record<BuildingType, number> = {
  house: 3.0, apartments: 3.0, office: 3.6, retail: 4.2, warehouse: 8, school: 3.6, clinic: 3.6, hotel: 3.2,
};
/** Gross m² per person. IBC-style screening factors, not a code-compliant occupant load. */
const AREA_PER_PERSON: Record<BuildingType, number> = {
  house: 40, apartments: 30, office: 13.9, retail: 5.6, warehouse: 27.9, school: 4.6, clinic: 13.9, hotel: 18.6,
};
const DEFAULT_AREA: Record<BuildingType, number> = {
  house: 180, apartments: 1800, office: 1500, retail: 600, warehouse: 2500, school: 2000, clinic: 900, hotel: 3000,
};
const DEFAULT_STOREYS: Record<BuildingType, number> = {
  house: 2, apartments: 5, office: 3, retail: 1, warehouse: 1, school: 2, clinic: 2, hotel: 4,
};
const DEFAULT_MATERIALS: Record<BuildingType, Record<ElementKey, MaterialId>> = {
  house: { structure: "timber", facade: "timber", roof: "steel" },
  apartments: { structure: "concrete", facade: "fibre-cement", roof: "membrane" },
  office: { structure: "steel", facade: "aluminium", roof: "membrane" },
  retail: { structure: "steel", facade: "fibre-cement", roof: "membrane" },
  warehouse: { structure: "steel", facade: "steel", roof: "steel" },
  school: { structure: "concrete", facade: "brick", roof: "membrane" },
  clinic: { structure: "concrete", facade: "brick", roof: "membrane" },
  hotel: { structure: "concrete", facade: "aluminium", roof: "membrane" },
};

const MATERIAL_WORDS: [RegExp, MaterialId][] = [
  [/timber|wood(?:en)?|cedar|cross-?laminated|clt/, "timber"],
  [/fib(?:re|er)[\s-]?cement/, "fibre-cement"],
  [/steel/, "steel"],
  [/concrete/, "concrete"],
  [/brick|masonry/, "brick"],
  [/alumin(?:i)?um/, "aluminium"],
];

function numberFrom(token: string): number | undefined {
  const t = token.toLowerCase();
  return WORD_NUMBERS[t] ?? (/^\d{1,2}$/.test(t) ? Number(t) : undefined);
}

function detectMaterials(text: string, type: BuildingType, found: string[], roofIsFlat: boolean) {
  const mats = { ...DEFAULT_MATERIALS[type] };
  if (roofIsFlat && mats.roof === "steel" && type === "house") mats.roof = "membrane";
  const set = new Set<ElementKey>();
  for (const [re, id] of MATERIAL_WORDS) {
    const src = re.source;
    const roleRules: [RegExp, ElementKey][] = [
      [new RegExp(`(?:${src})\\s*(?:cladding|facade|façade|exterior|skin|walls?)`), "facade"],
      [new RegExp(`(?:${src})\\s*(?:frame|framed|structure|structural|skeleton)`), "structure"],
      [new RegExp(`(?:${src})\\s*roof(?:ing)?`), "roof"],
    ];
    for (const [rule, el] of roleRules) {
      if (rule.test(text)) {
        if (MATERIALS[id].allowed.includes(el)) { mats[el] = id; set.add(el); found.push(`${el}: ${id}`); }
      }
    }
  }
  // A bare "steel building" / "concrete tower" sets the structure if nothing more specific was said.
  if (!set.has("structure")) {
    for (const [re, id] of MATERIAL_WORDS) {
      if (new RegExp(`(?:${re.source})\\s*(?:building|tower|house|home|warehouse|office|block)`).test(text) && MATERIAL_IDS.includes(id)) {
        mats.structure = id; set.add("structure"); found.push(`structure: ${id}`); break;
      }
    }
  }
  return { mats, explicit: set };
}


/** Derive massing and occupant load from type, storeys and gross floor area. */
export function geometryFor(type: BuildingType, storeys: number, gfa: number) {
  const st = Math.max(1, Math.min(60, Math.round(storeys)));
  const area = Math.max(20, Math.min(500000, gfa));
  const footprint = Math.max(1, Math.round(area / st));
  const aspect = type === "warehouse" ? 2 : 1.4;
  const depth = Math.sqrt(footprint / aspect);
  const width = footprint / depth;
  return {
    storeys: st, grossFloorAreaM2: Math.round(area), footprintM2: footprint, siteAreaM2: Math.round(footprint * 2.5),
    widthM: round1(width), depthM: round1(depth), heightM: round1(st * FLOOR_HEIGHT[type]),
    occupancy: Math.max(1, Math.ceil(area / AREA_PER_PERSON[type])),
  };
}

/** Change size or roof of an existing spec; materials, place and climate are kept. */
export function reshapeSpec(spec: BuildingSpec, change: { storeys?: number; grossFloorAreaM2?: number; roof?: RoofType }): BuildingSpec {
  const g = geometryFor(spec.type, change.storeys ?? spec.storeys, change.grossFloorAreaM2 ?? spec.grossFloorAreaM2);
  return { ...spec, ...g, roof: change.roof ?? spec.roof };
}

export const parseIdea: IdeaParser = (idea) => {
  const text = idea.toLowerCase();
  const found: string[] = [];
  const assumptions: string[] = [];

  // Type
  let type: BuildingType | undefined;
  for (const [re, t] of TYPE_RULES) if (re.test(text)) { type = t; break; }
  if (type) found.push(`type: ${type}`); else { type = "office"; assumptions.push("No building type recognised, so assumed an office."); }

  // Storeys
  let storeys: number | undefined;
  const sm = text.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|single|double|triple)[\s-]*(?:storeys?|stories|story|floors?|levels?)\b/);
  if (sm) storeys = numberFrom(sm[1]);
  if (storeys) found.push(`storeys: ${storeys}`);

  // Area (gross unless "per floor"/"footprint")
  let area: number | undefined;
  const m2 = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:m2|m²|sqm|sq\.?\s?m|square\s*met(?:er|re)s?)/);
  const ft2 = text.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:sq\.?\s?ft|sqft|square\s*(?:feet|foot)|ft2|ft²)/);
  if (m2) area = Number(m2[1].replace(/,/g, ""));
  else if (ft2) area = Math.round(Number(ft2[1].replace(/,/g, "")) * 0.092903);
  const perFloor = /per\s+(?:floor|level|storey|story)|each\s+(?:floor|level)|footprint/.test(text);

  storeys = storeys ?? DEFAULT_STOREYS[type];
  if (!sm) assumptions.push(`Storeys not stated, so assumed ${storeys}.`);
  storeys = Math.max(1, Math.min(60, storeys));
  let gfa: number;
  if (area && area > 0) {
    gfa = perFloor ? area * storeys : area;
    found.push(`area: ${Math.round(area)} m²${perFloor ? " per floor" : " gross"}`);
  } else {
    gfa = type === "house" || !sm ? DEFAULT_AREA[type] : DEFAULT_AREA[type] * (storeys / DEFAULT_STOREYS[type]);
    assumptions.push(`Floor area not stated, so assumed about ${Math.round(gfa)} m² gross.`);
  }
  gfa = Math.max(20, Math.min(500000, gfa));
  const footprint = Math.round(gfa / storeys);

  // Roof
  let roof: RoofType | undefined;
  if (/flat roof/.test(text)) roof = "flat";
  else if (/gable|pitched|sloped|sloping/.test(text)) roof = "gable";
  else if (/hip(?:ped)? roof/.test(text)) roof = "hip";
  else if (/mono-?pitch|shed roof/.test(text)) roof = "shed";
  if (roof) found.push(`roof: ${roof}`);
  else { roof = type === "house" || type === "warehouse" ? "gable" : "flat"; assumptions.push(`Roof not stated, so assumed ${roof}.`); }

  // Location and climate
  let place = PLACES.find((p) => p.keys.test(text));
  let climateId = place?.climateId;
  const jurisdictionId = place?.jurisdictionId ?? "generic-intl";
  if (place) found.push(`location: ${place.label}`);
  const wants = (re: RegExp) => re.test(text);
  if (wants(/extreme humidity|humid|tropical|monsoon|rainforest|heavy rain|very wet/)) { climateId = "tropical-humid"; found.push("climate: tropical humid"); }
  else if (wants(/desert|arid|hot and dry|scorching/)) { climateId = "hot-arid"; found.push("climate: hot arid"); }
  else if (wants(/freez|snow|arctic|sub-?zero|very cold|cold climate|harsh winter/)) { climateId = "cold-continental"; found.push("climate: cold continental"); }
  const coastal = wants(/coastal|\bcoast\b|beach|seaside|oceanfront|waterfront|\bisland\b|\bsea\b/) ? true : undefined;
  if (coastal) found.push("exposure: coastal");
  if (!climateId) { climateId = "temperate-maritime"; assumptions.push("No location or climate given, so used a temperate maritime climate."); }
  if (!place) assumptions.push("No known city recognised, so the generic international code baseline applies. Name a city for local codes.");
  place = place ?? { keys: /$^/, label: "Unspecified site", jurisdictionId, climateId, lat: NaN, lng: NaN };

  // Materials
  const { mats, explicit } = detectMaterials(text, type, found, roof === "flat");
  const assumedEls = (["structure", "facade", "roof"] as ElementKey[]).filter((e) => !explicit.has(e));
  if (assumedEls.length) assumptions.push(`Materials assumed for ${assumedEls.join(", ")} (typical for a ${type}); change them in the next step.`);

  // Geometry
  const geo = geometryFor(type, storeys, gfa);
  const spec: BuildingSpec = {
    name: `${type[0].toUpperCase()}${type.slice(1)} concept`,
    type, ...geo, roof, materials: mats,
    location: { label: place.label, jurisdictionId, lat: Number.isFinite(place.lat) ? place.lat : undefined, lng: Number.isFinite(place.lng) ? place.lng : undefined },
    climateId, coastal,
  };
  if (!CLIMATES[spec.climateId]) throw new Error(`Unknown climate ${spec.climateId}`);
  assumptions.push(`Site area assumed about ${spec.siteAreaM2} m² (2.5× footprint); enter the surveyed value for permits.`);

  const confidence = found.length >= 5 ? "high" : found.length >= 3 ? "medium" : "low";
  return { spec, found, assumptions, confidence };
};

const round1 = (n: number) => Math.round(n * 10) / 10;
