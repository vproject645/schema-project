'use client';
import { useEffect, useRef, useState } from 'react';

// Worldwide site view with three looks:
//  - Twin: "digital twin" style (blue glowing buildings under a purple sky)
//  - City: Mapbox Standard style (3D buildings, landmarks, lighting presets)
//  - Satellite: real aerial imagery with street labels and 3D building blocks
// Mapbox GL JS is loaded from Mapbox's CDN at runtime, so no npm dependency is needed.
const MAPBOX_VERSION = 'v3.9.0';
const BUILD_TOKEN = (() => { try { return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''; } catch { return ''; } })();
const DEFAULT_SITE = { lat: -1.2673, lng: 36.8060 }; // Westlands, Nairobi. Search any place, or use ?lat=..&lng=..
const PRESETS = ['dawn', 'day', 'dusk', 'night'] as const;
type Preset = (typeof PRESETS)[number];
type View = 'twin' | 'city' | 'satellite';

const STYLES: Record<View, string> = {
  twin: 'mapbox://styles/mapbox/dark-v11',
  city: 'mapbox://styles/mapbox/standard',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

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

function firstLabelLayer(map: any) {
  return map.getStyle().layers.find((l: any) => l.type === 'symbol' && l.layout && l.layout['text-field'])?.id;
}

// 3D building blocks on top of the satellite imagery.
function addSatelliteBuildings(map: any) {
  try {
    if (map.getLayer('3d-buildings')) return;
    map.addLayer({
      id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion', minzoom: 15,
      paint: { 'fill-extrusion-color': '#d9d4c7', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.55 },
    }, firstLabelLayer(map));
  } catch { /* style not ready, imagery still shows */ }
}

// Digital-twin look: glowing blue buildings colored by height, purple sky and fog.
function addTwinLook(map: any) {
  try {
    map.setFog({
      color: 'rgb(40, 20, 80)', 'high-color': 'rgb(214, 63, 208)', 'horizon-blend': 0.3,
      'space-color': 'rgb(14, 8, 46)', 'star-intensity': 0.5, range: [0.6, 12],
    });
    // Recolor the ground: deep teal land, green parks, bright blue water.
    const paint = (id: string, prop: string, value: string) => { try { if (map.getLayer(id)) map.setPaintProperty(id, prop, value); } catch { /* layer not in this style */ } };
    paint('land', 'background-color', '#0f3a4a');
    paint('landcover', 'fill-color', '#1f6b4a');
    paint('national-park', 'fill-color', '#1f7a4f');
    paint('landuse', 'fill-color', '#1d6a4c');
    paint('water', 'fill-color', '#2a86e8');
    if (map.getLayer('twin-buildings')) return;
    map.addLayer({
      id: 'twin-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion', minzoom: 12,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'height'], 8],
          0, '#3d6bd6', 25, '#5b8def', 60, '#8fc1ff', 120, '#c9e6ff', 220, '#ffffff'],
        'fill-extrusion-height': ['coalesce', ['get', 'height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-emissive-strength': 0.85,
      },
    }, firstLabelLayer(map));
  } catch { /* style not ready */ }
}

