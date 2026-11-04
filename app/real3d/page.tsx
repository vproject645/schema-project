'use client';
import { useEffect, useRef, useState } from 'react';

// Photorealistic 3D city view (real 3D models built from photos) using
// Google's Photorealistic 3D Tiles, rendered with CesiumJS loaded from Google's CDN.
// Needs a Google Maps API key with the "Map Tiles API" enabled.
const CESIUM = 'https://ajax.googleapis.com/ajax/libs/cesiumjs/1.105/Build/Cesium';
const BUILD_KEY = (() => { try { return process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''; } catch { return ''; } })();
const DEFAULT_SITE = { lat: -1.2673, lng: 36.8060 }; // Westlands, Nairobi

type CesiumLib = any; // loaded from the CDN, so no bundled types

function loadCesium(): Promise<CesiumLib> {
  const w = window as unknown as { Cesium?: CesiumLib };
  if (w.Cesium) return Promise.resolve(w.Cesium);
  return new Promise((resolve, reject) => {
    if (!document.getElementById('cesium-css')) {
      const css = document.createElement('link');
      css.id = 'cesium-css';
      css.rel = 'stylesheet';
      css.href = `${CESIUM}/Widgets/widgets.css`;
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    script.src = `${CESIUM}/Cesium.js`;
    script.onload = () => (w.Cesium ? resolve(w.Cesium) : reject(new Error('Cesium did not load.')));
    script.onerror = () => reject(new Error('Could not load the 3D library.'));
    document.head.appendChild(script);
  });
}

// Ground elevation (metres) so the camera starts above the buildings, not inside the hill.
async function groundHeight(lat: number, lng: number): Promise<number> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const d = (await r.json()) as { elevation?: number[] };
    return d.elevation?.[0] ?? 0;
  } catch { return 0; }
}

export default function Real3DPage() {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [key, setKey] = useState(BUILD_KEY);
  const [keyDraft, setKeyDraft] = useState('');
  const [site, setSite] = useState(DEFAULT_SITE);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  async function fly(Cesium: CesiumLib, viewer: any, lat: number, lng: number, instant = false) {
    const h = (await groundHeight(lat, lng)) + 380;
    viewer.camera[instant ? 'setView' : 'flyTo']({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat - 0.0035, h),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-32), roll: 0 },
      ...(instant ? {} : { duration: 3 }),
    });
  }

  // Create the viewer once a key exists.
  useEffect(() => {
    if (!key || !container.current) return;
    let cancelled = false;
    loadCesium().then(async (Cesium) => {
      if (cancelled || !container.current) return;
      const viewer = new Cesium.Viewer(container.current, {
        imageryProvider: false, baseLayerPicker: false, geocoder: false, homeButton: false,
        sceneModePicker: false, navigationHelpButton: false, animation: false, timeline: false,
        fullscreenButton: false, requestRenderMode: true,
      });
      viewerRef.current = viewer;
      viewer.scene.globe.show = false;
      try {
        const tileset = viewer.scene.primitives.add(new Cesium.Cesium3DTileset({
          url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,
          showCreditsOnScreen: true,
        }));
        tileset.readyPromise?.catch(() => setStatus('Google rejected the key. Check that the Map Tiles API is enabled and billing is on.'));
      } catch { setStatus('Could not start the 3D tiles. Check your Google key.'); }
      await fly(Cesium, viewer, site.lat, site.lng, true);
    }).catch((e: Error) => setStatus(e.message));
    return () => { cancelled = true; try { viewerRef.current?.destroy(); } catch { /* already gone */ } viewerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Fly to a new site.
  useEffect(() => {
    const Cesium = (window as unknown as { Cesium?: CesiumLib }).Cesium;
    if (Cesium && viewerRef.current) void fly(Cesium, viewerRef.current, site.lat, site.lng);
  }, [site]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setStatus('Searching…');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const hits = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!hits[0]) { setStatus('No match. Try a fuller address.'); return; }
      setSite({ lat: Number(hits[0].lat), lng: Number(hits[0].lon) });
      setStatus(hits[0].display_name);
    } catch { setStatus('Search failed. Check your connection.'); }
  }

  const box: React.CSSProperties = { padding: 12, border: '1px solid #c9cfc4', borderRadius: 8, fontSize: 16, width: '100%' };
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#5b6872' }}><a href="/">← Back to Schema</a> · <a href="/app">Workspace</a> · <a href="/radar">Subsurface Radar</a> · <a href="/contractor">Contractor Hub</a> · <a href="/studio">Studio 3D</a> · <a href="/site">Map view</a></p>
      <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Real 3D view</h1>
      {!key ? (
        <section style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
          <p>Paste a Google Maps API key with the <b>Map Tiles API</b> enabled. It stays in this tab only.</p>
          <input style={box} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="AIza…" autoCapitalize="none" autoCorrect="off" />
          <button style={{ ...box, marginTop: 8, background: '#283229', color: '#fff' }} onClick={() => keyDraft.trim() && setKey(keyDraft.trim())}>Show 3D city</button>
        </section>
      ) : (
        <>
          <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={box} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any address or city" />
            <button style={{ ...box, width: 110, background: '#283229', color: '#fff' }}>Go</button>
          </form>
          <p style={{ minHeight: 22, margin: '0 0 8px', fontSize: 14 }}>{status || `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`}</p>
          <div ref={container} style={{ width: '100%', height: '65vh', minHeight: 340, borderRadius: 12, overflow: 'hidden', border: '1px solid #c9cfc4' }} />
          <p style={{ fontSize: 13, color: '#5d6b5e' }}>Drag to look around, pinch to zoom, two fingers to tilt. Coverage varies by city. Imagery is a visual aid only, not survey data.</p>
        </>
      )}
    </main>
  );
}
