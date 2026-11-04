import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  C_SPEED_OF_LIGHT_M_PER_NS,
  MEDIUM_CATALOG,
  fresnelReflectionCoeff,
  rickerWavelet,
  timeToDepthMeters,
  depthToTimeNs,
  generateSyntheticRadargram,
  applyAgc,
} from '../src/radar/physics';
import { createInitialEdgeDaq, createInitialTiltSensors, tickTelemetry } from '../src/radar/daq';
import { runAiInversion, RADAR_PRESETS } from '../src/radar/inversion';
import type { RadarScanConfig, SubsurfaceStrata } from '../src/radar/types';

test('medium catalog has physically accurate velocities based on permittivity', () => {
  for (const [key, prop] of Object.entries(MEDIUM_CATALOG)) {
    const expectedV = C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(prop.permittivity);
    assert.ok(
      Math.abs(prop.velocity - expectedV) < 0.005,
      `Velocity mismatch for ${key}: got ${prop.velocity}, expected ${expectedV}`
    );
  }
  // Air void velocity should equal speed of light (c)
  assert.ok(Math.abs(MEDIUM_CATALOG.air_void.velocity - C_SPEED_OF_LIGHT_M_PER_NS) < 0.001);
  // Saturated soil has highest permittivity and slowest velocity
  assert.equal(MEDIUM_CATALOG.saturated_soil.permittivity, 25.0);
  assert.ok(MEDIUM_CATALOG.saturated_soil.velocity < MEDIUM_CATALOG.dry_sand.velocity);
});

test('fresnelReflectionCoeff handles positive and negative dielectric contrasts', () => {
  // Sand (eps=4) to Saturated soil (eps=25): n1=2, n2=5 -> (2-5)/(2+5) = -3/7 ≈ -0.4285
  const r1 = fresnelReflectionCoeff(4, 25);
  assert.ok(Math.abs(r1 - (-3 / 7)) < 0.001);

  // Clay (eps=14) to Air Void (eps=1): positive reflection coefficient
  const rVoid = fresnelReflectionCoeff(14, 1);
  assert.ok(rVoid > 0, 'Void reflection should have positive phase reversal');
});

test('rickerWavelet is zero-phase symmetric and peaks at t=0', () => {
  const f0 = 25; // 25 MHz
  const peak = rickerWavelet(0, f0);
  assert.equal(peak, 1.0, 'Ricker wavelet peak at t=0 must be exactly 1.0');

  // Symmetry: f(t) == f(-t)
  const positiveTime = rickerWavelet(15, f0);
  const negativeTime = rickerWavelet(-15, f0);
  assert.ok(Math.abs(positiveTime - negativeTime) < 1e-6, 'Ricker wavelet must be symmetric');

  // Side lobes should be negative
  const sideLobe = rickerWavelet(20, f0);
  assert.ok(sideLobe < 0, 'Side lobe must be negative');
});

test('timeToDepth and depthToTime round-trip accurately', () => {
  const eps = 9.0; // v = 0.1 m/ns
  const depth = 15.0; // 15 meters
  const timeNs = depthToTimeNs(depth, eps);
  const backDepth = timeToDepthMeters(timeNs, eps);
  assert.ok(Math.abs(depth - backDepth) < 1e-4);
});

test('generateSyntheticRadargram generates bounded 2D B-scan with correct dimensions', () => {
  const config: RadarScanConfig = {
    centerFrequencyMHz: 25,
    depthMaxMeters: 20,
    transectLengthMeters: 30,
    numTraces: 32,
    samplesPerTrace: 128,
    timeWindowNs: 350,
  };

  const strata: SubsurfaceStrata[] = [
    {
      name: 'Layer 1: Fill',
      medium: 'dry_sand',
      depthStartMeters: 0,
      depthEndMeters: 3,
      permittivity: 4,
      velocity: 0.15,
    },
    {
      name: 'Layer 2: Bedrock',
      medium: 'bedrock_granite',
      depthStartMeters: 3,
      depthEndMeters: 20,
      permittivity: 6,
      velocity: 0.122,
    },
  ];

  const radargram = generateSyntheticRadargram(config, strata, []);

  assert.equal(radargram.traces.length, 32);
  assert.equal(radargram.traces[0].length, 128);
  assert.equal(radargram.timeAxisNs.length, 128);
  assert.equal(radargram.distanceAxisMeters.length, 32);

  // Check amplitudes stay bounded between -1.0 and 1.0
  for (let tr = 0; tr < radargram.traces.length; tr++) {
    for (let s = 0; s < radargram.traces[tr].length; s++) {
      const amp = radargram.traces[tr][s];
      assert.ok(!Number.isNaN(amp), `NaN found in trace ${tr} sample ${s}`);
      assert.ok(amp >= -1.01 && amp <= 1.01, `Amplitude ${amp} out of range [-1, 1]`);
    }
  }
});

