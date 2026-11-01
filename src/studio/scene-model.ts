import { stresses } from "./climate";
import { MATERIALS } from "./materials";
import { ELEMENTS, conditionAt } from "./simulate";
import type { BuildingSpec, Climate, ElementKey, SimulationResult } from "./types";

/** Pure helpers that turn a spec and a simulation into what the 3D scene draws. */

export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - k) + ((b >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export interface SceneGeometry {
  width: number; depth: number; height: number; storeys: number; storeyHeight: number;
  baysWide: number; baysDeep: number;
  roof: BuildingSpec["roof"];
  /** Roof rise in metres for pitched roofs. */
  roofRise: number;
}

export function sceneGeometry(spec: BuildingSpec): SceneGeometry {
  const storeyHeight = spec.heightM / spec.storeys;
  const bay = spec.type === "warehouse" ? 6 : 3.2;
  return {
    width: spec.widthM, depth: spec.depthM, height: spec.heightM, storeys: spec.storeys, storeyHeight,
    baysWide: Math.max(1, Math.round(spec.widthM / bay)), baysDeep: Math.max(1, Math.round(spec.depthM / bay)),
    roof: spec.roof,
    roofRise: spec.roof === "flat" ? 0.4 : Math.min(4.5, Math.max(1.2, Math.min(spec.widthM, spec.depthM) * 0.22)),
  };
}

export interface Wear { condition: number; wear: number; color: number }
export type WearState = Record<ElementKey, Wear>;

/** Colour and wear (0 fresh → 1 failed) of each element at a fractional year. */
export function wearAt(spec: BuildingSpec, sim: SimulationResult, year: number): WearState {
  const out = {} as WearState;
  for (const el of ELEMENTS) {
    const condition = conditionAt(sim.elements[el].condition, year);
    const wear = 1 - condition / 100;
    const m = MATERIALS[spec.materials[el]];
    out[el] = { condition, wear, color: lerpColor(m.color.fresh, m.color.aged, Math.min(1, wear * 1.25)) };
  }
  return out;
}

export interface RainSettings { drops: number; speed: number; slant: number; active: boolean }
/** Rain density follows annual rainfall; arid sites get none. */
export function rainSettings(c: Climate): RainSettings {
  const k = Math.min(1.6, c.annualRain / 1500);
  return { active: c.annualRain >= 300, drops: Math.round(120 + k * 900), speed: 14 + k * 8, slant: 0.12 + (c.coastal ? 0.12 : 0) };
}

export interface Mood { sky: number; fog: number; ground: number; sun: number }
export function mood(c: Climate): Mood {
  const s = stresses(c);
  if (c.annualRain < 300 && c.hotDays > 90) return { sky: 0xe8dcc0, fog: 0xe8dcc0, ground: 0xc9b184, sun: 1.3 };
  if (c.freezeThawDays >= 60) return { sky: 0xd7dfe6, fog: 0xd7dfe6, ground: 0xe6eaec, sun: 0.8 };
  if (s.moisture > 1 || s.rain > 1.2) return { sky: 0xb7c4c0, fog: 0xb7c4c0, ground: 0x586b52, sun: 0.7 };
  return { sky: 0xcfdbe0, fog: 0xcfdbe0, ground: 0x7d8f6c, sun: 1 };
}
