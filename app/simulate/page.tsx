'use client';
import { useEffect, useRef, useState } from 'react';

// Climate and durability SCREENING ESTIMATE.
// Pulls one year of real weather history for the site (Open-Meteo, no key needed) and applies a
// simple, generic material model to show how conditions could wear a building over time.
// This is an early-stage estimate to compare options. It is NOT engineering advice or sign-off.
const WEATHER_YEAR = 2024;
const DEFAULT_SITE = { lat: -1.2673, lng: 36.8060 }; // Westlands, Nairobi

type Climate = { meanTemp: number; annualRain: number; meanRH: number; humidShare: number; freezeThawDays: number; hotDays: number; frostDays: number };

// Sensitivity of each material to each stress (generic screening values, not tested data).
const MATERIALS = [
  { name: 'Timber cladding', base: 0.018, w: { moisture: 1.6, rain: 1.0, freeze: 0.6, heat: 0.5 } },
  { name: 'Painted steel', base: 0.012, w: { moisture: 1.5, rain: 0.8, freeze: 0.3, heat: 0.3 } },
  { name: 'Reinforced concrete', base: 0.006, w: { moisture: 0.6, rain: 0.5, freeze: 1.4, heat: 0.4 } },
  { name: 'Brick masonry', base: 0.005, w: { moisture: 0.5, rain: 0.6, freeze: 1.2, heat: 0.2 } },
  { name: 'Aluminium cladding', base: 0.007, w: { moisture: 0.3, rain: 0.2, freeze: 0.1, heat: 0.6 } },
  { name: 'Single-ply roof membrane', base: 0.02, w: { moisture: 0.7, rain: 0.5, freeze: 0.8, heat: 1.4 } },
];