test('applyAgc enhances deeper weak reflections without clipping', () => {
  const trace = new Float32Array(100);
  trace[10] = 0.8; // shallow strong reflection
  trace[80] = 0.05; // deep attenuated reflection

  const agc = applyAgc(trace, 16);
  assert.equal(agc.length, trace.length);
  // Deep reflection amplitude ratio should be boosted relative to shallow
  assert.ok(Math.abs(agc[80]) > 0.05, 'AGC should amplify deep weak reflection');
  assert.ok(Math.abs(agc[10]) <= 1.0, 'AGC should not exceed bounds');
});

test('MEMS tilt sensor telemetry and tick updating maintain integrity', () => {
  const initialSensors = createInitialTiltSensors();
  const initialDaq = createInitialEdgeDaq();

  assert.equal(initialSensors.length, 4);
  assert.ok(initialSensors.some((s) => s.sensorId === 'TILT-SW-03' && s.status === 'warning'));

  const { sensors: tickedSensors, daq: tickedDaq } = tickTelemetry(initialSensors, initialDaq);
  assert.equal(tickedSensors.length, 4);
  assert.ok(tickedDaq.latencyMs >= 12 && tickedDaq.latencyMs <= 45);

  for (const s of tickedSensors) {
    assert.ok(Number.isFinite(s.pitchArcsec));
    assert.ok(Number.isFinite(s.rollArcsec));
    assert.ok(['nominal', 'warning', 'critical'].includes(s.status));
  }
});

test('runAiInversion extracts foundation anomalies and computes risk scorecard', () => {
  const config: RadarScanConfig = {
    centerFrequencyMHz: 25,
    depthMaxMeters: 20,
    transectLengthMeters: 40,
    numTraces: 40,
    samplesPerTrace: 128,
    timeWindowNs: 350,
  };
  const strata: SubsurfaceStrata[] = [
    {
      name: 'Layer 1: Fill',
      medium: 'dry_sand',
      depthStartMeters: 0,
      depthEndMeters: 2.5,
      permittivity: 4.5,
      velocity: 0.141,
    },
    {
      name: 'Layer 2: Clay',
      medium: 'damp_clay',
      depthStartMeters: 2.5,
      depthEndMeters: 20,
      permittivity: 12.0,
      velocity: 0.086,
    },
  ];

  const dummyRadargram = generateSyntheticRadargram(config, strata, []);
  const sensors = createInitialTiltSensors();
  const daq = createInitialEdgeDaq();

  const analysis = runAiInversion(dummyRadargram, sensors, daq);

  assert.ok(analysis.integrityScore >= 0 && analysis.integrityScore <= 100);
  assert.ok(['Optimal', 'Stable', 'Caution', 'Critical'].includes(analysis.stabilityGrade));
  assert.ok(analysis.bearingCapacityKPa > 100);
  assert.ok(analysis.settlementRiskPercent >= 0 && analysis.settlementRiskPercent <= 100);
  assert.ok(analysis.voidCollapseRiskPercent >= 0 && analysis.voidCollapseRiskPercent <= 100);
  assert.ok(analysis.anomalies.length > 0);
  assert.ok(analysis.contractorActionItems.length > 0);

  // Anomaly 1 should be the void below SW Footing
  const voidAnom = analysis.anomalies.find((a) => a.type === 'void');
  assert.ok(voidAnom, 'Void anomaly must be detected by AI inversion model');
  assert.equal(voidAnom?.severity, 'critical');
  assert.ok(voidAnom?.recommendedMitigation.includes('grouting'));
});

test('RADAR_PRESETS are configured for commercial, residential and coastal scopes', () => {
  assert.equal(RADAR_PRESETS.length, 3);
  assert.ok(RADAR_PRESETS.some((p) => p.id === 'portland_office'));
  assert.ok(RADAR_PRESETS.some((p) => p.id === 'nairobi_apartment'));
  assert.ok(RADAR_PRESETS.some((p) => p.id === 'miami_coastal'));
});
