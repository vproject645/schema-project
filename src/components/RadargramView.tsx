'use client';
import { useEffect, useRef, useState } from 'react';
import type { RadargramData, SubsurfaceAnomaly } from '../radar/types';
import { applyAgc } from '../radar/physics';

interface RadargramViewProps {
  radargram: RadargramData;
  anomalies: SubsurfaceAnomaly[];
  selectedAnomalyId?: string | null;
  onSelectAnomaly?: (id: string | null) => void;
}

export function RadargramView({
  radargram,
  anomalies,
  selectedAnomalyId,
  onSelectAnomaly,
}: RadargramViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aScanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTraceIdx, setSelectedTraceIdx] = useState<number>(Math.floor(radargram.config.numTraces / 2));
  const [palette, setPalette] = useState<'seismic' | 'thermal' | 'bone'>('seismic');
  const [agcEnabled, setAgcEnabled] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{ xM: number; depthM: number; timeNs: number; amp: number } | null>(null);

  const { numTraces, samplesPerTrace, transectLengthMeters, depthMaxMeters, timeWindowNs } = radargram.config;

  // Render 2D B-scan radargram on HTML5 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create ImageData buffer for high performance pixel manipulation
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Precompute processed traces (with AGC if enabled)
    const processedTraces: Float32Array[] = [];
    for (let tr = 0; tr < numTraces; tr++) {
      processedTraces.push(agcEnabled ? applyAgc(radargram.traces[tr], 32) : radargram.traces[tr]);
    }

    for (let py = 0; py < height; py++) {
      const sampleIdx = Math.floor((py / height) * samplesPerTrace);
      for (let px = 0; px < width; px++) {
        const traceIdx = Math.floor((px / width) * numTraces);
        const amp = processedTraces[traceIdx][sampleIdx];

        // Color mapping
        let r = 0, g = 0, b = 0;
        if (palette === 'seismic') {
          // Classic seismic: white at 0, black at positive, red/blue at negative
          const norm = (amp + 1) / 2; // 0 to 1
          if (norm < 0.5) {
            // Negative: blue to white
            const t = norm * 2;
            r = Math.round(t * 240);
            g = Math.round(t * 245);
            b = Math.round(180 + t * 75);
          } else {
            // Positive: white to dark charcoal
            const t = (norm - 0.5) * 2;
            const v = Math.round(245 - t * 220);
            r = v; g = v; b = v;
          }
        } else if (palette === 'thermal') {
          // Heatmap: dark purple -> magenta -> orange -> bright yellow
          const norm = Math.max(0, Math.min(1, Math.abs(amp) * 1.2));
          r = Math.round(norm * 255);
          g = Math.round(Math.pow(norm, 2) * 210);
          b = Math.round(Math.pow(1 - norm, 2) * 160);
        } else {
          // High-contrast Grayscale Bone
          const v = Math.round(((amp + 1) / 2) * 255);
          r = v; g = v; b = v;
        }

        const pixelIdx = (py * width + px) * 4;
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw Strata Horizons and Anomaly Markers
    ctx.save();
    for (const anom of anomalies) {
      const px = (anom.transectMeters / transectLengthMeters) * width;
      const py = (anom.depthMeters / depthMaxMeters) * height;

      const isSelected = selectedAnomalyId === anom.id;

      // Draw anomaly apex ring
      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = anom.severity === 'critical' ? '#d32f2f' : anom.severity === 'high' ? '#f57c00' : '#1976d2';
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Hyperbolic guide curve
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = anom.severity === 'critical' ? 'rgba(211, 47, 47, 0.7)' : 'rgba(25, 118, 210, 0.6)';
      const spanPx = (anom.extentMeters / transectLengthMeters) * width;
      ctx.moveTo(px - spanPx, py + 25);
      ctx.quadraticCurveTo(px, py - 5, px + spanPx, py + 25);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.font = '600 11px "IBM Plex Sans", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#14212b';
      ctx.lineWidth = 3;
      ctx.strokeText(`${anom.title.split(' ')[0]} (${anom.depthMeters}m)`, px + 10, py - 6);
      ctx.fillText(`${anom.title.split(' ')[0]} (${anom.depthMeters}m)`, px + 10, py - 6);
    }

    // Selected Trace Vertical Guide Line
    const selPx = (selectedTraceIdx / numTraces) * width;
    ctx.strokeStyle = '#c8561b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(selPx, 0);
    ctx.lineTo(selPx, height);
    ctx.stroke();
    ctx.restore();
  }, [radargram, anomalies, palette, agcEnabled, selectedAnomalyId, selectedTraceIdx, numTraces, samplesPerTrace, transectLengthMeters, depthMaxMeters]);

  // Render Single A-Scan Oscilloscope Waveform
  useEffect(() => {
    const canvas = aScanCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = '#14212b';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#273846';
    ctx.lineWidth = 0.8;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Center baseline
    const midX = width / 2;
    ctx.strokeStyle = '#435868';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(midX, 0); ctx.lineTo(midX, height); ctx.stroke();

    const trace = agcEnabled ? applyAgc(radargram.traces[selectedTraceIdx], 32) : radargram.traces[selectedTraceIdx];

    // Draw wiggle trace (Amplitude vs Depth/Time)
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.5;

    for (let s = 0; s < samplesPerTrace; s++) {
      const y = (s / samplesPerTrace) * height;
      const x = midX + trace[s] * (width * 0.42);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill positive lobes in green-blue
    ctx.save();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    for (let s = 0; s < samplesPerTrace; s++) {
      const y = (s / samplesPerTrace) * height;
      const x = midX + Math.max(0, trace[s]) * (width * 0.42);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(midX, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [radargram, selectedTraceIdx, agcEnabled, samplesPerTrace]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const clickedTransectM = xRatio * transectLengthMeters;
    const clickedDepthM = yRatio * depthMaxMeters;

    const clickedTrace = Math.floor(xRatio * numTraces);
    setSelectedTraceIdx(Math.max(0, Math.min(numTraces - 1, clickedTrace)));

    // Check if clicked close to an anomaly
    let closestAnom: SubsurfaceAnomaly | null = null;
    let minDist = 3.5; // meters tolerance
    for (const anom of anomalies) {
      const d = Math.hypot(anom.transectMeters - clickedTransectM, anom.depthMeters - clickedDepthM);
      if (d < minDist) {
        minDist = d;
        closestAnom = anom;
      }
    }
    onSelectAnomaly?.(closestAnom ? closestAnom.id : null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;

    const xM = Number((xRatio * transectLengthMeters).toFixed(1));
    const depthM = Number((yRatio * depthMaxMeters).toFixed(2));
    const timeNs = Number((yRatio * timeWindowNs).toFixed(1));

    const trIdx = Math.floor(xRatio * numTraces);
    const sIdx = Math.floor(yRatio * samplesPerTrace);
    const trace = radargram.traces[Math.max(0, Math.min(numTraces - 1, trIdx))];
    const amp = trace ? Number(trace[Math.max(0, Math.min(samplesPerTrace - 1, sIdx))].toFixed(3)) : 0;

    setHoverInfo({ xM, depthM, timeNs, amp });
  };

  return (
    <div className="radar-view-container" style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Subsurface 2D B-Scan Radargram</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5b6872' }}>
            Low-Frequency Penetrative GPR ({radargram.config.centerFrequencyMHz} MHz) · Depth 0 to {depthMaxMeters}m · Transect 0 to {transectLengthMeters}m
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, color: '#14212b', fontWeight: 500, cursor: 'pointer' }}>
            <input type="checkbox" checked={agcEnabled} onChange={(e) => setAgcEnabled(e.target.checked)} />
            AGC Gain Boost
          </label>
          <div style={{ display: 'flex', border: '1px solid #c9cfc4', borderRadius: 6, overflow: 'hidden' }}>
            {(['seismic', 'thermal', 'bone'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPalette(p)}
                style={{
                  padding: '5px 10px',
                  fontSize: 12,
                  border: 0,
                  background: palette === p ? '#14212b' : '#f5f6f4',
                  color: palette === p ? '#fff' : '#14212b',
                  cursor: 'pointer',
                  fontWeight: palette === p ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 14 }}>
        {/* B-scan 2D Radargram view */}
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={720}
            height={360}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoverInfo(null)}
            style={{ width: '100%', height: 340, borderRadius: 8, border: '1px solid #14212b', display: 'block', cursor: 'crosshair' }}
          />

          {/* Depth Axis Marks on Left */}
          <div style={{ position: 'absolute', left: 8, top: 8, pointerEvents: 'none', background: 'rgba(20,33,43,0.75)', color: '#fff', padding: '3px 6px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>
            0.0m (0 ns)
          </div>
          <div style={{ position: 'absolute', left: 8, bottom: 8, pointerEvents: 'none', background: 'rgba(20,33,43,0.75)', color: '#fff', padding: '3px 6px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>
            {depthMaxMeters.toFixed(1)}m ({timeWindowNs} ns)
          </div>

          {/* Transect distance indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5b6872', marginTop: 4, fontFamily: 'monospace' }}>
            <span>0.0 m (Transect Start)</span>
            <span>{(transectLengthMeters / 2).toFixed(1)} m</span>
            <span>{transectLengthMeters.toFixed(1)} m (Far Footing)</span>
          </div>

          {/* Live Hover Readout */}
          {hoverInfo && (
            <div style={{ position: 'absolute', right: 10, top: 10, pointerEvents: 'none', background: 'rgba(20,33,43,0.85)', color: '#fff', padding: '5px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', lineHeight: 1.4 }}>
              <div>Distance: <b>{hoverInfo.xM}m</b></div>
              <div>Depth: <b>{hoverInfo.depthM}m</b> ({hoverInfo.timeNs} ns)</div>
              <div>Wave Amp: <b>{hoverInfo.amp}</b></div>
            </div>
          )}
        </div>

        {/* A-scan Single Wave Trace Oscilloscope */}
        <div style={{ background: '#14212b', borderRadius: 8, padding: 10, color: '#e6edf1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#90caf9', marginBottom: 4 }}>
            A-Scan Wave Trace
          </div>
          <div style={{ fontSize: 11, color: '#a0afbb', marginBottom: 8, fontFamily: 'monospace' }}>
            Trace #{selectedTraceIdx + 1} @ {((selectedTraceIdx / numTraces) * transectLengthMeters).toFixed(1)}m
          </div>
          <canvas
            ref={aScanCanvasRef}
            width={180}
            height={260}
            style={{ width: '100%', height: 260, borderRadius: 4, display: 'block' }}
          />
          <div style={{ fontSize: 10, color: '#8295a5', marginTop: 6, textAlign: 'center' }}>
            Two-Way Echo Phase & Amplitude
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#d32f2f' }} />
          <span>Critical Soil Cavity / Void</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1976d2' }} />
          <span>Water Horizon / Hydrostatic Layer</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f57c00' }} />
          <span>Bedrock Discontinuity / Fault Contact</span>
        </div>
        <div style={{ marginLeft: 'auto', color: '#5b6872' }}>
          Click anywhere along profile to inspect individual A-scan wave reflections
        </div>
      </div>
    </div>
  );
}

