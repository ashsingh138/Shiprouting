// src/components/Map/WeatherLayer.jsx
import React from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import { formatDateTime } from '../../utils/formatters';

const WeatherLayer = ({ routeData }) => {
  if (!routeData || !routeData.path || routeData.path.length === 0) return null;

  // Function to determine the color based on wave height
  const getWaveColor = (waveHeight) => {
    if (waveHeight < 2.0) return "#10b981"; // Green (Safe)
    if (waveHeight < 4.0) return "#f59e0b"; // Yellow/Orange (Warning)
    return "#ef4444"; // Red (Danger)
  };

  return (
    <>
      {routeData.path.map((waypoint, index) => {
        // Skip the first and last points so we don't cover the main Start/End markers
        if (index === 0 || index === routeData.path.length - 1) return null;

        return (
          <CircleMarker
            key={index}
            center={[waypoint.lat, waypoint.lon]}
            radius={6}
            pathOptions={{
              color: getWaveColor(waypoint.expected_wave_height_m),
              fillColor: getWaveColor(waypoint.expected_wave_height_m),
              fillOpacity: 0.7,
              weight: 2
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h4 className="font-bold text-gray-800 border-b pb-1 mb-2">Waypoint {index}</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>ETA:</strong> {formatDateTime(waypoint.eta)}</li>
                  <li><strong>Waves:</strong> {waypoint.expected_wave_height_m} m</li>
                  <li><strong>Wind:</strong> {waypoint.expected_wind_speed_knots} kts</li>
                  <li><strong>Speed:</strong> {waypoint.calculated_speed_knots} kts</li>
                </ul>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default WeatherLayer;