/**
 * Subsurface Penetrative Radar (GPR) and Structural Health Monitoring Types.
 * Designed for low-frequency GPR (10-50 MHz) subsurface scanning, MEMS tilt telemetry,
 * and AI inversion for foundation strength and disaster risk prediction.
 */

export type GroundMedium = 'air_void' | 'dry_sand' | 'bedrock_granite' | 'concrete_footing' | 'damp_clay' | 'saturated_soil';

export interface MediumProperties {
  label: string;
  permittivity: number; // Relative dielectric permittivity (epsilon_r)
  conductivity: number; // S/m
  velocity: number;     // m/ns = 0.2998 / sqrt(permittivity)
}

export interface RadarScanConfig {
  centerFrequencyMHz: number; // 10 to 50 MHz
  depthMaxMeters: number;     // Max depth penetration (e.g. 25m)
  transectLengthMeters: number; // Profile length (e.g. 40m)
  numTraces: number;          // Number of A-scan traces along transect
  samplesPerTrace: number;    // Time samples per trace
  timeWindowNs: number;       // Two-way travel time window
}

export interface SubsurfaceAnomaly {
  id: string;
  type: 'void' | 'water_ingress' | 'bedrock_fault' | 'footing_settlement' | 'rebar_corrosion';
  title: string;
  transectMeters: number;
  depthMeters: number;
  extentMeters: number;
  confidence: number; // 0 to 1
  severity: 'low' | 'moderate' | 'high' | 'critical';
  dielectricContrast: number;
  description: string;
  recommendedMitigation: string;
}

export interface SubsurfaceStrata {
  name: string;
  medium: GroundMedium;
  depthStartMeters: number;
  depthEndMeters: number;
  permittivity: number;
  velocity: number;
}

export interface TiltSensorReading {
  sensorId: string;
  location: string; // e.g. 'Pillar C1 - South Footing'
  pitchArcsec: number; // tilt along X in arcseconds (1 arcsec ≈ 0.00485 mrad)
  rollArcsec: number;  // tilt along Y in arcseconds
  pitchMrad: number;
  rollMrad: number;
  driftRateMradPerMonth: number;
  vibrationRmsG: number;
  temperatureC: number;
  status: 'nominal' | 'warning' | 'critical';
}

export interface EdgeDaqStatus {
  deviceType: 'NVIDIA Jetson Orin Nano' | 'Raspberry Pi 5 Edge DAQ';
  gprTransceiverStatus: 'active' | 'standby' | 'calibrating';
  frequencyMHz: number;
  pulseRateKhz: number;
  txPowerWatts: number;
  batteryPercent: number;
  cellularUplink: '5G connected' | '4G LTE' | 'offline';
  sampleRateKhz: number;
  latencyMs: number;
  lastSyncIso: string;
}

export interface RadargramData {
  config: RadarScanConfig;
  strata: SubsurfaceStrata[];
  traces: Float32Array[]; // 2D matrix: traces[transectIndex][timeSampleIndex] amplitude (-1 to 1)
  timeAxisNs: number[];
  depthAxisMeters: number[];
  distanceAxisMeters: number[];
}

export interface FoundationAnalysisResult {
  scanTimestamp: string;
  integrityScore: number; // 0 to 100
  stabilityGrade: 'Optimal' | 'Stable' | 'Caution' | 'Critical';
  bearingCapacityKPa: number;
  settlementRiskPercent: number;
  voidCollapseRiskPercent: number;
  seismicAmplificationFactor: number;
  anomalies: SubsurfaceAnomaly[];
  sensorCluster: TiltSensorReading[];
  edgeDaq: EdgeDaqStatus;
  summary: string;
  contractorActionItems: string[];
}