async function loadClimate(lat: number, lng: number): Promise<Climate> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${WEATHER_YEAR}-01-01&end_date=${WEATHER_YEAR}-12-31&hourly=temperature_2m,relative_humidity_2m,precipitation&timezone=UTC`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather service did not respond. Try again in a moment.');
  const d = (await r.json()) as { hourly?: { temperature_2m: (number | null)[]; relative_humidity_2m: (number | null)[]; precipitation: (number | null)[] } };
  const h = d.hourly;
  if (!h || !h.temperature_2m?.length) throw new Error('No weather history for this location.');
  let tSum = 0, tN = 0, rhSum = 0, rhN = 0, humid = 0, rain = 0;
  const days = Math.floor(h.temperature_2m.length / 24);
  let freezeThaw = 0, hot = 0, frost = 0;
  for (let day = 0; day < days; day++) {
    let min = Infinity, max = -Infinity;
    for (let i = day * 24; i < day * 24 + 24; i++) {
      const t = h.temperature_2m[i];
      if (t != null) { tSum += t; tN++; if (t < min) min = t; if (t > max) max = t; }
      const rh = h.relative_humidity_2m[i];
      if (rh != null) { rhSum += rh; rhN++; if (rh > 80) humid++; }
      rain += h.precipitation[i] ?? 0;
    }
    if (min < 0 && max > 0) freezeThaw++;
    if (min < 0) frost++;
    if (max > 32) hot++;
  }
  return {
    meanTemp: tN ? tSum / tN : 0, annualRain: rain, meanRH: rhN ? rhSum / rhN : 0,
    humidShare: rhN ? humid / rhN : 0, freezeThawDays: freezeThaw, hotDays: hot, frostDays: frost,
  };
}

function stresses(c: Climate) {
  return {
    moisture: Math.min(c.humidShare / 0.6, 1.5),
    rain: Math.min(c.annualRain / 1500, 1.5),
    freeze: Math.min(c.freezeThawDays / 60, 1.5),
    heat: Math.min(c.hotDays / 45, 1.5),
  };
}

function rate(m: (typeof MATERIALS)[number], c: Climate) {
  const s = stresses(c);
  return m.base * (1 + m.w.moisture * s.moisture + m.w.rain * s.rain + m.w.freeze * s.freeze + m.w.heat * s.heat);
}
const condition = (r: number, year: number) => 100 * Math.exp(-r * year);
const yearsToFlag = (r: number) => Math.log(100 / 60) / r; // years until condition falls below 60
const label = (v: number) => (v >= 80 ? 'Good' : v >= 60 ? 'Fair' : 'Poor');
const color = (v: number) => (v >= 80 ? '#3f7d4f' : v >= 60 ? '#c58b1c' : '#b3402f');

export default function SimulatePage() {
  const [site, setSite] = useState(DEFAULT_SITE);
  const [latText, setLatText] = useState(String(DEFAULT_SITE.lat));
  const [lngText, setLngText] = useState(String(DEFAULT_SITE.lng));
  const [climate, setClimate] = useState<Climate | null>(null);
  const [status, setStatus] = useState('');
  const [year, setYear] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read ?lat=..&lng=.. from the address bar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setSite({ lat, lng }); setLatText(String(lat)); setLngText(String(lng));
    }
  }, []);

  // Load weather history for the site.
  useEffect(() => {
    let cancelled = false;
    setStatus('Loading weather history…'); setClimate(null);
    loadClimate(site.lat, site.lng)
      .then((c) => { if (!cancelled) { setClimate(c); setStatus(''); } })
      .catch((e: Error) => { if (!cancelled) setStatus(e.message); });
    return () => { cancelled = true; };
  }, [site]);

  // Time-lapse: advance one year at a time.
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setYear((y) => { if (y >= 50) { setPlaying(false); return 50; } return y + 1; });
    }, 250);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing]);

  function apply() {
    const lat = Number(latText), lng = Number(lngText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { setStatus('Enter a valid latitude and longitude.'); return; }
    setYear(0); setPlaying(false); setSite({ lat, lng });
  }

  const box: React.CSSProperties = { padding: 12, border: '1px solid #c9cfc4', borderRadius: 8, fontSize: 16, width: '100%' };
  const btn: React.CSSProperties = { ...box, background: '#283229', color: '#fff', width: 'auto', padding: '10px 16px' };
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#66705f' }}>
        <a href="/">← Back to Schema</a> · <a href="/app">Workspace</a> · <a href="/radar">Subsurface Radar</a> · <a href="/contractor">Contractor Hub</a> · <a href={`/site?lat=${site.lat}&lng=${site.lng}`}>Map view</a> · <a href="/real3d">Real 3D</a>
      </p>
      <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Climate and durability estimate</h1>
      <p style={{ margin: '0 0 12px', padding: 12, background: '#f6efe3', borderRadius: 8, fontSize: 14 }}>
        <b>Early estimate only.</b> This uses one year of past weather ({WEATHER_YEAR}) and generic material factors to compare options. It is not engineering advice, a code check or professional sign-off. A licensed engineer must confirm real design decisions.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input style={box} inputMode="decimal" value={latText} onChange={(e) => setLatText(e.target.value)} aria-label="Latitude" placeholder="Latitude" />
        <input style={box} inputMode="decimal" value={lngText} onChange={(e) => setLngText(e.target.value)} aria-label="Longitude" placeholder="Longitude" />
        <button style={btn} onClick={apply}>Load</button>
      </div>
      {status && <p style={{ fontSize: 14 }}>{status}</p>}
      {climate && (
        <>
          <section style={{ background: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Site climate ({WEATHER_YEAR})</h2>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
              <li>Average temperature: {climate.meanTemp.toFixed(1)} °C</li>
              <li>Rainfall: {Math.round(climate.annualRain)} mm for the year</li>
              <li>Average humidity: {Math.round(climate.meanRH)}%, and above 80% for {Math.round(climate.humidShare * 100)}% of hours</li>
              <li>Freeze-thaw days: {climate.freezeThawDays} (frost days: {climate.frostDays})</li>
              <li>Days above 32 °C: {climate.hotDays}</li>
            </ul>
          </section>
          <section style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Time-lapse: estimated condition after {year} year{year === 1 ? '' : 's'}</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <button style={btn} onClick={() => { if (year >= 50) setYear(0); setPlaying((p) => !p); }}>{playing ? 'Pause' : 'Play'}</button>
              <input type="range" min={0} max={50} value={year} onChange={(e) => { setPlaying(false); setYear(Number(e.target.value)); }} style={{ flex: 1 }} aria-label="Years" />
            </div>
            {MATERIALS.map((m) => {
              const r = rate(m, climate);
              const v = condition(r, year);
              return (
                <div key={m.name} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>{m.name}</span>
                    <span style={{ color: color(v) }}>{label(v)} · {Math.round(v)}%</span>
                  </div>
                  <div style={{ height: 12, background: '#e6e9e1', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${v}%`, height: '100%', background: color(v), transition: 'width .2s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#5d6b5e', marginTop: 2 }}>Maintenance flag in about {Math.round(yearsToFlag(r))} years (when condition drops below 60%)</div>
                </div>
              );
            })}
          </section>
          <p style={{ fontSize: 13, color: '#5d6b5e' }}>Method: humidity, rainfall, freeze-thaw and heat are scaled against typical ranges, then weighted per material to set a yearly wear rate. Values are for comparing options, not predicting real lifespans.</p>
        </>
      )}
    </main>
  );
}
