'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SchemaMark } from './SchemaMark';
import { RadargramView } from './RadargramView';
import { TiltSensorClusterView } from './TiltSensorClusterView';
import { generateSyntheticRadargram, MEDIUM_CATALOG } from '../radar/physics';
import { createInitialEdgeDaq, createInitialTiltSensors, tickTelemetry } from '../radar/daq';
import { RADAR_PRESETS, runAiInversion } from '../radar/inversion';
import type { RadarScanConfig, SubsurfaceStrata } from '../radar/types';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Cpu, Download,
  ExternalLink, FileSpreadsheet, HardHat, Info, Radio, RefreshCw, ShieldAlert,
  ShieldCheck, Waves, Zap
} from 'lucide-react';

export function RadarStudioApp() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('portland_office');
  const [centerFreqMHz, setCenterFreqMHz] = useState<number>(25);
  const [depthMaxM, setDepthMaxM] = useState<number>(20);
  const [transectLengthM, setTransectLengthM] = useState<number>(40);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  // Live telemetry state
  const [sensors, setSensors] = useState(createInitialTiltSensors);
  const [edgeDaq, setEdgeDaq] = useState(createInitialEdgeDaq);
  const [liveStreamActive, setLiveStreamActive] = useState<boolean>(true);

  // Config definition
  const config: RadarScanConfig = useMemo(() => ({
    centerFrequencyMHz: centerFreqMHz,
    depthMaxMeters: depthMaxM,
    transectLengthMeters: transectLengthM,
    numTraces: 64,
    samplesPerTrace: 256,
    timeWindowNs: Math.round((2 * depthMaxM / 0.10) * 1.1),
  }), [centerFreqMHz, depthMaxM, transectLengthM]);

  // Strata geological profile
  const strata: SubsurfaceStrata[] = useMemo(() => [
    {
      name: 'Layer 1: Compacted Fill / Crushed Stone Sub-base',
      medium: 'dry_sand',
      depthStartMeters: 0,
      depthEndMeters: 2.2,
      permittivity: 4.5,
      velocity: 0.141,
    },
    {
      name: 'Layer 2: Stiff Silty Clay & Footing Bearing Strata',
      medium: 'damp_clay',
      depthStartMeters: 2.2,
      depthEndMeters: 8.5,
      permittivity: 12.0,
      velocity: 0.086,
    },
    {
      name: 'Layer 3: Saturated Alluvial Gravel / Water Horizon',
      medium: 'saturated_soil',
      depthStartMeters: 8.5,
      depthEndMeters: 14.0,
      permittivity: 24.0,
      velocity: 0.061,
    },
    {
      name: 'Layer 4: Dense Basalt / Bedrock Contact',
      medium: 'bedrock_granite',
      depthStartMeters: 14.0,
      depthEndMeters: depthMaxM,
      permittivity: 6.0,
      velocity: 0.122,
    },
  ], [depthMaxM]);

  // Run AI Inversion and generate Radargram
  const initialAnalysis = useMemo(() => {
    // Generate initial anomalies
    const dummyRadargram = generateSyntheticRadargram(config, strata, []);
    return runAiInversion(dummyRadargram, sensors, edgeDaq);
  }, [config, strata, sensors, edgeDaq]);

  const [analysis, setAnalysis] = useState(initialAnalysis);

  const radargram = useMemo(() => {
    return generateSyntheticRadargram(config, strata, analysis.anomalies);
  }, [config, strata, analysis.anomalies]);

  // Telemetry tick effect
  useEffect(() => {
    if (!liveStreamActive) return;
    const interval = setInterval(() => {
      setSensors((prevSensors) => {
        const { sensors: nextSensors, daq: nextDaq } = tickTelemetry(prevSensors, edgeDaq);
        setEdgeDaq(nextDaq);
        return nextSensors;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [liveStreamActive, edgeDaq]);

  // Handle Preset change
  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = RADAR_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setCenterFreqMHz(p.frequencyMHz);
    setDepthMaxM(p.depthMax);
    setTransectLengthM(p.transectLength);
  };

  // Trigger full scan
  const triggerScan = () => {
    setScanning(true);
    setTimeout(() => {
      const freshRadargram = generateSyntheticRadargram(config, strata, []);
      const freshResult = runAiInversion(freshRadargram, sensors, edgeDaq);
      setAnalysis(freshResult);
      setScanning(false);
    }, 850);
  };

  const exportReport = () => {
    const report = {
      project: 'Schema Structural Health & Subsurface GPR Inspection',
      preset: selectedPresetId,
      timestamp: analysis.scanTimestamp,
      edgeDaq: analysis.edgeDaq,
      foundationIntegrityScore: analysis.integrityScore,
      stabilityGrade: analysis.stabilityGrade,
      bearingCapacityKPa: analysis.bearingCapacityKPa,
      settlementRiskPercent: analysis.settlementRiskPercent,
      voidCollapseRiskPercent: analysis.voidCollapseRiskPercent,
      seismicAmplificationFactor: analysis.seismicAmplificationFactor,
      detectedAnomalies: analysis.anomalies,
      sensorTelemetry: analysis.sensorCluster,
      contractorActionItems: analysis.contractorActionItems,
      engineeringDisclaimer: 'GPR radar profiles and AI inversion model provide screening diagnostics for special inspection and contractor validation. Licensed structural/geotechnical engineer stamped verification required before permit signoff.',
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema-subsurface-gpr-report-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="radar-page-shell" style={{ minHeight: '100vh', background: '#f5f6f4', color: '#14212b', fontFamily: '"IBM Plex Sans", Inter, sans-serif' }}>
      {/* Top Header */}
      <header style={{ borderBottom: '1px solid #d5dad9', background: '#fff', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#14212b', fontWeight: 600, fontSize: 18 }}>
            <SchemaMark size={24} />
            <span>Schema</span>
          </a>
          <span style={{ height: 18, width: 1, background: '#d5dad9' }} />
          <span style={{ fontSize: 13, color: '#5b6872', fontWeight: 500 }}>
            Subsurface Radar & Disaster Prediction AI
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
          <a href="/app" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Workspace</a>
          <a href="/studio" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Studio 3D</a>
          <a href="/contractor" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Contractor Hub</a>
          <a href="/site" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Site View</a>
          <a href="/simulate" style={{ color: '#5b6872', textDecoration: 'none', fontWeight: 500 }}>Climate</a>
          <a
            href="/app"
            style={{
              padding: '6px 14px',
              background: '#14212b',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Open Project
          </a>
        </nav>
      </header>

      {/* Hero Banner */}
      <div style={{ background: '#14212b', color: '#fff', padding: '24px 24px 28px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1d4f7c', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            <Radio size={12} /> Low-Frequency GPR (10–50 MHz) · Edge DAQ · AI Inversion
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Penetrative Radar & Subsurface Disaster Prediction
          </h1>
          <p style={{ margin: 0, maxWidth: 840, fontSize: 15, color: '#a0afbb', lineHeight: 1.5 }}>
            Scans internal structural integrity and deep subterranean strata (up to 35m) using penetrative RF radar waves.
            Coupled with an Edge DAQ unit (NVIDIA Jetson / RPi 5) and MEMS tilt sensor clusters to detect foundation voids,
            soil shear shifts, and seismic vulnerability before construction or commercial fit-out.
          </p>
          <p role="note" style={{ margin: '12px 0 0', maxWidth: 840, fontSize: 13, color: '#e6c98a', lineHeight: 1.5 }}>
            Simulated demonstration. Radar profiles and sensor readings on this page are generated, not measured on a real site. Results are screening aids only and are not a geotechnical report or a disaster warning. Any real finding needs a licensed engineer.
          </p>
        </div>
      </div>

      {/* Main Workspace Container */}
      <main style={{ maxWidth: 1180, margin: '20px auto', padding: '0 16px' }}>
        {/* Preset Selector & Controls Bar */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 16, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#14212b' }}>Site Context:</span>
            {RADAR_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: `1px solid ${selectedPresetId === p.id ? '#14212b' : '#c9cfc4'}`,
                  background: selectedPresetId === p.id ? '#14212b' : '#fff',
                  color: selectedPresetId === p.id ? '#fff' : '#14212b',
                  fontSize: 13,
                  fontWeight: selectedPresetId === p.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setLiveStreamActive(!liveStreamActive)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                border: '1px solid #c9cfc4',
                background: liveStreamActive ? '#e8f5e9' : '#fff',
                color: liveStreamActive ? '#2e7d32' : '#5b6872',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Activity size={14} className={liveStreamActive ? 'sa-spin' : ''} />
              {liveStreamActive ? 'Live Telemetry Active' : 'Telemetry Paused'}
            </button>

            <button
              onClick={triggerScan}
              disabled={scanning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                borderRadius: 6,
                border: 0,
                background: '#1d4f7c',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: scanning ? 'wait' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={scanning ? 'sa-spin' : ''} />
              {scanning ? 'Computing Inversion…' : 'Run Radar Scan'}
            </button>

            <button
              onClick={exportReport}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid #c9cfc4',
                background: '#fff',
                color: '#14212b',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Export Report
            </button>
          </div>
        </div>

        {/* Real-time Hardware & Edge DAQ Telemetry Strip */}
        <div style={{ background: '#eaf1f7', border: '1px solid #d3e0ec', borderRadius: 8, padding: '10px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={16} color="#1d4f7c" />
            <span><b>Edge Gateway:</b> {edgeDaq.deviceType}</span>
            <span style={{ color: '#8a98a2' }}>|</span>
            <span><b>Transceiver:</b> {edgeDaq.frequencyMHz} MHz ({edgeDaq.txPowerWatts}W Peak)</span>
            <span style={{ color: '#8a98a2' }}>|</span>
            <span><b>Sampling:</b> {edgeDaq.sampleRateKhz} kHz (PRF {edgeDaq.pulseRateKhz} kHz)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2e7d32', fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2e7d32' }} />
              {edgeDaq.cellularUplink} ({edgeDaq.latencyMs}ms)
            </span>
            <span style={{ color: '#5b6872' }}>Battery: {edgeDaq.batteryPercent}%</span>
          </div>
        </div>

        {/* Foundation Health & Disaster Prediction Scorecard */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Foundation Integrity
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: analysis.integrityScore < 70 ? '#c62828' : '#14212b' }}>
                {analysis.integrityScore}
              </span>
              <span style={{ fontSize: 14, color: '#5b6872' }}>/ 100</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: analysis.stabilityGrade === 'Caution' ? '#ef6c00' : '#2e7d32', marginTop: 4 }}>
              Grade: {analysis.stabilityGrade}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Soil Bearing Capacity
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#14212b' }}>
                {analysis.bearingCapacityKPa}
              </span>
              <span style={{ fontSize: 14, color: '#5b6872' }}>kPa</span>
            </div>
            <div style={{ fontSize: 12, color: '#5b6872', marginTop: 4 }}>
              Safe footing load limit
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Void Collapse Hazard
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: analysis.voidCollapseRiskPercent > 50 ? '#c62828' : '#2e7d32' }}>
                {analysis.voidCollapseRiskPercent}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: analysis.voidCollapseRiskPercent > 50 ? '#c62828' : '#5b6872', fontWeight: 500, marginTop: 4 }}>
              High cavity risk at 2.8m
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#5b6872', fontWeight: 600, textTransform: 'uppercase' }}>
              Seismic Amp. Factor
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#14212b' }}>
                {analysis.seismicAmplificationFactor}×
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#5b6872', marginTop: 4 }}>
              Bedrock shear boundary
            </div>
          </div>
        </div>

        {/* 2D Radargram Canvas Component */}
        <RadargramView
          radargram={radargram}
          anomalies={analysis.anomalies}
          selectedAnomalyId={selectedAnomalyId}
          onSelectAnomaly={setSelectedAnomalyId}
        />

        {/* MEMS Tilt Sensor Array Cluster Component */}
        <TiltSensorClusterView sensors={sensors} />

        {/* Detected Subsurface Anomalies & Inversion Insights */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>AI Inversion Anomaly Register</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5b6872' }}>
                Automated hyperbolic wave migration & dielectric contrast classification
              </p>
            </div>
            <span style={{ fontSize: 13, color: '#5b6872' }}>
              {analysis.anomalies.length} Anomaly Signatures Detected
            </span>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {analysis.anomalies.map((anom) => (
              <div
                key={anom.id}
                onClick={() => setSelectedAnomalyId(anom.id)}
                style={{
                  border: `1px solid ${selectedAnomalyId === anom.id ? '#14212b' : '#e0e0e0'}`,
                  background: selectedAnomalyId === anom.id ? '#f7f9fa' : '#fff',
                  borderRadius: 8,
                  padding: 14,
                  cursor: 'pointer',
                  transition: 'all .15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: anom.severity === 'critical' ? '#ffebee' : anom.severity === 'high' ? '#fff3e0' : '#e3f2fd',
                          color: anom.severity === 'critical' ? '#c62828' : anom.severity === 'high' ? '#ef6c00' : '#1565c0',
                        }}
                      >
                        {anom.severity}
                      </span>
                      <strong style={{ fontSize: 15, color: '#14212b' }}>{anom.title}</strong>
                      <span style={{ fontSize: 12, color: '#5b6872' }}>({anom.id})</span>
                    </div>
                    <p style={{ margin: '6px 0 8px', fontSize: 13, color: '#29342c' }}>
                      {anom.description}
                    </p>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#5b6872', flexWrap: 'wrap' }}>
                      <span>Location: <b>Transect {anom.transectMeters}m</b></span>
                      <span>Depth: <b>{anom.depthMeters}m</b></span>
                      <span>Lateral Span: <b>{anom.extentMeters}m</b></span>
                      <span>Confidence: <b>{Math.round(anom.confidence * 100)}%</b></span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, background: '#f8faf9', borderLeft: '3px solid #1d4f7c', padding: '6px 12px', fontSize: 12.5, color: '#14212b' }}>
                  <strong>Contractor Mitigation:</strong> {anom.recommendedMitigation}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* General Contractor Field Action Plan */}
        <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <HardHat size={20} color="#1d4f7c" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>General Contractor Subsurface Validation Brief</h3>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#5b6872' }}>
            Action items synthesized by Schema AI for the site superintendent and project engineer
          </p>

          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {analysis.contractorActionItems.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                {item}
              </li>
            ))}
          </ol>

          <div style={{ marginTop: 16, padding: '12px 14px', background: '#f5f6f4', borderRadius: 8, fontSize: 12, color: '#5b6872', lineHeight: 1.6 }}>
            <b>Code & Inspection Provenance:</b> Conforms to ASTM D6432 Standard Guide for Using the Surface Ground Penetrating Radar Method for Subsurface Investigation and IBC Chapter 17 Special Inspections for Geotechnical and Foundation Stability.
          </div>
        </div>
      </main>
    </div>
  );
}

