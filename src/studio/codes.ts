import { CLIMATES } from "./climate";
import type { BuildingSpec, Climate } from "./types";

/**
 * Code and permit engine.
 *
 * This identifies the codes and permits that LIKELY apply to a concept, and why, so a team
 * knows what to prepare. It does not certify compliance, interpret local amendments, or
 * replace the authority having jurisdiction. Every result carries `verify: true`.
 */
export type CodeCategory = "structural" | "fire" | "accessibility" | "energy" | "zoning" | "environmental" | "mep" | "safety" | "wind-flood";
export type DocId =
  | "application-form" | "owner-authorisation" | "project-description" | "site-plan" | "drawings"
  | "structural-design" | "geotechnical" | "code-summary" | "durability-statement" | "energy-compliance"
  | "stormwater" | "fire-life-safety" | "accessibility" | "environmental-screening"
  | "contractor-registration" | "hurricane-product-approvals" | "construction-phase-plan";

export interface CodeRef {
  id: string; title: string; issuer: string; category: CodeCategory;
  applies: (s: BuildingSpec, c: Climate) => boolean;
  why: (s: BuildingSpec, c: Climate) => string;
}
export interface PermitRule {
  id: string; name: string; authority: string;
  /** Where applications are filed, if known. Unknown stays unknown. */
  channel: string;
  applies: (s: BuildingSpec, c: Climate) => boolean;
  why: (s: BuildingSpec, c: Climate) => string;
  documents: DocId[];
}
export interface Jurisdiction {
  id: string; label: string; authority: string;
  hazards: { seismic: string; wind: string; flood: string; snow: string };
  codes: CodeRef[]; permits: PermitRule[];
}

const always = () => true;
const nonHouse = (s: BuildingSpec) => s.type !== "house";
const isResidentialSmall = (s: BuildingSpec) => s.type === "house";
const tall = (s: BuildingSpec) => s.heightM >= 23 || s.storeys >= 7;

const stormwaterDocs: DocId[] = ["stormwater"];
const commonDocs: DocId[] = ["application-form", "owner-authorisation", "project-description", "site-plan", "drawings", "code-summary", "durability-statement"];

