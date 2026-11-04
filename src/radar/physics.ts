/**
 * Subsurface Radar Physics & Synthetic Profile Generator.
 * Implements Maxwell-approximated GPR wave propagation, Ricker wavelet synthesis,
 * hyperbolic diffraction modeling for point anomalies, and layer boundary reflections.
 */

import type { GroundMedium, MediumProperties, RadarScanConfig, RadargramData, SubsurfaceAnomaly, SubsurfaceStrata } from './types';

export const C_SPEED_OF_LIGHT_M_PER_NS = 0.299792458; // metres per nanosecond

export const MEDIUM_CATALOG: Record<GroundMedium, MediumProperties> = {
  air_void: {
    label: 'Air Void / Cavity',
    permittivity: 1.0,
    conductivity: 0.00001,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(1.0), // 0.300 m/ns
  },
  dry_sand: {
    label: 'Dry Sand / Gravel',
    permittivity: 4.0,
    conductivity: 0.001,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(4.0), // 0.150 m/ns
  },
  bedrock_granite: {
    label: 'Bedrock (Granite/Basalt)',
    permittivity: 6.0,
    conductivity: 0.0005,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(6.0), // 0.122 m/ns
  },
  concrete_footing: {
    label: 'Reinforced Concrete Footing',
    permittivity: 8.0,
    conductivity: 0.01,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(8.0), // 0.106 m/ns
  },
  damp_clay: {
    label: 'Damp Clay / Subgrade',
    permittivity: 14.0,
    conductivity: 0.05,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(14.0), // 0.080 m/ns
  },
  saturated_soil: {
    label: 'Saturated Soil / Water Table',
    permittivity: 25.0,
    conductivity: 0.08,
    velocity: C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(25.0), // 0.060 m/ns
  },
};

/**
 * Computes Fresnel reflection coefficient at a planar normal interface.
 * R = (sqrt(eps1) - sqrt(eps2)) / (sqrt(eps1) + sqrt(eps2))
 */
export function fresnelReflectionCoeff(eps1: number, eps2: number): number {
  const n1 = Math.sqrt(eps1);
  const n2 = Math.sqrt(eps2);
  return (n1 - n2) / (n1 + n2);
}

/**
 * Evaluates a zero-phase Ricker Wavelet of peak frequency f0 (MHz) at time t (ns).
 * f(t) = (1 - 2*pi^2 * f0^2 * t^2) * exp(-pi^2 * f0^2 * t^2)
 */
export function rickerWavelet(tNs: number, f0MHz: number): number {
  // Convert MHz to GHz to match nanosecond time scale (1 MHz = 0.001 GHz = 0.001 ns^-1)
  const f0 = f0MHz * 0.001;
  const arg = Math.PI * f0 * tNs;
  const argSq = arg * arg;
  return (1 - 2 * argSq) * Math.exp(-argSq);
}

/**
 * Converts two-way travel time (ns) to depth (m) using an effective bulk permittivity.
 */
export function timeToDepthMeters(timeNs: number, effectivePermittivity: number): number {
  const v = C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(effectivePermittivity);
  return (timeNs * v) / 2;
}

/**
 * Converts depth (m) to two-way travel time (ns).
 */
export function depthToTimeNs(depthM: number, effectivePermittivity: number): number {
  const v = C_SPEED_OF_LIGHT_M_PER_NS / Math.sqrt(effectivePermittivity);
  return (2 * depthM) / v;
}

/**
 * Generates synthetic radargram (B-scan matrix) for given strata and point anomalies.
 */
