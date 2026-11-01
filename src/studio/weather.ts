import type { Climate } from "./types";

/**
 * Summarise one year (or more) of hourly weather into a Climate.
 * Pure function so it can be tested without a network.
 */
export function summariseHourly(
  id: string, label: string,
  temp: (number | null)[], rh: (number | null)[], precip: (number | null)[],
  opts: { coastal?: boolean; uvIndex?: number } = {},
): Climate {
  const days = Math.floor(temp.length / 24);
  if (days < 1) throw new Error("Need at least one full day of hourly data.");
  const years = days / 365;
  let tSum = 0, tN = 0, rhSum = 0, rhN = 0, humid = 0, rain = 0, ft = 0, hot = 0, frost = 0;
  for (let d = 0; d < days; d++) {
    let min = Infinity, max = -Infinity;
    for (let i = d * 24; i < d * 24 + 24; i++) {
      const t = temp[i];
      if (t != null) { tSum += t; tN++; min = Math.min(min, t); max = Math.max(max, t); }
      const h = rh[i];
      if (h != null) { rhSum += h; rhN++; if (h > 80) humid++; }
      rain += precip[i] ?? 0;
    }
    if (min < 0 && max > 0) ft++;
    if (min < 0) frost++;
    if (max > 32) hot++;
  }
  const per = (n: number) => Math.round(n / years);
  return {
    id, label, source: "observed",
    meanTemp: tN ? tSum / tN : 0, meanRH: rhN ? rhSum / rhN : 0,
    humidShare: rhN ? humid / rhN : 0, annualRain: rain / years,
    freezeThawDays: per(ft), hotDays: per(hot), frostDays: per(frost),
    uvIndex: opts.uvIndex ?? 8, coastal: opts.coastal ?? false,
  };
}

/** Browser/Worker helper: one year of Open-Meteo history for a point. No key needed. */
export async function fetchObservedClimate(lat: number, lng: number, year = 2024, label = "Observed site weather"): Promise<Climate> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${year}-01-01&end_date=${year}-12-31&hourly=temperature_2m,relative_humidity_2m,precipitation&timezone=UTC`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Weather service did not respond. Try again in a moment.");
  const d = (await r.json()) as { hourly?: { temperature_2m: (number | null)[]; relative_humidity_2m: (number | null)[]; precipitation: (number | null)[] } };
  const h = d.hourly;
  if (!h?.temperature_2m?.length) throw new Error("No weather history for this location.");
  return summariseHourly(`observed-${lat.toFixed(2)}-${lng.toFixed(2)}`, label, h.temperature_2m, h.relative_humidity_2m, h.precipitation);
}