const JURISDICTIONS: Jurisdiction[] = [
  {
    id: "portland-or", label: "Portland, Oregon, USA", authority: "Portland Permitting & Development",
    hazards: { seismic: "High (Cascadia subduction zone)", wind: "Moderate", flood: "Site-specific (river floodplains)", snow: "Low" },
    codes: [
      { id: "ossc", title: "Oregon Structural Specialty Code (IBC-based)", issuer: "State of Oregon BCD", category: "structural", applies: (s) => !isResidentialSmall(s), why: () => "Governs structure, egress, fire-resistance and occupancy for commercial and larger buildings." },
      { id: "orsc", title: "Oregon Residential Specialty Code (IRC-based)", issuer: "State of Oregon BCD", category: "structural", applies: isResidentialSmall, why: () => "Applies to detached houses and townhouses up to three storeys." },
      { id: "seismic", title: "Seismic design provisions (ASCE 7 via the state code)", issuer: "State of Oregon BCD", category: "structural", applies: always, why: () => "Portland is in a high seismic zone, so lateral-system design drives structure and cost." },
      { id: "oeesc", title: "Oregon Energy Efficiency Specialty Code", issuer: "State of Oregon BCD", category: "energy", applies: always, why: () => "Envelope, lighting and mechanical efficiency requirements." },
      { id: "ofc", title: "Oregon Fire Code", issuer: "Oregon State Fire Marshal", category: "fire", applies: nonHouse, why: (s) => `Fire access, alarms and suppression for a ${s.occupancy}-person ${s.type}.` },
      { id: "or-mep", title: "Oregon Plumbing, Mechanical and Electrical Specialty Codes", issuer: "State of Oregon BCD", category: "mep", applies: always, why: () => "Each trade has its own code and separate permit." },
      { id: "a117", title: "Accessibility (state code Chapter 11, ICC A117.1, ADA)", issuer: "State of Oregon BCD / US DOJ", category: "accessibility", applies: nonHouse, why: () => "Public and commercial buildings need accessible routes, entrances and facilities." },
      { id: "title33", title: "Portland Zoning Code (Title 33)", issuer: "City of Portland", category: "zoning", applies: always, why: () => "Use, height, setbacks, coverage and design overlays." },
      { id: "swmm", title: "Portland Stormwater Management Manual", issuer: "City of Portland", category: "environmental", applies: always, why: (s) => `New roof and paving (about ${s.footprintM2} m² footprint) must manage runoff on site. Thresholds are in the manual.` },
    ],
    permits: [
      { id: "building", name: "Building permit", authority: "Portland Permitting & Development", channel: "DevHub (online portal)", applies: always, why: () => "Core permit covering structure, envelope and life safety.", documents: [...commonDocs, "structural-design", "energy-compliance", ...stormwaterDocs] },
      { id: "trade", name: "Electrical, plumbing and mechanical permits", authority: "Portland Permitting & Development", channel: "DevHub (online portal)", applies: always, why: () => "Trade work is permitted separately, usually by the licensed trade contractor.", documents: ["application-form", "contractor-registration"] },
      { id: "fire", name: "Fire marshal review", authority: "Portland Fire & Rescue", channel: "Through the building permit review", applies: nonHouse, why: () => "Commercial occupancies get fire and life-safety review.", documents: ["fire-life-safety"] },
      { id: "esc", name: "Erosion and sediment control", authority: "Portland Permitting & Development", channel: "With the building permit", applies: always, why: () => "Ground disturbance needs erosion control. Confirm the size threshold.", documents: ["site-plan", "stormwater"] },
      { id: "geo", name: "Geotechnical report review", authority: "Portland Permitting & Development", channel: "With the building permit", applies: (s) => s.storeys >= 3 || s.type !== "house", why: () => "High seismic hazard and soil conditions typically require a geotechnical engineer's report.", documents: ["geotechnical"] },
    ],
  },
  {
    id: "nairobi-ke", label: "Nairobi, Kenya", authority: "Nairobi City County",
    hazards: { seismic: "Low to moderate", wind: "Low", flood: "Site-specific (riparian land, black-cotton soils)", snow: "None" },
    codes: [
      { id: "kbc", title: "Building Code (Local Government Adoptive By-Laws, Building Order 1968)", issuer: "Government of Kenya", category: "structural", applies: always, why: () => "Base building rules. A revision has been under development, so confirm the current edition with the county." },
      { id: "struct-basis", title: "Structural design basis (Eurocodes / BS commonly used)", issuer: "Registered engineer", category: "structural", applies: always, why: () => "The structural engineer states the design standard. Confirm the county accepts it." },
      { id: "plupa", title: "Physical and Land Use Planning Act, 2019", issuer: "Government of Kenya / county planning", category: "zoning", applies: always, why: () => "Development permission, zoning, plot coverage and change of use." },
      { id: "emca", title: "Environmental Management and Coordination Act, 1999 (EIA regulations)", issuer: "NEMA", category: "environmental", applies: always, why: (s) => `Projects are screened by risk category. A ${s.grossFloorAreaM2} m² ${s.type} needs a screening decision on a project report or full EIA.` },
      { id: "nca", title: "National Construction Authority Act, 2011", issuer: "NCA", category: "safety", applies: always, why: () => "Contractors must be registered, and projects are registered with a levy. Confirm thresholds." },
      { id: "osha", title: "Occupational Safety and Health Act, 2007", issuer: "DOSH", category: "safety", applies: always, why: () => "Worksite registration and safe construction practice." },
      { id: "fire", title: "Fire Risk Reduction Rules, 2007", issuer: "County fire department", category: "fire", applies: nonHouse, why: (s) => `Fire safety measures and certification for a ${s.occupancy}-person ${s.type}.` },
      { id: "pwd", title: "Persons with Disabilities Act, 2003 (access provisions)", issuer: "Government of Kenya", category: "accessibility", applies: nonHouse, why: () => "Public buildings need accessible entrances, routes and sanitary facilities." },
      { id: "kebs", title: "Kenya Bureau of Standards (KEBS) material standards", issuer: "KEBS", category: "structural", applies: always, why: () => "Materials such as cement, steel and sections should meet Kenyan standards." },
    ],
    permits: [
      { id: "development", name: "Development permission (planning approval)", authority: "Nairobi City County, Planning", channel: "Confirm the county's current channel", applies: always, why: () => "Planning approval before building plan approval.", documents: ["application-form", "owner-authorisation", "project-description", "site-plan", "drawings", "code-summary"] },
      { id: "building", name: "Building plan approval", authority: "Nairobi City County, Building Control", channel: "Confirm the county's current channel", applies: always, why: () => "Structural and architectural drawings are approved before work starts.", documents: [...commonDocs, "structural-design", "geotechnical"] },
      { id: "nema", name: "NEMA environmental screening / EIA", authority: "NEMA", channel: "NEMA licensing system", applies: always, why: () => "Screen to decide between a project report and a full EIA.", documents: ["environmental-screening", "project-description", "site-plan"] },
      { id: "nca", name: "NCA project registration", authority: "National Construction Authority", channel: "NCA portal", applies: always, why: () => "Project registration, levy and registered contractor.", documents: ["contractor-registration"] },
      { id: "dosh", name: "DOSH workplace registration", authority: "Directorate of Occupational Safety and Health", channel: "DOSH registration", applies: always, why: () => "Construction sites must be registered.", documents: ["construction-phase-plan"] },
      { id: "fire", name: "Fire safety certificate", authority: "Nairobi County Fire Department", channel: "Confirm with the county", applies: nonHouse, why: () => "Required for non-domestic buildings before occupation.", documents: ["fire-life-safety"] },
    ],
  },
  {
    id: "miami-fl", label: "Miami, Florida, USA", authority: "Miami-Dade County / municipal building department",
    hazards: { seismic: "Low", wind: "Very high (hurricane, High-Velocity Hurricane Zone)", flood: "High (coastal and storm-surge zones)", snow: "None" },
    codes: [
      { id: "fbc", title: "Florida Building Code, Building and Residential", issuer: "Florida Building Commission", category: "structural", applies: always, why: () => "State code with enhanced wind provisions." },
      { id: "hvhz", title: "High-Velocity Hurricane Zone provisions and Notice of Acceptance product approvals", issuer: "Miami-Dade County", category: "wind-flood", applies: always, why: () => "Windows, doors, roofing and cladding need approved products and impact or shutter protection." },
      { id: "flood", title: "Flood-resistant construction (FEMA flood zones, ASCE 24)", issuer: "Local floodplain administrator", category: "wind-flood", applies: (s, c) => c.coastal || s.coastal === true, why: () => "Coastal sites may need elevation, flood-resistant materials and elevation certificates." },
      { id: "fbc-energy", title: "Florida Building Code, Energy Conservation", issuer: "Florida Building Commission", category: "energy", applies: always, why: () => "Envelope and system efficiency." },
      { id: "ffpc", title: "Florida Fire Prevention Code", issuer: "Florida State Fire Marshal", category: "fire", applies: nonHouse, why: (s) => `Fire protection for a ${s.occupancy}-person ${s.type}.` },
      { id: "fac", title: "Florida Accessibility Code", issuer: "Florida Building Commission", category: "accessibility", applies: nonHouse, why: () => "Accessible routes and facilities in public and commercial buildings." },
      { id: "fl-mep", title: "Florida plumbing, mechanical and electrical provisions", issuer: "Florida Building Commission", category: "mep", applies: always, why: () => "Trade permits are issued separately." },
      { id: "zoning", title: "Local zoning and land development regulations", issuer: "City / county planning", category: "zoning", applies: always, why: () => "Use, height, setbacks and coverage." },
    ],
    permits: [
      { id: "building", name: "Building permit", authority: "County or municipal building department", channel: "Local online permitting portal (varies by municipality)", applies: always, why: () => "Core permit including wind and flood review.", documents: [...commonDocs, "structural-design", "hurricane-product-approvals", "energy-compliance", ...stormwaterDocs] },
      { id: "trade", name: "Electrical, plumbing and mechanical permits", authority: "County or municipal building department", channel: "Local online permitting portal", applies: always, why: () => "Separate trade permits.", documents: ["application-form", "contractor-registration"] },
      { id: "noc", name: "Notice of Commencement", authority: "County clerk", channel: "Recorded with the clerk", applies: always, why: () => "Florida lien law requires recording before work starts above a cost threshold. Confirm the current amount.", documents: ["owner-authorisation"] },
      { id: "fire", name: "Fire review", authority: "Fire prevention bureau", channel: "Through the building permit review", applies: nonHouse, why: () => "Commercial occupancies get fire review.", documents: ["fire-life-safety"] },
    ],
  },
  {
    id: "london-uk", label: "London, UK", authority: "Local planning authority and building control",
    hazards: { seismic: "Very low", wind: "Moderate", flood: "Site-specific (Thames and surface water)", snow: "Low" },
    codes: [
      { id: "br2010", title: "Building Regulations 2010 and Approved Documents (A, B, C, L, M and others)", issuer: "UK Government", category: "structural", applies: always, why: () => "Covers structure, fire, moisture, energy and access." },
      { id: "docC", title: "Approved Document C: site preparation and resistance to contaminants and moisture", issuer: "UK Government", category: "structural", applies: (_s, c) => c.annualRain > 500, why: (_s, c) => `About ${Math.round(c.annualRain)} mm of rain a year makes moisture resistance a design driver.` },
      { id: "bsa", title: "Building Safety Act 2022 (higher-risk buildings)", issuer: "Building Safety Regulator", category: "fire", applies: (s) => (s.type === "apartments" || s.type === "clinic") && (s.heightM >= 18 || s.storeys >= 7), why: (s) => `A ${s.heightM} m, ${s.storeys}-storey ${s.type} falls in the higher-risk category, with gateway approvals.` },
      { id: "tcpa", title: "Town and Country Planning Act 1990 and local plan", issuer: "Local planning authority", category: "zoning", applies: always, why: () => "Planning permission covers use, massing and design." },
      { id: "cdm", title: "Construction (Design and Management) Regulations 2015", issuer: "HSE", category: "safety", applies: always, why: () => "Duties for client, designers and contractors, with notification if thresholds are met." },
      { id: "pwa", title: "Party Wall etc. Act 1996", issuer: "UK Government", category: "structural", applies: (s) => s.type !== "warehouse", why: () => "Applies if work affects or abuts a neighbouring wall or excavates close to neighbours." },
      { id: "regfire", title: "Regulatory Reform (Fire Safety) Order 2005", issuer: "Fire authority", category: "fire", applies: nonHouse, why: () => "Responsible-person duties for non-domestic premises." },
    ],
    permits: [
      { id: "planning", name: "Planning permission", authority: "Local planning authority", channel: "Planning Portal", applies: always, why: () => "Needed before most new buildings.", documents: ["application-form", "owner-authorisation", "project-description", "site-plan", "drawings", "durability-statement"] },
      { id: "building-control", name: "Building control approval (full plans)", authority: "Local authority or registered building control approver", channel: "Direct to the building control body", applies: always, why: () => "Confirms compliance with the Building Regulations.", documents: [...commonDocs, "structural-design", "energy-compliance", "fire-life-safety"] },
      { id: "hrb", name: "Building Safety Regulator gateways", authority: "Building Safety Regulator", channel: "Building Safety Regulator portal", applies: (s) => (s.type === "apartments" || s.type === "clinic") && (s.heightM >= 18 || s.storeys >= 7), why: () => "Higher-risk buildings need gateway approval before and during construction.", documents: ["fire-life-safety", "structural-design"] },
      { id: "f10", name: "CDM notification (if thresholds met)", authority: "HSE", channel: "HSE online notification", applies: (s) => s.grossFloorAreaM2 >= 500, why: () => "Larger or longer projects must notify the HSE.", documents: ["construction-phase-plan"] },
    ],
  },
  {
    id: "generic-intl", label: "General baseline (no local code modelled)", authority: "Local authority having jurisdiction",
    hazards: { seismic: "Unknown, check locally", wind: "Unknown, check locally", flood: "Unknown, check locally", snow: "Unknown, check locally" },
    codes: [
      { id: "ibc", title: "International Building Code family (or the nationally adopted equivalent)", issuer: "ICC / national authority", category: "structural", applies: always, why: () => "Used here only as a baseline. Confirm which code your authority has adopted." },
      { id: "fire", title: "Fire code", issuer: "Local fire authority", category: "fire", applies: nonHouse, why: (s) => `Fire safety for a ${s.occupancy}-person ${s.type}.` },
      { id: "energy", title: "Energy conservation code", issuer: "Local authority", category: "energy", applies: always, why: () => "Envelope and systems efficiency, if adopted locally." },
      { id: "access", title: "Accessibility standard", issuer: "Local authority", category: "accessibility", applies: nonHouse, why: () => "Accessible routes and facilities for public and commercial buildings." },
      { id: "zoning", title: "Local zoning / planning rules", issuer: "Local planning authority", category: "zoning", applies: always, why: () => "Use, height, setbacks and coverage." },
      { id: "env", title: "Environmental impact screening", issuer: "Environmental authority", category: "environmental", applies: (s) => s.grossFloorAreaM2 >= 2000, why: (s) => `A ${s.grossFloorAreaM2} m² project often triggers environmental screening.` },
    ],
    permits: [
      { id: "building", name: "Building permit", authority: "Local authority", channel: "Confirm locally", applies: always, why: () => "Core permit for new construction.", documents: [...commonDocs, "structural-design", "energy-compliance", ...stormwaterDocs] },
      { id: "planning", name: "Zoning or planning approval", authority: "Local planning authority", channel: "Confirm locally", applies: always, why: () => "Confirms use and massing are allowed.", documents: ["application-form", "site-plan", "project-description"] },
      { id: "env", name: "Environmental screening", authority: "Environmental authority", channel: "Confirm locally", applies: (s) => s.grossFloorAreaM2 >= 2000, why: () => "Larger projects are commonly screened.", documents: ["environmental-screening"] },
      { id: "fire", name: "Fire approval", authority: "Local fire authority", channel: "Confirm locally", applies: nonHouse, why: () => "Commercial occupancies need fire review.", documents: ["fire-life-safety"] },
      { id: "trade", name: "Trade permits (electrical, plumbing, mechanical)", authority: "Local authority", channel: "Confirm locally", applies: always, why: () => "Trade work is usually permitted separately.", documents: ["contractor-registration"] },
      { id: "occupancy", name: "Certificate of occupancy", authority: "Local authority", channel: "Confirm locally", applies: always, why: () => "Issued after final inspection, before use.", documents: [] },
    ],
  },
];