export function generateSyntheticRadargram(
  config: RadarScanConfig,
  strata: SubsurfaceStrata[],
  anomalies: SubsurfaceAnomaly[]
): RadargramData {
  const { numTraces, samplesPerTrace, transectLengthMeters, timeWindowNs, centerFrequencyMHz } = config;

  const dt = timeWindowNs / samplesPerTrace;
  const dx = transectLengthMeters / (numTraces - 1);

  const timeAxisNs: number[] = [];
  for (let s = 0; s < samplesPerTrace; s++) timeAxisNs.push(s * dt);

  const distanceAxisMeters: number[] = [];
  for (let tr = 0; tr < numTraces; tr++) distanceAxisMeters.push(tr * dx);

  // Calculate average near-surface permittivity for depth scale
  const avgPermittivity = strata.length ? strata[0].permittivity : 9.0;
  const depthAxisMeters = timeAxisNs.map((t) => timeToDepthMeters(t, avgPermittivity));

  // Initialize traces array
  const traces: Float32Array[] = [];
  for (let tr = 0; tr < numTraces; tr++) {
    traces.push(new Float32Array(samplesPerTrace));
  }

  // 1. Synthesize Direct Ground Wave / Direct Coupling at t = 0
  for (let tr = 0; tr < numTraces; tr++) {
    const trace = traces[tr];
    for (let s = 0; s < Math.min(40, samplesPerTrace); s++) {
      const t = timeAxisNs[s] - 8.0; // centered slightly after onset
      trace[s] += 0.85 * rickerWavelet(t, centerFrequencyMHz);
    }
  }

  // 2. Synthesize Continuous Strata Layer Reflections
  for (let layerIdx = 0; layerIdx < strata.length - 1; layerIdx++) {
    const layer = strata[layerIdx];
    const nextLayer = strata[layerIdx + 1];
    const boundaryDepth = layer.depthEndMeters;
    const rCoeff = fresnelReflectionCoeff(layer.permittivity, nextLayer.permittivity);

    // Layer two-way travel time
    const t0 = depthToTimeNs(boundaryDepth, layer.permittivity);

    for (let tr = 0; tr < numTraces; tr++) {
      const x = distanceAxisMeters[tr];
      // Subtle geological topography undulation along transect
      const undulationDepth = boundaryDepth + 0.3 * Math.sin((x / transectLengthMeters) * Math.PI * 2.5);
      const tArrival = depthToTimeNs(undulationDepth, layer.permittivity);
      const sampleCenter = Math.round(tArrival / dt);

      const pulseWidthSamples = Math.round(30 / (centerFrequencyMHz * dt * 0.001));
      const trace = traces[tr];

      for (let s = Math.max(0, sampleCenter - pulseWidthSamples); s < Math.min(samplesPerTrace, sampleCenter + pulseWidthSamples); s++) {
        const timeDiff = timeAxisNs[s] - tArrival;
        // Attenuation factor: waves lose energy with depth
        const attenuation = Math.exp(-0.02 * boundaryDepth);
        trace[s] += rCoeff * attenuation * rickerWavelet(timeDiff, centerFrequencyMHz);
      }
    }
  }

  // 3. Synthesize Hyperbolic Diffractions for Subsurface Anomalies
  for (const anomaly of anomalies) {
    const x0 = anomaly.transectMeters;
    const d0 = anomaly.depthMeters;
    // Velocity of surrounding medium
    const surroundingLayer = strata.find((s) => d0 >= s.depthStartMeters && d0 <= s.depthEndMeters) || strata[0];
    const v = surroundingLayer.velocity;
    const t0 = (2 * d0) / v; // apex time

    // Anomaly reflection polarity
    // Voids have negative contrast (lower permittivity than surrounding soil), producing positive initial phase
    const amplitude = (anomaly.severity === 'critical' ? 1.0 : anomaly.severity === 'high' ? 0.75 : 0.5) * (anomaly.type === 'void' ? 1.0 : -0.8);

    for (let tr = 0; tr < numTraces; tr++) {
      const x = distanceAxisMeters[tr];
      const distFromApex = Math.abs(x - x0);
      // Hyperbola aperture limit (waves only scatter within beam cone ~ 45 deg)
      if (distFromApex > d0 * 1.5) continue;

      // Hyperbolic two-way travel time: t(x) = sqrt(t0^2 + 4*(x - x0)^2 / v^2)
      const tHyperbola = Math.sqrt(t0 * t0 + (4 * distFromApex * distFromApex) / (v * v));
      if (tHyperbola >= timeWindowNs) continue;

      const sampleApex = Math.round(tHyperbola / dt);
      const trace = traces[tr];
      const pulseWidthSamples = Math.round(25 / (centerFrequencyMHz * dt * 0.001));

      // Geometric spreading and attenuation
      const geometricSpreading = Math.sqrt(t0 / tHyperbola);
      const attenuation = Math.exp(-0.025 * d0);

      for (let s = Math.max(0, sampleApex - pulseWidthSamples); s < Math.min(samplesPerTrace, sampleApex + pulseWidthSamples); s++) {
        const timeDiff = timeAxisNs[s] - tHyperbola;
        trace[s] += amplitude * geometricSpreading * attenuation * rickerWavelet(timeDiff, centerFrequencyMHz);
      }
    }
  }

  // 4. Add subtle Gaussian background thermal noise and clamp between -1 and 1
  for (let tr = 0; tr < numTraces; tr++) {
    const trace = traces[tr];
    for (let s = 0; s < samplesPerTrace; s++) {
      const noise = (Math.random() - 0.5) * 0.04;
      trace[s] = Math.max(-1.0, Math.min(1.0, trace[s] + noise));
    }
  }

  return {
    config,
    strata,
    traces,
    timeAxisNs,
    depthAxisMeters,
    distanceAxisMeters,
  };
}

/**
 * Apply Automatic Gain Control (AGC) to amplify deeper reflections for visual radargram rendering.
 */
export function applyAgc(trace: Float32Array, windowSamples: number): Float32Array {
  const len = trace.length;
  const out = new Float32Array(len);
  const half = Math.floor(windowSamples / 2);

  for (let i = 0; i < len; i++) {
    let sumSq = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j < Math.min(len, i + half); j++) {
      sumSq += trace[j] * trace[j];
      count++;
    }
    const rms = Math.sqrt(sumSq / (count || 1));
    const gain = rms > 0.001 ? 1.0 / rms : 1.0;
    out[i] = Math.max(-1.0, Math.min(1.0, trace[i] * gain * 0.35));
  }
  return out;
}

