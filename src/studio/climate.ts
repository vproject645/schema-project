import type { Climate, Stresses } from "./types";

/**
 * Indicative regional presets. They are approximate, rounded values meant to
 * make options comparable early on. For a real site, replace them with
 * observed history via `summariseHourly` (see ./weather.ts).
 */
export const CLIMATES: Record<string, Climate> = {
  "highland-subtropical": {
    id: "highland-subtropical", label: "Highland subtropical (e.g. Nairobi)",
    meanTemp: 18.5, annualRain: 950, meanRH: 66, humidShare: 0.25, freezeThawDays: 0,
    hotDays: 0, frostDays: 0, uvIndex: 11, coastal: false, source: "preset",
  },
  "tropical-humid": {
    id: "tropical-humid", label: "Tropical humid, heavy rain",
    meanTemp: 27, annualRain: 2400, meanRH: 82, humidShare: 0.7, freezeThawDays: 0,
    hotDays: 20, frostDays: 0, uvIndex: 11, coastal: false, source: "preset",
  },
  "hot-arid": {
    id: "hot-arid", label: "Hot arid",
    meanTemp: 28, annualRain: 100, meanRH: 50, humidShare: 0.1, freezeThawDays: 0,
    hotDays: 150, frostDays: 0, uvIndex: 12, coastal: false, source: "preset",
  },
  "temperate-maritime": {
    id: "temperate-maritime", label: "Temperate maritime (e.g. Portland)",
    meanTemp: 12, annualRain: 1000, meanRH: 72, humidShare: 0.3, freezeThawDays: 20,
    hotDays: 10, frostDays: 40, uvIndex: 8, coastal: false, source: "preset",
  },
  "cold-continental": {
    id: "cold-continental", label: "Cold continental, snow and freezing",
    meanTemp: 4, annualRain: 800, meanRH: 72, humidShare: 0.25, freezeThawDays: 90,
    hotDays: 5, frostDays: 150, uvIndex: 7, coastal: false, source: "preset",
  },
  "humid-subtropical-coast": {
    id: "humid-subtropical-coast", label: "Humid subtropical, hurricane coast (e.g. Miami)",
    meanTemp: 25, annualRain: 1500, meanRH: 74, humidShare: 0.4, freezeThawDays: 0,
    hotDays: 60, frostDays: 0, uvIndex: 11, coastal: true, source: "preset",
  },
  "temperate-oceanic": {
    id: "temperate-oceanic", label: "Cool oceanic (e.g. London)",
    meanTemp: 11, annualRain: 600, meanRH: 76, humidShare: 0.3, freezeThawDays: 10,
    hotDays: 3, frostDays: 20, uvIndex: 6, coastal: false, source: "preset",
  },
};

const clamp = (v: number, max: number) => Math.max(0, Math.min(v, max));

/** Normalised 0–1.5 stress per mechanism. 1 ≈ demanding but ordinary. */
export function stresses(c: Climate): Stresses {
  return {
    moisture: clamp(c.humidShare / 0.6, 1.5),
    rain: clamp(c.annualRain / 1500, 1.5),
    freeze: clamp(c.freezeThawDays / 60, 1.5),
    heat: clamp(c.hotDays / 45, 1.5),
    salt: c.coastal ? 1 : 0.1,
    uv: clamp(c.uvIndex / 8, 1.5),
  };
}

export function withCoastal(c: Climate, coastal: boolean | undefined): Climate {
  return coastal === undefined || coastal === c.coastal ? c : { ...c, coastal };
}