export const JURISDICTION_IDS = JURISDICTIONS.map((j) => j.id);
export function getJurisdiction(id: string): Jurisdiction {
  return JURISDICTIONS.find((j) => j.id === id) ?? JURISDICTIONS[JURISDICTIONS.length - 1];
}
export const listJurisdictions = () => JURISDICTIONS.map(({ id, label }) => ({ id, label }));

export interface ApplicableCode { id: string; title: string; issuer: string; category: CodeCategory; why: string; verify: true }
export interface RequiredPermit { id: string; name: string; authority: string; channel: string; why: string; documents: DocId[]; verify: true }
export interface CodeAnalysis {
  jurisdiction: Jurisdiction;
  codes: ApplicableCode[];
  permits: RequiredPermit[];
  professionals: string[];
  designFlags: string[];
  disclaimer: string;
}

export function analyzeCodes(spec: BuildingSpec, climate?: Climate, jurisdictionId = spec.location.jurisdictionId): CodeAnalysis {
  const j = getJurisdiction(jurisdictionId);
  const c = climate ?? CLIMATES[spec.climateId];
  const codes = j.codes.filter((x) => x.applies(spec, c)).map((x) => ({
    id: x.id, title: x.title, issuer: x.issuer, category: x.category, why: x.why(spec, c), verify: true as const,
  }));
  const permits = j.permits.filter((p) => p.applies(spec, c)).map((p) => ({
    id: p.id, name: p.name, authority: p.authority, channel: p.channel, why: p.why(spec, c),
    documents: p.documents, verify: true as const,
  }));
  const professionals = new Set<string>();
  if (spec.type !== "house" || spec.storeys >= 3) professionals.add("Registered architect");
  professionals.add("Structural engineer");
  if (spec.type !== "house") professionals.add("Fire and life-safety engineer");
  if (spec.storeys >= 3 || spec.grossFloorAreaM2 >= 500) professionals.add("Geotechnical engineer");
  if (permits.some((p) => p.documents.includes("energy-compliance"))) professionals.add("Energy / building-services engineer");
  if (permits.some((p) => p.documents.includes("stormwater"))) professionals.add("Civil engineer (drainage and stormwater)");
  if (permits.some((p) => p.id === "nema" || p.id === "env")) professionals.add("Environmental practitioner");

  const flags: string[] = [];
  if (tall(spec)) flags.push(`At ${spec.heightM} m and ${spec.storeys} storeys this is a taller building, which usually triggers stricter fire, egress and structural review.`);
  if (spec.occupancy >= 50 && spec.type !== "house") flags.push(`About ${spec.occupancy} occupants: expect multiple exits and accessible egress requirements.`);
  if (/high|very high/i.test(j.hazards.seismic)) flags.push(`Seismic hazard: ${j.hazards.seismic}. The lateral system will drive structural design.`);
  if (/high|very high/i.test(j.hazards.wind)) flags.push(`Wind hazard: ${j.hazards.wind}. Envelope products need wind and debris-impact approval.`);
  if (/high/i.test(j.hazards.flood)) flags.push(`Flood hazard: ${j.hazards.flood}. Check flood zone and minimum floor elevation.`);
  if (c.freezeThawDays >= 60) flags.push("Heavy freeze-thaw exposure: frost depth for footings and freeze-resistant materials need to be specified.");
  if (c.annualRain >= 1900) flags.push("Very heavy rainfall: drainage design and moisture control will be checked closely.");

  return {
    jurisdiction: j, codes, permits, professionals: [...professionals], designFlags: flags,
    disclaimer: "These are the codes and permits likely to apply, found from the concept alone. They are not a compliance finding or legal advice. Confirm with the authority having jurisdiction and a licensed professional before relying on them.",
  };
}
