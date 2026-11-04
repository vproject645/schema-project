/**
 * Edge DAQ and MEMS Tilt Sensor Array Telemetry.
 * Simulates high-rate edge acquisition (NVIDIA Jetson / RPi 5) with MEMS tri-axial tilt
 * sensors mounted on critical structural foundation columns.
 */

import type { EdgeDaqStatus, TiltSensorReading } from './types';

export function createInitialTiltSensors(): TiltSensorReading[] {
  return [
    {
      sensorId: 'TILT-NW-01',
      location: 'Column A1 (North-West Footing)',
      pitchArcsec: 14.2,
      rollArcsec: -8.1,
      pitchMrad: 14.2 * 0.004848,
      rollMrad: -8.1 * 0.004848,
      driftRateMradPerMonth: 0.04,
      vibrationRmsG: 0.012,
      temperatureC: 18.5,
      status: 'nominal',
    },
    {
      sensorId: 'TILT-NE-02',
      location: 'Column D1 (North-East Footing)',
      pitchArcsec: -18.7,
      rollArcsec: 5.4,
      pitchMrad: -18.7 * 0.004848,
      rollMrad: 5.4 * 0.004848,
      driftRateMradPerMonth: 0.06,
      vibrationRmsG: 0.015,
      temperatureC: 19.1,
      status: 'nominal',
    },
    {
      sensorId: 'TILT-SW-03',
      location: 'Column A4 (South-West Core Footing)',
      pitchArcsec: 84.5, // Significant differential tilt!
      rollArcsec: 62.0,
      pitchMrad: 84.5 * 0.004848, // ~ 0.41 mrad (Warning zone)
      rollMrad: 62.0 * 0.004848,
      driftRateMradPerMonth: 0.28,
      vibrationRmsG: 0.042,
      temperatureC: 21.3,
      status: 'warning',
    },
    {
      sensorId: 'TILT-SE-04',
      location: 'Column D4 (South-East Footing)',
      pitchArcsec: 22.0,
      rollArcsec: -12.3,
      pitchMrad: 22.0 * 0.004848,
      rollMrad: -12.3 * 0.004848,
      driftRateMradPerMonth: 0.05,
      vibrationRmsG: 0.014,
      temperatureC: 18.8,
      status: 'nominal',
    },
  ];
}

export function createInitialEdgeDaq(): EdgeDaqStatus {
  return {
    deviceType: 'NVIDIA Jetson Orin Nano',
    gprTransceiverStatus: 'active',
    frequencyMHz: 25.0,
    pulseRateKhz: 50.0,
    txPowerWatts: 100.0,
    batteryPercent: 96,
    cellularUplink: '5G connected',
    sampleRateKhz: 1000,
    latencyMs: 18,
    lastSyncIso: new Date().toISOString(),
  };
}

/**
 * Perturbs sensor telemetry to simulate live real-time sensor polling.
 */
export function tickTelemetry(
  sensors: TiltSensorReading[],
  daq: EdgeDaqStatus
): { sensors: TiltSensorReading[]; daq: EdgeDaqStatus } {
  const updatedSensors = sensors.map((s) => {
    // Micro-fluctuation
    const jitterArcsec = (Math.random() - 0.5) * 1.5;
    const newPitch = Math.max(-120, Math.min(120, s.pitchArcsec + jitterArcsec));
    const newRoll = Math.max(-120, Math.min(120, s.rollArcsec + jitterArcsec * 0.8));
    const pitchMrad = newPitch * 0.004848;
    const rollMrad = newRoll * 0.004848;
    const magMrad = Math.sqrt(pitchMrad * pitchMrad + rollMrad * rollMrad);

    let status: 'nominal' | 'warning' | 'critical' = 'nominal';
    if (magMrad > 0.6) status = 'critical';
    else if (magMrad > 0.25 || s.driftRateMradPerMonth > 0.15) status = 'warning';

    return {
      ...s,
      pitchArcsec: Number(newPitch.toFixed(1)),
      rollArcsec: Number(newRoll.toFixed(1)),
      pitchMrad: Number(pitchMrad.toFixed(4)),
      rollMrad: Number(rollMrad.toFixed(4)),
      status,
    };
  });

  const updatedDaq: EdgeDaqStatus = {
    ...daq,
    latencyMs: Math.max(12, Math.min(45, Math.round(daq.latencyMs + (Math.random() - 0.5) * 4))),
    lastSyncIso: new Date().toISOString(),
  };

  return { sensors: updatedSensors, daq: updatedDaq };
}