export default function SitePage() {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const presetRef = useRef<Preset>('dusk');
  const viewRef = useRef<View>('twin');
  const nextZoomRef = useRef<number | null>(null);
  const skipFlyRef = useRef(false);
  const [token, setToken] = useState(BUILD_TOKEN);
  const [tokenDraft, setTokenDraft] = useState('');
  const [site, setSite] = useState(DEFAULT_SITE);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState<Preset>('dusk');
  const [view, setView] = useState<View>('twin');
  const [autoQ, setAutoQ] = useState('');
  const [locating, setLocating] = useState(false);

  // Read ?lat=..&lng=.. from the address bar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
    const q = p.get('q');
    if (q && !p.has('lat')) { setQuery(q); setAutoQ(q); }
    if (p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) setSite({ lat, lng });
  }, []);

  function applyLook(map: any, v: View) {
    if (v === 'twin') addTwinLook(map);
    else if (v === 'satellite') addSatelliteBuildings(map);
  }

  // Create the map once a token exists.
  useEffect(() => {
    if (!token || !container.current) return;
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !container.current) return;
      mapboxgl.accessToken = token;
      const v = viewRef.current;
      const map = new mapboxgl.Map({
        container: container.current,
        style: STYLES[v],
        center: [site.lng, site.lat], zoom: 15.2, pitch: 55, bearing: -17,
        ...(v === 'city' ? { config: { basemap: { lightPreset: presetRef.current, show3dObjects: true, showPointOfInterestLabels: true } } } : {}),
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl());
      map.on('error', (e: any) => setStatus('Map error: ' + (e?.error?.message || 'unknown')));
      map.on('load', () => {
        applyLook(map, viewRef.current);
        const marker = new mapboxgl.Marker({ draggable: true }).setLngLat([site.lng, site.lat]).addTo(map);
        marker.on('dragend', () => {
          const { lng, lat } = marker.getLngLat();
          skipFlyRef.current = true;
          setSite({ lat, lng });
          setStatus('Pin moved to this spot.');
        });
        markerRef.current = marker;
      });
    }).catch((e: Error) => setStatus(e.message));
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; markerRef.current = null; };
    // The map is created once per token; later site changes fly the camera instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fly to a new site.
  useEffect(() => {
    markerRef.current?.setLngLat([site.lng, site.lat]);
    if (skipFlyRef.current) { skipFlyRef.current = false; return; }
    const zoom = nextZoomRef.current ?? 15.2;
    nextZoomRef.current = null;
    mapRef.current?.flyTo({ center: [site.lng, site.lat], zoom, pitch: 55, duration: 2500 });
  }, [site]);

  // Change the lighting (dawn / day / dusk / night). 3D city view only.
  function choosePreset(p: Preset) {
    presetRef.current = p;
    setPreset(p);
    try { mapRef.current?.setConfigProperty('basemap', 'lightPreset', p); } catch { /* map still loading or other view */ }
  }

  // Switch between Twin, 3D city and Satellite.
  function chooseView(v: View) {
    if (v === viewRef.current) return;
    viewRef.current = v;
    setView(v);
    setStatus('');
    const map = mapRef.current;
    if (!map) return;
    if (v === 'city') {
      map.setStyle(STYLES.city, { config: { basemap: { lightPreset: presetRef.current, show3dObjects: true, showPointOfInterestLabels: true } } });
    } else {
      map.setStyle(STYLES[v]);
      map.once('style.load', () => applyLook(map, v));
    }
  }

  // Fly to where the person is standing and drop the pin there. They can drag the pin to adjust.
  function useMyLocation() {
    if (!('geolocation' in navigator)) { setStatus('This browser cannot share your location.'); return; }
    setLocating(true);
    setStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        nextZoomRef.current = accuracy > 100 ? 16.5 : 18.3;
        setSite({ lat: latitude, lng: longitude });
        setStatus(`You are here (accurate to about ${Math.round(accuracy)} m). Drag the pin to fine-tune the building location.`);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setStatus(err.code === err.PERMISSION_DENIED
          ? 'Location is blocked. Allow location for this site in your browser settings, then try again.'
          : err.code === err.TIMEOUT
            ? 'Finding your location took too long. Move to an open area and try again.'
            : 'Your location is not available right now.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  function search(event: React.FormEvent) { event.preventDefault(); void runSearch(query); }

  // Run the project's address/title search once, as soon as a token exists.
  useEffect(() => { if (token && autoQ) { const q = autoQ; setAutoQ(''); void runSearch(q); } }, [token, autoQ]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSearch(raw: string) {
    const q = raw.trim();
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
  const chip = (active: boolean, disabled = false): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, border: '1px solid #283229', background: active ? '#283229' : '#fff', color: active ? '#fff' : '#283229', fontSize: 14, opacity: disabled ? 0.4 : 1 });
  const viewLabel: Record<View, string> = { twin: 'Twin', city: '3D city', satellite: 'Satellite' };
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5b6872' }}><a href="/">← Back to Schema</a> · <a href="/app">Workspace</a> · <a href="/radar">Subsurface Radar</a> · <a href="/contractor">Contractor Hub</a> · <a href="/studio">Studio 3D</a> · <a href="/real3d">Real 3D (Google)</a></p>
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
          <button type="button" onClick={useMyLocation} disabled={locating} style={{ ...box, marginBottom: 8, background: '#1d4f7c', color: '#fff', border: '1px solid #1d4f7c', fontWeight: 600, opacity: locating ? 0.7 : 1 }}>
            {locating ? 'Finding your location…' : 'Use my location'}
          </button>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            {(['twin', 'city', 'satellite'] as View[]).map((v) => <button key={v} type="button" style={chip(view === v)} onClick={() => chooseView(v)}>{viewLabel[v]}</button>)}
          </div>
          {view === 'city' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {PRESETS.map((p) => <button key={p} type="button" style={{ ...chip(preset === p), textTransform: 'capitalize' }} onClick={() => choosePreset(p)}>{p}</button>)}
            </div>
          )}
          <p style={{ minHeight: 22, margin: '0 0 8px', fontSize: 14 }}>{status || `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`}</p>
          <p style={{ margin: '0 0 8px', fontSize: 14 }}><a href={`/simulate?lat=${site.lat}&lng=${site.lng}`}>Climate and durability estimate for this site →</a></p>
          <div ref={container} style={{ width: '100%', height: '65vh', minHeight: 340, borderRadius: 12, overflow: 'hidden', border: '1px solid #c9cfc4' }} />
          <p style={{ fontSize: 13, color: '#5d6b5e' }}>Drag the pin to adjust the site. Drag the map to pan, two fingers to tilt and rotate. Imagery is a visual aid only, not survey data.</p>
        </>
      )}
    </main>
  );
}
