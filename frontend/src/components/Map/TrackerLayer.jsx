// src/components/Map/TrackerLayer.jsx
import React from 'react';
import { Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// A custom SVG Ship Icon that we can rotate based on heading
const createShipIcon = (heading = 0) => {
  return L.divIcon({
    className: 'clear-background',
    html: `
      <div style="transform: rotate(${heading}deg); width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" fill="#1e3a8a" stroke="#ffffff" stroke-width="1" width="28" height="28" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.5));">
          <path d="M12 2L4 10v9c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-9L12 2z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const TrackerLayer = ({ trackingData }) => {
  if (!trackingData || !trackingData.currentLocation) return null;

  const { pastPath, futurePath, currentLocation, shipDetails } = trackingData;

  return (
    <>
      {/* 1. PAST PATH (Solid Gray Line) */}
      {pastPath && pastPath.length > 0 && (
        <Polyline 
          positions={pastPath} 
          color="#6b7280" 
          weight={4} 
          opacity={0.6} 
        />
      )}

      {/* 2. FUTURE PATH (Dashed Blue Line for the weather-optimized route) */}
      {futurePath && futurePath.length > 0 && (
        <Polyline 
          positions={futurePath} 
          color="#3b82f6" 
          weight={4} 
          dashArray="10, 10" 
          opacity={0.9} 
        >
          <Tooltip sticky>Optimized Future Route</Tooltip>
        </Polyline>
      )}

      {/* 3. CURRENT SHIP LOCATION */}
      <Marker 
        position={[currentLocation.lat, currentLocation.lon]} 
        icon={createShipIcon(currentLocation.heading)}
      >
        <Popup className="custom-popup">
          <div className="font-sans">
            <h3 className="font-bold text-lg text-blue-900 border-b pb-1 mb-2">
              {shipDetails?.name || "Unknown Vessel"}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-700">
              <span className="font-semibold text-gray-500">IMO:</span> 
              <span>{shipDetails?.imo || "N/A"}</span>
              
              <span className="font-semibold text-gray-500">Speed:</span> 
              <span>{currentLocation.speed_knots} kn</span>
              
              <span className="font-semibold text-gray-500">Status:</span> 
              <span className="text-green-600 font-bold">{currentLocation.status || "Underway"}</span>
            </div>
          </div>
        </Popup>
        <Tooltip direction="top" offset={[0, -15]} opacity={1}>
          <span className="font-bold">{shipDetails?.name || "Tracked Ship"}</span>
        </Tooltip>
      </Marker>
    </>
  );
};

export default TrackerLayer;