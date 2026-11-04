'use client';
import type { TiltSensorReading } from '../radar/types';
import { Activity, AlertTriangle, Compass, ShieldCheck, Thermometer } from 'lucide-react';

interface TiltSensorClusterViewProps {
  sensors: TiltSensorReading[];
}

export function TiltSensorClusterView({ sensors }: TiltSensorClusterViewProps) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d5dad9', borderRadius: 12, padding: 18, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>MEMS Tri-Axial Tilt & Pillar Deflection Telemetry</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#5b6872' }}>
            High-precision MEMS inclinometer telemetry mounted on perimeter foundation columns and core footings
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e7d32' }} />
          4 Sensors Online (1000 Hz)
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {sensors.map((sensor) => {
          const isWarning = sensor.status === 'warning';
          const isCritical = sensor.status === 'critical';
          const totalTiltMrad = Math.sqrt(sensor.pitchMrad * sensor.pitchMrad + sensor.rollMrad * sensor.rollMrad);

          return (
            <div
              key={sensor.sensorId}
              style={{
                border: `1px solid ${isCritical ? '#e57373' : isWarning ? '#ffb74d' : '#e0e0e0'}`,
                background: isCritical ? '#fff8f8' : isWarning ? '#fffdf7' : '#fafafa',
                borderRadius: 8,
                padding: 14,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5b6872', textTransform: 'uppercase' }}>
                    {sensor.sensorId}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#14212b' }}>
                    {sensor.location}
                  </div>
                </div>
                <div
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: isCritical ? '#ffebee' : isWarning ? '#fff3e0' : '#e8f5e9',
                    color: isCritical ? '#c62828' : isWarning ? '#ef6c00' : '#2e7d32',
                  }}
                >
                  {sensor.status}
                </div>
              </div>

              {/* Graphic Vector Gauge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    border: '1px solid #b4bdc0',
                    background: '#fff',
                    position: 'relative',
                    display: 'grid',
                    placeItems: 'center',
                    flex: 'none',
                  }}
                >
                  {/* Crosshair */}
                  <div style={{ position: 'absolute', width: '100%', height: 1, background: '#e0e0e0' }} />
                  <div style={{ position: 'absolute', height: '100%', width: 1, background: '#e0e0e0' }} />
                  {/* Deflection point */}
                  <div
                    style={{
                      position: 'absolute',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isCritical ? '#c62828' : isWarning ? '#ef6c00' : '#2e7d32',
                      transform: `translate(${Math.max(-20, Math.min(20, sensor.pitchArcsec * 0.25))}px, ${Math.max(-20, Math.min(20, sensor.rollArcsec * 0.25))}px)`,
                      boxShadow: '0 0 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </div>

                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#5b6872' }}>Total Deflection:</span>
                    <b>{totalTiltMrad.toFixed(3)} mrad</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: '#5b6872' }}>Pitch / Roll:</span>
                    <span>{sensor.pitchArcsec}″ / {sensor.rollArcsec}″</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#5b6872' }}>Monthly Drift:</span>
                    <span style={{ color: sensor.driftRateMradPerMonth > 0.15 ? '#c62828' : '#14212b', fontWeight: 600 }}>
                      +{sensor.driftRateMradPerMonth} mrad/mo
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, borderTop: '1px solid #e0e0e0', paddingTop: 8, fontSize: 11, color: '#5b6872' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Activity size={12} /> {sensor.vibrationRmsG} g RMS
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Thermometer size={12} /> {sensor.temperatureC} °C
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

