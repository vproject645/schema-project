'use client';
import { useEffect, useRef, useState } from 'react';

// Worldwide 3D city view. Mapbox GL JS is loaded from Mapbox's CDN at runtime,
// so no npm dependency (and no lockfile change) is needed.
// Uses Mapbox's Standard style: 3D buildings, landmarks and lighting for cities worldwide.
const MAPBOX_VERSION = 'v3.9.0';
const BUILD_TOKEN = (() => { try { return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''; } catch { return ''; } })();
const DEFAULT_SITE = { lat: -1.2673, lng: 36.8060 }; // Westlands, Nairobi. Search any place, or use ?lat=..&lng=..
const PRESETS = ['dawn', 'day', 'dusk', 'night'] as const;
type Preset = (typeof PRESETS)[number];

type MapboxGL = any; // loaded from the CDN, so no bundled types

function loadMapbox(): Promise<MapboxGL> {
  const w = window as unknown as { mapboxgl?: MapboxGL };
  if (w.mapboxgl) return Promise.resolve(w.mapboxgl);
  return new Promise((resolve, reject) => {
    if (!document.getElementById('mapbox-css')) {
      const css = document.createElement('link');
      css.id = 'mapbox-css';
      css.rel = 'stylesheet';
      css.href = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;
    script.onload = () => (w.mapboxgl ? resolve(w.mapboxgl) : reject(new Error('Mapbox did not load.')));
    script.onerror = () => reject(new Error('Could not load the map library.'));
    document.head.appendChild(script);
  });
}

export default function SitePage() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const presetRef = useRef<Preset>('dusk');
  const [token, setToken] = useState(BUILD_TOKEN);
  const [tokenDraft, setTokenDraft] = useState('');
  const [site, setSite] = useState(DEFAULT_SITE);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState<Preset>('dusk');

  // Read ?lat=..&lng=.. from the address bar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    if (p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) setSite({ lat, lng });
  }, []);

  // Create the map once a token exists.
  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !container.current) return;
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/standard',
        center: [site.lng, site.lat], zoom: 16.2, pitch: 60, bearing: -17,
        config: { basemap: { lightPreset: presetRef.current, show3dObjects: true, showPointOfInterestLabels: true } },
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl());
      map.on('error', (e: any) => setStatus('Map error: ' + (e?.error?.message || 'unknown')));
      map.on('load', () => {
        markerRef.current = new mapboxgl.Marker().setLngLat([site.lng, site.lat]).addTo(map);
      });
    }).catch((e: Error) => setStatus(e.message));
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
    // The map is created once per token; later site changes fly the camera instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fly to a new site.
  useEffect(() => {
    mapRef.current?.flyTo({ center: [site.lng, site.lat], zoom: 16.2, pitch: 60, duration: 2500 });
    markerRef.current?.setLngLat([site.lng, site.lat]);
  }, [site]);

  // Change the lighting (dawn / day / dusk / night).
  function choosePreset(p: Preset) {
    presetRef.current = p;
    setPreset(p);
    try { mapRef.current?.setConfigProperty('basemap', 'lightPreset', p); } catch { /* map still loading */ }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q || !token) return;
    setStatus('Searching…');
    try {
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?limit=1&access_token=${encodeURIComponent(token)}`);
      const data = (await r.json()) as { features?: { center: [number, number]; place_name: string }[] };
      const hit = data.features?.[0];
      if (!hit) { setStatus('No match. Try a fuller address.'); return; }
      setSite({ lng: hit.center[0], lat: hit.center[1] });
      setStatus(hit.place_name);
    } catch { setStatus('Search failed. Check your connection.'); }
  }

  const box: React.CSSProperties = { padding: 12, border: '1px solid #c9cfc4', borderRadius: 8, fontSize: 16, width: '100%' };
  const chip = (active: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, border: '1px solid #283229', background: active ? '#283229' : '#fff', color: active ? '#fff' : '#283229', fontSize: 14, textTransform: 'capitalize' });
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 8px' }}><a href="/">← Back to Schema</a></p>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Site view</h1>
      {!token ? (
        <section style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <p>Paste a Mapbox <b>public</b> token (starts with <code>pk.</code>). It stays in this tab only.</p>
          <input style={box} value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="pk.…" autoCapitalize="none" autoCorrect="off" />
          <button style={{ ...box, marginTop: 8, background: '#283229', color: '#fff' }} onClick={() => tokenDraft.trim().startsWith('pk.') && setToken(tokenDraft.trim())}>Show map</button>
        </section>
      ) : (
        <>
          <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={box} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any address or city" />
            <button style={{ ...box, width: 110, background: '#283229', color: '#fff' }}>Go</button>
          </form>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {PRESETS.map((p) => <button key={p} type="button" style={chip(preset === p)} onClick={() => choosePreset(p)}>{p}</button>)}
          </div>
          <p style={{ minHeight: 22, margin: '0 0 8px', fontSize: 14 }}>{status || `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`}</p>
          <div ref={container} style={{ width: '100%', height: '65vh', minHeight: 340, borderRadius: 12, overflow: 'hidden', border: '1px solid #c9cfc4' }} />
          <p style={{ fontSize: 13, color: '#5d6b5e' }}>Drag to pan, two fingers to tilt and rotate. Imagery is a visual aid only, not survey data.</p>
        </>
      )}
    </main>
  );
}
